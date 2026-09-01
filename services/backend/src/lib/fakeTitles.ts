const NAMES = ['Bilal Ahmed','Sara Khan','Muhammad Hamza','Ayesha Siddiqui','Fatima Noor','Ali Raza','Zainab Bibi','Usman Ghani','Hina Shahid','Imran Malik','Khadija Tul Kubra','Abdul Rehman'];

export function djb2(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function resolveFakeTitle(iban: string): string {
  return NAMES[djb2(iban) % NAMES.length];
}
