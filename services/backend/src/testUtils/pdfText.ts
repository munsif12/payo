/**
 * Minimal, dependency-free PDF text extractor for tests.
 *
 * statementPdf.ts embeds Plus Jakarta Sans as a CID/Identity-H font, so page content streams
 * hold glyph indices (`<0001000200030003> Tj`), not the original characters — a plain
 * `buffer.includes('some text')` check would never match. Every embedded font still carries a
 * `/ToUnicode` CMap (glyph index → real character) purely so PDF readers can support text
 * search/copy, and we lean on the exact same mechanism here.
 *
 * This walks the raw (uncompressed — statementPdf.ts sets `compress: false` for this reason)
 * PDF byte stream: split it into objects (respecting each stream's declared `/Length` so binary
 * font data can never be misread as PDF syntax), find each font's `/ToUnicode` CMap, and decode
 * each page's `Tj`/`TJ` runs through the CMap for the font active at that point. It is
 * deliberately narrow — just enough to support "does this generated PDF contain this string" —
 * not a general-purpose PDF parser.
 */

interface PdfObj { dict: string; stream?: string }

function parsePdfObjects(s: string): Map<number, PdfObj> {
  const objects = new Map<number, PdfObj>();
  let cursor = 0;
  const headerRe = /(\d+)\s+0\s+obj/g;
  for (;;) {
    headerRe.lastIndex = cursor;
    const hm = headerRe.exec(s);
    if (!hm) break;
    const id = Number(hm[1]);
    const pos = headerRe.lastIndex;
    const streamIdx = s.indexOf('stream', pos);
    const endobjIdx = s.indexOf('endobj', pos);
    if (streamIdx !== -1 && (endobjIdx === -1 || streamIdx < endobjIdx)) {
      // Stream object: skip exactly /Length bytes of (possibly binary) data rather than
      // searching for 'endstream' textually — embedded font bytes can coincidentally contain
      // any keyword.
      const dict = s.slice(pos, streamIdx);
      const lenMatch = /\/Length\s+(\d+)/.exec(dict);
      let dataStart = streamIdx + 'stream'.length;
      if (s[dataStart] === '\r') dataStart++;
      if (s[dataStart] === '\n') dataStart++;
      const length = lenMatch ? Number(lenMatch[1]) : 0;
      const dataEnd = dataStart + length;
      const streamData = s.slice(dataStart, dataEnd);
      const endstreamIdx = s.indexOf('endstream', dataEnd);
      const realEndobjIdx = s.indexOf('endobj', endstreamIdx === -1 ? dataEnd : endstreamIdx);
      objects.set(id, { dict, stream: streamData });
      cursor = (realEndobjIdx === -1 ? dataEnd : realEndobjIdx) + 'endobj'.length;
    } else {
      const dict = s.slice(pos, endobjIdx === -1 ? s.length : endobjIdx);
      objects.set(id, { dict });
      cursor = (endobjIdx === -1 ? s.length : endobjIdx) + 'endobj'.length;
    }
  }
  return objects;
}

function hexToUnicode(hex: string): string {
  let out = '';
  for (let i = 0; i < hex.length; i += 4) out += String.fromCodePoint(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

/** Parses one `/ToUnicode` CMap stream (`beginbfrange`/`beginbfchar` blocks) into code → char.
 * pdfkit emits exactly one mapping per line, so line-splitting (rather than a single regex over
 * the whole block) avoids misreading a `[<a> <b> <c>]` array's individual entries as `<lo> <hi>
 * <start>` range triples. */
function parseCmapStream(stream: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of stream.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const rawLine of block[1]!.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      const arr = /^<([0-9a-fA-F]+)>\s*<[0-9a-fA-F]+>\s*\[([\s\S]*)\]$/.exec(line);
      if (arr) {
        const lo = parseInt(arr[1]!, 16);
        const items = arr[2]!.match(/<([0-9a-fA-F]*)>/g) ?? [];
        items.forEach((it, idx) => map.set(lo + idx, hexToUnicode(it.slice(1, -1))));
        continue;
      }
      const single = /^<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>$/.exec(line);
      if (single) {
        const lo = parseInt(single[1]!, 16), hi = parseInt(single[2]!, 16), uStart = parseInt(single[3]!, 16);
        for (let code = lo; code <= hi; code++) map.set(code, String.fromCodePoint(uStart + (code - lo)));
      }
    }
  }
  for (const block of stream.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const rawLine of block[1]!.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      const pair = /^<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>$/.exec(line);
      if (pair) map.set(parseInt(pair[1]!, 16), hexToUnicode(pair[2]!));
    }
  }
  return map;
}

