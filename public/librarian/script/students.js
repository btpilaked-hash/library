// students.js — loaded by Bstudents.html (librarian student view)
// Shows PIN column. No edit/delete — read + hold/unhold only via librarianControl.

//const LIB_BASE  = "http://localhost:3000/api/librarians";
//const STU_BASE  = "http://localhost:3000/api/students";
const SERVER = window.location.origin;

const LIB_BASE  = `${SERVER}/api/librarians`;
const STU_BASE  = `${SERVER}/api/students`;

const token = localStorage.getItem("token");
const role  = localStorage.getItem("role");

if (!token || role !== "librarian") {
    alert("Access denied. Librarians only.");
    window.location.href = "logLib.html";
}

function goTo(page)  { window.location.href = page; }
function logout()    { localStorage.clear(); window.location.href = "logLib.html"; }
function jsonHeaders(){ return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }; }

let allStudents = [];

function openStudentModal()  { document.getElementById("student-modal").style.display = "flex"; }
function closeStudentModal() { document.getElementById("student-modal").style.display = "none"; }

// Build "BSCS 1-A" from separate dropdowns
function buildYearAndSection() {
    const course  = document.getElementById("m_course").value;
    const yearNum = document.getElementById("m_yearNum").value;
    const section = document.getElementById("m_sectionLetter").value;
    if (!course || !yearNum || !section) return null;
    return `${course} ${yearNum}-${section}`;
}

async function registerStudent() {
    const message        = document.getElementById("modal_regS_message");
    const yearAndSection = buildYearAndSection();
    if (!yearAndSection) { message.innerText = "Please select Course, Year, and Section."; return; }

    const pin = document.getElementById("m_pin").value.trim();
    if (!/^\d{1,6}$/.test(pin)) { message.innerText = "PIN must be up to 6 digits (numbers only)."; return; }

    const body = {
        stu_id: document.getElementById("m_stu_id").value.trim(),
        fName:  document.getElementById("m_fName").value.trim(),
        mName:  document.getElementById("m_mName").value.trim(),
        lName:  document.getElementById("m_lName").value.trim(),
        yearAndSection,
        pin,
    };
    if (Object.values(body).some(v => !v)) { message.innerText = "Please fill in all fields."; return; }

    try {
        const res  = await fetch(`${STU_BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        message.innerText = data.message || (res.ok ? "Student registered." : "Failed.");
        if (res.ok) {
            ["m_stu_id","m_fName","m_mName","m_lName","m_pin"]
                .forEach(id => document.getElementById(id).value = "");
            ["m_course","m_yearNum","m_sectionLetter"]
                .forEach(id => document.getElementById(id).value = "");
            closeStudentModal();
            loadStudents();
        }
    } catch (err) { message.innerText = "Cannot connect to server."; }
}

async function loadStudents() {
    const message = document.getElementById("students_message");
    try {
        const res  = await fetch(`${LIB_BASE}/students`, { headers: jsonHeaders() });
        const data = await res.json();
        allStudents = res.ok ? data : [];
        renderStudents();
    } catch (err) { message.innerText = "Cannot connect to server."; }
}

function renderStudents() {
    const tbody   = document.getElementById("student-table-body");
    const message = document.getElementById("students_message");
    const search  = document.getElementById("stuSearch").value.toLowerCase();
    const courseF = document.getElementById("stuCourseFilter").value;
    const yearF   = document.getElementById("stuYearFilter").value;
    const secF    = document.getElementById("stuSectionFilter").value;
    const statusF = document.getElementById("stuStatusFilter").value;
    tbody.innerHTML = "";

    let filtered = allStudents.filter(s => {
        const fullName    = `${s.lName} ${s.fName} ${s.mName}`.toLowerCase();
        const matchSearch = !search || (s.stu_id||"").toLowerCase().includes(search) || fullName.includes(search);
        const yas         = s.yearAndSection || "";
        // yas format: "BSCS 1-A"
        const matchCourse = courseF === "all" || yas.startsWith(courseF);
        const matchYear   = yearF   === "all" || yas.includes(` ${yearF}-`);
        const matchSec    = secF    === "all" || yas.endsWith(`-${secF}`);
        const matchStatus = statusF === "all" || s.status === statusF;
        return matchSearch && matchCourse && matchYear && matchSec && matchStatus;
    });

    filtered.sort((a,b) => {
        const c = (a.lName||"").localeCompare(b.lName||"");
        return c !== 0 ? c : (a.fName||"").localeCompare(b.fName||"");
    });

    if (filtered.length === 0) { message.innerText = "No students found."; return; }
    message.innerText = "";

    filtered.forEach(stu => {
        const tr     = document.createElement("tr");
        const isHold = stu.status === "hold";
        tr.innerHTML = `
            <td>${stu.stu_id}</td>
            <td>${stu.lName}</td>
            <td>${stu.fName}</td>
            <td>${stu.mName}</td>
            <td>${stu.yearAndSection}</td>
            <td><strong style="color:${isHold?"red":"green"}">${(stu.status||"").toUpperCase()}</strong></td>
            <td>${stu.pin || "—"}</td>
        `;
        tbody.appendChild(tr);
    });
}

loadStudents();