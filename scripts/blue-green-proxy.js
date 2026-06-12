#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const LISTEN_PORT = Number(process.env.BLUE_GREEN_LISTEN_PORT || process.env.PORT || 42427);
const LISTEN_HOST = process.env.BLUE_GREEN_LISTEN_HOST || '0.0.0.0';
const BACKEND_PORT_FILE =
  process.env.BLUE_GREEN_BACKEND_PORT_FILE ||
  path.join(process.cwd(), '.blue-green', 'active-backend-port');
const FALLBACK_BACKEND_PORT = Number(process.env.BLUE_GREEN_FALLBACK_BACKEND_PORT || 42428);

function readBackendPort() {
  try {
    const raw = fs.readFileSync(BACKEND_PORT_FILE, 'utf8').trim();
    const port = Number(raw);

    if (Number.isInteger(port) && port > 0 && port < 65536) {
      return port;
    }
  } catch {
    return FALLBACK_BACKEND_PORT;
  }

  return FALLBACK_BACKEND_PORT;
}

const proxyServer = http.createServer((req, res) => {
  const backendPort = readBackendPort();

  const upstreamReq = http.request(
    {
      method: req.method,
      hostname: '127.0.0.1',
      port: backendPort,
      path: req.url,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on('error', () => {
    res.statusCode = 502;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Upstream unavailable');
  });

  req.pipe(upstreamReq);
});

proxyServer.on('upgrade', (request, socket, head) => {
  const backendPort = readBackendPort();
  const upstream = http.request(
    {
      method: request.method,
      headers: request.headers,
      hostname: '127.0.0.1',
      port: backendPort,
      path: request.url,
    }
  );

  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    socket.write(`HTTP/1.1 ${upRes.statusCode || 502} Switching Protocols\r\n`);
    socket.write('\r\n');
    upSocket.pipe(socket);
    socket.pipe(upSocket);
    upSocket.write(upHead);
    socket.write(head);
  });

  upstream.on('error', () => {
    socket.destroy();
  });

  upstream.end(head);
});

proxyServer.on('clientError', (error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

proxyServer.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`Blue-green proxy listening on ${LISTEN_HOST}:${LISTEN_PORT}`);
});
