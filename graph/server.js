

import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { sparql, bindingsToObjects } from './sparql.js';
import { stringify } from 'csv-stringify/sync';
import { syncModels, User, Purchase, PurchaseItem } from './db/models.js';
import { createUser, createPurchaseWithItems, getUserPurchases } from './db/services.js';

import { chatWithGPT } from './chatgpt.js';
import { buildPromptContext } from './promptContext.js';



const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});


// ChatGPT endpoint
app.post('/chat', async (req, res) => {
  const { prompt, model, max_tokens, temperature, system } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Missing prompt in body' });
  try {
    const response = await chatWithGPT(prompt, { model, max_tokens, temperature, system });
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Explain SPARQL result via ChatGPT endpoint
app.post('/explain-sparql', async (req, res) => {
  const { query, prompt, system } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing SPARQL query in body' });
  try {
    const raw = await sparql(query);
    const rows = bindingsToObjects(raw);
  const chatPrompt = `${prompt || 'Explain this data in English:'}\nData: ${JSON.stringify(rows)}`;
    const explanation = await chatWithGPT(chatPrompt, { system });
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

function systemPrompt() {
  return `GraphDB – Core Entities and Relationships for Transactions and Product Information

FinancialTransaction
Type: exs:FinancialTransaction
Properties / Relationships:

exs:hasTransactionDate → xsd:date
The date on which the transaction occurred.

exs:hasParticipant → exs:Payee
The party involved in the transaction (e.g., seller, supermarket).

exs:hasReceipt → exs:Receipt
The receipt information associated with the transaction.

Participant (Payee)
Type: exs:Payee
Properties / Relationships:

exs:isPlayedBy → ?merchant
Refers to the seller/merchant (e.g., Migros, Coop).
?merchant is typically an entity (Organization/Store) or a literal string.

Receipt
Type: exs:Receipt
Properties / Relationships:

exs:hasLineItem → exs:ReceiptLineItem
Each line item in the receipt (product or service).

ReceiptLineItem
Type: exs:ReceiptLineItem
Properties / Relationships:

exs:lineSubtotal → xsd:decimal
The price of the product/service in that line.

exs:hasProduct → exs:Product
Reference to the product in the line item.

Product
Type: exs:Product
Properties / Relationships:

rdfs:label → string
Product name (e.g., Milch 1L, Butterzopf).

(Optional) skos:broader / skos:narrower → exs:ProductCategory
The category hierarchy to which the product belongs (e.g., Wine, Beer & Spirits).

ProductCategory
Type: exs:ProductCategory
Properties / Relationships:

rdfs:label → string
Category name (e.g., Wine, Beer & Spirits).

skos:narrower / skos:broader → exs:ProductCategory
Relationships for subcategories / parent categories.

🔄 Summary Flow
FinancialTransaction
   ├── hasTransactionDate → xsd:date
   ├── hasParticipant → Payee ── isPlayedBy → Merchant (e.g., Migros)
   └── hasReceipt → Receipt
                       └── hasLineItem → ReceiptLineItem
                                             ├── lineSubtotal → decimal
                                             └── hasProduct → Product ── label → "Product Name"
                                                                              └── broader/

Usage Scenarios

Date filtering → with exs:hasTransactionDate for time-based queries.

Merchant-based → with exs:isPlayedBy to see from which store purchases were made.

Product-based → via rdfs:label to filter by product name or regex.

Category-based → using skos:broader/narrower to group expenses by category.

Cost analysis → with exs:lineSubtotal to sum or aggregate prices.`;
}

// From a natural language question: generate a SPARQL query, run it, then ask ChatGPT to answer based on results
app.post('/ask-db', async (req, res) => {
  const { question, model, max_tokens, temperature, system } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Missing question in body' });
  let sparqlQuery = null;
  try {
    // fetch schema info and trim if very long
    const schemaText = await getSchemaInfo();
    const schemaSnippet = schemaText && schemaText.length > 3000 ? schemaText.slice(0, 3000) + '\n...[truncated]' : schemaText;
  // 1. Ask ChatGPT for a SPARQL query using curated context + schema snippet
  const context = buildPromptContext(schemaSnippet);
  const prompt = `${context}\n\n# Task\nGenerate a SPARQL query for the following question.\nFollow policy above strictly and return only the query.\nQuestion: ${question}`;
  sparqlQuery = await chatWithGPT(prompt, { model, max_tokens, temperature, system: systemPrompt() });
  // sanitize ChatGPT output to extract actual SPARQL
  const cleanedQuery = sanitizeSparql(sparqlQuery);
  // 2. Execute the query (cleaned)
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
  // 3. Give results and question to ChatGPT; ask for a concise English answer
  const answerPrompt = `You are an analyst. Answer in English concisely.\n\nQuestion: ${question}\nData: ${JSON.stringify(rows)}`;
    const answer = await chatWithGPT(answerPrompt, { model, max_tokens, temperature, system });
  res.json({ answer, sparql: sparqlQuery, cleanedSparql: cleanedQuery, rows });
  } catch (err) {
    // cleanedQuery may be undefined if sanitize failed before declaration; guard it
    let cleanedQuery;
    try { cleanedQuery = sanitizeSparql(String(sparqlQuery || '')); } catch {}
    res.status(500).json({ error: err && err.message ? err.message : String(err), sparql: sparqlQuery, cleanedSparql: cleanedQuery || null });
  }
});
// From a natural language question: generate a SPARQL query and return its results
app.post('/ask-sparql', async (req, res) => {
  const { question, model, max_tokens, temperature, system } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Missing question in body' });
  try {
  // Ask ChatGPT for a SPARQL query (curated context)
  const schemaText = await getSchemaInfo();
  const schemaSnippet = schemaText && schemaText.length > 3000 ? schemaText.slice(0, 3000) + '\n...[truncated]' : schemaText;
  const context = buildPromptContext(schemaSnippet);
  const prompt = `${context}\n\n# Task\nGenerate a SPARQL query for the following question.\nFollow policy above strictly and return only the query.\nQuestion: ${question}`;
  const effectiveSystem = system || process.env.OPENAI_SYSTEM_PROMPT || defaultSystemPrompt();
  const sparqlQuery = await chatWithGPT(prompt, { model, max_tokens, temperature, system: effectiveSystem });
  const cleanedQuery = sanitizeSparql(sparqlQuery);
  // Execute the query
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
    // In failure path sparqlQuery/cleanedQuery may be undefined
    let sparqlQuery, cleanedQuery;
    try { sparqlQuery = String(sparqlQuery); } catch {}
    try { cleanedQuery = sanitizeSparql(String(sparqlQuery || '')); } catch {}
    res.status(500).json({ error: err && err.message ? err.message : String(err), sparql: sparqlQuery || null, cleanedSparql: cleanedQuery || null });
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
    app.listen(port, () => console.log(`Graph API listening without DB on http://localhost:${port}`));
  });
