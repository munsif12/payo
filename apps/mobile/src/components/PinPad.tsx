import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { tokens } from '../theme/tokens';

export function usePinPad(length = 4) {
  const [pin, setPin] = useState('');
  const push = (d: string) => setPin(p => (p.length < length ? p + d : p));
  const pop = () => setPin(p => p.slice(0, -1));
  const clear = () => setPin('');
  return { pin, push, pop, clear, complete: pin.length === length };
}

const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', '⌫']];

export function PinPad({ pin, onDigit, onBackspace }: {
  pin: string; onDigit: (d: string) => void; onBackspace: () => void;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: tokens.space.m, marginBottom: tokens.space.xl }}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            testID={`pin-dot-${i}${i < pin.length ? '-filled' : ''}`}
            style={{
              width: 18, height: 18, borderRadius: 9,
              backgroundColor: i < pin.length ? tokens.color.accent : tokens.color.surfaceRaised,
            }}
          />
        ))}
      </View>
      {KEYS.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: tokens.space.m, marginBottom: tokens.space.m }}>
          {row.map((k, ki) => (
            <Pressable
              key={ki}
              testID={k === '⌫' ? 'pin-backspace' : k ? `pin-${k}` : undefined}
              accessibilityLabel={k === '⌫' ? 'backspace' : k || undefined}
              disabled={!k}
              onPress={() => (k === '⌫' ? onBackspace() : onDigit(k))}
              style={{
                width: 76, height: 76, borderRadius: 38,
                backgroundColor: k ? tokens.color.surface : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: tokens.color.text, fontSize: 28, fontWeight: '600' }}>{k}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
