import { join, dirname } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";

/* VideoFile represents a single media file within a channel */
export interface VideoFile
{
  path: string;
  name: string;
  duration: number; /* Duration in seconds; 0 means unknown */
}

/* Channel represents a top-level folder treated as a broadcast channel */
export interface Channel
{
  id: string;
  name: string;
  files: VideoFile[];
  anchorTime: number; /* Unix timestamp ms — the notional broadcast start point */
  shuffle: boolean;
}

/* AppConfig is the full persisted state written to channels.json */
export interface AppConfig
{
  mediaRoot: string;
  channels: Channel[];
  durationCache: Record<string, number>; /* filePath → duration in seconds */
  lastPort: number;
}

/* Fallback duration used when a file has not been probed yet */
export const DEFAULT_DURATION_SECONDS = 90 * 60; /* 90 minutes */

const DEFAULT_CONFIG: AppConfig =
{
  mediaRoot: "",
  channels: [],
  durationCache: {},
  lastPort: 3000,
};

/* Resolving channels.json location — beside the binary in production, cwd in dev */
function getConfigPath(): string
{
  const argv0 = Bun.argv[0] ?? "";
  const isCompiled = !argv0.toLowerCase().includes("bun");
  const configDir = isCompiled ? dirname(argv0) : process.cwd();
  return join(configDir, "channels.json");
}

/* Loading config from disk, returning defaults if absent or malformed */
export function loadConfig(): AppConfig
{
  const configPath = getConfigPath();

  if (!existsSync(configPath))
  {
    return { ...DEFAULT_CONFIG };
  }

  try
  {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as AppConfig;
  }
  catch
  {
    console.warn("channels.json is malformed — falling back to defaults");
    return { ...DEFAULT_CONFIG };
  }
}

/* Persisting config to disk */
export function saveConfig(config: AppConfig): void
{
  const configPath = getConfigPath();

  try
  {
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  }
  catch (err)
  {
    console.error("Failed to write channels.json:", err);
  }
}