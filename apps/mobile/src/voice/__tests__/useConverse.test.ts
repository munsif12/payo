import { createInFlightGate } from '../inFlightGate';

test('a second tryEnter is rejected while the gate is occupied', () => {
  const gate = createInFlightGate();
  expect(gate.tryEnter()).toBe(true);
  expect(gate.tryEnter()).toBe(false);
  expect(gate.tryEnter()).toBe(false);
});

test('release reopens the gate for a new turn', () => {
  const gate = createInFlightGate();
  expect(gate.tryEnter()).toBe(true);
  gate.release();
  expect(gate.tryEnter()).toBe(true);
});

test('a fresh gate starts open', () => {
  const gate = createInFlightGate();
  expect(gate.tryEnter()).toBe(true);
});

test('release is idempotent — calling it twice is safe', () => {
  const gate = createInFlightGate();
  expect(gate.tryEnter()).toBe(true);
  gate.release();
  gate.release();
  expect(gate.tryEnter()).toBe(true);
});
