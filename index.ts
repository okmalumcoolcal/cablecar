import { scanMediaRoot } from "./src/modules/scanner";
import { getCurrentSchedule } from "./src/modules/scheduler";
import { loadConfig, saveConfig } from "./src/modules/config";

const MEDIA_ROOT =
  "\\\\Mac\\Home\\Downloads\\CALN_RECWRK\\24_TransferToRecDrive\\0_CNAIRCN_Downloads\\CableCar";

/* Loading existing config to preserve any stored anchor times */
const config = loadConfig();
const channels = scanMediaRoot(MEDIA_ROOT);
const now = Date.now();

/* Preserving anchor times for known channels, assigning fresh ones for new channels */
for (const channel of channels)
{
  const existing = config.channels.find(c => c.id === channel.id);
  channel.anchorTime = existing?.anchorTime ?? now;
  channel.shuffle = existing?.shuffle ?? false;
}

config.mediaRoot = MEDIA_ROOT;
config.channels = channels;
saveConfig(config);

console.log("--- Scheduler test: current time ---\n");

for (const channel of channels)
{
  const result = getCurrentSchedule(channel, now, config.durationCache);

  if (!result)
  {
    console.log(`${channel.name}: no files\n`);
    continue;
  }

  const durationSource = config.durationCache[result.file.path] ? "probed" : "default 90min";

  console.log(`Channel: ${channel.name}`);
  console.log(`  Playing:  ${result.file.name}`);
  console.log(`  Position: file ${result.fileIndex + 1} of ${result.totalFiles}`);
  console.log(`  Seek to:  ${result.seekSeconds}s  (duration source: ${durationSource})`);
  console.log("");
}

/* Simulating 3 hours elapsed to verify scheduler advances correctly */
const threeHoursMs = 3 * 60 * 60 * 1000;
console.log("--- Scheduler test: +3 hours ---\n");

for (const channel of channels)
{
  const result = getCurrentSchedule(channel, now + threeHoursMs, config.durationCache);

  if (!result) continue;

  console.log(`Channel: ${channel.name}`);
  console.log(`  Playing:  ${result.file.name}`);
  console.log(`  Position: file ${result.fileIndex + 1} of ${result.totalFiles}`);
  console.log(`  Seek to:  ${result.seekSeconds}s`);
  console.log("");
}