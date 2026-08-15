/**
 * SkeletonLoader — Shimmer loading placeholder
 * Shows animated gradient shimmer while content loads
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Platform } from 'react-native';
import { colors, radii, spacing } from '../../utils/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radii.sm, style }: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.shimmer,
          overflow: 'hidden',
        },
        style,
      ]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
            backgroundColor: 'rgba(255,255,255,0.3)',
          },
        ]}
      />
    </View>
  );
}

/**
 * PostCardSkeleton — Full skeleton for a product post card
 * Shows while feed is loading
 */
export function PostCardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      {/* Header: avatar + name + time */}
      <View style={skeletonStyles.header}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={skeletonStyles.headerText}>
          <Skeleton width={100} height={14} />
          <Skeleton width={60} height={10} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>

      {/* Content text */}
      <Skeleton width="90%" height={14} style={{ marginBottom: 8 }} />
      <Skeleton width="65%" height={14} style={{ marginBottom: 12 }} />

      {/* Image */}
      <Skeleton width="100%" height={240} borderRadius={radii.xl} />

      {/* Chips */}
      <View style={skeletonStyles.chips}>
        <Skeleton width={80} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>

      {/* Actions */}
      <View style={skeletonStyles.actions}>
        <Skeleton width={60} height={28} borderRadius={14} />
        <Skeleton width={60} height={28} borderRadius={14} />
        <Skeleton width={60} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...Platform.select({
      default: { shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
