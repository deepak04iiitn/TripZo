import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export const SKELETON_DURATION_MS = 1200;
export const SKELETON_TRANSLATE_OUTPUT_RANGE = [-220, 220];
export const SKELETON_GRADIENT_COLORS = [
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.56)',
  'rgba(255,255,255,0)',
];

export function useSkeletonShimmer({
  duration = SKELETON_DURATION_MS,
  outputRange = SKELETON_TRANSLATE_OUTPUT_RANGE,
} = {}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    shimmerAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [duration, shimmerAnim]);

  return shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange,
  });
}

