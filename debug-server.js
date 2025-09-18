// Debug server to identify Railway startup issues
console.log('=== DEBUG SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());
console.log('PORT env:', process.env.PORT);

const http = require('http');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

console.log(`Attempting to bind to ${HOST}:${PORT}`);

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    message: 'Debug server working',
    port: PORT,
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  }));
});

server.on('error', (err) => {
  console.error('SERVER ERROR:', err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`=== SERVER STARTED SUCCESSFULLY ===`);
  console.log(`Listening on ${HOST}:${PORT}`);
  console.log(`Test with: curl http://${HOST}:${PORT}/health`);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

console.log('Server setup complete, starting listen...');