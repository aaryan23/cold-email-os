// Diagnostic probe: intercepts process.exit and captures the crash reason
// Stays live so we can query what failed via HTTP
const http = require('http');
const port = process.env.PORT || 3000;

const diagnostics = {
  exitIntercepted: null,
  loadError: null,
  envVars: {
    NODE_ENV: process.env.NODE_ENV || 'MISSING',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.length + ' chars)' : 'MISSING',
    REDIS_URL: process.env.REDIS_URL ? 'SET (' + process.env.REDIS_URL.length + ' chars)' : 'MISSING',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING',
    APIFY_API_TOKEN: process.env.APIFY_API_TOKEN ? 'SET' : 'MISSING',
    PORT: process.env.PORT || 'MISSING (will default)',
  }
};

// Intercept process.exit so we can capture what triggers it
const realExit = process.exit.bind(process);
process.exit = function(code) {
  diagnostics.exitIntercepted = { code, stack: new Error('exit called here').stack };
  console.error('[PROBE] process.exit(' + code + ') intercepted — keeping probe alive');
  // Do NOT actually exit
};

// Try loading the actual app
try {
  require('./dist/index.js');
  diagnostics.loadError = null;
} catch (e) {
  diagnostics.loadError = { message: e.message, stack: e.stack };
  console.error('[PROBE] App load threw:', e.message);
}

// Start the diagnostic HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(diagnostics, null, 2));
});

server.listen(port, () => {
  console.log('[PROBE] Diagnostic server listening on port', port);
  console.log('[PROBE] ENV check:', JSON.stringify(diagnostics.envVars));
});
