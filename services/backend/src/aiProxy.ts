import http from 'node:http';
import type { Request, Response } from 'express';

/**
 * /ai/* → the AI service on this machine. A phone on the LAN cannot reach the
 * Python process directly on a Mac with the application firewall on (Homebrew
 * Python is not in its allow list; Node is), so the app talks to the AI service
 * through the backend's port. Streams both ways: the multipart audio upload in,
 * the SSE reply (and the TTS audio) out. Mounted BEFORE express.json() so the
 * body is never consumed here.
 */
export function aiProxy(target = process.env.AI_URL || 'http://127.0.0.1:8000') {
  const base = new URL(target);
  return (req: Request, res: Response) => {
    const upstream = http.request(
      {
        hostname: base.hostname,
        port: base.port || 80,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: base.host },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.status(502).json({ success: false, code: 'AI_UNAVAILABLE', message: 'AI service unreachable' });
      else res.end();
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  };
}
