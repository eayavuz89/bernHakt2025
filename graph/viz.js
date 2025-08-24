// Build a simple Vega-Lite spec from tabular rows if the shape is visualizable

function isDateLikeKey(key) {
  const k = String(key).toLowerCase();
  return k.includes('date') || k.includes('time') || k.endsWith('_at');
}

function isDateValue(v) {
  if (v == null) return false;
  const s = String(v);
  return /^(\d{4}-\d{2}-\d{2})([tT ]\d{2}:\d{2}(:\d{2})?)?/.test(s);
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '.'));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export function buildVegaLiteSpec(rows) {
  try {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const sample = rows.slice(0, Math.min(rows.length, 100));
    const keys = Object.keys(sample[0] || {});
    if (keys.length === 0) return null;

    const stats = keys.map(k => {
      let numericCount = 0, dateCount = 0, stringCount = 0;
      for (const r of sample) {
        const v = r[k];
        if (v == null) continue;
        const num = toNumber(v);
        if (Number.isFinite(num)) numericCount++;
        if (isDateValue(v) || isDateLikeKey(k)) dateCount++;
        if (typeof v === 'string') stringCount++;
      }
      return { key: k, numericCount, dateCount, stringCount };
    });

    const pickNumeric = () => stats
      .filter(s => s.numericCount >= Math.max(3, Math.ceil(sample.length * 0.3)))
      .sort((a, b) => b.numericCount - a.numericCount)[0]?.key;

    const pickDate = () => stats
      .filter(s => s.dateCount >= Math.max(3, Math.ceil(sample.length * 0.2)))
      .sort((a, b) => b.dateCount - a.dateCount)[0]?.key;

    const pickCategory = () => stats
      .filter(s => s.stringCount >= Math.max(3, Math.ceil(sample.length * 0.3)))
      .sort((a, b) => b.stringCount - a.stringCount)[0]?.key;

    const yKey = pickNumeric();
    const tKey = pickDate();
    const xKey = tKey || pickCategory();
    if (!yKey || !xKey) return null;

    const isTime = tKey != null && xKey === tKey;
    const title = isTime ? `${yKey} over ${xKey}` : `${yKey} by ${xKey}`;

    let values = rows;
    if (!isTime) {
      const freq = new Map();
      for (const r of rows) {
        const k = r[xKey];
        if (k == null) continue;
        freq.set(k, (freq.get(k) || 0) + 1);
      }
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => e[0]);
      values = rows.filter(r => top.includes(r[xKey]));
    }

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title,
      data: { values },
      mark: isTime ? { type: 'line', point: true } : { type: 'bar' },
      encoding: {
        x: isTime
          ? { field: xKey, type: 'temporal', title: xKey }
          : { field: xKey, type: 'nominal', sort: '-y', title: xKey },
        y: { field: yKey, type: 'quantitative', title: yKey },
        tooltip: keys.slice(0, 8).map(k => ({ field: k, type: k === yKey ? 'quantitative' : (k === xKey && isTime ? 'temporal' : 'nominal') }))
      }
    };

    return { type: 'vega-lite', spec };
  } catch (_) {
    return null;
  }
}
// Build a simple Vega-Lite spec from tabular rows if the shape is visualizable

function isDateLikeKey(key) {
  const k = String(key).toLowerCase();
  return k.includes('date') || k.includes('time') || k.endsWith('_at');
}

function isDateValue(v) {
  if (v == null) return false;
  const s = String(v);
  // ISO date or datetime
  return /^(\d{4}-\d{2}-\d{2})([tT ]\d{2}:\d{2}(:\d{2})?)?/.test(s);
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '.'));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export function buildVegaLiteSpec(rows, options = {}) {
  try {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const sample = rows.slice(0, Math.min(rows.length, 100));
    // Gather keys
    const keys = Object.keys(sample[0] || {});
    if (keys.length === 0) return null;

    // Score each key as numeric, date, or categorical
    const stats = keys.map(k => {
      let numericCount = 0, dateCount = 0, stringCount = 0;
      for (const r of sample) {
        const v = r[k];
        if (v == null) continue;
        const num = toNumber(v);
        if (Number.isFinite(num)) numericCount++;
        if (isDateValue(v) || isDateLikeKey(k)) dateCount++;
        if (typeof v === 'string') stringCount++;
      }
      return { key: k, numericCount, dateCount, stringCount };
    });

    const pickNumeric = () => stats
      .filter(s => s.numericCount >= Math.max(3, Math.ceil(sample.length * 0.3)))
      .sort((a, b) => b.numericCount - a.numericCount)[0]?.key;

    const pickDate = () => stats
      .filter(s => s.dateCount >= Math.max(3, Math.ceil(sample.length * 0.2)))
      .sort((a, b) => b.dateCount - a.dateCount)[0]?.key;

    const pickCategory = () => stats
      .filter(s => s.stringCount >= Math.max(3, Math.ceil(sample.length * 0.3)))
      .sort((a, b) => b.stringCount - a.stringCount)[0]?.key;

    const yKey = pickNumeric();
    const tKey = pickDate();
    const xKey = tKey || pickCategory();

    if (!yKey || !xKey) return null;

    const isTime = tKey != null && xKey === tKey;
    // Create a title from keys
    const title = isTime ? `${yKey} over ${xKey}` : `${yKey} by ${xKey}`;

    // For categorical, limit top 15 categories by frequency
    let values = rows;
    if (!isTime) {
      const freq = new Map();
      for (const r of rows) {
        const k = r[xKey];
        if (k == null) continue;
        freq.set(k, (freq.get(k) || 0) + 1);
      }
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => e[0]);
      values = rows.filter(r => top.includes(r[xKey]));
    }

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title,
      data: { values },
      mark: isTime ? { type: 'line', point: true } : { type: 'bar' },
      encoding: {
        x: isTime
          ? { field: xKey, type: 'temporal', title: xKey }
          : { field: xKey, type: 'nominal', sort: '-y', title: xKey },
        y: { field: yKey, type: 'quantitative', title: yKey },
        tooltip: keys.slice(0, 8).map(k => ({ field: k, type: k === yKey ? 'quantitative' : (k === xKey && isTime ? 'temporal' : 'nominal') }))
      }
    };

    return { type: 'vega-lite', spec };
  } catch (e) {
    return null;
  }
}
