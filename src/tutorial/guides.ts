/**
 * Tutoriales: guías paso a paso de cada app. Sin React, para poder probarlas.
 *
 * Cada paso puede abrir una ruta y resaltar un elemento marcado con `data-tour="<target>"`.
 * Si el elemento no está en pantalla (p. ej. una lista vacía), el paso se muestra al centro.
 *
 * Agregar una guía = una entrada en GUIDES + los `data-tour` en las pantallas que resalta.
 * Cuando un módulo pase de 'soon' a 'ready', se le agrega su guía aquí.
 */
import { MODULES, type ModuleId } from '../modules/catalog';

export interface GuideStep {
  title: string;
  text: string;
  /** Ruta que se abre antes de mostrar el paso. */
  route?: string;
  /** Valor de `data-tour` del elemento a resaltar. */
  target?: string;
  /**
   * El paso espera a que el usuario toque el elemento resaltado y llegue a una ruta que cumpla
   * esta expresión; entonces avanza solo. Mientras, se puede tocar el elemento resaltado.
   */
  waitFor?: { path: string; hint: string };
  /** Solo se muestra si estos módulos están activos. */
  requires?: ModuleId[];
  ownerOnly?: boolean;
}

export interface Guide {
  id: string;
  /** Módulo al que pertenece; null = guía general de la app. */
  module: ModuleId | null;
  title: string;
  summary: string;
  /** Ícono de UI5 (registrado en src/icons.ts). */
  icon: string;
  ownerOnly?: boolean;
  /** Otros módulos que tienen que estar activos para ofrecer la guía. */
  requires?: ModuleId[];
  /** Pantallas donde esta guía es la ayuda de contexto (prefijos de ruta, '/' = solo el inicio). */
  paths: string[];
  steps: GuideStep[];
}

export const WELCOME_GUIDE_ID = 'bienvenida';

/** Ficha de un producto (no "nuevo" ni sus subrutas). */
const PRODUCT_DETAIL = '^/productos/(?!nuevo$)[^/]+$';

