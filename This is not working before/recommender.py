"""
recommender.py — NumPy-based Smart Recommendation Engine
=========================================================
No ML library needed — pure Python + NumPy + Flask.

Features:
  1. Personalized scoring  (borrow +3, favorite +2, search +1)
  2. Collaborative filtering ("users like you")
  3. Popularity ranking     (trending / top picks)
  4. Search boosting        (query matches boost score)
  5. Category-based suggestions
  6. Cold-start handling    (new users get popular books)
  7. Real-time             (recalculates on every request — no retraining)

Run:  python recommender.py
Port: http://localhost:5001
"""

from flask import Flask, jsonify, request as freq
from flask_cors import CORS
from pymongo import MongoClient
import numpy as np
import os, re
from collections import defaultdict

app  = Flask(__name__)
CORS(app)

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/ccit_library")
client    = MongoClient(MONGO_URI)

# Safely get the database: prefer the name embedded in the URI,
# fall back to "ccit_library" if the URI has no database component.
# This prevents a crash when using Atlas URIs like ...mongodb.net/?retryWrites=true
try:
    db = client.get_default_database()
except Exception:
    db = client["ccit_library"]

W_BORROW   = 3   # Accepted / Borrowed / Returned
W_FAVORITE = 3
W_SEARCH   = 3

# Category relationships — for category-based suggestions
RELATED_CATEGORIES = {
    "Academic":     ["Academic"],
    "Non-Academic": ["Non-Academic"],
    # genre-level relations
    "Theses":        ["Research Book", "Journal"],
    "Journal":       ["Theses", "Research Book"],
    "Research Book": ["Theses", "Journal", "Text Book"],
    "Text Book":     ["Research Book"],
    "Fiction":       ["Adventure", "Mystery", "Historical"],
    "Mystery":       ["Fiction", "Horror"],
    "Horror":        ["Mystery", "Fiction"],
    "Romance":       ["Fiction", "Historical"],
    "Adventure":     ["Fiction", "Historical"],
    "Historical":    ["Adventure", "Romance"],
}

POSITIVE_STATUSES = {"Accepted", "PickedUp", "Returned", "Lost"}

def load_books():
    # Only return books that have an isbn — books without one can't be recommended
    return [b for b in db.shelf_as.find({}, {
        "isbn":1,"title":1,"author":1,
        "genre":1,"category":1,"publisher":1,"available_copies":1
    }) if b.get("isbn")]

def load_students():
    return list(db.students.find({}, {
        "stu_id":1,"favorites":1,"search_log":1
    }))

def load_requests():
    return [r for r in db.requests.find(
        {"status": {"$in": list(POSITIVE_STATUSES)}},
        {"stu_id":1,"isbn":1,"status":1}
    ) if r.get("stu_id") and r.get("isbn")]


# ══════════════════════════════════════════════════════════════════════════
#  FEATURE: Personal Score Vector
#  Builds a score map {isbn: score} for one student
# ══════════════════════════════════════════════════════════════════════════

def personal_scores(stu_id, books, requests, stu_doc):
    scores = defaultdict(float)
    book_map = {b["isbn"]: b for b in books}  # safe — load_books() already filtered

    # Borrow history
    for r in requests:
        if r.get("stu_id") == stu_id and r.get("isbn") in book_map:
            scores[r["isbn"]] += W_BORROW

    # Favorites
    for fav in (stu_doc or {}).get("favorites", []):
        bid = fav.get("isbn","")
        if bid in book_map:
            scores[bid] += W_FAVORITE

    # Search log — match terms against book fields
    for entry in (stu_doc or {}).get("search_log", []):
        term = entry.get("term","").lower().strip()
        if len(term) < 2:
            continue
        for book in books:
            haystack = " ".join([
                book.get("title",""),
                book.get("author",""),
                book.get("genre",""),
                book.get("category",""),
                book.get("publisher",""),
            ]).lower()
            if term in haystack:
                scores[book["isbn"]] += W_SEARCH

    return scores


