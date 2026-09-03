export const fmtRs = (paisa: number) => '₨' + (paisa / 100).toLocaleString('en-PK');

/** Escapes regex metacharacters so a user-supplied search term (e.g. a `+92…` phone) is matched literally. */
export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
