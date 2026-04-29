require('dotenv').config();
const conDB      = require('./config/db');
const express    = require('express');
const studentR   = require("./routes/studentR");
const librarianR = require("./routes/librarianR");
const bookR      = require("./routes/bookR");
const adminR     = require("./routes/adminR");
const recommendR = require("./routes/recommendR");
const path       = require('path');
const cors       = require('cors');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

conDB();

const uploadsDir    = path.join(__dirname, "uploads");
const uploadLibDir  = path.join(__dirname, "uploadLib");
const uploadAdminDir = path.join(__dirname, "uploadAdmin");
if (!fs.existsSync(uploadsDir))    fs.mkdirSync(uploadsDir);
if (!fs.existsSync(uploadLibDir))  fs.mkdirSync(uploadLibDir);
if (!fs.existsSync(uploadAdminDir)) fs.mkdirSync(uploadAdminDir);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(path.join(__dirname, 'public')));
app.use("/uploads",   express.static(path.join(__dirname, 'uploads')));
app.use("/uploadLib",   express.static(path.join(__dirname, 'uploadLib')));
app.use("/uploadAdmin", express.static(path.join(__dirname, 'uploadAdmin')));

app.use('/api/students',   studentR);
app.use('/api/librarians', librarianR);
app.use('/api/book',       bookR);
app.use('/api/admin',      adminR);
app.use('/api/recommend',  recommendR);

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`http://localhost:${PORT}/index.html                     - students`);
    console.log(`http://localhost:${PORT}/librarian/html/logLib.html     - librarian`);
    console.log(`http://localhost:${PORT}/Admin/html/admin.html          - admin`);
});