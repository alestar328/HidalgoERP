import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_IDS,
  CORE_MODULES,
  MODULES,
  MODULE_IDS,
  OPTIONAL_MODULES,
} from '../../src/modules/catalog';
import {
  activeModules,
  dependenciesOf,
  dependentsOf,
  planToggle,
  presetModules,
  toOverrides,
} from '../../src/modules/resolve';

describe('catálogo de módulos', () => {
  it('las dependencias apuntan a módulos que existen y no hay ciclos', () => {
    for (const id of MODULE_IDS) {
      for (const dep of MODULES[id].requires) expect(MODULE_IDS).toContain(dep);
      expect(dependenciesOf(id)).not.toContain(id);
    }
  });

  it('el núcleo solo depende del núcleo', () => {
    for (const id of CORE_MODULES) {
      for (const dep of dependenciesOf(id)) expect(MODULES[dep].core).toBe(true);
    }
  });

  it('cada paquete por rubro trae solo opcionales y con sus dependencias completas', () => {
    for (const t of BUSINESS_TYPE_IDS) {
      const preset = presetModules(t);
      for (const id of BUSINESS_TYPES[t].modules) {
        expect(OPTIONAL_MODULES).toContain(id);
        for (const dep of dependenciesOf(id)) expect(preset.has(dep)).toBe(true);
      }
      // Lo que se activa es exactamente el paquete: no se cae nada por dependencias.
      expect([...activeModules(t)].sort()).toEqual([...preset].sort());
    }
  });

  it('confección trae producción, que necesita compras', () => {
    const ropa = activeModules('ropa');
    expect(ropa.has('produccion')).toBe(true);
    expect(ropa.has('compras')).toBe(true);
    expect(activeModules('bodega').has('produccion')).toBe(false);
  });
});

describe('módulos activos de un negocio', () => {
  it('siempre incluye el núcleo, aunque el dueño intente apagarlo', () => {
    const active = activeModules('general', { productos: false, ventas: false });
    for (const id of CORE_MODULES) expect(active.has(id)).toBe(true);
  });

  it('un rubro desconocido se trata como "general"', () => {
    expect(activeModules('zapatería')).toEqual(activeModules('general'));
  });

  it('las decisiones del dueño encienden y apagan sobre el paquete', () => {
    const active = activeModules('bodega', { fiados: false, variantes: true });
    expect(active.has('fiados')).toBe(false);
    expect(active.has('variantes')).toBe(true);
  });

  it('un módulo sin su dependencia queda apagado', () => {
    const active = activeModules('ropa', { compras: false });
    expect(active.has('compras')).toBe(false);
    expect(active.has('produccion')).toBe(false);
  });

  it('ignora filas de módulos que el código ya no conoce', () => {
    expect(toOverrides([{ module_id: 'viejo', enabled: true }, { module_id: 'fiados', enabled: false }])).toEqual({
      fiados: false,
    });
  });
});

describe('encender y apagar con dependencias', () => {
  it('encender producción también enciende compras', () => {
    const plan = planToggle(activeModules('general'), 'produccion', true);
    expect(plan).toEqual({ enabled: true, modules: ['produccion', 'compras'], alsoChanged: ['compras'] });
  });

  it('apagar compras también apaga producción', () => {
    const plan = planToggle(activeModules('ropa'), 'compras', false);
    expect(plan).toEqual({ enabled: false, modules: ['compras', 'produccion'], alsoChanged: ['produccion'] });
  });

  it('sin dependencias pendientes no hay nada extra que avisar', () => {
    expect(planToggle(activeModules('general'), 'variantes', true)?.alsoChanged).toEqual([]);
  });

  it('no hace nada con el núcleo ni si ya está en ese estado', () => {
    expect(planToggle(activeModules('general'), 'ventas', false)).toBeNull();
    expect(planToggle(activeModules('ropa'), 'produccion', true)).toBeNull();
  });

  it('aplicar el plan deja todo consistente', () => {
    const before = activeModules('ropa');
    const plan = planToggle(before, 'compras', false)!;
    const overrides = Object.fromEntries(plan.modules.map((m) => [m, plan.enabled]));
    const after = activeModules('ropa', overrides);
    expect(after.has('compras')).toBe(false);
    expect(after.has('produccion')).toBe(false);
    expect(dependentsOf('compras')).toEqual(['produccion']);
  });
});
