const SERVER = window.location.origin;

const LIB_BASE   = `${SERVER}/api/librarians`;
//const LIB_BASE   = "http://10.154.86.63:3000/api/librarians";
//const LIB_BASE   = "http://192.168.1.39:3000/api/librarians";

const token      = localStorage.getItem("token");
const role       = localStorage.getItem("role");

if (!token || role !== "librarian") {
    alert("Access denied. Librarians only.");
    window.location.href = "logLib.html";
}

let allRequests = [];

function goTo(page) { window.location.href = page; }
function logout()   { localStorage.clear(); window.location.href = "logLib.html"; }

function jsonHeaders() {
    return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
}

async function loadRequests() {
    const message = document.getElementById("req_message");
    message.innerText = "Loading...";
    try {
        const res  = await fetch(`${LIB_BASE}/requests`, { headers: jsonHeaders() });
        const data = await res.json();
        allRequests = res.ok ? data.filter(r => r.status === "Pending") : [];
        renderRequests();
    } catch (err) {
        message.innerText = "Cannot connect to server.";
    }
}

function renderRequests() {
    const tbody   = document.getElementById("requests-list");
    const message = document.getElementById("req_message");
    const empty   = document.getElementById("empty-state");
    const search  = document.getElementById("reqSearch").value.toLowerCase();

    tbody.innerHTML = "";

    const filtered = allRequests.filter(req => {
        const matchSearch = !search ||
            (req.student_name || "").toLowerCase().includes(search) ||
            (req.stu_id       || "").toLowerCase().includes(search) ||
            (req.book_title   || "").toLowerCase().includes(search);
        return matchSearch;
    });

    if (filtered.length === 0) {
        message.innerText = "No pending requests.";
        empty.style.display = "block";
        return;
    }

    message.innerText = "";
    empty.style.display = "none";

    filtered.forEach(req => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                <td>${req.student_name || "—"}</td>
                <td>${req.stu_id       || "—"}</td>
                <td>${req.yearAndSection || "—"}</td>
                <td>${req.book_title   || "—"}</td>
                <td>${req.isbn         || "—"}</td>
                <td>${req.request_time ? new Date(req.request_time).toLocaleString() : "—"}</td>
                <td>
                    <div class="actions" style="justify-content:center;">
                        <button class="btn-accept" onclick="respond('${req._id}','Accepted')">
                            <i class="fa fa-check"></i> Accept
                        </button>
                        <button class="btn-decline" onclick="respond('${req._id}','Declined')">
                            <i class="fa fa-times"></i> Decline
                        </button>
                    </div>
                </td>
            `;
        tbody.appendChild(tr);
    });
}

async function respond(requestId, status) {
    const message = document.getElementById("req_message");
    const label   = status === "Accepted" ? "accept" : "decline";
    if (!confirm(`Are you sure you want to ${label} this request?`)) return;
    try {
        const res  = await fetch(`${LIB_BASE}/requests/${requestId}`, {
            method:  "PUT",
            headers: jsonHeaders(),
            body:    JSON.stringify({ status })  // no remarks field
        });
        const data = await res.json();
        message.innerText = data.message || (res.ok ? "Request updated." : "Failed.");
        if (res.ok) loadRequests();
    } catch (err) {
        message.innerText = "Cannot connect to server.";
    }
}

loadRequests();