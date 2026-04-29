const SERVER = window.location.origin;

const LIB_BASE = `${SERVER}/api/librarians`;
//const LIB_BASE = "http://10.154.86.63:3000/api/librarians";
//const LIB_BASE = "http://192.168.1.39:3000/api/librarians";

const token    = localStorage.getItem("token");
const role     = localStorage.getItem("role");

if (!token || role !== "librarian") {
    alert("Access denied. Librarians only.");
    window.location.href = "logLib.html";
}

const STATUS_MAP = {
    Accepted:  "To Be Picked Up",
    PickedUp:  "To Be Returned",
    Returned:  "Returned",
    Lost:      "Lost",
    Cancelled: "Cancelled"
};

let borrowedTransactions = [];

function goTo(page) { window.location.href = page; }

function jsonHeaders() {
    return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
}

async function loadBorrowedBooks() {
    const message = document.getElementById("borrowed_message");
    message.innerText = "Loading...";

    try {
        const res = await fetch(`${LIB_BASE}/requests`, { headers: jsonHeaders() });
        const data = await res.json();
        borrowedTransactions = res.ok
            ? data.filter((item) => item.status !== "Pending" && item.status !== "Declined")
            : [];
        renderBorrowedBooks();
    } catch (err) {
        message.innerText = "Cannot connect to server.";
    }
}

function renderBorrowedBooks() {
    const tbody = document.getElementById("requests-list");
    const empty = document.getElementById("empty-state");
    const message = document.getElementById("borrowed_message");
    const search = document.getElementById("borrowedSearch").value.toLowerCase();
    const statusFilter = document.getElementById("borrowedStatusFilter").value;

    tbody.innerHTML = "";

    const filtered = borrowedTransactions.filter((item) => {
        const matchSearch = !search ||
            (item.student_name || "").toLowerCase().includes(search) ||
            (item.stu_id || "").toLowerCase().includes(search) ||
            (item.book_title || "").toLowerCase().includes(search);
        const matchStatus = statusFilter === "all" || item.status === statusFilter;
        return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
        message.innerText = "No borrowed-book records found.";
        empty.style.display = "block";
        return;
    }

    message.innerText = "";
    empty.style.display = "none";

    filtered.forEach((item) => {
        const tr = document.createElement("tr");
        let actions = "-";

        if (item.status === "Accepted") {
            actions = `<button class="btn-accept" onclick="markPickedUp('${item._id}')">Picked Up</button>`;
        } else if (item.status === "PickedUp") {
            actions = `
                    <div class="actions">
                        <button class="btn-accept" onclick="openCondModal('${item._id}')">Returned</button>
                        <button class="btn-decline" onclick="markLost('${item._id}')">Lost</button>
                    </div>
                `;
        }

        tr.innerHTML = `
                <td>${item.student_name || "-"}</td>
                <td>${item.stu_id || "-"}</td>
                <td>${item.book_title || "-"}</td>
                <td>${STATUS_MAP[item.status] || item.status || "-"}</td>
                <td>${item.book_condition || "-"}</td>
                <td>${item.request_time ? new Date(item.request_time).toLocaleString() : "-"}</td>
                <td>${item.responded_time ? new Date(item.responded_time).toLocaleString() : "-"}</td>
                <td>${actions}</td>
            `;
        tbody.appendChild(tr);
    });
}

async function markPickedUp(requestId) {
    const message = document.getElementById("borrowed_message");
    if (!confirm("Mark this book as picked up?")) return;

    try {
        const res = await fetch(`${LIB_BASE}/requests/${requestId}/pickedup`, {
            method: "PUT",
            headers: jsonHeaders()
        });
        const data = await res.json();
        message.innerText = data.message || (res.ok ? "Done." : "Failed.");
        if (res.ok) {
            loadBorrowedBooks();
        }
    } catch (err) {
        message.innerText = "Cannot connect to server.";
    }
}

function openCondModal(requestId) {
    document.getElementById("condRequestId").value = requestId;
    document.getElementById("condSelect").value = "Good";
    document.getElementById("condRemarks").value = "";
    document.getElementById("cond_message").innerText = "";
    document.getElementById("condModal").style.display = "flex";
}

function closeCondModal() {
    document.getElementById("condModal").style.display = "none";
}

async function submitReturn() {
    const requestId = document.getElementById("condRequestId").value;
    const condition = document.getElementById("condSelect").value;
    const remarks   = document.getElementById("condRemarks").value.trim();
    const modalMessage = document.getElementById("cond_message");
    const pageMessage  = document.getElementById("borrowed_message");

    try {
        const res = await fetch(`${LIB_BASE}/requests/${requestId}/returned`, {
            method:  "PUT",
            headers: jsonHeaders(),
            body:    JSON.stringify({ condition, remarks: remarks || null })
        });
        const data = await res.json();

        if (res.ok) {
            closeCondModal();
            pageMessage.innerText = data.message || "Book returned.";
            loadBorrowedBooks();
        } else {
            modalMessage.innerText = data.message || "Failed.";
        }
    } catch (err) {
        modalMessage.innerText = "Cannot connect to server.";
    }
}

async function markLost(requestId) {
    const message = document.getElementById("borrowed_message");
    if (!confirm("Mark this book as LOST?")) return;

    try {
        const res = await fetch(`${LIB_BASE}/requests/${requestId}/lost`, {
            method: "PUT",
            headers: jsonHeaders()
        });
        const data = await res.json();
        message.innerText = data.message || (res.ok ? "Done." : "Failed.");
        if (res.ok) {
            loadBorrowedBooks();
        }
    } catch (err) {
        message.innerText = "Cannot connect to server.";
    }
}

loadBorrowedBooks();