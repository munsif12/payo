/**
 * Minimal SSE client over XMLHttpRequest — React Native's fetch cannot stream
 * response bodies, but XHR exposes the growing responseText via onprogress.
 */
export interface SseEvent {
  event: string;
  data: unknown;
}

export function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const blocks = buffer.split(/\n\n/);
  const rest = blocks.pop() ?? '';
  for (const block of blocks) {
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (data) {
      try {
        events.push({ event, data: JSON.parse(data) });
      } catch {
        events.push({ event, data });
      }
    }
  }
  return { events, rest };
}

export interface PostSseOptions {
  headers?: Record<string, string>;
  body?: string;
  formData?: FormData;
  onEvent: (e: SseEvent) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  xhrFactory?: () => XMLHttpRequest;
}

export function postSse(url: string, opts: PostSseOptions): { abort: () => void } {
  const xhr = (opts.xhrFactory ?? (() => new XMLHttpRequest()))();
  let seen = 0;
  let buffer = '';

  const pump = () => {
    const text = xhr.responseText ?? '';
    if (text.length > seen) {
      buffer += text.slice(seen);
      seen = text.length;
      const { events, rest } = parseSseChunk(buffer);
      buffer = rest;
      for (const e of events) opts.onEvent(e);
    }
  };

  xhr.open('POST', url);
  for (const [k, v] of Object.entries(opts.headers ?? {})) xhr.setRequestHeader(k, v);
  xhr.onprogress = pump;
  xhr.onload = () => {
    pump();
    // flush a final block that may lack the trailing blank line
    if (buffer.trim()) {
      const { events } = parseSseChunk(buffer + '\n\n');
      for (const e of events) opts.onEvent(e);
      buffer = '';
    }
    opts.onDone?.();
  };
  xhr.onerror = () => opts.onError?.('network error');
  xhr.send(opts.formData ?? opts.body);
  return { abort: () => xhr.abort() };
}
