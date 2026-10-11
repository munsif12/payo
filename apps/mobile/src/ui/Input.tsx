import React, { useState } from 'react';
import { TextInput, View, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, type, glassTokens } from '../theme/tokens';
import { useIsUrdu } from './Text';

export interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

// Input — GLASS-SPEC §2: a 56 pt glass field, 1 px line, radius 16; focus =
// 1.5 px amber line. Placeholder ink3. Optional leading icon slot.
export function Input({ icon, containerStyle, style, onFocus, onBlur, ...rest }: InputProps) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        {
          height: 56,
          borderRadius: radius.input,
          backgroundColor: c.surface,
          borderWidth: focused ? glassTokens.inputFocusLine : glassTokens.line,
          borderColor: focused ? c.amber : c.separator,
          flexDirection: urdu ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          gap: 10,
        },
        containerStyle,
      ]}
    >
      {icon}
      <TextInput
        placeholderTextColor={c.ink3}
        selectionColor={c.amber}
        allowFontScaling
        maxFontSizeMultiplier={type.maxFontSizeMultiplier}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          {
            flex: 1,
            fontSize: 17,
            color: c.ink,
            fontFamily: urdu ? type.urduFontFamily : type.fontFamily[400],
            textAlign: urdu ? 'right' : 'left',
            writingDirection: urdu ? 'rtl' : 'ltr',
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