# ══════════════════════════════════════════════════════════════════════════
#  FEATURE: Collaborative Filtering
#  "Users Like You" — cosine similarity between student score vectors
# ══════════════════════════════════════════════════════════════════════════

def collaborative_scores(stu_id, books, requests, all_students):
    book_ids = [b["isbn"] for b in books]   # safe — load_books() already filtered
    book_idx = {bid: i for i, bid in enumerate(book_ids)}
    n_books  = len(book_ids)

    stu_map  = {}
    stu_docs = {s["stu_id"]: s for s in all_students if s.get("stu_id")}

    all_ids = list({r.get("stu_id") for r in requests if r.get("stu_id")} | set(stu_docs.keys()))
    for sid in all_ids:
        vec  = np.zeros(n_books)
        doc  = stu_docs.get(sid, {})
        for r in requests:
            if r.get("stu_id") == sid and r.get("isbn") in book_idx:
                vec[book_idx[r["isbn"]]] += W_BORROW
        for fav in doc.get("favorites", []):
            if fav.get("isbn","") in book_idx:
                vec[book_idx[fav["isbn"]]] += W_FAVORITE
        stu_map[sid] = vec

    if stu_id not in stu_map or np.sum(stu_map[stu_id]) == 0:
        return {}

    target_vec = stu_map[stu_id]

    def cosine(a, b):
        denom = (np.linalg.norm(a) * np.linalg.norm(b))
        return float(np.dot(a, b) / denom) if denom > 0 else 0.0

    similarities = {}
    for sid, vec in stu_map.items():
        if sid != stu_id:
            sim = cosine(target_vec, vec)
            if sim > 0:
                similarities[sid] = sim

    if not similarities:
        return {}

    collab_vec = np.zeros(n_books)
    total_sim  = 0.0
    for sid, sim in sorted(similarities.items(), key=lambda x: -x[1])[:10]:
        collab_vec += sim * stu_map[sid]
        total_sim  += sim

    if total_sim > 0:
        collab_vec /= total_sim

    return {book_ids[i]: float(collab_vec[i]) for i in range(n_books) if collab_vec[i] > 0}


# ══════════════════════════════════════════════════════════════════════════
#  FEATURE: Popularity Ranking
# ══════════════════════════════════════════════════════════════════════════

def popularity_scores(books, requests, all_students):
    scores = defaultdict(float)
    for r in requests:
        if r.get("isbn"):
            scores[r["isbn"]] += W_BORROW
    for stu in all_students:
        for fav in stu.get("favorites", []):
            if fav.get("isbn"):
                scores[fav["isbn"]] += W_FAVORITE
    return dict(scores)


# ══════════════════════════════════════════════════════════════════════════
#  FEATURE: Search Boost
#  Boosts scores of books that match the current search query
# ══════════════════════════════════════════════════════════════════════════

def search_boost(query, books):
    if not query:
        return {}
    q = query.lower().strip()
    boost = {}
    for book in books:
        haystack = " ".join([
            book.get("title",""), book.get("author",""),
            book.get("genre",""), book.get("category",""),
        ]).lower()
        if q in haystack:
            # Exact title match gets higher boost
            if q in book.get("title","").lower():
                boost[book["isbn"]] = 3.0
            else:
                boost[book["isbn"]] = 1.5
    return boost


# ══════════════════════════════════════════════════════════════════════════
#  FEATURE: Category-Based Suggestions
#  Adds a small bonus to books in related genres/categories
# ══════════════════════════════════════════════════════════════════════════

