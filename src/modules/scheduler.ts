import type { Channel, VideoFile } from "./config";
import { DEFAULT_DURATION_SECONDS } from "./config";

/* What the scheduler returns for a given channel at a given moment */
export interface ScheduleResult
{
  file: VideoFile;
  seekSeconds: number;  /* How far into the file to start playback */
  fileIndex: number;    /* Position in the resolved playlist (0-based) */
  totalFiles: number;
}

/* Seeded PRNG using mulberry32 — deterministic across restarts */
function seededRandom(seed: number): () => number
{
  let s = seed >>> 0;

  return () =>
  {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Hashing a channel id string to a stable numeric seed */
function stringToSeed(str: string): number
{
  let hash = 0;

  for (let i = 0; i < str.length; i++)
  {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }

  return hash >>> 0;
}

/* Fisher-Yates shuffle using the seeded RNG — same seed always produces same order */
function deterministicShuffle<T>(arr: T[], seed: number): T[]
{
  const result = [...arr];
  const rand = seededRandom(seed);

  for (let i = result.length - 1; i > 0; i--)
  {
    const j = Math.floor(rand() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }

  return result;
}

/* Core scheduling function — returns which file is playing now and where */
export function getCurrentSchedule(
  channel: Channel,
  nowMs: number,
  durationCache: Record<string, number> = {}
): ScheduleResult | null
{
  if (channel.files.length === 0) return null;

  /* Resolving the ordered playlist for this channel */
  const files = channel.shuffle
    ? deterministicShuffle(channel.files, stringToSeed(channel.id))
    : [...channel.files];

  /* Resolving each file's duration in ms, falling back to default when unknown */
  const durationsMs = files.map(f =>
    (durationCache[f.path] ?? DEFAULT_DURATION_SECONDS) * 1000
  );

  const totalMs = durationsMs.reduce((sum, d) => sum + d, 0);
  if (totalMs === 0) return null;

  /* Wrapping elapsed time into the playlist window — handles negative offsets safely */
  const rawElapsedMs = nowMs - channel.anchorTime;
  const elapsedMs = ((rawElapsedMs % totalMs) + totalMs) % totalMs;

  /* Walking the playlist to find the active file */
  let accumulated = 0;

  for (let i = 0; i < files.length; i++)
  {
    const fileDurationMs = durationsMs[i] ?? 0;

    if (elapsedMs < accumulated + fileDurationMs)
    {
      return {
        file: files[i]!,
        seekSeconds: Math.floor((elapsedMs - accumulated) / 1000),
        fileIndex: i,
        totalFiles: files.length,
      };
    }

    accumulated += fileDurationMs;
  }

  /* Safety fallback — unreachable with correct modulo math */
  return {
    file: files[files.length - 1]!,
    seekSeconds: 0,
    fileIndex: files.length - 1,
    totalFiles: files.length,
  };
}