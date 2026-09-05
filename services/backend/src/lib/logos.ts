/**
 * Institution/biller logos are fetched live from Google's favicon service rather than
 * stored — one URL formula, no logo assets to seed or keep in sync with real brands.
 */
export const logoUrlFor = (domain: string): string =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
