const SERVER = window.location.origin;

const BOOK_BASE  = `${SERVER}/api/book`;
const LIB_BASE   = `${SERVER}/api/librarians`;
//const BOOK_BASE  = "http://10.154.86.63:3000/api/book";
//const LIB_BASE   = "http://10.154.86.63:3000/api/librarians";
//const BOOK_BASE  = "http://192.168.1.39:3000/api/book";
//const LIB_BASE   = "http://192.168.1.39:3000/api/librarians";
const token      = localStorage.getItem("token");
const role       = localStorage.getItem("role");

if (!token || role !== "librarian") {
    alert("Access denied. Librarians only.");
    window.location.href = "logLib.html";
}

function authHeaders() { return { "Authorization": `Bearer ${token}` }; }
function jsonHeaders() { return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }; }

let allBooks = [];

function goTo(page)  { window.location.href = page; }
function logout()    { localStorage.clear(); window.location.href = "logLib.html"; }

const ACADEMIC_GENRES     = ["Theses", "Journal", "Research Book", "Text Book"];
const NON_ACADEMIC_GENRES = ["Fiction", "Mystery", "Horror", "Romance", "Adventure", "Historical"];

function populateGenreSelect() {
    const cat = document.getElementById("f_category").value;
    const sel = document.getElementById("f_genre");
    sel.innerHTML = '<option value="">-- Select Genre --</option>';
    const genres = cat === "Academic" ? ACADEMIC_GENRES
        : cat === "Non-Academic"      ? NON_ACADEMIC_GENRES : [];
    genres.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g; opt.textContent = g;
        sel.appendChild(opt);
    });
}

function toggleIsbnRequired() {
    const cat = document.getElementById("f_category").value;
    const el  = document.getElementById("isbnRequired");
    el.innerText = cat === "Non-Academic" ? "* required" : "(optional for Academic)";
}

// ── Available copies live validation ──────────────────────────────────────────
// Called oninput on both total and available fields (wired in openModal below)
function validateAvailable() {
    const totalEl     = document.getElementById("f_total");
    const availEl    = document.getElementById("f_available");
    const total      = Number(totalEl.value);
    const available  = Number(availEl.value);
    const msgEl      = document.getElementById("modalMessage");

    if (available < 0) {
        availEl.value = 0;
    }
    if (total > 0 && available > total) {
        availEl.value = total;    // cap it silently
        msgEl.innerText = "Available copies cannot exceed total copies.";
    } else if (msgEl.innerText === "Available copies cannot exceed total copies.") {
        msgEl.innerText = "";     // clear the warning once valid
    }
}

function openModal(book) {
    stopScanner();
    document.getElementById("modal").style.display = "flex";
    document.getElementById("modalMessage").innerText = "";
    document.getElementById("isbn_status").innerText  = "";
    document.getElementById("isbn_status").className  = "";

    // Wire live validation every time modal opens (safe to call multiple times)
    document.getElementById("f_total").oninput     = validateAvailable;
    document.getElementById("f_available").oninput = validateAvailable;

    if (book) {
        document.getElementById("modalTitle").innerText    = "Edit Book Record";
        document.getElementById("editBookMongoId").value   = book._id;
        document.getElementById("f_isbn").value            = book.isbn     || "";
        document.getElementById("f_title").value           = book.title    || "";
        document.getElementById("f_author").value          = book.author   || "";
        document.getElementById("f_publisher").value       = book.publisher|| "";
        document.getElementById("f_total").value           = book.total_copies;
        document.getElementById("f_available").value       = book.available_copies;
        document.getElementById("f_year").value            = book.publish_year
            ? new Date(book.publish_year).toISOString().split("T")[0] : "";
        document.getElementById("f_category").value        = book.category || "";
        populateGenreSelect();
        toggleIsbnRequired();
        document.getElementById("f_genre").value           = book.genre    || "";
        document.getElementById("preview").innerHTML       = book.image
            ? `<img src="http://localhost:3000${book.image}">` : "Cover";
    } else {
        document.getElementById("modalTitle").innerText    = "Official Accession Record";
        document.getElementById("editBookMongoId").value   = "";
        document.getElementById("f_isbn").value            = "";
        document.getElementById("f_title").value           = "";
        document.getElementById("f_author").value          = "";
        document.getElementById("f_publisher").value       = "";
        document.getElementById("f_total").value           = "";
        document.getElementById("f_available").value       = "";
        document.getElementById("f_year").value            = "";
        document.getElementById("f_category").value        = "";
        document.getElementById("f_genre").value           = "";
        document.getElementById("isbnRequired").innerText  = "";
        document.getElementById("cover").value             = "";
        document.getElementById("preview").innerHTML       = "Cover";
        populateGenreSelect();
    }
}

function closeModal() {
    stopScanner();
    document.getElementById("modal").style.display = "none";
}

window.onclick = e => { if (e.target.id === "modal") closeModal(); };

document.getElementById("cover").addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = evt => {
            document.getElementById("preview").innerHTML = `<img src="${evt.target.result}">`;
        };
        reader.readAsDataURL(file);
    }
});

