/**
 * Family words → saved-recipient nicknames.
 *
 * "Send 2,000 to my father" is the most natural thing a PAYO user says, and nobody saves
 * their father under the nickname "father": he is "Abbu", "Abba", "Baba" or "Papa". Each
 * group below is one relationship in English, Roman Urdu and Urdu script; a query that
 * matches ANY member of a group matches a nickname that starts with ANY member of it.
 * Purely lexical — no model involved — so "father" → "Abbu" is deterministic.
 */
const GROUPS: readonly (readonly string[])[] = [
  ['father', 'dad', 'daddy', 'papa', 'abbu', 'abba', 'abu', 'baba', 'walid', 'ابو', 'ابا', 'بابا', 'والد'],
  ['mother', 'mom', 'mum', 'mummy', 'mama', 'ammi', 'ami', 'amma', 'walida', 'امی', 'اماں', 'ماں', 'والدہ'],
  ['son', 'beta', 'بیٹا', 'بیٹے'],
  ['daughter', 'beti', 'بیٹی'],
  ['brother', 'bhai', 'bhaiya', 'bro', 'بھائی'],
  ['sister', 'behen', 'behan', 'baji', 'apa', 'api', 'aapi', 'بہن', 'باجی', 'آپی', 'آپا'],
  ['husband', 'shohar', 'میاں', 'شوہر'],
  ['wife', 'biwi', 'begum', 'بیوی', 'بیگم'],
  ['uncle', 'chacha', 'mamu', 'mamoo', 'taya', 'khalu', 'phupha', 'چچا', 'ماموں', 'تایا'],
  ['aunt', 'aunty', 'auntie', 'khala', 'phuppo', 'chachi', 'mami', 'خالہ', 'پھپھو', 'چچی', 'ممانی'],
  ['grandfather', 'grandpa', 'dada', 'nana', 'دادا', 'نانا'],
  ['grandmother', 'grandma', 'dadi', 'nani', 'دادی', 'نانی'],
];

/** "my father" / "mere abbu" / "میرے ابو" / "abbu jaan" → "abbu" */
export function normalizeRelationQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/^(my|mere|meri|mera|میرے|میری|میرا)\s+/u, '')
    .replace(/\s+(jaan|jaani|jan|ji|sahab|sahib|جان|جی|صاحب)$/u, '')
    .trim();
}

/**
 * Every word that names the same relationship as `q`, or null when `q` is not a family
 * word. The returned list always contains the normalised query itself.
 */
export function relationAliases(q: string): string[] | null {
  const key = normalizeRelationQuery(q);
  if (!key) return null;
  const group = GROUPS.find((g) => g.includes(key));
  return group ? [...group] : null;
}
