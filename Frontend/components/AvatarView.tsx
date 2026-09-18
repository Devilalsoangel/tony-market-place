import React from 'react';
import { View, Text } from 'react-native';
import { avatarInitials } from '../utils/productImages';

/**
 * Local initials avatar — deterministic per name, zero network, offline-proof.
 * Replaces per-row dicebear calls (third-party PII ping + blank-on-offline).
 * Sizes via explicit width/height/borderRadius style passthrough.
 */
export function AvatarView({
  name,
  size = 40,
  fontSize,
}: {
  name: string;
  size?: number;
  fontSize?: number;
}) {
  const { initials, bg } = avatarInitials(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: fontSize ?? size * 0.38, fontWeight: '700' }}>
        {initials}
      </Text>
    </View>
  );
}
