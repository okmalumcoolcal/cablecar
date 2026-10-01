import { loadConfig }          from "./src/modules/config";
import { findVlc, launchVlc }  from "./src/modules/vlc";
import { startServer }         from "./src/server";
import { platform }            from "os";

/* ── Load config ─────────────────────────────────────────────── */

const config = loadConfig();
const PORT   = config.lastPort ?? 3000;

/* ── Find VLC ────────────────────────────────────────────────── */

const vlcPath = findVlc();

if (!vlcPath)
{
  console.error("VLC not found — install VLC from videolan.org");
  process.exit(1);
}

console.log(`VLC found: ${vlcPath}`);

/* ── Launch VLC ──────────────────────────────────────────────── */

console.log("Launching VLC...");
await launchVlc(vlcPath);
console.log("VLC HTTP interface ready");

/* ── Start Express server ────────────────────────────────────── */

startServer(PORT);

/* ── Open browser ────────────────────────────────────────────── */

const url = `http://localhost:${PORT}`;

if (platform() === "win32")
{
  Bun.spawn({
    cmd: ["C:\\Windows\\System32\\cmd.exe", "/c", "start", "", url],
    stdout: "ignore",
    stderr: "ignore",
  });
}
else if (platform() === "darwin")
{
  Bun.spawn({ cmd: ["open", url], stdout: "ignore", stderr: "ignore" });
}
else
{
  Bun.spawn({ cmd: ["xdg-open", url], stdout: "ignore", stderr: "ignore" });
}

console.log(`\nCableCar running at ${url}`);
console.log("Press Ctrl+C to stop.");