export const GUIDES: Guide[] = [
  {
    id: WELCOME_GUIDE_ID,
    module: null,
    title: 'Recorrido de bienvenida',
    summary: 'Dónde está cada cosa: apps, avisos, barra de abajo y ayuda.',
    icon: 'home',
    paths: ['/'],
    steps: [
      {
        route: '/',
        title: '¡Bienvenido!',
        text: 'En un minuto te mostramos dónde está cada cosa. Puedes salir cuando quieras y volver a verlo desde el botón de ayuda.',
      },
      {
        route: '/',
        target: 'lp-shell',
        title: 'Tu negocio',
        text: 'Aquí ves el nombre de tu negocio y su rubro. El rubro decide qué apps vienen encendidas.',
      },
      {
        route: '/',
        target: 'lp-apps',
        title: 'Las apps',
        text: 'Cada cuadro abre una app. Están agrupadas por tema y muestran un resumen (por ejemplo, cuántos artículos tienes). Las que dicen «Pronto» llegan en próximas versiones.',
      },
      {
        route: '/',
        target: 'lp-alert',
        title: 'Avisos de stock',
        text: 'Cuando un producto llega a su stock mínimo, aparece aquí un aviso para reponerlo.',
      },
      {
        route: '/',
        target: 'nav',
        title: 'La barra de abajo',
        text: 'Los accesos que más usas. En «Más» están tu negocio, los módulos, los tutoriales y cerrar sesión.',
      },
      {
        route: '/',
        target: 'help',
        title: '¿Dudas? Toca la ayuda',
        text: 'Este botón está arriba en cada pantalla. Abre los tutoriales de lo que estás viendo.',
      },
      {
        route: '/ayuda',
        target: 'help-list',
        title: 'Tutoriales',
        text: 'Aquí están las guías de las apps que tienes activas. Las que ya viste quedan marcadas con ✓. Puedes repetirlas cuando quieras.',
      },
    ],
  },
  {
    id: 'productos-buscar',
    module: 'productos',
    title: 'Buscar y revisar productos',
    summary: 'Encontrar un producto, filtrar lo que falta y leer su stock.',
    icon: 'search',
    paths: ['/productos'],
    steps: [
      {
        route: '/productos',
        target: 'products-search',
        title: 'Buscar',
        text: 'Escribe parte del nombre, el código o el código de barras. No importan tildes ni mayúsculas.',
      },
      {
        route: '/productos',
        target: 'products-filters',
        title: 'Filtros',
        text: '«Stock bajo» y «Agotados» muestran lo que hay que reponer. «Archivados» son productos que ya no vendes.',
      },
      {
        route: '/productos',
        target: 'products-list',
        title: 'La lista',
        text: 'Cada fila muestra precio y stock. El color avisa: naranja, en su mínimo; rojo, agotado. Toca uno para ver su ficha.',
      },
    ],
  },
  {
    id: 'productos-nuevo',
    module: 'productos',
    title: 'Crear un producto',
    summary: 'Nombre, precios, stock inicial y aviso de stock mínimo.',
    icon: 'add',
    ownerOnly: true,
    paths: ['/productos'],
    steps: [
      {
        route: '/productos',
        target: 'products-new',
        title: 'Botón «Nuevo»',
        text: 'Desde aquí creas un producto. También está el cuadro «Nuevo producto» en el inicio.',
      },
      {
        route: '/productos/nuevo',
        target: 'form-basic',
        title: 'Nombre y unidad',
        text: 'Solo el nombre es obligatorio. «Se vende por» indica la unidad: unidad, docena, caja, kilo o litro.',
      },
      {
        route: '/productos/nuevo',
        target: 'form-basic',
        requires: ['produccion'],
        title: 'Compra o producción',
        text: '«Al reponer, se consigue por» dice si lo compras o lo hace tu taller. Así la lista de reposición lo separa.',
      },
      {
        route: '/productos/nuevo',
        target: 'form-prices',
        title: 'Precios',
        text: 'El precio por menor es el que cobras normalmente. El costo solo lo ves tú y sirve para saber cuánto ganas.',
      },
      {
        route: '/productos/nuevo',
        target: 'form-prices',
        requires: ['precios'],
        title: 'Precio por mayor',
        text: 'Activa «Tiene precio por mayor» y pon desde qué cantidad se aplica. Por ejemplo: S/ 2.50 desde 12 unidades.',
      },
      {
        route: '/productos/nuevo',
        target: 'form-stock',
        title: 'Stock inicial y mínimo',
        text: 'Pon cuántos tienes hoy. En «Avisarme cuando queden» va el mínimo: al llegar ahí, te avisamos para reponer.',
      },
      {
        route: '/productos/nuevo',
        target: 'form-codes',
        title: 'Códigos (opcional)',
        text: 'Tu código interno y el código de barras del empaque. Te ayudan a encontrarlo rápido.',
      },
      {
        route: '/productos/nuevo',
        target: 'form-save',
        title: 'Guardar',
        text: 'Al guardar, el producto aparece en la lista y ya se puede vender.',
      },
    ],
  },
  {
    id: 'stock-movimientos',
    module: 'productos',
    title: 'Registrar entradas y ajustar stock',
    summary: 'Sumar mercadería que llegó, corregir un conteo y ver el historial.',
    icon: 'inventory',
    ownerOnly: true,
    paths: ['/productos'],
    steps: [
      {
        route: '/productos',
        target: 'products-list',
        waitFor: { path: PRODUCT_DETAIL, hint: 'Toca un producto para seguir' },
        title: 'Elige un producto',
        text: 'Toca cualquier producto de la lista para abrir su ficha. Si aún no tienes productos, crea uno primero.',
      },
      {
        target: 'stock-card',
        title: 'Stock actual',
        text: 'Aquí ves cuánto hay ahora.',
      },
      {
        target: 'stock-actions',
        title: 'Entrada o Ajustar',
        text: '«Entrada» suma lo que llegó. «Ajustar» sirve para registrar una salida (merma, pérdida, regalo) o corregir el número después de contar.',
      },
      {
        target: 'stock-movements',
        title: 'Historial',
        text: 'Cada cambio queda registrado con fecha y motivo. Así sabes siempre por qué cambió el stock.',
      },
      {
        target: 'product-archive',
        title: 'Archivar',
        text: 'Si ya no vendes un producto, archívalo: deja de salir para vender, pero su historial se conserva.',
      },
    ],
  },
  {
    id: 'variantes',
    module: 'variantes',
    title: 'Tallas, colores y modelos',
    summary: 'Agregar variantes a un producto, cada una con su stock.',
    icon: 'product',
    ownerOnly: true,
    paths: ['/productos'],
    steps: [
      {
        title: '¿Qué es una variante?',
        text: 'Tallas, colores o modelos de un mismo producto. Cada variante lleva su propio stock y precio, y el producto suma el total.',
      },
      {
        route: '/productos',
        target: 'products-list',
        waitFor: { path: PRODUCT_DETAIL, hint: 'Toca un producto para seguir' },
        title: 'Abre el producto principal',
        text: 'Toca el producto al que quieres agregar tallas o colores.',
      },
      {
        target: 'variants',
        title: 'Agregar variante',
        text: 'Toca «Agregar variante». Si el producto ya tiene stock, primero déjalo en 0 con «Ajustar»: desde ahí el stock se lleva por variante.',
      },
    ],
  },
  {
    id: 'reposicion',
    module: 'reposicion',
    title: 'Reponer lo que falta',
    summary: 'Lista de agotados y en mínimo, cantidad sugerida y pedido por WhatsApp.',
    icon: 'alert',
    paths: ['/reposicion'],
    steps: [
      {
        title: 'Cómo funciona',
        text: 'Cada producto puede tener un stock mínimo («Avisarme cuando queden»). Cuando llega a ese número, entra en la lista de reposición.',
      },
      {
        route: '/reposicion',
        target: 'reorder',
        title: 'La lista',
        text: 'Ves cuánto queda y cuánto pedir: la cantidad sugerida completa el doble del mínimo. Si todo está en orden, la lista sale vacía.',
      },
      {
        route: '/reposicion',
        requires: ['produccion'],
        target: 'reorder',
        title: 'Producir o comprar',
        text: 'Con Producción activo, la lista se separa en lo que hace tu taller y lo que compras a proveedores.',
      },
      {
        route: '/reposicion',
        target: 'reorder-share',
        title: 'Enviar por WhatsApp',
        text: 'Con un toque mandas la lista a tu proveedor o a tu taller.',
      },
      {
        title: 'Cuando llegue la mercadería',
        text: 'Regístrala con «Entrada» en la ficha de cada producto. Al subir el stock, sale de esta lista.',
      },
    ],
  },
  {
    id: 'modulos',
    module: 'admin',
    title: 'Elegir qué apps usar',
    summary: 'Tipo de negocio, apps opcionales y paquetes por rubro.',
    icon: 'puzzle',
    ownerOnly: true,
    paths: ['/modulos'],
    steps: [
      {
        route: '/modulos',
        target: 'modules-type',
        title: 'Tipo de negocio',
        text: 'Al elegir un rubro se enciende su paquete de apps. Puedes cambiarlo cuando quieras.',
      },
      {
        route: '/modulos',
        target: 'modules-optional',
        title: 'Apps opcionales',
        text: 'Enciende o apaga cada una. Si una necesita otra, te avisamos y se encienden juntas. Apagar una app no borra tus datos.',
      },
      {
        route: '/modulos',
        target: 'modules-packs',
        title: 'Paquetes por rubro',
        text: 'Qué trae encendido cada rubro de fábrica, para comparar.',
      },
    ],
  },
  {
    id: 'negocio',
    module: 'admin',
    title: 'Datos del negocio y vendedores',
    summary: 'Nombre y contacto del negocio, e invitar a quien te ayuda a vender.',
    icon: 'employee',
    ownerOnly: true,
    paths: ['/ajustes'],
    steps: [
      {
        route: '/ajustes',
        target: 'settings-org',
        title: 'Datos del negocio',
        text: 'Nombre, celular y dirección. El nombre sale en los mensajes que envías por WhatsApp.',
      },
      {
        route: '/ajustes',
        target: 'settings-team',
        title: 'Vendedores',
        text: 'Un vendedor registra ventas y consulta el stock, pero no ve costos ni puede borrar o anular.',
      },
      {
        route: '/ajustes',
        target: 'settings-invite',
        title: 'Invitar',
        text: 'Escribe su correo y toca «Invitar». Dile que entre a la app con ese mismo correo: quedará dentro de tu negocio.',
      },
    ],
  },
];

