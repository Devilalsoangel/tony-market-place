// bb-boot: check CDP, relaunch warm gpt-bridge Chrome if dead
const { execSync, spawn } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PROFILE = path.join(os.tmpdir(), "gpt-bridge-profile");
const PORT = 9222;

function cdpAlive() {
  try {
    const out = execSync(`curl -s --max-time 3 http://127.0.0.1:${PORT}/json/version`, { encoding: "utf8" });
    return out.includes("webSocketDebuggerUrl");
  } catch { return false; }
}

async function main() {
  if (cdpAlive()) { console.log("READY (CDP already up)"); process.exit(0); }
  console.log("CDP dead - relaunching warm Chrome...");
  const child = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--no-first-run", "--no-default-browser-check",
    "--restore-last-session",
    "https://chatgpt.com",
  ], { detached: true, stdio: "ignore" });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (cdpAlive()) { console.log(`READY (relaunched, ${i + 1}s)`); process.exit(0); }
  }
  console.error("FAIL: CDP did not come up in 20s");
  process.exit(1);
}
main();