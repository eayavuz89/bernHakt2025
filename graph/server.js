

import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { sparql, bindingsToObjects } from './index.js';
import fs from 'fs';
import { stringify } from 'csv-stringify/sync';
import { syncModels, User, Purchase, PurchaseItem } from './db/models.js';
import { createUser, createPurchaseWithItems, getUserPurchases } from './db/services.js';

import { chatWithGPT } from './chatgpt.js';



const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});


// ChatGPT endpoint
app.post('/chat', async (req, res) => {
  const { prompt, model, max_tokens, temperature } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Missing prompt in body' });
  try {
    const response = await chatWithGPT(prompt, { model, max_tokens, temperature });
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPARQL sonucu ChatGPT ile açıklama endpointi
app.post('/explain-sparql', async (req, res) => {
  const { query, prompt } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing SPARQL query in body' });
  try {
    const raw = await sparql(query);
    const rows = bindingsToObjects(raw);
    const chatPrompt = `${prompt || 'Bu veriyi açıkla:'}\nVeri: ${JSON.stringify(rows)}`;
    const explanation = await chatWithGPT(chatPrompt);
    res.json({ explanation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Log all incoming requests



// Simple GET endpoint that runs the default query with optional limit
app.get('/query', async (req, res) => {
  const limit = Number(req.query.limit) || 5000;
  const q = `PREFIX exs: <https://static.rwpz.net/spendcast/schema#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?product ?label ?name ?description ?category ?migipediaUrl ?migrosId ?migrosOnlineId ?productUrls ?uid
WHERE {
  ?product a exs:Product ;
           rdfs:label ?label ;
           exs:name ?name ;
           exs:description ?description ;
           exs:category ?category ;
           exs:migipediaUrl ?migipediaUrl ;
           exs:migrosId ?migrosId ;
           exs:migrosOnlineId ?migrosOnlineId ;
           exs:productUrls ?productUrls ;
           exs:uid ?uid .
}
ORDER BY ?product
LIMIT ${limit}`;

  try {
    const raw = await sparql(q);
    const rows = bindingsToObjects(raw);
    res.json({ rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: fetch schema info (classes + properties) from the triple store and format as a string
async function getSchemaInfo() {
  try {
    const qClasses = `SELECT ?class ?label WHERE { ?class a <http://www.w3.org/2002/07/owl#Class> . OPTIONAL { ?class <http://www.w3.org/2000/01/rdf-schema#label> ?label } } ORDER BY ?class`;
    const rawClasses = await sparql(qClasses);
    const classes = bindingsToObjects(rawClasses);

    const qProps = `SELECT ?prop ?label ?type WHERE { ?prop a ?type . FILTER(?type IN (<http://www.w3.org/2002/07/owl#ObjectProperty>, <http://www.w3.org/2002/07/owl#DatatypeProperty>)) OPTIONAL { ?prop <http://www.w3.org/2000/01/rdf-schema#label> ?label } } ORDER BY ?prop`;
    const rawProps = await sparql(qProps);
    const props = bindingsToObjects(rawProps);

    let out = '';
    if (classes && classes.length) {
      out += 'Classes:\n';
      for (const c of classes) {
        out += `- ${c.class}${c.label ? ` (${c.label})` : ''}\n`;
      }
    }
    if (props && props.length) {
      out += '\nProperties:\n';
      for (const p of props) {
        const shortType = (p.type || '').endsWith('ObjectProperty') ? 'ObjectProperty' : (p.type || '').endsWith('DatatypeProperty') ? 'DatatypeProperty' : p.type;
        out += `- ${p.prop}${p.label ? ` (${p.label})` : ''} : ${shortType}\n`;
      }
    }
    return out || '';
  } catch (err) {
    console.warn('Failed to fetch schema info:', err && err.message ? err.message : err);
    return '';
  }
}

// Clean up ChatGPT-produced SPARQL: remove markdown fences, leading commentary, and extract from first SPARQL keyword
function sanitizeSparql(text) {
  if (!text || typeof text !== 'string') return text;
  let s = text;
  // If there's a fenced code block, prefer its content
  const firstFence = s.indexOf('```');
  if (firstFence !== -1) {
    const secondFence = s.indexOf('```', firstFence + 3);
    if (secondFence !== -1) {
      s = s.slice(firstFence + 3, secondFence);
    } else {
      s = s.slice(firstFence + 3);
    }
  }
  // Normalize whitespace
  s = s.replace(/\r\n/g, '\n').trim();
  // Find the first SPARQL keyword and cut everything before it
  const kwMatch = s.match(/(PREFIX|SELECT|ASK|CONSTRUCT|DESCRIBE)\b/i);
  if (kwMatch) {
    s = s.slice(kwMatch.index).trim();
  }
  // Remove any remaining backticks or surrounding commentary lines like "SPARQL sorgusu:"
  s = s.replace(/[`]/g, '').replace(/^\s*[^\n]*SPARQL[^\n]*\n/i, '').trim();
  return s;
}

// Doğal dil sorudan SPARQL sorgusu üretip, sonucu ChatGPT'ye vererek yanıt dönen endpoint
app.post('/ask-db', async (req, res) => {
  const { question, model, max_tokens, temperature } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Missing question in body' });
  let sparqlQuery = null;
  try {
    // fetch schema info and trim if very long
    const schemaText = await getSchemaInfo();
    const schemaSnippet = schemaText && schemaText.length > 3000 ? schemaText.slice(0, 3000) + '\n...[truncated]' : schemaText;
    // 1. ChatGPT'den SPARQL sorgusu iste (şema bilgisini ekle)
    const prompt = `${schemaSnippet ? `Şema:\n${schemaSnippet}\n\n` : ''}Aşağıdaki soruya uygun bir SPARQL sorgusu üret ve sadece sorguyu döndür:\nSoru: ${question}`;
  sparqlQuery = await chatWithGPT(prompt, { model, max_tokens, temperature });
  // sanitize ChatGPT output to extract actual SPARQL
  const cleanedQuery = sanitizeSparql(sparqlQuery);
    // 2. Sorguyu çalıştır (cleaned)
    const raw = await sparql(cleanedQuery);
    let rows;
    // ASK queries return a boolean in many SPARQL endpoints
    if (raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'boolean')) {
      rows = { ask: raw.boolean };
    } else if (raw && raw.results && Array.isArray(raw.results.bindings)) {
      rows = bindingsToObjects(raw);
    } else {
      // Fallback: return raw as-is (string or other form)
      rows = raw;
    }
    // 3. Sonuçları ve soruyu ChatGPT'ye verip doğal yanıt iste
    const answerPrompt = `${schemaSnippet ? `Şema:\n${schemaSnippet}\n\n` : ''}Soru: ${question}\nVeri: ${JSON.stringify(rows)}\nYukarıdaki veriye dayanarak sorunun dilinde ve kısa bir yanıt ver.`;
    const answer = await chatWithGPT(answerPrompt, { model, max_tokens, temperature });
  res.json({ answer, sparql: sparqlQuery, cleanedSparql: cleanedQuery, rows });
  } catch (err) {
  res.status(500).json({ error: err && err.message ? err.message : String(err), sparql: sparqlQuery, cleanedSparql: typeof cleanedQuery !== 'undefined' ? cleanedQuery : null });
  }
});
// Doğal dil sorudan SPARQL sorgusu üretip sonucu dönen endpoint
app.post('/ask-sparql', async (req, res) => {
  const { question, model, max_tokens, temperature } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Missing question in body' });
  try {
    // ChatGPT'den SPARQL sorgusu iste
    const prompt = `Aşağıdaki soruya uygun bir SPARQL sorgusu üret ve sadece sorguyu döndür:\nSoru: ${question}`;
  const sparqlQuery = await chatWithGPT(prompt, { model, max_tokens, temperature });
  const cleanedQuery = sanitizeSparql(sparqlQuery);
  // Sorguyu çalıştır
    const raw = await sparql(cleanedQuery);
    let rows;
    if (raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'boolean')) {
      rows = { ask: raw.boolean };
    } else if (raw && raw.results && Array.isArray(raw.results.bindings)) {
      rows = bindingsToObjects(raw);
    } else {
      rows = raw;
    }
    res.json({ sparql: sparqlQuery, cleanedSparql: cleanedQuery, rows, count: Array.isArray(rows) ? rows.length : undefined });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err), sparql: typeof sparqlQuery !== 'undefined' ? sparqlQuery : null, cleanedSparql: typeof cleanedQuery !== 'undefined' ? cleanedQuery : null });
  }
});

// POST /query with body { query }
app.post('/query', async (req, res) => {
  const query = req.body.query;
  if (!query) return res.status(400).json({ error: 'Missing query in body' });
  try {
    const raw = await sparql(query);
    const rows = bindingsToObjects(raw);
    res.json({ rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download last results as CSV/JSON by query param type
app.post('/download', async (req, res) => {
  const query = req.body.query;
  const type = (req.query.type || 'json').toLowerCase();
  if (!query) return res.status(400).json({ error: 'Missing query in body' });
  try {
    const raw = await sparql(query);
    const rows = bindingsToObjects(raw);
    if (type === 'csv') {
      const csv = stringify(rows, { header: true });
      res.setHeader('Content-Type', 'text/csv');
      res.send(csv);
    } else {
      res.json({ rows, count: rows.length });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== Sequelize endpoints ==============
app.get('/db/users', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Number(req.query.offset) || 0;
  try {
    const { rows, count } = await User.findAndCountAll({
      attributes: ['id', 'username', 'email', 'fullName', 'created_at'],
      order: [['id', 'DESC']],
      limit, offset
    });
    res.json({ rows, count, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/db/purchases', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const purchases = await Purchase.findAll({
      where: { user_id: userId },
      include: [{ model: PurchaseItem, as: 'items' }],
      order: [['id', 'DESC']]
    });
    res.json({ rows: purchases, count: purchases.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user
app.post('/db/users', async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create purchase with items
app.post('/db/purchases', async (req, res) => {
  const { userId, items, currency, status, shippingAddress } = req.body || {};
  if (!userId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'userId and items[] are required' });
  }
  try {
    const purchase = await createPurchaseWithItems(userId, items, { currency, status, shippingAddress });
    res.status(201).json(purchase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
syncModels()
  .then(() => {
    console.log('Sequelize schema synced');
    app.listen(port, () => console.log(`Graph API listening on http://localhost:${port}`));
  })
  .catch(err => {
    console.error('Failed to ensure DB schema:', err.message);
    process.exit(1);
  });
