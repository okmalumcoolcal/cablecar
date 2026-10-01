import express                           from "express";
import type { Request, Response }        from "express";
import { join }                        from "path";
import { loadConfig, saveConfig }      from "./modules/config";
import { getCurrentSchedule }          from "./modules/scheduler";
import { playFile, getStatus }         from "./modules/vlc";

/* ─── Active channel — in-memory for this phase ─────────────── */

let activeChannelId: string | null = null;

/* ─── Server factory ─────────────────────────────────────────── */

export function startServer(port: number): void
{
  const app = express();
  app.use(express.json());

  /* ── GET / — serve the browser UI ──────────────────────────── */

  app.get("/", (_req: Request, res: Response) =>
  {
    res.sendFile(join(import.meta.dir, "index.html"));
  });

  /* ── GET /api/channels ──────────────────────────────────────── */

  app.get("/api/channels", (_req: Request, res: Response) =>
  {
    const config = loadConfig();

    const channels = config.channels.map(ch => ({
      id:        ch.id,
      name:      ch.name,
      fileCount: ch.files.length,
    }));

    res.json({ channels, activeChannelId });
  });

  /* ── GET /api/status ─────────────────────────────────────────── */

  app.get("/api/status", async (_req: Request, res: Response) =>
  {
    try
    {
      const config    = loadConfig();
      const vlcStatus = await getStatus();

      let scheduleInfo: Record<string, unknown> | null = null;

      if (activeChannelId)
      {
        const channel = config.channels.find(ch => ch.id === activeChannelId);

        if (channel)
        {
          const result = getCurrentSchedule(channel, Date.now(), config.durationCache);

          if (result)
          {
            scheduleInfo = {
              channelName: channel.name,
              fileName:    result.file.name,
              fileIndex:   result.fileIndex,
              totalFiles:  result.totalFiles,
              seekSeconds: result.seekSeconds,
            };
          }
        }
      }

      res.json({
        vlc:             vlcStatus ?? { state: "stopped", time: 0, length: 0, position: 0 },
        schedule:        scheduleInfo,
        activeChannelId,
      });
    }
    catch (err)
    {
      res.status(500).json({ error: "Status read failed" });
    }
  });

  /* ── POST /api/tune/:channelId ──────────────────────────────── */

  app.post("/api/tune/:channelId", async (req: Request, res: Response) =>
  {
    try
    {
      const config  = loadConfig();
      const channel = config.channels.find(ch => ch.id === req.params.channelId);

      if (!channel)
      {
        res.status(404).json({ error: "Channel not found" });
        return;
      }

      const result = getCurrentSchedule(channel, Date.now(), config.durationCache);

      if (!result)
      {
        res.status(500).json({ error: "Scheduler returned null — channel has no files" });
        return;
      }

      await playFile(result.file.path, result.seekSeconds);

      activeChannelId = channel.id;

      res.json({
        channelId:   channel.id,
        channelName: channel.name,
        fileName:    result.file.name,
        fileIndex:   result.fileIndex,
        totalFiles:  result.totalFiles,
        seekSeconds: result.seekSeconds,
      });
    }
    catch (err)
    {
      res.status(500).json({ error: "Tune failed" });
    }
  });

  /* ── Start listening ─────────────────────────────────────────── */

  app.listen(port, () =>
  {
    console.log(`CableCar server running at http://localhost:${port}`);
  });
}