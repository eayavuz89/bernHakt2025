import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ---- senin yolların ----
const MCP_PY  = "C:/Users/eayav/Desktop/Repository/spendcast-mcp/.venv/Scripts/python.exe";
const MCP_CWD = "C:/Users/eayav/Desktop/Repository/spendcast-mcp";
const MCP_ARGS = ["src/spendcast_mcp/server.py"];

// toolResult içinden JSON çekmek için yardımcı
const pickJson = (r) =>
  (Array.isArray(r?.content) ? r.content.find(x => x.type === "json")?.json : null) ?? r;

async function main() {
  // 1) transport'u oluştur
  const transport = new StdioClientTransport({
    command: MCP_PY,
    args: MCP_ARGS,
    cwd: MCP_CWD,
    stderr: "inherit"
  });

  // 2) client'ı kur (transport'u burada vermiyoruz!)
  const client = new Client({
    name: "spendcast-node-client",
    version: "0.0.1",
    capabilities: { tools: {} }
  });

  // 3) bağlanırken transport'u geçir
  await client.connect(transport);

  // 4) sunucudaki tool’ları al
  const { tools } = await client.listTools();
  console.log("Tools:", tools.map(t => t.name));
  const toolName =
    tools.find(t => t.name === "execute_sparql_validated")?.name ??
    tools.find(t => t.name === "execute_sparql")?.name;
  if (!toolName) throw new Error("execute_sparql aracı bulunamadı.");

  // 5) basit test sorgusu
  const q1 = `SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }`;
  const r1 = pickJson(await client.callTool(toolName, { query: q1 }));
  console.log("COUNT:", JSON.stringify(r1, null, 2));

  // 6) örnek domain sorgusu (prefix TTL’dekiyle birebir olmalı)
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
  const r2 = pickJson(await client.callTool(toolName, { query: q2 }));
  console.log("Sample:", JSON.stringify(r2, null, 2));

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
