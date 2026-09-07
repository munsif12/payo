import React, { useEffect, useRef } from 'react';
import { View, StyleProp, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { D_ENTER, D_MICRO, EASE_OUT } from './config';
import { splitWords, wordDelays, WORD_TRANSLATE_Y } from './wordRiseSchedule';
import { Text } from '../ui/Text';

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

/** Marks a word that is playing its entrance — the plain branch renders none. */
export const WORD_TEST_ID = 'word-rise-word';

// The schedule itself is pure (and unit-tested) — see ./wordRiseSchedule.
export { splitWords, wordDelays, wordRiseEnd, WORD_TRANSLATE_Y } from './wordRiseSchedule';

function Word({ text, delay, style, reducedMotion }: {
  text: string;
  delay: number;
  style?: StyleProp<TextStyle>;
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = withTiming(1, { duration: D_MICRO });
      return;
    }
    progress.value = withDelay(delay, withTiming(1, { duration: D_ENTER, easing: easeOut }));
    // The schedule is fixed at mount: a re-render must never restart a word.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - progress.value) * WORD_TRANSLATE_Y }],
  }));

  return (
    <Animated.View testID={WORD_TEST_ID} style={animatedStyle}>
      <Text style={style} variant="h1">{text}</Text>
    </Animated.View>
  );
}

export interface WordRiseProps {
  text: string;
  /** Text style for every word (the greeting is 26/800 on the navy head). */
  textStyle?: StyleProp<TextStyle>;
  /** Delay before the first word, in ms. */
  offset?: number;
  /** Arms the entrance. The caller passes `useFirstPaint(...)`; the first render
   *  at which it is true LATCHES the text being animated. It may safely flip back
   *  to false straight afterwards — the entrance already armed keeps running. */
  animate?: boolean;
  /** Urdu mirrors the word order to the right. */
  urdu?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// WordRise — Direction A's signature greeting (spec §1 rule 2, §3 WORD_STEP):
// the line arrives word by word, each rising D_ENTER with a WORD_STEP stagger.
// Transform + opacity only, on the UI thread. Reduced motion: a single D_MICRO
// opacity fade, no stagger and no travel.
export function WordRise({ text, textStyle, offset = 0, animate = true, urdu = false, style, testID }: WordRiseProps) {
  const reducedMotion = useReducedMotion();
  const words = splitWords(text);
  const delays = wordDelays(words.length, offset);
  // The entrance arms ONCE, on the first render where `animate` is true, and it
  // latches the exact string it armed on. Two things fall out of that:
  //  - useFirstPaint flipping to false right afterwards cannot tear down the
  //    entrance already scheduled below;
  //  - a LATER text change (the name landing from /me, a language switch) is not
  //    the line we armed, so it renders through the plain branch instead of
  //    replaying the whole greeting.
  const armedRef = useRef<string | null>(null);
  if (animate && armedRef.current === null) armedRef.current = text;
  const shouldAnimate = armedRef.current === text;

  if (!shouldAnimate) {
    return (
      <View testID={testID} style={style}>
        <Text style={textStyle} variant="h1">{text}</Text>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: urdu ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          columnGap: 7,
        },
        style,
      ]}
    >
      {words.map((word, i) => (
        <Word
          key={`${i}-${word}`}
          text={word}
          delay={delays[i]}
          style={textStyle}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  );
}