export interface GuideContext {
  active: Set<ModuleId>;
  isOwner: boolean;
}

const allowed = (item: { ownerOnly?: boolean; requires?: ModuleId[] }, ctx: GuideContext) =>
  (!item.ownerOnly || ctx.isOwner) && (item.requires ?? []).every((m) => ctx.active.has(m));

/** Guías que puede ver este usuario: módulo activo, dependencias activas y rol permitido. */
export function visibleGuides(ctx: GuideContext): Guide[] {
  return GUIDES.filter((g) => (g.module === null || ctx.active.has(g.module)) && allowed(g, ctx));
}

/** Pasos de una guía para este usuario (se saltan los de módulos apagados o solo para el dueño). */
export function guideSteps(guide: Guide, ctx: GuideContext): GuideStep[] {
  return guide.steps.filter((s) => allowed(s, ctx));
}

/** Guías de ayuda para la pantalla actual. */
export function guidesForPath(path: string, guides: Guide[]): Guide[] {
  return guides.filter((g) => g.paths.some((p) => (p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`))));
}

/** Módulos activos cuya pantalla aún no existe: su guía llega con ellos. */
export function upcomingGuides(active: Set<ModuleId>): ModuleId[] {
  return [...active].filter((id) => MODULES[id].status === 'soon');
}

export function getGuide(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}
