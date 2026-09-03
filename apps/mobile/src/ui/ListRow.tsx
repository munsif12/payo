import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { usePressScale } from '../motion/usePressScale';
import { Text, useIsUrdu } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ListRowProps {
  left?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  separator?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ListRow — Foundations.dc.html .row: 14px gap, 14px vertical padding,
// separator border-bottom. Used for txn rows, biller rows, settings rows.
export function ListRow({ left, title, subtitle, right, onPress, showChevron, separator = true, style, testID }: ListRowProps) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();

  const content = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? <Text variant="hl" numberOfLines={1}>{title}</Text> : title}
        {subtitle ? (typeof subtitle === 'string' ? <Text variant="foot" numberOfLines={1}>{subtitle}</Text> : subtitle) : null}
      </View>
      {right}
      {showChevron ? <ChevronRight size={20} color={c.ink3} strokeWidth={2} /> : null}
    </>
  );

  const rowStyle: ViewStyle = {
    flexDirection: urdu ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: separator ? 1 : 0,
    borderBottomColor: c.separator,
  };

  if (!onPress) {
    return <View testID={testID} style={[rowStyle, style]}>{content}</View>;
  }

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[rowStyle, pressStyle, style]}
    >
      {content}
    </AnimatedPressable>
  );
}
