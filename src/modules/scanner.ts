import { readdirSync, statSync } from "fs";
import { join, extname, basename } from "path";
import type { Channel, VideoFile } from "./config";

/* Defining supported video extensions for filtering */
const VIDEO_EXTENSIONS = new Set(
  [
    ".mp4", ".mkv", ".avi", ".wmv", ".mov",
    ".m4v", ".mpg", ".mpeg", ".flv", ".ts", ".webm"
  ]
);

/* Converting folder names into url-safe ids */
function slugify(name: string): string
{
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* Collecting video files from a single flat folder */
function getVideoFiles(folderPath: string): VideoFile[]
{
  let entries: string[];

  try
  {
    entries = readdirSync(folderPath);
  }
  catch
  {
    return [];
  }

  return entries
    .filter(f => VIDEO_EXTENSIONS.has(extname(f).toLowerCase()))
    .sort()
    .map(f => (
      {
        path: join(folderPath, f),
        name: basename(f, extname(f)),
        duration: 0,
      }
    ));
}

/* Scanning a channel folder and grouping files by subfolder then loose files */
function scanChannelFolder(channelPath: string): VideoFile[]
{
  let entries: string[];

  try
  {
    entries = readdirSync(channelPath);
  }
  catch
  {
    return [];
  }

  const files: VideoFile[] = [];
  const subfolders: string[] = [];
  const looseFiles: string[] = [];

  /* Separating subfolders from loose video files */
  for (const entry of entries)
  {
    const fullPath = join(channelPath, entry);
    let stat;

    try
    {
      stat = statSync(fullPath);
    }
    catch
    {
      continue;
    }

    if (stat.isDirectory())
    {
      subfolders.push(entry);
    }
    else if (VIDEO_EXTENSIONS.has(extname(entry).toLowerCase()))
    {
      looseFiles.push(entry);
    }
  }

  /* Interleaving subfolders and loose files by alphabetical name */
  type Entry = { name: string; isFolder: boolean };

  const combined: Entry[] = [
    ...subfolders.map(f => ({ name: f, isFolder: true })),
    ...looseFiles.map(f => ({ name: f, isFolder: false })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  /* Building the final file list respecting group order */
  for (const entry of combined)
  {
    if (entry.isFolder)
    {
      /* Appending all files from the subfolder group */
      const subFiles = getVideoFiles(join(channelPath, entry.name));
      files.push(...subFiles);
    }
    else
    {
      /* Appending the loose file directly */
      files.push(
        {
          path: join(channelPath, entry.name),
          name: basename(entry.name, extname(entry.name)),
          duration: 0,
        }
      );
    }
  }

  return files;
}

/* Scanning the media root and returning all valid channels */
export function scanMediaRoot(rootPath: string): Channel[]
{
  let entries: string[];

  try
  {
    entries = readdirSync(rootPath);
  }
  catch (err)
  {
    console.error(`Cannot read media root: ${rootPath}`, err);
    return [];
  }

  const channels: Channel[] = [];

  /* Processing each top-level subfolder as a potential channel */
  for (const entry of entries)
  {
    const fullPath = join(rootPath, entry);
    let stat;

    try
    {
      stat = statSync(fullPath);
    }
    catch
    {
      continue;
    }

    if (!stat.isDirectory()) continue;

    const files = scanChannelFolder(fullPath);

    /* Skipping folders with no supported video files */
    if (files.length === 0) continue;

    channels.push(
      {
        id: slugify(entry),
        name: entry,
        files,
        anchorTime: Date.now(),
        shuffle: false,
      }
    );
  }

  /* Returning channels sorted alphabetically by display name */
  return channels.sort((a, b) => a.name.localeCompare(b.name));
}