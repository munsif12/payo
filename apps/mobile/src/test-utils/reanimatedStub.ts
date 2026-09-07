// A minimal stand-in for react-native-reanimated in unit tests. Its real entry
// point loads the worklets native module, which the jest environment has no
// binding for. Everything animated in this app is transform/opacity on the UI
// thread, so a test can only ever assert WHICH branch renders — never the
// animation itself. Deliberately free of JSX and of any react-native import:
// the nativewind babel transform may not run inside a jest.mock factory.
import React from 'react';

type AnyProps = Record<string, unknown>;

const host = (name: string) => (props: AnyProps) => React.createElement(name, props);

const easing = () => (t: number) => t;

export const useSharedValue = <T,>(value: T) => ({ value });
export const useAnimatedStyle = () => ({});
export const useAnimatedReaction = () => {};
export const withTiming = <T,>(toValue: T) => toValue;
export const withDelay = <T,>(_delay: number, animation: T) => animation;
export const withSequence = <T,>(...animations: T[]) => animations[animations.length - 1];
export const withRepeat = <T,>(animation: T) => animation;
export const cancelAnimation = () => {};
export const runOnJS = <T extends (...args: never[]) => unknown>(fn: T) => fn;
export const Easing = { bezier: easing, out: easing, inOut: easing, ease: 0, linear: 0 };

const Animated = {
  View: host('View'),
  Text: host('Text'),
  ScrollView: host('ScrollView'),
  createAnimatedComponent: <T,>(component: T) => component,
};

export default Animated;
