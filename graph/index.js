// package.json -> "type": "module" olsun
// npm i node-fetch
import fetch from "node-fetch";

const ENDPOINT = "http://localhost:7200/repositories/spendcast";

// Security kapalıysa auth gerekmez. Açıksa:
// const auth = "Basic " + Buffer.from("admin:root").toString("base64");

async function sparql(query) {
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

(async () => {
  // 1) Basit sayım
  const q1 = `SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }`;
  console.log(await sparql(q1));

  // 2) Domain sorgusu (prefix’i TTL’den birebir al!)
  const EXS = "https://static.rwpz.net/spendcast/schema#";
  const q2 = `
    PREFIX exs: <${EXS}>
    SELECT ?transaction ?amount ?date WHERE {
      ?person a exs:Person ; exs:hasAccount ?account .
      ?transaction exs:hasParticipant ?account ;
                   exs:hasMonetaryAmount ?amount ;
                   exs:hasDate ?date .
    } LIMIT 10
  `;
  console.log(await sparql(q2));
})();