function setIsbnStatus(msg, cls) {
    const el = document.getElementById("isbn_status");
    el.className = cls;
    el.innerText  = msg;
}

function autofillBook(data, source) {
    const set = (id, val) => { if (val) document.getElementById(id).value = val; };
    set("f_title",    data.title);
    set("f_author",   data.author);
    set("f_publisher",data.publisher);
    if (data.publish_year) {
        const raw = String(data.publish_year);
        document.getElementById("f_year").value =
            /^\d{4}$/.test(raw) ? raw + "-01-01" : raw.slice(0, 10);
    }
    if (source === "db") {
        set("f_total",    String(data.total_copies));
        set("f_available",String(data.available_copies));
        if (data.category) {
            document.getElementById("f_category").value = data.category;
            populateGenreSelect();
            toggleIsbnRequired();
        }
        if (data.genre) document.getElementById("f_genre").value = data.genre;
    }
}

async function lookupISBN() {
    const isbn = document.getElementById("f_isbn").value.trim();
    if (!isbn) { setIsbnStatus("Please enter an ISBN first.", "error"); return; }
    setIsbnStatus("🔍 Checking database…", "loading");

    try {
        const res = await fetch(`${BOOK_BASE}/getByISBN/${encodeURIComponent(isbn)}`);
        if (res.ok) {
            autofillBook(await res.json(), "db");
            setIsbnStatus("✅ Found in library — fields autofilled.", "found");
            return;
        }
    } catch (_) {}

    setIsbnStatus("Not in DB — searching Google Books…", "loading");
    try {
        const gRes  = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
        const gData = await gRes.json();
        if (gData.totalItems > 0) {
            const info = gData.items[0].volumeInfo;
            autofillBook({ title: info.title, author: (info.authors||[]).join(", "),
                publisher: info.publisher, publish_year: info.publishedDate }, "google");
            setIsbnStatus("✅ Found on Google Books — fields autofilled.", "found");
            return;
        }
    } catch (_) {}

    setIsbnStatus("Trying Open Library…", "loading");
    try {
        const oRes  = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
        const oData = await oRes.json();
        const key   = `ISBN:${isbn}`;
        if (oData[key]) {
            const b = oData[key];
            autofillBook({ title: b.title,
                author:    (b.authors   ||[]).map(a=>a.name).join(", "),
                publisher: (b.publishers||[]).map(p=>p.name).join(", "),
                publish_year: b.publish_date }, "openlibrary");
            setIsbnStatus("Found on Open Library — fields autofilled.", "found");
            return;
        }
    } catch (_) {}

    setIsbnStatus("Not found. Please enter details manually.", "notfound");
}

let html5QrCode    = null;
let scannerRunning = false;

async function toggleScanner() {
    if (scannerRunning) { await stopScanner(); return; }

    document.getElementById("scanBtn").innerHTML = '<i class="fa fa-stop"></i> Stop';
    scannerRunning = true;
    setIsbnStatus("Starting camera…", "loading");
    document.getElementById("scanner-container").innerHTML = "";

    html5QrCode = new Html5Qrcode("scanner-container");
    try {
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
            setIsbnStatus("No camera found.", "error");
            await stopScanner(); return;
        }
        const preferred = devices.find(d =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
        ) || devices[0];

        setIsbnStatus("Point camera at the barcode…", "loading");

        await html5QrCode.start(
            preferred.id,
            { fps: 10, qrbox: { width: 260, height: 100 } },
            async (decoded) => {
                const clean = decoded.trim();
                if (/^\d{9,13}[\dX]?$/.test(clean)) {
                    document.getElementById("f_isbn").value = clean;
                    await stopScanner();
                    await lookupISBN();
                }
            },
            () => {}
        );
    } catch (err) {
        setIsbnStatus("Camera error: " + err, "error");
        await stopScanner();
    }
}

async function stopScanner() {
    document.getElementById("scanBtn").innerHTML = '<i class="fa fa-camera"></i> Scan';
    scannerRunning = false;
    if (html5QrCode) {
        try {
            const state = html5QrCode.getState();
            if (state === 2) await html5QrCode.stop();
            html5QrCode.clear();
        } catch (_) {}
        html5QrCode = null;
    }
    document.getElementById("scanner-container").innerHTML = "";
    const overlay = document.getElementById("scanOverlay");
    if (overlay) overlay.style.display = "none";
}

