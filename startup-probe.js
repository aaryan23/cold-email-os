// Minimal probe: starts HTTP server before loading any app code
// If this goes live, the problem is in app startup, not Render infra
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('probe ok');
});

server.listen(port, () => {
  console.log('Probe server listening on port', port);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
  console.log('REDIS_URL set:', !!process.env.REDIS_URL);
  console.log('ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY);
});
