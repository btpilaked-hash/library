/**
 * start.js
 * ────────
 * Starts both the Node.js server and the Python recommender
 * together with a single command: node start.js
 *
 * Place this file in the ROOT of your project (same level as server.js).
 */

const { spawn } = require("child_process");
const path      = require("path");
const http      = require("http");

const NODE_SCRIPT   = path.join(__dirname, "server.js");
const PYTHON_SCRIPT = path.join(__dirname, "recommender.py");

// Use "python" on Windows, "python3" on Mac/Linux
const PYTHON_CMD = process.platform === "win32"
    ? path.join(__dirname, ".venv1", "Scripts", "python.exe")
    : "python3";

const C = {
    node:   s => `\x1b[36m[Node]\x1b[0m   ${s}`,
    python: s => `\x1b[33m[Python]\x1b[0m ${s}`,
    info:   s => `\x1b[32m[Launcher]\x1b[0m ${s}`,
    error:  s => `\x1b[31m[ERROR]\x1b[0m  ${s}`,
};

console.log(C.info("Starting CCIT Library System..."));
console.log(C.info("Node.js → server.js (port 3000)"));
console.log(C.info("Python → recommender.py (port 5001)"));
console.log("");

function waitForFlask(retries = 60, interval = 500) {
    return new Promise((resolve) => {
        let attempts = 0;
        function check() {
            const req = http.get("http://localhost:5001/health", (res) => {
                if (res.statusCode === 200) {
                    resolve(true);
                } else {
                    retry();
                }
            });
            req.on("error", () => retry());
            req.setTimeout(400, () => { req.destroy(); retry(); });
        }
        function retry() {
            attempts++;
            if (attempts >= retries) {
                resolve(false);
            } else {
                setTimeout(check, interval);
            }
        }
        check();
    });
}

const pyProc = spawn(PYTHON_CMD, [PYTHON_SCRIPT], {
    env:   { ...process.env },
    stdio: "pipe",
});

pyProc.stdout.on("data", data => {
    data.toString().trim().split("\n")
        .forEach(line => console.log(C.python(line)));
});
pyProc.stderr.on("data", data => {
    // Flask writes its startup banner to stderr — that is normal
    data.toString().trim().split("\n")
        .forEach(line => console.log(C.python(line)));
});
pyProc.on("error", err => {
    console.log(C.error(`Could not start Python: ${err.message}`));
    console.log(C.error("Make sure Python is installed and run:"));
    console.log(C.error("  pip install flask flask-cors pymongo numpy"));
    console.log(C.info("Node.js server will still start — recommender will be disabled."));
});
pyProc.on("close", code => {
    if (code !== 0 && code !== null) {
        console.log(C.error(`Python process exited with code ${code}`));
        console.log(C.error("Common fixes:"));
        console.log(C.error("  1. pip install flask flask-cors pymongo numpy"));
        console.log(C.error("  2. Make sure MONGO_URI in your .env is correct"));
        console.log(C.error("  3. Try running:  python recommender.py  directly to see the full error"));
    }
});

const nodeProc = spawn("node", [NODE_SCRIPT], {
    env:   { ...process.env },
    stdio: "pipe",
});

nodeProc.stdout.on("data", data => {
    data.toString().trim().split("\n")
        .forEach(line => console.log(C.node(line)));
});
nodeProc.stderr.on("data", data => {
    data.toString().trim().split("\n")
        .forEach(line => console.log(C.node(line)));
});
nodeProc.on("error", err => {
    console.log(C.error(`Could not start Node.js: ${err.message}`));
});
nodeProc.on("close", code => {
    console.log(C.error(`Node.js exited (code ${code}). Shutting down Python too.`));
    pyProc.kill();
    process.exit(code);
});

waitForFlask().then(ready => {
    if (ready) {
        console.log(C.info("Recommender (Flask) is ready on port 5001"));
    } else {
        console.log(C.error("⚠️  Recommender did not start within 30 s."));
        console.log(C.error("   Run  python recommender.py  directly to see why."));
        console.log(C.info("   The library system still works — only recommendations are affected."));
    }
});

process.on("SIGINT", () => {
    console.log("\n" + C.info("Shutting down both servers..."));
    pyProc.kill("SIGINT");
    nodeProc.kill("SIGINT");
    process.exit(0);
});
process.on("SIGTERM", () => {
    pyProc.kill("SIGTERM");
    nodeProc.kill("SIGTERM");
    process.exit(0);
});