/** Best-effort text extraction from a PDF buffer produced by `buildStatementPdf` (or any pdfkit
 * document with `compress: false`). Returns all page text concatenated with no guaranteed word
 * spacing — use `.includes(...)` against short, distinctive substrings, not exact-string
 * equality. Simple (non-embedded, e.g. Helvetica) fonts fall back to reading hex bytes as
 * WinAnsi/Latin-1, which is an ASCII-equivalent identity mapping for ordinary text. */
export function extractPdfText(buf: Buffer): string {
  const s = buf.toString('latin1');
  const objects = parsePdfObjects(s);

  const nameToFontObj = new Map<string, number>();
  const fontToCmap = new Map<number, number>();
  const codeMaps = new Map<number, Map<number, string>>();

  for (const [id, obj] of objects) {
    const { dict, stream } = obj;
    if (/\/Font\s*<</.test(dict)) {
      const fontDict = /\/Font\s*<<([\s\S]*?)>>/.exec(dict);
      if (fontDict) {
        for (const em of fontDict[1]!.matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) nameToFontObj.set(em[1]!, Number(em[2]));
      }
    }
    if (/\/Type\s*\/Font\b/.test(dict)) {
      const tu = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(dict);
      if (tu) fontToCmap.set(id, Number(tu[1]));
    }
    if (stream && (stream.includes('beginbfrange') || stream.includes('beginbfchar'))) {
      const map = parseCmapStream(stream);
      if (map.size) codeMaps.set(id, map);
    }
  }

  function decodeHexRun(hex: string, fontResourceName: string): string {
    const fontObjId = nameToFontObj.get(fontResourceName);
    const cmapObjId = fontObjId !== undefined ? fontToCmap.get(fontObjId) : undefined;
    const map = cmapObjId !== undefined ? codeMaps.get(cmapObjId) : undefined;
    let res = '';
    if (map) {
      for (let i = 0; i < hex.length; i += 4) res += map.get(parseInt(hex.slice(i, i + 4), 16)) ?? '';
    } else {
      // No CMap for this font (e.g. a standard Helvetica fallback) — WinAnsiEncoding is
      // identity with ASCII for ordinary Latin text, so raw bytes decode directly.
      for (let i = 0; i < hex.length; i += 2) res += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    return res;
  }

  let out = '';
  for (const [, obj] of objects) {
    const body = obj.stream;
    if (!body || !body.includes('BT') || !(body.includes(' Tj') || body.includes(' TJ'))) continue;
    let currentFont = '';
    const tokenRe = /\/(F\d+)\s+[\d.]+\s+Tf|<((?:[0-9a-fA-F]{2})+)>\s*Tj|\[((?:<[0-9a-fA-F]*>|-?[\d.]+|\s)+)\]\s*TJ/g;
    let tm: RegExpExecArray | null;
    while ((tm = tokenRe.exec(body))) {
      if (tm[1]) currentFont = tm[1];
      else if (tm[2]) out += decodeHexRun(tm[2], currentFont);
      else if (tm[3]) {
        for (const h of tm[3].match(/<([0-9a-fA-F]*)>/g) ?? []) out += decodeHexRun(h.slice(1, -1), currentFont);
      }
    }
    out += '\n';
  }
  return out;
}

/** Number of `/Type /Page` objects in the PDF — a simple, format-agnostic page count. */
export function countPdfPages(buf: Buffer): number {
  const matches = buf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g);
  return matches ? matches.length : 0;
}
