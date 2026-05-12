/**
 * Synonym dictionary for automotive parts to improve search recall.
 * Maps common variations and languages to canonical search terms.
 */
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  'spark plug': ['bujia', 'bujía', 'sparkplug', 'encendido', 'ignicion', 'ignition'],
  'diesel heater': ['calentador', 'punta de calentamiento', 'glow plug', 'diesel', 'precalentamiento'],
  'filter': ['filtro', 'purificador', 'elemento'],
  'oil': ['aceite', 'lubricante', 'motor'],
  'iridium': ['iridio', 'punta fina', 'laser iridium'],
  'platinum': ['platino', 'g-power'],
  'ngk': ['ene ge ka', 'n.g.k'],
  'denso': ['denco', 'denzo'],
  'bosch': ['bosch', 'boch'],
};

/**
 * Expands a search query by including known synonyms.
 */
export const expandSearchQuery = (query: string): string[] => {
  const normalized = query.toLowerCase().trim();
  const tokens = normalized.split(/\s+/);
  const expansions = new Set<string>([normalized]);

  tokens.forEach(token => {
    Object.entries(SEARCH_SYNONYMS).forEach(([canonical, synonyms]) => {
      if (token === canonical || synonyms.includes(token)) {
        expansions.add(canonical);
        synonyms.forEach(s => expansions.add(s));
      }
    });
  });

  return Array.from(expansions);
};
