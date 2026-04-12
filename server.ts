import express from 'express';
import { createServer as createViteServer } from 'vite';
import Parser from 'rss-parser';
import path from 'path';
import * as dns from 'dns/promises';

/** Reject URLs that point to private/reserved IP ranges. */
function isPrivateIP(ip: string): boolean {
  // IPv4 private/reserved ranges
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 127) return true;                          // 127.0.0.0/8
    if (parts[0] === 10) return true;                           // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true;     // 192.168.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true;     // 169.254.0.0/16 (link-local / cloud metadata)
    if (parts[0] === 0) return true;                            // 0.0.0.0/8
  }
  // IPv6 loopback and private
  if (ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  return false;
}

async function validateFeedUrl(raw: string): Promise<URL> {
  const parsed = new URL(raw); // throws on malformed URLs
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https URLs are allowed');
  }
  // Resolve hostname and reject private IPs to prevent SSRF
  const { address } = await dns.lookup(parsed.hostname);
  if (isPrivateIP(address)) {
    throw new Error('URLs pointing to private/internal networks are not allowed');
  }
  return parsed;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const parser = new Parser();

  app.use(express.json());

  // API route to fetch and parse RSS feeds
  app.post('/api/feed', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      await validateFeedUrl(url);

      const feed = await parser.parseURL(url);
      res.json(feed);
    } catch (error) {
      console.error('Error fetching feed:', error);
      res.status(500).json({ error: 'Failed to fetch feed' });
    }
  });

  // Serve the combined feed built by `npm run ingest`
  app.get('/main.rss', (_req, res) => {
    const filePath = path.join(process.cwd(), 'data', 'main.rss');
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).type('text/plain').send('Feed not generated yet — run `npm run ingest`.');
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
