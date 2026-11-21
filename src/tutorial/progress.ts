/**
 * Progreso de los tutoriales de cada usuario: si ya se le ofreció la bienvenida y qué guías terminó.
 *
 * La fuente de verdad es la base (tabla tutorial_progress, ver 0004): así el progreso sigue a la
 * cuenta en cualquier equipo y el dueño ve el de su equipo. Además se guarda una copia en el
 * navegador para que funcione sin conexión; lo que quede solo aquí se sube al volver.
 */

export interface TutorialProgress {
  welcomeSeen: boolean;
  /** Guías terminadas → fecha de la última vez (ISO; vacía si no se sabe). */
  done: Record<string, string>;
}

export const EMPTY_PROGRESS: TutorialProgress = { welcomeSeen: false, done: {} };

const key = (userId: string) => `mipuesto:tutorial:${userId}`;

export function loadProgress(userId: string): TutorialProgress {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return EMPTY_PROGRESS;
    const data = JSON.parse(raw) as { welcomeSeen?: unknown; done?: unknown };
    const done: Record<string, string> = {};
    // Formato anterior: lista de ids.
    if (Array.isArray(data.done)) {
      for (const id of data.done) if (typeof id === 'string') done[id] = '';
    } else if (data.done && typeof data.done === 'object') {
      for (const [id, at] of Object.entries(data.done)) done[id] = typeof at === 'string' ? at : '';
    }
    return { welcomeSeen: data.welcomeSeen === true, done };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(userId: string, progress: TutorialProgress): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(progress));
  } catch {
    // Sin almacenamiento: queda lo de la base.
  }
}

/** Une lo del equipo con lo de la base: una guía cuenta como vista si está en cualquiera de los dos. */
export function mergeProgress(local: TutorialProgress, server: TutorialProgress | null): TutorialProgress {
  if (!server) return local;
  const done = { ...local.done };
  for (const [id, at] of Object.entries(server.done)) if (!done[id] || at > done[id]) done[id] = at;
  return { welcomeSeen: local.welcomeSeen || server.welcomeSeen, done };
}

/** Lo que el equipo tiene y la base no: hay que subirlo. */
export function pendingSync(local: TutorialProgress, server: TutorialProgress): { guides: string[]; welcome: boolean } {
  return {
    guides: Object.keys(local.done).filter((id) => !(id in server.done)),
    welcome: local.welcomeSeen && !server.welcomeSeen,
  };
}
