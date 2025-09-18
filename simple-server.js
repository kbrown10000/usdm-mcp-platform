// Ultra-simple server for Railway - CommonJS
const http = require('http');

// CRITICAL: Parse PORT as integer - Railway provides it as a string
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

console.log('Starting simple server...');
console.log('PORT from environment:', process.env.PORT);
console.log('Using PORT:', PORT);

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} from ${req.headers.host}`);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/health/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      version: '27.0-simple',
      timestamp: timestamp,
      port: PORT,
      env: process.env.RAILWAY_ENVIRONMENT || 'unknown',
      node: process.version
    }));
  } else if (req.url === '/mcp/discover' || req.url === '/mcp/discover/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'USDM MCP Platform',
      version: '27.0',
      status: 'operational',
      endpoints: ['/health', '/mcp/discover'],
      port: PORT
    }));
  } else if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`V27.0 Simple Server Running\nPort: ${PORT}\nTime: ${timestamp}`);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', path: req.url }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`✅ Simple server listening on ${HOST}:${PORT}`);
  console.log(`✅ Health check ready at http://${HOST}:${PORT}/health`);
  console.log(`✅ Railway environment: ${process.env.RAILWAY_ENVIRONMENT || 'not set'}`);
  console.log(`✅ Node version: ${process.version}`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Keep the process alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

console.log('Server setup complete, waiting for requests...');