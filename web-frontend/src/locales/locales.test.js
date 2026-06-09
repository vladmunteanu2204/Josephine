import { describe, it, expect } from 'vitest';
import en from './en.json';
import itLocale from './it.json';   // NOT `it` — that's Vitest's test fn
import de from './de.json';

// Flatten nested keys to dotted paths so we compare the full key space, not just
// the top level. A key present in one language but missing in another silently
// falls back to the key name in the UI — this test catches that.
function keyPaths(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...keyPaths(v, path));
    else out.push(path);
  }
  return out.sort();
}

describe('locale key parity (en / it / de)', () => {
  const enKeys = keyPaths(en);
  const itKeys = keyPaths(itLocale);
  const deKeys = keyPaths(de);

  it('it.json has exactly the same keys as en.json', () => {
    const missing = enKeys.filter((k) => !itKeys.includes(k));
    const extra = itKeys.filter((k) => !enKeys.includes(k));
    expect({ missingFromIt: missing, extraInIt: extra }).toEqual({ missingFromIt: [], extraInIt: [] });
  });

  it('de.json has exactly the same keys as en.json', () => {
    const missing = enKeys.filter((k) => !deKeys.includes(k));
    const extra = deKeys.filter((k) => !enKeys.includes(k));
    expect({ missingFromDe: missing, extraInDe: extra }).toEqual({ missingFromDe: [], extraInDe: [] });
  });

  it('no translation value is empty', () => {
    for (const [lang, obj] of [['en', en], ['it', itLocale], ['de', de]]) {
      const empties = keyPaths(obj).filter((path) => {
        const val = path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
        return typeof val === 'string' && val.trim() === '';
      });
      expect(empties, `empty values in ${lang}.json`).toEqual([]);
    }
  });
});
