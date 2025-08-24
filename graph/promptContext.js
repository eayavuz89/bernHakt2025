// High-signal prompt context for generating reliable SPARQL against our dataset
// Keep this concise and curated. Update when schema evolves.

export function buildPromptContext(schemaSnippet = '') {
  const prefixes = [
    'PREFIX exs: <https://static.rwpz.net/spendcast/schema#>',
    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>'
  ].join('\n');

  const policy = [
    '- Language: Prefer English labels/texts; when filtering by language use FILTER(langMatches(lang(?v), "en")).',
    '- Limits: Include LIMIT 100 by default unless the question asks otherwise.',
    '- Use only the listed prefixes and predicates; do not invent new vocabularies.',
    '- Return only the SPARQL query, no explanations or markdown.'
  ].join('\n');

  const dictionary = [
    '- Product (class) → exs:Product',
    '- Human label → rdfs:label (lang string)',
    '- Name → exs:name (lang string)',
    '- Description → exs:description (lang string)',
    '- Category → exs:category (IRI)',
    '- Migipedia URL → exs:migipediaUrl (IRI/string)',
    '- Migros ID → exs:migrosId (string/integer)',
    '- Migros Online ID → exs:migrosOnlineId (string/integer)',
    '- Product URLs → exs:productUrls (string/IRI)',
    '- UID → exs:uid (string)'
  ].join('\n');

  const relationships = [
    '?product a exs:Product ;',
    '         rdfs:label ?label ;',
    '         exs:name ?name ;',
    '         exs:description ?description ;',
    '         exs:category ?category ;',
    '         exs:migipediaUrl ?migipediaUrl ;',
    '         exs:migrosId ?migrosId ;',
    '         exs:migrosOnlineId ?migrosOnlineId ;',
    '         exs:productUrls ?productUrls ;',
    '         exs:uid ?uid .'
  ].join('\n');

  const fewShots = [
    {
      q: 'List 10 product names and Migipedia URLs containing the word "pumpkin".',
      sparql: `${prefixes}\nSELECT ?product ?name ?migipediaUrl WHERE {\n  ?product a exs:Product ;\n           exs:name ?name ;\n           exs:migipediaUrl ?migipediaUrl .\n  FILTER(CONTAINS(LCASE(STR(?name)), "pumpkin"))\n} ORDER BY LCASE(STR(?name))\nLIMIT 10`
    },
    {
      q: 'How many products are there per category? Return top 10 categories by count.',
      sparql: `${prefixes}\nSELECT ?category (COUNT(?product) AS ?count) WHERE {\n  ?product a exs:Product ; exs:category ?category .\n} GROUP BY ?category\nORDER BY DESC(?count)\nLIMIT 10`
    },
    {
      q: 'Find 20 products with English labels, returning product, label, and uid.',
      sparql: `${prefixes}\nSELECT ?product ?label ?uid WHERE {\n  ?product a exs:Product ; rdfs:label ?label ; exs:uid ?uid .\n  FILTER(langMatches(lang(?label), "en"))\n} ORDER BY LCASE(STR(?label))\nLIMIT 20`
    }
  ];

  const fewShotBlock = fewShots.map((ex, i) => [
    `# Example ${i + 1} (Question)`,
    `# ${ex.q}`,
    ex.sparql
  ].join('\n')).join('\n\n');

  return [
    prefixes,
    '',
    '# Policy',
    policy,
    '',
    '# Dictionary (business term → predicate)',
    dictionary,
    '',
    '# Core product relations',
    'WHERE {',
    relationships,
    '}',
    '',
    schemaSnippet ? '# Schema (truncated)' : '',
    schemaSnippet || '',
    '',
    '# Few-shot examples',
    fewShotBlock
  ].filter(Boolean).join('\n');
}
