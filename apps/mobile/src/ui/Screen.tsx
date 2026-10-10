import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../theme/tokens';
import { GlassBackground, useHasGlassBackdrop } from './GlassBackground';

// Screen — safe-area wrapper over the glass gradient (GLASS-SPEC §1). The
// gradient sits behind the children and under the safe-area padding; inside a
// `GlassBackdropScope` (the tabs layout) the screen stays transparent so the one
// gradient behind the navigator runs on, seamlessly, under the nav pill.
export function Screen({ children, style, padded = true }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const scoped = useHasGlassBackdrop();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: 'transparent',
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: padded ? space.gutter : 0,
        },
        style,
      ]}
    >
      {scoped ? null : <GlassBackground />}
      {children}
    </View>
  );
}
