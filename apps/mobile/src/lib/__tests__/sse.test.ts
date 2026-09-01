import { parseSseChunk } from '../sse';

test('parses complete SSE blocks and keeps the partial rest', () => {
  const chunk = 'event: token\ndata: {"text":"سلام "}\n\nevent: card\ndata: {"card":{"kind":"balance","balancePaisa":100}}\n\nevent: done\ndata: {"sess';
  const { events, rest } = parseSseChunk(chunk);
  expect(events).toEqual([
    { event: 'token', data: { text: 'سلام ' } },
    { event: 'card', data: { card: { kind: 'balance', balancePaisa: 100 } } },
  ]);
  expect(rest).toContain('event: done');
});

test('flushing rest with terminator yields the final event', () => {
  const { events } = parseSseChunk('event: done\ndata: {"sessionId":"s1","messageId":"m1"}\n\n');
  expect(events).toEqual([{ event: 'done', data: { sessionId: 's1', messageId: 'm1' } }]);
});
