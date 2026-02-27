// Diagnostic probe v3: captures stdout (pino logs) to expose crash reason
const http = require('http');
const port = process.env.PORT || 3000;

const captured = { logs: [], exitCode: null, loadError: null };

// Capture stdout so we can read pino JSON logs (which contain the error)
const realWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk, ...args) {
  captured.logs.push(chunk.toString().trim());
  return realWrite(chunk, ...args);
};

// Intercept process.exit
process.exit = function(code) {
  captured.exitCode = code;
  process.stderr.write('[PROBE] process.exit(' + code + ') intercepted\n');
};

// Load the app
try {
  require('./dist/index.js');
} catch (e) {
  captured.loadError = e.message + '\n' + e.stack;
}

// Give async startup 8s to fail and log before responding
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(captured, null, 2));
});

server.listen(port, () => {
  process.stderr.write('[PROBE] Diagnostic server on port ' + port + '\n');
});
