/** Minúsculas, sin tildes y con espacios simples: "  Lápiz   MONGOL " → "lapiz mongol". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Todas las palabras buscadas deben aparecer en el texto (en cualquier orden). */
export function matchesSearch(haystack: string, query: string): boolean {
  const q = normalizeText(query);
  if (q === '') return true;
  const h = normalizeText(haystack);
  return q.split(' ').every((token) => h.includes(token));
}
