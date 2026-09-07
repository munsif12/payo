// The real Reanimated entry point loads the worklets native module, which this
// environment has no binding for. What is under test is WHICH branch renders —
// the animation itself is UI-thread-only and unobservable from here.
jest.mock('react-native-reanimated', () => require('../../test-utils/reanimatedStub'));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import '../../i18n';
import { WordRise, WORD_TEST_ID } from '../WordRise';

const animatedWords = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => n.props?.testID === WORD_TEST_ID && typeof n.type === 'string').length;

test('arms on the first render where animate is true and splits into words', () => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<WordRise text="Assalam o Alaikum" animate />); });
  expect(animatedWords(r)).toBe(3);
  act(() => { r.unmount(); });
});

test('a later text change does not replay the entrance', () => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<WordRise text="Assalam o Alaikum" animate />); });
  expect(animatedWords(r)).toBe(3);

  // The name lands from /me, or the user switches to Urdu: a different line, so
  // it renders plain rather than re-running the whole greeting.
  act(() => { r.update(<WordRise text="Assalam o Alaikum, Ammi" animate />); });
  expect(animatedWords(r)).toBe(0);

  // And it stays plain — including after useFirstPaint has flipped to false.
  act(() => { r.update(<WordRise text="Assalam o Alaikum, Ammi" animate={false} />); });
  expect(animatedWords(r)).toBe(0);
  act(() => { r.unmount(); });
});

test('the armed entrance survives animate flipping back to false', () => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<WordRise text="one two" animate />); });
  act(() => { r.update(<WordRise text="one two" animate={false} />); });
  expect(animatedWords(r)).toBe(2);
  act(() => { r.unmount(); });
});

test('nothing animates until animate arms — then the ready text plays', () => {
  let r!: TestRenderer.ReactTestRenderer;
  // Home holds the greeting back until the name is known (useFirstPaint(ready)).
  act(() => { r = TestRenderer.create(<WordRise text="Assalam o Alaikum," animate={false} />); });
  expect(animatedWords(r)).toBe(0);

  act(() => { r.update(<WordRise text="Assalam o Alaikum, Ammi" animate />); });
  expect(animatedWords(r)).toBe(4);
  act(() => { r.unmount(); });
});
