// Three-way merge of the last synced snapshot and the two device copies.
// A conflict is returned instead of silently replacing either user's edit.
(function (root) {
  // Object key insertion order is not a data change.
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
    return value;
  };
  const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const plain = x => x && typeof x === 'object' && !Array.isArray(x);
  function merge(base, local, remote, choices = {}) {
    const conflicts = [];
    const details = [];
    function walk(b, l, r, path) {
      if (same(l, r)) return l;
      if (same(l, b)) return r;
      if (same(r, b)) return l;
      if (Array.isArray(l) && Array.isArray(r) && (!b || Array.isArray(b)) &&
          [...(b || []), ...l, ...r].every(x => plain(x) && typeof x.id === 'string')) {
        const ids = [...new Set([...(b || []), ...r, ...l].map(x => x.id))];
        return ids.map(id => walk((b || []).find(x => x.id === id),
          l.find(x => x.id === id), r.find(x => x.id === id), path + '.' + id))
          .filter(x => x !== undefined);
      }
      if (Array.isArray(l) && Array.isArray(r) && (!b || Array.isArray(b)) &&
          [...(b || []), ...l, ...r].every(x => typeof x === 'string') &&
          [b || [],l,r].every(a => new Set(a).size === a.length)) {
        const baseline=b || [];
        return [...new Set([...baseline,...r,...l])]
          .filter(x => baseline.includes(x) ? l.includes(x) && r.includes(x) : l.includes(x) || r.includes(x));
      }
      // A stale empty prayer list must not erase prayers saved in the account.
      // This is intentionally narrow: only the worshipDuas collection.
      if (path === 'data.worshipDuas' && Array.isArray(l) && Array.isArray(r) &&
          l.length === 0 && r.length > 0) return r;
      // Preserve additions from either device in lists without record IDs.
      // Only applies when neither side removed an existing baseline entry.
      if (Array.isArray(l) && Array.isArray(r) && Array.isArray(b) &&
          b.every(x => l.some(y => same(x,y)) && r.some(y => same(x,y)))) {
        const merged = [...r];
        for (const item of l) if (!merged.some(x => same(x,item))) merged.push(item);
        return merged;
      }
      if (plain(l) && plain(r) && (b === undefined || plain(b))) {
        const result = {};
        for (const k of new Set([...Object.keys(b || {}), ...Object.keys(r), ...Object.keys(l)])) {
          const v = walk(b?.[k], l[k], r[k], path + '.' + k);
          if (v !== undefined) result[k] = v;
        }
        return result;
      }
      // Dhikr counters must never be lost merely because another device
      // lacks a counter key. Keep the higher recorded count on conflict.
      if (/^data\.adhkarCounts(?:\.|$)/.test(path) &&
          [b,l,r].every(v => v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v)))) {
        const numbers=[l,r].filter(v => typeof v === 'number' && Number.isFinite(v));
        return numbers.length ? Math.max(...numbers) : undefined;
      }
      // Presentation-only preferences should not block content synchronization.
      // Prefer the account preference when both devices changed it.
      if (/^data\.designSettings\.(applyAll|audioMode)$/.test(path)) return r;
      conflicts.push(path);
      details.push({path,local:l,remote:r});
      return choices[path] === 'remote' ? r : l;
    }
    const value = walk(base, local, remote, 'data');
    return {value, conflicts, details};
  }
  root.yomiMerge = merge;
  if (typeof module !== 'undefined') module.exports = merge;
})(typeof window === 'undefined' ? globalThis : window);
