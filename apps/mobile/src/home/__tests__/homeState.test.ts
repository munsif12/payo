import { homeState, headHeight, headStatus, HEAD_HEIGHT } from '../homeState';

const at = (mode: Parameters<typeof headStatus>[0], messageCount: number, recording = false) =>
  homeState({ mode, messageCount, recording });

// SHEET_OVERLAP in src/ui/Sheet.tsx — kept as a literal so this stays a pure test.
const SHEET_OVERLAP = 14;

test('head heights are the artboards navy heights', () => {
  expect(HEAD_HEIGHT).toEqual({ greet: 330, listening: 350, conversation: 230 });
  expect(headHeight('greet')).toBe(330);
  expect(headHeight('listening')).toBe(350);
  expect(headHeight('conversation')).toBe(230);
});

test('the sheet lands on each artboards sheet top once it overlaps the head', () => {
  expect(headHeight('greet') - SHEET_OVERLAP).toBe(316);
  expect(headHeight('listening') - SHEET_OVERLAP).toBe(336);
  expect(headHeight('conversation') - SHEET_OVERLAP).toBe(216);
});

test('greet is the resting face', () => {
  expect(at('off', 0)).toBe('greet');
  // Thinking/speaking before any message has landed still shows the greet face —
  // the head's status row carries the state, the sheet keeps its suggestions.
  expect(at('thinking', 0)).toBe('greet');
  expect(at('speaking', 0)).toBe('greet');
  expect(at('paused', 0)).toBe('greet');
});

test('listening while nothing has been said yet', () => {
  expect(at('listening', 0)).toBe('listening');
  // A tap-per-turn recording with the loop off is listening too.
  expect(at('off', 0, true)).toBe('listening');
});

test('one message and it is a conversation from then on', () => {
  expect(at('off', 1)).toBe('conversation');
  expect(at('listening', 4)).toBe('conversation');
  expect(at('off', 9, true)).toBe('conversation');
});

test('headStatus mirrors the loop, and a bare recording reads as listening', () => {
  expect(headStatus('off', false)).toBe('none');
  expect(headStatus('off', true)).toBe('listening');
  expect(headStatus('listening', false)).toBe('listening');
  expect(headStatus('thinking', false)).toBe('thinking');
  expect(headStatus('speaking', false)).toBe('speaking');
  expect(headStatus('paused', false)).toBe('paused');
});
