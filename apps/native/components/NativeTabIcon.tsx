import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { ThemeColors } from '../constants/colors';

export type NativeTabIconName = 'log' | 'timeline' | 'together' | 'account';

type NativeTabIconProps = {
  active?: boolean;
  boxHeight?: number;
  boxWidth?: number;
  colors: ThemeColors;
  name: NativeTabIconName;
  size?: number;
};

export function NativeTabIcon({
  active = false,
  boxHeight = 36,
  boxWidth = 52,
  colors,
  name,
  size = 26,
}: NativeTabIconProps) {
  const color = active ? '#0F0F0F' : colors.onSurfaceVariant;

  return (
    <View style={[styles.box, { width: boxWidth, height: boxHeight }, active && styles.boxActive]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {name === 'log' ? (
          <>
            <Path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
            <Path d="M13.5 6 18 10.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : null}
        {name === 'timeline' ? (
          <>
            <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} />
            <Line x1={12} y1={12} x2={12} y2={7.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={12} y1={12} x2={15.5} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : null}
        {name === 'together' ? (
          <Path
            d="M5 6.5h14v9H9l-4 3v-12Z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {name === 'account' ? (
          <>
            <Path
              d="M19.2 13.4a7.6 7.6 0 0 0 0-2.8l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-2.4-1.4L14 2.6h-4l-.4 2.6a7.2 7.2 0 0 0-2.4 1.4l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 2.8l-2 1.5 2 3.5 2.4-1a7.2 7.2 0 0 0 2.4 1.4l.4 2.6h4l.4-2.6a7.2 7.2 0 0 0 2.4-1.4l2.4 1 2-3.5-2-1.5Z"
              stroke={color}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
            <Circle cx={12} cy={12} r={3.1} stroke={color} strokeWidth={1.8} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  boxActive: {
    backgroundColor: '#FF9933',
  },
});