def category_bonus(stu_doc, books, requests):
    # Find the student's preferred genres/categories from history
    genre_counts = defaultdict(int)
    cat_counts   = defaultdict(int)
    book_map     = {b["isbn"]: b for b in books}

    for fav in (stu_doc or {}).get("favorites", []):
        b = book_map.get(fav.get("isbn",""))
        if b:
            if b.get("genre"):    genre_counts[b["genre"]]    += 1
            if b.get("category"): cat_counts[b["category"]]   += 1

    bonus = defaultdict(float)
    preferred_genres = set(genre_counts.keys())
    preferred_cats   = set(cat_counts.keys())

    # Expand with related genres
    related = set()
    for g in preferred_genres:
        related.update(RELATED_CATEGORIES.get(g, []))

    for book in books:
        bg = book.get("genre","")
        bc = book.get("category","")
        if bg in preferred_genres or bc in preferred_cats:
            bonus[book["isbn"]] += 1.0
        elif bg in related:
            bonus[book["isbn"]] += 0.5

    return dict(bonus)


# ══════════════════════════════════════════════════════════════════════════
#  MAIN RECOMMENDATION ENDPOINT
# ══════════════════════════════════════════════════════════════════════════

@app.route("/recommend/<stu_id>", methods=["GET"])
def recommend(stu_id):
    try:
        n        = int(freq.args.get("n", 6))
        query    = freq.args.get("q", "").strip()   # optional live search query
        mode     = freq.args.get("mode", "personal") # personal | trending | similar

        books        = load_books()
        requests_    = load_requests()
        all_students = load_students()

        if not books:
            return jsonify({"recommendations": [], "reason": "No books in system."})

        book_map = {b["isbn"]: b for b in books}
        stu_doc  = next((s for s in all_students if s.get("stu_id") == stu_id), None)

        print("\n===== DEBUG START =====")
        print("TARGET STU_ID:", stu_id)

        print("\nALL STUDENT IDS:")
        print([s.get("stu_id") for s in all_students[:10]])

        print("\nALL REQUEST STU_IDS:")
        print([r.get("stu_id") for r in requests_[:10]])

        print("\nMATCHED STUDENT DOC:")
        print(stu_doc)

        print("\nFAVORITES RAW:")
        print((stu_doc or {}).get("favorites"))

        print("\nSEARCH LOG RAW:")
        print((stu_doc or {}).get("search_log"))

        print("\nREQUEST MATCH COUNT:")
        print(len([r for r in requests_ if r.get("stu_id") == stu_id]))

        print("===== DEBUG END =====\n")


        # Books the student already has active interactions with
        interacted = {
                         r["isbn"] for r in requests_ if r["stu_id"] == stu_id
                     } | {
                         fav.get("isbn","") for fav in (stu_doc or {}).get("favorites", [])
                     }

        # ── MODE: TRENDING ─────────────────────────────────────────────────
        if mode == "trending":
            pop = popularity_scores(books, requests_, all_students)
            ranked = sorted(
                [(bid, s) for bid, s in pop.items() if bid in book_map],
                key=lambda x: -x[1]
            )[:n]
            recs = _format(ranked, book_map)
            return jsonify({"recommendations": recs, "reason": "trending"})

        # ── COLD START — no personal data ──────────────────────────────────
        has_data = (
                any(r["stu_id"] == stu_id for r in requests_) or
                bool((stu_doc or {}).get("favorites")) or
                bool((stu_doc or {}).get("search_log"))
        )

        if not has_data:
            print("DEBUG: No data detected for user", stu_id)
            pop    = popularity_scores(books, requests_, all_students)
            boost  = search_boost(query, books)
            merged = defaultdict(float)
            for bid, s in pop.items():   merged[bid] += s
            for bid, s in boost.items(): merged[bid] += s
            ranked = sorted(
                [(bid, s) for bid, s in merged.items() if bid in book_map],
                key=lambda x: -x[1]
            )[:n]
            recs = _format(ranked, book_map)
            return jsonify({"recommendations": recs, "reason": "popular"})

        # ── PERSONALISED ───────────────────────────────────────────────────
        personal  = personal_scores(stu_id, books, requests_, stu_doc)
        collab    = collaborative_scores(stu_id, books, requests_, all_students)
        pop       = popularity_scores(books, requests_, all_students)
        boost     = search_boost(query, books)
        cat_bonus = category_bonus(stu_doc, books, requests_)

        # Merge all signals
        merged = defaultdict(float)
        for bid in book_map:
            merged[bid] += personal.get(bid, 0) * 1.0
            merged[bid] += collab.get(bid, 0)   * 0.8   # collaborative slightly less
            merged[bid] += pop.get(bid, 0)       * 0.3   # popularity as tiebreaker
            merged[bid] += boost.get(bid, 0)     * 2.0   # search query is strong signal
            merged[bid] += cat_bonus.get(bid, 0) * 0.5

        # Only remove if we still have enough candidates
        filtered = {bid: score for bid, score in merged.items() if bid not in interacted}

        if len(filtered) >= n:
            merged = filtered
        ranked = sorted(merged.items(), key=lambda x: -x[1])[:n]

        if not ranked:
            # FINAL fallback → include interacted books
            fallback = sorted(
                [(bid, personal.get(bid, 0)) for bid in book_map if personal.get(bid, 0) > 0],
                key=lambda x: -x[1]
            )[:n]

            if fallback:
                recs = _format(fallback, book_map)
                return jsonify({"recommendations": recs, "reason": "from_your_activity"})
            # Fallback to popularity if no candidates
            pop_ranked = sorted(
                [(bid, s) for bid, s in pop.items()
                 if bid in book_map and bid not in interacted],
                key=lambda x: -x[1]
            )[:n]
            recs = _format(pop_ranked, book_map)
            return jsonify({"recommendations": recs, "reason": "popular_fallback"})

        recs = _format(ranked, book_map)
        return jsonify({"recommendations": recs, "reason": "personalized"})

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════
#  TRENDING BOOKS (standalone endpoint)
# ══════════════════════════════════════════════════════════════════════════

