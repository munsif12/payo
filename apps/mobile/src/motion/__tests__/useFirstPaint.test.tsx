import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useFirstPaint } from '../useFirstPaint';

function Probe({ seen, ready = true }: { seen: boolean[]; ready?: boolean }) {
  const firstPaint = useFirstPaint(ready);
  seen.push(firstPaint);
  return null;
}

test('is true on the first paint and false for every render after it', () => {
  const seen: boolean[] = [];
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<Probe seen={seen} />); });

  expect(seen[0]).toBe(true);
  expect(seen[seen.length - 1]).toBe(false);

  // A re-render of the same instance — a new message, a digest landing, a tab
  // re-focus — must not put it back to true.
  act(() => { renderer.update(<Probe seen={seen} />); });
  expect(seen[seen.length - 1]).toBe(false);
  expect(seen.filter(Boolean)).toHaveLength(1);

  act(() => { renderer.unmount(); });
});

test('a fresh mount gets its own first paint', () => {
  const a: boolean[] = [];
  const b: boolean[] = [];
  let r1!: TestRenderer.ReactTestRenderer;
  let r2!: TestRenderer.ReactTestRenderer;
  act(() => { r1 = TestRenderer.create(<Probe seen={a} />); });
  act(() => { r1.unmount(); });
  act(() => { r2 = TestRenderer.create(<Probe seen={b} />); });
  expect(a[0]).toBe(true);
  expect(b[0]).toBe(true);
  act(() => { r2.unmount(); });
});

test('ready holds the first paint back until the content is worth animating', () => {
  const seen: boolean[] = [];
  let r!: TestRenderer.ReactTestRenderer;
  // Home's greeting: the name has not arrived from /me yet.
  act(() => { r = TestRenderer.create(<Probe seen={seen} ready={false} />); });
  expect(seen.some(Boolean)).toBe(false);

  // It arrives — the entrance is handed out exactly once, then never again.
  act(() => { r.update(<Probe seen={seen} ready />); });
  expect(seen.filter(Boolean)).toHaveLength(1);

  act(() => { r.update(<Probe seen={seen} ready />); });
  act(() => { r.update(<Probe seen={seen} ready={false} />); });
  act(() => { r.update(<Probe seen={seen} ready />); });
  expect(seen.filter(Boolean)).toHaveLength(1);
  act(() => { r.unmount(); });
});
