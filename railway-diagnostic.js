/**
 * Minimal Railway Diagnostic Server
 * Based on working pattern from enterprise-extension
 */

const http = require('http');

// Railway provides PORT env var
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // CRITICAL: Must be 0.0.0.0 for Railway

// Create minimal server
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      message: 'Railway Diagnostic Server',
      timestamp: new Date().toISOString(),
      port: PORT,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
        RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
        PORT: process.env.PORT
      }
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', path: req.url }));
  }
});

// Error handling
server.on('error', (err) => {
  console.error('[CRITICAL] Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

// Start server
console.log('========================================');
console.log('Railway Diagnostic Server Starting');
console.log('========================================');
console.log(`PORT from env: ${process.env.PORT || 'not set'}`);
console.log(`Binding to: ${HOST}:${PORT}`);
console.log('========================================');

// CRITICAL: Start listening immediately
server.listen(PORT, HOST, () => {
  console.log(`[SUCCESS] Server listening on ${HOST}:${PORT}`);
  console.log(`[SUCCESS] Server.listening = ${server.listening}`);
  console.log('Ready for health checks at /health');
  console.log('========================================');
});