@app.route("/trending", methods=["GET"])
def trending():
    try:
        n     = int(freq.args.get("n", 6))
        books = load_books()
        reqs  = load_requests()
        stus  = load_students()
        pop   = popularity_scores(books, reqs, stus)
        book_map = {b["isbn"]: b for b in books}
        ranked = sorted(
            [(bid, s) for bid, s in pop.items() if bid in book_map],
            key=lambda x: -x[1]
        )[:n]

        # Count how many distinct students have contributed any interaction signal
        # (borrow, favorite, or search). Frontend only shows trending if >= 10.
        active_student_ids = set()
        for r in reqs:
            if r.get("stu_id"):
                active_student_ids.add(r["stu_id"])
        for s in stus:
            if s.get("favorites") or s.get("search_log"):
                active_student_ids.add(s.get("stu_id",""))
        active_student_ids.discard("")

        return jsonify({
            "trending":       _format(ranked, book_map),
            "student_count":  len(active_student_ids),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════
#  HELPER
# ══════════════════════════════════════════════════════════════════════════

def _format(ranked, book_map):
    result = []
    for bid, score in ranked:
        b = book_map.get(bid)
        if b:
            result.append({
                "isbn":  b["isbn"],
                "title":    b["title"],
                "author":   b.get("author",""),
                "genre":    b.get("genre",""),
                "category": b.get("category",""),
                "score":    round(float(score), 3),
            })
    return result

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/debug")
def debug():
    """Visit http://localhost:5001/debug to diagnose collection issues."""
    try:
        books    = load_books()
        students = load_students()
        requests = load_requests()
        return jsonify({
            "books_found":    len(books),
            "students_found": len(students),
            "requests_found": len(requests),
            "sample_book":    books[0]    if books    else None,
            "sample_student": {
                "stu_id":        students[0].get("stu_id"),
                "favorites_len": len(students[0].get("favorites", [])),
                "search_log_len":len(students[0].get("search_log", [])),
            } if students else None,
        })
    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

if __name__ == "__main__":
    print("Smart Recommender running on http://localhost:5001")
    print("Install: pip install flask flask-cors pymongo numpy")
    app.run(host="0.0.0.0", port=5001, debug=False)
    #app.run(port=5001, debug=False)