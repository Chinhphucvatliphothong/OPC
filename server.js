import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Health check endpoint for container probes
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Clean URLs & rewrite for /admin matching vercel.json
app.get(['/admin', '/Admin', '/admin.html', '/Admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve static files from root directory with clean URL extension support
app.use(express.static(__dirname, {
  extensions: ['html']
}));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
