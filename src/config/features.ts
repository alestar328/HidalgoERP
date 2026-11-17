/** Funciones opcionales. Se activan cambiando a true. */
export const FEATURES = {
  /** Escaneo de código de barras con la cámara (se implementa junto con Ventas). */
  barcodeScanner: false,
  /** Ingreso con código por SMS. Requiere configurar un proveedor de SMS en Supabase. */
  phoneOtp: false,
} as const;
