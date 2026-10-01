import { loadConfig, saveConfig }       from "./src/modules/config";
import { getCurrentSchedule }           from "./src/modules/scheduler";
import { findVlc, launchVlc, playFile,
         getStatus, stop }              from "./src/modules/vlc";

/* ── Loading config ──────────────────────────────────────────── */

const config = loadConfig();

/* ── Finding VLC ─────────────────────────────────────────────── */

const vlcPath = findVlc();

if (!vlcPath)
{
  console.error("VLC not found — install VLC from videolan.org");
  process.exit(1);
}

console.log(`VLC found: ${vlcPath}`);

/* ── Launching VLC with HTTP interface ───────────────────────── */

console.log("Launching VLC...");
await launchVlc(vlcPath);
console.log("VLC HTTP interface ready\n");

/* ── Scheduler: current position for Channel1 ────────────────── */

const channel = config.channels[0];

if (!channel)
{
  console.error("No channels in channels.json — run the scanner first");
  process.exit(1);
}

const result = getCurrentSchedule(channel, Date.now(), config.durationCache);

if (!result)
{
  console.error("Scheduler returned null — channel has no files");
  process.exit(1);
}

console.log(`--- Channel: ${channel.name} ---`);
console.log(`  File:     ${result.file.name}`);
console.log(`  Position: ${result.fileIndex + 1} of ${result.totalFiles}`);
console.log(`  Seek to:  ${result.seekSeconds}s\n`);

/* ── Sending play + seek to VLC ──────────────────────────────── */

console.log("Sending play command to VLC...");
await playFile(result.file.path, result.seekSeconds);
console.log("Play command sent\n");

/* ── Reading status after 3 seconds ─────────────────────────── */

console.log("Waiting 3 seconds...");
await Bun.sleep(3000);

const status = await getStatus();

if (status)
{
  console.log("VLC status:");
  console.log(`  State:    ${status.state}`);
  console.log(`  Time:     ${status.time}s`);
  console.log(`  Duration: ${status.length}s`);
  console.log(`  Position: ${(status.position * 100).toFixed(1)}%\n`);

  /* Caching the probed duration if VLC reported a valid length */
  if (status.length > 0)
  {
    config.durationCache[result.file.path] = status.length;
    saveConfig(config);
    console.log(`Duration cached: ${status.length}s written to channels.json`);
  }
}
else
{
  console.log("Could not read VLC status");
}

/* ── Stopping VLC ────────────────────────────────────────────── */

await stop();
console.log("\n04_VlcBridge smoke test complete.");