// Open Food Facts integration: fetch Nutri-Score by product name and enrich rows

const UA = 'bernHakt2025/1.0 (OpenFoodFacts integration)';

const cache = new Map(); // name -> result|null

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`OFF request failed: ${res.status}`);
  return res.json();
}

export async function getNutriScoreForName(name) {
  try {
    const key = (name || '').trim().toLowerCase();
    if (!key) return null;
    if (cache.has(key)) return cache.get(key);

    const params = new URLSearchParams({
      search_terms: key,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '1',
      fields: 'product_name,brands,code,nutriscore_grade,nutriscore_score,categories_tags'
    });
    const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
    const data = await fetchJson(url);
    const p = Array.isArray(data?.products) && data.products.length > 0 ? data.products[0] : null;
    if (!p) { cache.set(key, null); return null; }
    const result = {
      grade: p.nutriscore_grade || null,
      score: typeof p.nutriscore_score === 'number' ? p.nutriscore_score : null,
      code: p.code || null,
      product_name: p.product_name || null,
      brands: p.brands || null,
      source: 'openfoodfacts'
    };
    cache.set(key, result);
    return result;
  } catch (e) {
    return null;
  }
}

export async function enrichRowsWithNutriScore(rows, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const max = Number(process.env.OFF_MAX_ENRICH) || options.max || 15;
  const slice = rows.slice(0, Math.min(rows.length, max));
  // Process sequentially for simplicity and to be gentle on OFF API
  for (const r of slice) {
    try {
      const name = r?.label || r?.name || r?.product_name;
      if (!name || typeof name !== 'string') continue;
      const info = await getNutriScoreForName(name);
      if (info && info.grade) {
        r.nutriScore = info; // attach as a separate property
      }
    } catch (_) {
      // ignore per-row errors
    }
  }
  return rows;
}
