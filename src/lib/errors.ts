interface MaybePgError {
  code?: string;
  message?: string;
  details?: string;
}

/** Convierte errores de Supabase/Postgres/red en un mensaje corto para el usuario. */
export function errorMessage(error: unknown): string {
  const e = (error ?? {}) as MaybePgError;
  const msg = e.message ?? '';

  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Sin conexión. Revisa tu internet e inténtalo otra vez.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'No se pudo conectar. Revisa tu internet.';

  if (e.code === '23505') {
    if (/sku/i.test(msg + (e.details ?? ''))) return 'Ya existe un producto con ese código.';
    if (/categories/i.test(msg)) return 'Esa categoría ya existe.';
    if (/invitations/i.test(msg)) return 'Ese correo ya fue invitado.';
    return 'Ese dato ya existe.';
  }
  if (e.code === '42501') {
    return /[áéíóúñ]|Solo/i.test(msg) ? msg : 'No tienes permiso para hacer esto.';
  }
  if (e.code === '23503') return 'No se puede borrar porque tiene movimientos registrados.';
  if (/rate limit|security purposes/i.test(msg)) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
  if (/token has expired|invalid.*(otp|token)/i.test(msg)) return 'El código no es válido o ya venció. Pide uno nuevo.';

  // Las funciones de la base ya responden en español.
  return msg || 'Ocurrió un error. Inténtalo otra vez.';
}
