// package.json -> "type": "module" olsun
// npm i node-fetch
import fetch from "node-fetch";
import fs from 'fs';

const ENDPOINT = "http://localhost:7200/repositories/spendcast";

// Security kapalıysa auth gerekmez. Açıksa:
// const auth = "Basic " + Buffer.from("admin:root").toString("base64");

export async function sparql(query) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      "Accept": "application/sparql-results+json",
      // "Authorization": auth,
    },
    body: query
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GraphDB ${res.status}: ${text}`);
  }
  return res.json();
}
export function bindingsToObjects(sparqlJson) {
  const vars = sparqlJson.head.vars || [];
  return (sparqlJson.results.bindings || []).map(b => {
    const obj = {};
    for (const v of vars) {
      obj[v] = b[v] ? b[v].value : null;
    }
    return obj;
  });
}

// If run directly, execute sample query and write results
if (import.meta.url === `file://${process.cwd().replace(/\\/g, '/')}/graph/index.js`) {
  (async () => {
  // 1) Basit sayım
  const q1 = `PREFIX exs: <https://static.rwpz.net/spendcast/schema#>
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
LIMIT 5000`;
  const raw = await sparql(q1);

  const rows = bindingsToObjects(raw);

  function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

    
  console.log(`${rows.length} rows`);

  if (rows.length === 0) {
    console.log('No results');
  } else {
    // show a manageable sample in the console
    const sampleSize = 50;
    console.log(`Showing first ${Math.min(sampleSize, rows.length)} rows:`);
    console.table(rows.slice(0, sampleSize));

    // Save full results for inspection
    const outJson = 'graph/results.json';
    const outCsv = 'graph/results.csv';
    fs.writeFileSync(outJson, JSON.stringify(rows, null, 2));

    const header = Object.keys(rows[0]);
    const csvLines = [header.join(',')];
    for (const r of rows) {
      csvLines.push(header.map(h => csvEscape(r[h])).join(','));
    }
    fs.writeFileSync(outCsv, csvLines.join('\n'));

    console.log(`Full results written to ${outJson} and ${outCsv}`);
  }
  })();
}
