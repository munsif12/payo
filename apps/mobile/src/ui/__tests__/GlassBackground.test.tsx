import React from 'react';
import { act, create } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBackground, GlassBackdropScope } from '../GlassBackground';
import { Screen } from '../Screen';
import { glass } from '../../theme/tokens';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function render(el: React.ReactElement) {
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(el); });
  return tree;
}

test('GlassBackground is the navy → navyDeep vertical gradient (GLASS-SPEC §1)', () => {
  const tree = render(<GlassBackground testID="bg" />);
  const gradient = tree.root.findByType(LinearGradient);
  expect(gradient.props.colors).toEqual([glass.navy, glass.navyDeep]);
  expect(gradient.props.start).toEqual({ x: 0.5, y: 0 });
  expect(gradient.props.end).toEqual({ x: 0.5, y: 1 });
  expect(gradient.props.pointerEvents).toBe('none');
});

test('Screen paints its own gradient on its own, and none inside a GlassBackdropScope', () => {
  const alone = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Screen><React.Fragment /></Screen>
    </SafeAreaProvider>,
  );
  expect(alone.root.findAllByType(LinearGradient)).toHaveLength(1);

  const scoped = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <GlassBackdropScope>
        <Screen><React.Fragment /></Screen>
      </GlassBackdropScope>
    </SafeAreaProvider>,
  );
  // Exactly one gradient: the scope's, behind the whole navigator.
  expect(scoped.root.findAllByType(LinearGradient)).toHaveLength(1);
});
