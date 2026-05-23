import http from 'http';
import { URL } from 'url';

/** Forward /api/* to the game API (stack mode: API on localhost in same container). */
export function createApiProxy(targetBase) {
  const base = targetBase.replace(/\/$/, '');
  return (req, res) => {
    const suffix = req.originalUrl.replace(/^\/api/, '') || '/';
    let target;
    try {
      target = new URL(suffix, `${base}/`);
    } catch {
      res.status(400).json({ ok: false, message: 'Bad proxy path' });
      return;
    }
    const headers = { ...req.headers, host: target.host };
    delete headers.connection;
    const proxyReq = http.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + target.search,
        method: req.method,
        headers
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      console.error('[api-proxy]', err.message);
      if (!res.headersSent) {
        res.status(502).json({
          ok: false,
          message: 'Game API not reachable. In stack mode, API should run on API_PORT (default 3848).'
        });
      }
    });
    req.pipe(proxyReq);
  };
}

export function resolveApiProxyTarget() {
  if (process.env.API_PROXY_TARGET) {
    return process.env.API_PROXY_TARGET.replace(/\/$/, '');
  }
  const mode = (process.env.SERVICE || 'stack').toLowerCase();
  if (mode === 'stack') {
    const port = process.env.API_PORT || '3848';
    return `http://127.0.0.1:${port}`;
  }
  return null;
}
