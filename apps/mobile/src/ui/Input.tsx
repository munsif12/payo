import React, { useState } from 'react';
import { TextInput, View, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, type } from '../theme/tokens';
import { useIsUrdu } from './Text';

export interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

// Input — Foundations.dc.html .input/.inputOn: 56pt, 16 radius, 1.5px
// separator border that turns amber on focus, optional left icon slot.
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
          borderWidth: 1.5,
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
