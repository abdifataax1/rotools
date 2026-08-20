import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDeveloperProducts } from './services/robloxDevProducts.js';
import { createShortsRouter } from './shorts/router.js';
import { createShortsUploadRouter } from './shorts/uploadRouter.js';

const app = express();
const port = process.env.PORT || 5174;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'rotools-api', hasRobloxKey: Boolean(process.env.ROBLOX_API_KEY) });
});

app.post('/api/devproducts/create', async (req, res) => {
  try {
    const { universeId, products, dryRun = true, delayMs = 650 } = req.body || {};
    if (!universeId) return res.status(400).json({ error: 'Universe ID is required.' });
    if (!Array.isArray(products) || products.length === 0) return res.status(400).json({ error: 'At least one product is required.' });
    const results = await createDeveloperProducts({ universeId, products, dryRun: Boolean(dryRun), delayMs: Number(delayMs) || 0 });
    res.json({ ok: true, results });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Developer product request failed.' });
  }
});

app.use('/shorts', createShortsRouter());
app.use('/api/shorts/upload', createShortsUploadRouter());

app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`RoTools API running on http://localhost:${port}`);
});
