import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { serverApi } from '../utils/serverApi';
import { isApprovedSeller, sellerPendingReview } from '../utils/marketplace';

// SELLER-ONLY: "Go Live" entry from the feed create band (Post / Story / Live).
// Creates a REAL LiveStream row on the server — the room appears in every
// user's Live Shopping list and in the admin panel. Video broadcasting itself
// arrives with a streaming backend; this screen never fakes one.
export default function StartLiveScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Role gate — approved sellers only (matches server 403 + sibling guards).
  if (!isApprovedSeller(user)) {
    const pending = sellerPendingReview(user);
    return (
      <View className="flex-1" style={{ backgroundColor: colors.surface }}>
        <View className="flex-row items-center px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <CloseIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: 80 }}>
          <Text className="font-inter-700 text-textPrimary text-center" style={{ fontSize: 18, lineHeight: 26 }}>
            Live is for sellers
          </Text>
          <Text className="font-inter-400 text-textSecondary text-center mt-2" style={{ fontSize: 14, lineHeight: 20 }}>
            {pending
              ? 'Your seller application is under review. Going live unlocks the moment you are approved.'
              : 'Become a seller to go live, list products and post stories.'}
          </Text>
          {!pending && (
            <TouchableOpacity
              onPress={() => router.push('/become-seller')}
              className="mt-6 rounded-full px-6 h-11 items-center justify-center"
              style={{ backgroundColor: colors.primaryContainer }}
            >
              <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.onPrimary }}>
                Become a Seller
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const goLive = async () => {
    if (!title.trim() || starting) return;
    setStarting(true);
    setError(null);
    const res = await serverApi.startLiveStream(title.trim());
    setStarting(false);
    if (res.ok && res.data?.stream) {
      router.replace('/live');
    } else {
      setError(res.error === 'offline' ? 'You appear offline — try again.' : res.error ?? 'Could not start the live room.');
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <CloseIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text
          className="flex-1 text-center font-inter-700 text-textPrimary"
          style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.5, marginRight: 20 }}
        >
          Go Live
        </Text>
      </View>

      <View className="flex-1 px-5 pt-6">
        {/* LIVE preview chip — shows what buyers will see in Live Shopping */}
        <View className="rounded-figma-24 p-5" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLowest }}>
              <Text className="font-inter-700 text-primary" style={{ fontSize: 15, lineHeight: 19 }}>
                {(user?.businessName || user?.name || 'S').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={1}>
                {user?.businessName || user?.name}
              </Text>
              <View className="flex-row items-center mt-0.5 self-start px-1.5 rounded-full" style={{ backgroundColor: colors.error }}>
                <Text className="font-inter-700 text-white" style={{ fontSize: 9, lineHeight: 13, letterSpacing: 0.6 }}>
                  LIVE
                </Text>
              </View>
            </View>
          </View>
          <Text className="font-inter-600 text-textPrimary mt-3" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={2}>
            {title.trim() || 'Your live room title'}
          </Text>
        </View>

        <Text className="font-inter-600 text-textPrimary mt-6 mb-2" style={{ fontSize: 14, lineHeight: 18 }}>
          Room title
        </Text>
        <TextInput
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            if (error) setError(null);
          }}
          placeholder="e.g. Weekend thrift drop — live deals"
          placeholderTextColor={colors.textTertiary}
          maxLength={120}
          className="h-12 rounded-figma-16 px-4 font-inter-400 text-textPrimary"
          style={{ backgroundColor: colors.surfaceContainerLow, fontSize: 15 }}
        />

        <Text className="font-inter-400 text-textSecondary mt-3" style={{ fontSize: 12, lineHeight: 17 }}>
          Your room appears for every buyer in Live Shopping with a link to your shop. Broadcasting ends when you end it
          (rooms auto-close after 2 hours).
        </Text>

        {error && (
          <Text className="font-inter-500 mt-3" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          onPress={goLive}
          disabled={!title.trim() || starting}
          className="h-14 rounded-figma-16 items-center justify-center mt-6 flex-row"
          style={{
            backgroundColor: title.trim() && !starting ? colors.primaryContainer : colors.surfaceContainer,
            gap: 8,
          }}
          activeOpacity={0.85}
        >
          <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: starting ? colors.textTertiary : colors.error }} />
          <Text
            className="font-inter-600"
            style={{ fontSize: 16, lineHeight: 22, color: title.trim() && !starting ? colors.onPrimary : colors.textTertiary }}
          >
            {starting ? 'Starting…' : 'Go Live'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
