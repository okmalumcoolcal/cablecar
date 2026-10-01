import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";

export interface VideoFile
{
  path: string;
  name: string;
  duration: number; /* Storing duration in seconds — 0 until populated by scheduler */
}

export interface Channel
{
  id: string;         /* Storing slugified folder name for internal use */
  name: string;       /* Storing display name — the folder name as-is */
  files: VideoFile[];
  anchorTime: number; /* Storing unix ms — fixed reference point for scheduling */
  shuffle: boolean;   /* Toggling false = ordered (default), true = seeded shuffle */
}

export interface Config
{
  mediaRoot: string;
  channels: Channel[];
  lastPort: number;
  lastActiveChannel: string | null;
}

const DEFAULT_CONFIG: Config =
{
  mediaRoot: "",
  channels: [],
  lastPort: 3000,
  lastActiveChannel: null,
};

/* Resolving channels.json path to sit alongside the executable */
const CONFIG_PATH = join(dirname(Bun.main), "channels.json");

export function readConfig(): Config
{
  try
  {
    /* Reading and parsing the existing config file */
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  }
  catch
  {
    /* Returning defaults when no config file exists yet */
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(config: Config): void
{
  /* Writing the updated config back to disk */
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}