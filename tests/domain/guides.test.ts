import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MODULE_IDS, MODULES, type ModuleId } from '../../src/modules/catalog';
import {
  GUIDES,
  WELCOME_GUIDE_ID,
  guideSteps,
  guidesForPath,
  upcomingGuides,
  visibleGuides,
} from '../../src/tutorial/guides';

const all = new Set<ModuleId>(MODULE_IDS);
const core = new Set<ModuleId>(MODULE_IDS.filter((id) => MODULES[id].core));

/** Todo el código de src, para comprobar que cada paso resalta un elemento que existe. */
function sourceText(dir: string): string {
  return readdirSync(dir)
    .map((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceText(path);
      return /\.tsx?$/.test(name) ? readFileSync(path, 'utf8') : '';
    })
    .join('\n');
}

describe('tutoriales', () => {
  it('los ids son únicos y cada guía tiene pasos', () => {
    const ids = GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GUIDES) expect(g.steps.length).toBeGreaterThan(0);
  });

  it('cada paso con elemento apunta a un data-tour que existe en las pantallas', () => {
    const src = sourceText(fileURLToPath(new URL('../../src', import.meta.url)));
    for (const g of GUIDES) {
      for (const s of g.steps) {
        if (s.target) expect(src, `${g.id}: ${s.target}`).toContain(`data-tour="${s.target}"`);
      }
    }
  });

  it('las guías solo son de módulos con pantalla (los de "Pronto" van en Próximamente)', () => {
    for (const g of GUIDES) if (g.module) expect(MODULES[g.module].status).toBe('ready');
  });

  it('el vendedor no ve guías ni pasos del dueño', () => {
    const seller = visibleGuides({ active: all, isOwner: false });
    expect(seller.some((g) => g.ownerOnly)).toBe(false);
    expect(seller.map((g) => g.id)).toContain(WELCOME_GUIDE_ID);
    for (const g of seller) {
      expect(guideSteps(g, { active: all, isOwner: false }).some((s) => s.ownerOnly)).toBe(false);
    }
  });

  it('las guías de módulos apagados no aparecen', () => {
    const ids = visibleGuides({ active: core, isOwner: true }).map((g) => g.id);
    expect(ids).not.toContain('reposicion');
    expect(ids).not.toContain('variantes');
    expect(ids).toContain('productos-nuevo');
  });

  it('los pasos de módulos apagados se saltan', () => {
    const nuevo = GUIDES.find((g) => g.id === 'productos-nuevo')!;
    const basic = guideSteps(nuevo, { active: core, isOwner: true });
    const full = guideSteps(nuevo, { active: all, isOwner: true });
    expect(full.length).toBeGreaterThan(basic.length);
    expect(basic.some((s) => s.requires?.includes('precios'))).toBe(false);
  });

  it('la ayuda de contexto encuentra la guía de la pantalla', () => {
    const ids = (path: string) => guidesForPath(path, GUIDES).map((g) => g.id);
    expect(ids('/productos')).toContain('productos-buscar');
    expect(ids('/productos/abc')).toContain('stock-movimientos');
    expect(ids('/reposicion')).toEqual(['reposicion']);
    expect(ids('/')).toEqual([WELCOME_GUIDE_ID]);
    expect(ids('/productosx')).toEqual([]);
  });

  it('los pasos que esperan un toque reconocen la ficha del producto, no el formulario nuevo', () => {
    const step = GUIDES.flatMap((g) => g.steps).find((s) => s.waitFor)!;
    const re = new RegExp(step.waitFor!.path);
    expect(re.test('/productos/7b1c')).toBe(true);
    expect(re.test('/productos/nuevo')).toBe(false);
    expect(re.test('/productos/7b1c/editar')).toBe(false);
  });

  it('los módulos activos que aún no tienen pantalla se anuncian como próximos', () => {
    expect(upcomingGuides(all)).toContain('ventas');
    expect(upcomingGuides(all)).not.toContain('productos');
  });
});
