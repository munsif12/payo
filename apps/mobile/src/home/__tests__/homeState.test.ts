import { homeState, headStatus, orbStateFor } from '../homeState';

const at = (mode: Parameters<typeof headStatus>[0], messageCount: number, recording = false) =>
  homeState({ mode, messageCount, recording });

test('greet is the resting face', () => {
  expect(at('off', 0)).toBe('greet');
  // Thinking/speaking before any message has landed still shows the greet face —
  // the head's sub-line carries the state, the body keeps the orb and the family.
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

test('orbStateFor: listening with the mic open, live for the rest of a conversation, idle when off', () => {
  expect(orbStateFor('off', false)).toBe('idle');
  expect(orbStateFor('off', true)).toBe('listening');
  expect(orbStateFor('listening', false)).toBe('listening');
  expect(orbStateFor('thinking', false)).toBe('live');
  expect(orbStateFor('speaking', false)).toBe('live');
  expect(orbStateFor('paused', false)).toBe('live');
});
