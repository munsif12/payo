import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { Keyboard, Mic, X } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { Input } from './Input';
import { Text } from './Text';
import { Breathe } from '../motion/Breathe';
import { ListeningRings } from '../motion/ListeningRings';
import { usePressScale } from '../motion/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const MIC_SIZE = 64;

export interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  hint?: string;
  listening: boolean;
  onMicPress: () => void;
  onStopListening: () => void;
  style?: StyleProp<ViewStyle>;
}

// Composer — Main.dc.html (idle) / HomeListening.dc.html (listening): a 56pt
// input pill + 64pt amber mic that breathes while idle. Listening flips the
// mic to a navy button with an X and two expanding ListeningRings, per
// Motion.dc.html "Mic idle" / "Listening" rows.
export function Composer({ value, onChangeText, onSubmit, placeholder, hint, listening, onMicPress, onStopListening, style }: ComposerProps) {
  const { c } = useTheme();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <View style={[{ gap: 8 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Input
          icon={<Keyboard size={20} color={c.ink3} strokeWidth={2} />}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          editable={!listening}
          containerStyle={{ flex: 1, borderRadius: 28 }}
        />
        {listening ? (
          <View style={{ width: MIC_SIZE, height: MIC_SIZE }}>
            <ListeningRings size={MIC_SIZE} color={c.amber} />
            <AnimatedPressable
              testID="composer-stop-listening"
              accessibilityRole="button"
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onStopListening();
              }}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={[
                {
                  width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2,
                  backgroundColor: c.navy, alignItems: 'center', justifyContent: 'center',
                },
                pressStyle,
              ]}
            >
              <X size={26} color={c.white} strokeWidth={2.6} />
            </AnimatedPressable>
          </View>
        ) : (
          <Breathe style={{ shadowColor: 'rgba(242,169,59,1)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20 }}>
            <AnimatedPressable
              testID="composer-mic"
              accessibilityRole="button"
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onMicPress();
              }}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={[
                {
                  width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2,
                  backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center',
                },
                pressStyle,
              ]}
            >
              <Mic size={28} color={c.navy} strokeWidth={2.4} />
            </AnimatedPressable>
          </Breathe>
        )}
      </View>
      {hint ? <Text variant="foot" center>{hint}</Text> : null}
    </View>
  );
}
