import {
  BUSINESS_TYPES,
  CORE_MODULES,
  MODULES,
  MODULE_IDS,
  isBusinessType,
  isModuleId,
  type BusinessType,
  type ModuleId,
} from './catalog';

/** Decisiones guardadas del dueño (filas de organization_modules). */
export type ModuleOverrides = Partial<Record<ModuleId, boolean>>;

/** Pasa las filas de la base a overrides, ignorando módulos que el código ya no conoce. */
export function toOverrides(rows: { module_id: string; enabled: boolean }[]): ModuleOverrides {
  const out: ModuleOverrides = {};
  for (const r of rows) if (isModuleId(r.module_id)) out[r.module_id] = r.enabled;
  return out;
}

/** Lo que trae el paquete del rubro: núcleo + sus opcionales. */
export function presetModules(businessType: string): Set<ModuleId> {
  const type: BusinessType = isBusinessType(businessType) ? businessType : 'general';
  return new Set<ModuleId>([...CORE_MODULES, ...BUSINESS_TYPES[type].modules]);
}

/**
 * Módulos encendidos de verdad: paquete del rubro + decisiones del dueño.
 * El núcleo no se puede apagar, y un módulo sin sus dependencias queda apagado.
 */
export function activeModules(businessType: string, overrides: ModuleOverrides = {}): Set<ModuleId> {
  const active = presetModules(businessType);
  for (const id of MODULE_IDS) {
    const choice = overrides[id];
    if (choice === undefined || MODULES[id].core) continue;
    if (choice) active.add(id);
    else active.delete(id);
  }
  // Quita en cadena lo que se quedó sin dependencias.
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...active]) {
      if (MODULES[id].requires.some((dep) => !active.has(dep))) {
        active.delete(id);
        changed = true;
      }
    }
  }
  return active;
}

/** Todas las dependencias de un módulo, directas e indirectas. */
export function dependenciesOf(id: ModuleId): ModuleId[] {
  const seen = new Set<ModuleId>();
  const visit = (m: ModuleId) => {
    for (const dep of MODULES[m].requires) {
      if (!seen.has(dep)) {
        seen.add(dep);
        visit(dep);
      }
    }
  };
  visit(id);
  return MODULE_IDS.filter((m) => seen.has(m));
}

/** Módulos que dependen de este, directa o indirectamente. */
export function dependentsOf(id: ModuleId): ModuleId[] {
  return MODULE_IDS.filter((m) => m !== id && dependenciesOf(m).includes(id));
}

export interface ModuleChange {
  enabled: boolean;
  /** Todos los módulos que cambian, incluido el pedido. */
  modules: ModuleId[];
  /** Los que cambian además del pedido (para avisarle al dueño). */
  alsoChanged: ModuleId[];
}

/**
 * Qué cambia al encender o apagar un módulo, partiendo de lo que está activo:
 * encender también enciende sus dependencias; apagar también apaga lo que depende de él.
 * Devuelve null si no hay nada que hacer o si es del núcleo.
 */
export function planToggle(active: Set<ModuleId>, id: ModuleId, enable: boolean): ModuleChange | null {
  if (MODULES[id].core || active.has(id) === enable) return null;
  const related = enable ? dependenciesOf(id) : dependentsOf(id);
  const alsoChanged = related.filter((m) => !MODULES[m].core && active.has(m) !== enable);
  return { enabled: enable, modules: [id, ...alsoChanged], alsoChanged };
}
