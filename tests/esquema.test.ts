// Comprobaciones del SQL de la casa que no se ven hasta que falla en Supabase.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../supabase/esquema.sql', import.meta.url), 'utf8');

describe('esquema.sql', () => {
  it('ningún DELETE va sin WHERE (Supabase los rechaza si llegan desde la API)', () => {
    const deletes = [...sql.matchAll(/delete\s+from\s+[^;]*;/gi)].map((m) => m[0]);
    expect(deletes.length).toBeGreaterThan(0);
    for (const d of deletes) expect(d, d).toMatch(/\swhere\s/i);
  });
});
