import { existsSync } from "fs";
import { platform } from "os";

/* ─── Constants ──────────────────────────────────────────────── */

const VLC_HOST     = "127.0.0.1";
const VLC_PORT     = 8080;
const VLC_PASSWORD = "cablecar";
const VLC_AUTH     = btoa(`:${VLC_PASSWORD}`);

/* ─── Process handle ─────────────────────────────────────────── */

let vlcProc: ReturnType<typeof Bun.spawn> | null = null;

/* ─── Path detection ─────────────────────────────────────────── */

function getVlcCandidates(): string[]
{
  const os = platform();

  if (os === "win32")
  {
    return [
      "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
      "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe",
    ];
  }

  if (os === "darwin")
  {
    return ["/Applications/VLC.app/Contents/MacOS/VLC"];
  }

  return ["/usr/bin/vlc", "/usr/local/bin/vlc", "/snap/bin/vlc"];
}

export function findVlc(): string | null
{
  for (const candidate of getVlcCandidates())
  {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/* ─── Launch ─────────────────────────────────────────────────── */

export async function launchVlc(vlcPath: string): Promise<void>
{
  if (vlcProc) return;

  vlcProc = Bun.spawn({
    cmd: [
      vlcPath,
      "--extraintf=http",
      `--http-host=${VLC_HOST}`,
      `--http-port=${VLC_PORT}`,
      `--http-password=${VLC_PASSWORD}`,
      "--no-video-title-show",
      "--no-one-instance",
      "--quiet",
    ],
    stdout: "ignore",
    stderr: "ignore",
  });

  await waitForVlcReady();
}

async function waitForVlcReady(maxWaitMs = 8000): Promise<void>
{
  const start = Date.now();

  while (Date.now() - start < maxWaitMs)
  {
    try
    {
      await vlcGet("/requests/status.xml");
      return;
    }
    catch { /* Not ready yet */ }

    await Bun.sleep(300);
  }

  throw new Error("VLC HTTP interface did not become ready within 8 seconds");
}

/* ─── HTTP helper ────────────────────────────────────────────── */

async function vlcGet(endpoint: string): Promise<string>
{
  const url = `http://${VLC_HOST}:${VLC_PORT}${endpoint}`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${VLC_AUTH}` },
  });

  if (!res.ok) throw new Error(`VLC HTTP ${res.status}`);
  return res.text();
}

/* ─── Path to file URI ───────────────────────────────────────── */

function toFileUri(filePath: string): string
{
  if (platform() === "win32")
  {
    /* Handling UNC paths: \\server\share\file → file:////server/share/file */
    if (filePath.startsWith("\\\\"))
    {
      return "file://" + filePath.replace(/\\/g, "/");
    }

    /* Handling local paths: C:\path\file → file:///C:/path/file */
    return "file:///" + filePath.replace(/\\/g, "/");
  }

  return "file://" + filePath;
}

/* ─── Playback controls ──────────────────────────────────────── */

export async function playFile(filePath: string, seekSeconds: number = 0): Promise<void>
{
  const uri = encodeURIComponent(toFileUri(filePath));
  await vlcGet(`/requests/status.xml?command=in_play&input=${uri}`);

  if (seekSeconds > 0)
  {
    /* Waiting for VLC to open and index the file before the seek lands */
    await Bun.sleep(800);
    await vlcGet(`/requests/status.xml?command=seek&val=${seekSeconds}s`);
  }
}

export async function seek(seconds: number): Promise<void>
{
  await vlcGet(`/requests/status.xml?command=seek&val=${seconds}s`);
}

export async function stop(): Promise<void>
{
  await vlcGet(`/requests/status.xml?command=pl_stop`);
}

/* ─── Status ─────────────────────────────────────────────────── */

export interface VlcStatus
{
  state:    "playing" | "paused" | "stopped";
  time:     number;   /* Current position in seconds */
  length:   number;   /* Total duration in seconds   */
  position: number;   /* 0-1 fractional position     */
}

export async function getStatus(): Promise<VlcStatus | null>
{
  try
  {
    const xml = await vlcGet("/requests/status.xml");

    const state    = xml.match(/<state>(.*?)<\/state>/)?.[1]                  ?? "stopped";
    const time     = parseInt(xml.match(/<time>(.*?)<\/time>/)?.[1]           ?? "0", 10);
    const length   = parseInt(xml.match(/<length>(.*?)<\/length>/)?.[1]       ?? "0", 10);
    const position = parseFloat(xml.match(/<position>(.*?)<\/position>/)?.[1] ?? "0");

    return { state: state as VlcStatus["state"], time, length, position };
  }
  catch
  {
    return null;
  }
}