async function submitBook() {
    const msg     = document.getElementById("modalMessage");
    const mongoId = document.getElementById("editBookMongoId").value;
    const isEdit  = !!mongoId;

    const title            = document.getElementById("f_title").value.trim();
    const author           = document.getElementById("f_author").value.trim();
    const isbn             = document.getElementById("f_isbn").value.trim();
    const total_copies     = Number(document.getElementById("f_total").value);
    const available_copies = Number(document.getElementById("f_available").value);
    const publisher        = document.getElementById("f_publisher").value.trim();
    const publish_year     = document.getElementById("f_year").value.trim();
    const category         = document.getElementById("f_category").value.trim();
    const genre            = document.getElementById("f_genre").value.trim();
    const imageFile        = document.getElementById("cover").files[0];

    if (!category) { msg.innerText = "Please select a category."; return; }
    if (category === "Non-Academic" && !isbn) {
        msg.innerText = "ISBN is required for Non-Academic books."; return;
    }
    if (!title || !author || !total_copies || !publisher || !publish_year || !genre) {
        msg.innerText = "Please fill in all required fields."; return;
    }

    // ── Validate available copies ≤ total copies ──────────────────────────────
    if (available_copies < 0) {
        msg.innerText = "Available copies cannot be negative."; return;
    }
    if (available_copies > total_copies) {
        msg.innerText = "Available copies cannot exceed total copies."; return;
    }

    if (!isEdit && !imageFile) { msg.innerText = "Please upload a cover image."; return; }

    msg.innerText = isEdit ? "Saving changes..." : "Adding book...";

    if (isEdit) {
        const body = { title, author, isbn,
            total_copies, available_copies,
            publisher, publish_year, category, genre };
        try {
            const res  = await fetch(`${LIB_BASE}/books/${mongoId}`, {
                method: "PUT", headers: jsonHeaders(), body: JSON.stringify(body)
            });
            const data = await res.json();
            msg.innerText = data.message;
            if (res.ok) { closeModal(); loadBooks(); }
        } catch (err) { msg.innerText = "Cannot connect to server."; }
    } else {
        const formData = new FormData();
        if (isbn) formData.append("isbn", isbn);
        formData.append("title",            title);
        formData.append("author",           author);
        formData.append("total_copies",     total_copies);
        formData.append("available_copies", available_copies);
        formData.append("publisher",        publisher);
        formData.append("publish_year",     publish_year);
        formData.append("category",         category);
        formData.append("genre",            genre);
        formData.append("image",            imageFile);
        try {
            const res  = await fetch(`${BOOK_BASE}/addBook`, {
                method: "POST", headers: authHeaders(), body: formData
            });
            const data = await res.json();
            msg.innerText = data.message;
            if (res.ok) { closeModal(); loadBooks(); }
        } catch (err) { msg.innerText = "Cannot connect to server."; }
    }
}

async function loadBooks() {
    const msg = document.getElementById("tableMessage");
    msg.innerText = "";
    try {
        const res  = await fetch(`${BOOK_BASE}/getBooks`);
        const data = await res.json();
        allBooks   = res.ok ? data : [];
        filterBooks();
    } catch (err) { msg.innerText = "Cannot connect to server."; }
}

function filterBooks() {
    const q     = document.getElementById("searchInput").value.toLowerCase();
    const tbody = document.getElementById("booksTableBody");
    const msg   = document.getElementById("tableMessage");
    tbody.innerHTML = "";

    let filtered = allBooks.filter(b =>
        !q ||
        (b.title     || "").toLowerCase().includes(q) ||
        (b.author    || "").toLowerCase().includes(q) ||
        (b.isbn      || "").toLowerCase().includes(q) ||
        (b.genre     || "").toLowerCase().includes(q) ||
        (b.publisher || "").toLowerCase().includes(q) ||
        (b.category  || "").toLowerCase().includes(q)
    );

    if (filtered.length === 0) { msg.innerText = "No books found."; return; }
    msg.innerText = "";

    filtered.forEach(book => {
        const tr    = document.createElement("tr");
        const year  = book.publish_year ? new Date(book.publish_year).getFullYear() : "—";
        const added = book.createdAt    ? new Date(book.createdAt).toLocaleDateString() : "—";
        tr.innerHTML = `
            <td>
                <button class="btn-show" onclick="showImg('${book.image}', '${(book.title||'').replace(/'/g,"\\'")}')">Show</button>
            </td>
            <td title="${book.title || ""}">${book.title}</td>
            <td title="${book.author || ""}">${book.author}</td>
            <td title="${book.isbn || ""}">${book.isbn || "—"}</td>
            <td>${book.category || "—"}</td>
            <td>${book.genre || "—"}</td>
            <td title="${book.publisher || ""}">${book.publisher}</td>
            <td>${year}</td>
            <td>${book.total_copies}</td>
            <td>${book.available_copies}</td>
            <td>${added}</td>
            <td>
                <div class="actions" style="justify-content:center;">
                    <button class="btn-accept" onclick='openModal(${JSON.stringify(book).replace(/'/g, "&#39;")})'>
                        <i class="fa fa-pen"></i> Edit
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function showImg(url, title) {
    document.getElementById("popupImg").src = url;
    document.getElementById("popupTitle").innerText = title;
    document.getElementById("imgPopup").classList.add("active");
}
function closeImgPopup() {
    document.getElementById("imgPopup").classList.remove("active");
}
document.getElementById("imgPopup").addEventListener("click", function(e) {
    if (e.target === this) closeImgPopup();
});

loadBooks();