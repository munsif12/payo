import { orbBus } from '../orbBus';

beforeEach(() => orbBus.reset());

test('starts idle with no handler and nothing pending', () => {
  expect(orbBus.getState()).toBe('idle');
  expect(orbBus.hasHandler()).toBe(false);
  expect(orbBus.consumePendingStart()).toBe(false);
});

test('press() with a handler calls it and returns true, latching nothing', () => {
  const handler = jest.fn();
  orbBus.setHandler(handler);
  expect(orbBus.press()).toBe(true);
  expect(handler).toHaveBeenCalledTimes(1);
  expect(orbBus.consumePendingStart()).toBe(false);
});

test('press() without a handler returns false and latches a pending start', () => {
  expect(orbBus.press()).toBe(false);
  expect(orbBus.consumePendingStart()).toBe(true);
  // Consumed once: the next read is clean.
  expect(orbBus.consumePendingStart()).toBe(false);
});

test('two presses before Home mounts still consume as a single pending start', () => {
  orbBus.press();
  orbBus.press();
  expect(orbBus.consumePendingStart()).toBe(true);
  expect(orbBus.consumePendingStart()).toBe(false);
});

test('setHandler(null) unregisters: the next press latches instead of calling', () => {
  const handler = jest.fn();
  orbBus.setHandler(handler);
  orbBus.setHandler(null);
  expect(orbBus.hasHandler()).toBe(false);
  expect(orbBus.press()).toBe(false);
  expect(handler).not.toHaveBeenCalled();
  expect(orbBus.consumePendingStart()).toBe(true);
});

test('setState notifies subscribers only on a change', () => {
  const listener = jest.fn();
  const unsubscribe = orbBus.subscribe(listener);
  orbBus.setState('listening');
  orbBus.setState('listening');
  expect(listener).toHaveBeenCalledTimes(1);
  expect(orbBus.getState()).toBe('listening');
  orbBus.setState('live');
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  orbBus.setState('idle');
  expect(listener).toHaveBeenCalledTimes(2);
});

test('reset clears the handler, the pending flag and the state', () => {
  const listener = jest.fn();
  orbBus.subscribe(listener);
  orbBus.setHandler(() => {});
  orbBus.setState('live');
  orbBus.setHandler(null);
  orbBus.press();
  orbBus.reset();
  expect(orbBus.getState()).toBe('idle');
  expect(orbBus.hasHandler()).toBe(false);
  expect(orbBus.consumePendingStart()).toBe(false);
  // live → idle is a change, so subscribers heard about it.
  expect(listener).toHaveBeenCalledTimes(2);
});
