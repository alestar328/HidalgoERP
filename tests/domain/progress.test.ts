import { describe, expect, it } from 'vitest';
import { mergeProgress, pendingSync } from '../../src/tutorial/progress';

describe('progreso de tutoriales: equipo + base', () => {
  it('sin base (sin conexión o migración sin aplicar) usa lo del equipo', () => {
    const local = { welcomeSeen: true, done: { a: '' } };
    expect(mergeProgress(local, null)).toBe(local);
  });

  it('une lo visto en el equipo y en la base, con la fecha más reciente', () => {
    const merged = mergeProgress(
      { welcomeSeen: false, done: { a: '', b: '2026-11-20T10:00:00Z' } },
      { welcomeSeen: true, done: { b: '2026-11-21T10:00:00Z', c: '2026-11-19T10:00:00Z' } },
    );
    expect(merged.welcomeSeen).toBe(true);
    expect(merged.done).toEqual({ a: '', b: '2026-11-21T10:00:00Z', c: '2026-11-19T10:00:00Z' });
  });

  it('sube solo lo que la base no tiene', () => {
    expect(
      pendingSync({ welcomeSeen: true, done: { a: '', b: '' } }, { welcomeSeen: false, done: { b: '2026-11-21T10:00:00Z' } }),
    ).toEqual({ guides: ['a'], welcome: true });
    expect(pendingSync({ welcomeSeen: false, done: {} }, { welcomeSeen: true, done: { b: '' } })).toEqual({
      guides: [],
      welcome: false,
    });
  });
});
