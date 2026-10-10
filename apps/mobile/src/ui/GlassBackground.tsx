import React, { createContext, useContext } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { glass } from '../theme/tokens';

// GlassBackground — GLASS-SPEC §1: the vertical navy → navyDeep gradient that
// fills the whole screen, including behind the status bar and the nav pill.
// Absolute-fill and pointer-transparent: render it first inside any flex:1
// container and lay the screen over it.
export function GlassBackground({ style, testID }: { style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <LinearGradient
      testID={testID}
      pointerEvents="none"
      colors={[glass.navy, glass.navyDeep]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}

const GlassBackdropContext = createContext(false);

/** True when an ancestor `GlassBackdropScope` already paints the gradient behind
 *  this subtree — `Screen` then stays transparent instead of stacking a second,
 *  shorter gradient (whose bottom colour would not match and would read as a
 *  seam where the nav pill starts). */
export function useHasGlassBackdrop(): boolean {
  return useContext(GlassBackdropContext);
}

// GlassBackdropScope — one gradient behind a whole navigator (the tabs layout),
// so the scene and the nav pill share a single uninterrupted background.
export function GlassBackdropScope({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flex: 1, backgroundColor: glass.navy }, style]}>
      <GlassBackground />
      <GlassBackdropContext.Provider value={true}>{children}</GlassBackdropContext.Provider>
    </View>
  );
}
