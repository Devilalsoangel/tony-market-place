import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, CameraPlusIcon, MapPinIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { sellerImages } from '../utils/screenImages';
import { CATEGORY_TREE } from '../utils/categories';

// Edit Shop Profile (Figma 245:2051) — store photo, profile fields, hours,
// danger zone. Persists to AuthContext. The shop category drives the
// storefront archetype (goods/food/service/job/realestate/b2b UI).
export default function EditShopScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.businessName || 'Elara Finds');
  const [tagline, setTagline] = useState('Sustainable luxury, weekly drops');
  const [about, setAbout] = useState('Curated collection of pre-loved sustainable luxury items. Handpicked for quality and timeless style.');
  const [address, setAddress] = useState('Aoyama, Minato City, Tokyo');
  const [email, setEmail] = useState('hello@elarafinds.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [category, setCategory] = useState(user?.category ?? 'fashion');

  const save = async () => {
    try {
      await updateUser({ businessName: name, category });
      Alert.alert('Saved', 'Shop profile updated.');
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    }
  };

  const Field = ({ label, hint, value, onChange, prefix }: { label: string; hint?: string; value: string; onChange: (t: string) => void; prefix?: string }) => (
    <View className="mb-4">
      <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
        {label}
      </Text>
      <View className="flex-row items-center px-4" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
        {prefix && (
          <Text className="font-inter-500 text-textSecondary mr-1" style={{ fontSize: 14 }}>
            {prefix}
          </Text>
        )}
        <TextInput
          className="flex-1 font-inter-400 text-textPrimary"
          style={{ fontSize: 14 }}
          value={value}
          onChangeText={onChange}
          placeholderTextColor={colors.secondary}
        />
      </View>
      {hint && (
        <Text className="font-inter-400 text-textSecondary mt-1.5" style={{ fontSize: 11, lineHeight: 14 }}>
          {hint}
        </Text>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-textPrimary" style={{ fontSize: 18, lineHeight: 24 }}>
          Edit Shop Profile
        </Text>
        <TouchableOpacity onPress={save}>
          <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.primaryContainer }}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {/* Store photo */}
        <View className="items-center my-6">
          <TouchableOpacity>
            <View className="w-24 h-24 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
              <Image source={sellerImages.avatar} className="w-24 h-24 rounded-full" />
              <View className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryContainer, borderWidth: 2, borderColor: colors.surface }}>
                <CameraPlusIcon size={14} color={colors.onPrimary} />
              </View>
            </View>
          </TouchableOpacity>
          <Text className="font-inter-500 text-textSecondary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
            Change store photo
          </Text>
        </View>

        <View className="mx-5">
          <Field label="Official Store Name" hint="Shown to buyers instead of your username" value={name} onChange={setName} />
          <Field label="Username" hint="Used for links and follows only" value={user?.username || 'elara_finds'} onChange={() => {}} prefix="@" />
          <Field label="Tagline" value={tagline} onChange={setTagline} />
          <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
            About your store
          </Text>
          <View className="px-4 py-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
            <TextInput
              className="font-inter-400 text-textPrimary"
              style={{ fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
              value={about}
              onChangeText={setAbout}
              multiline
              placeholderTextColor={colors.secondary}
            />
          </View>

          <View className="mt-5">
            <Field label="Business Address" value={address} onChange={setAddress} />
            <TouchableOpacity className="flex-row items-center mb-5" onPress={() => router.push('/map')}>
              <MapPinIcon size={14} color={colors.primaryContainer} />
              <Text className="font-inter-500 ml-1.5" style={{ fontSize: 12, lineHeight: 16, color: colors.primaryContainer }}>
                Use current location
              </Text>
            </TouchableOpacity>
            <Field label="Contact Email" value={email} onChange={setEmail} />
            <Field label="Contact Phone" value={phone} onChange={setPhone} />
          </View>

          {/* Shop Category — drives the storefront UI (17 industries) */}
          <View className="mt-2 mb-4">
            <Text className="font-inter-600 text-textPrimary mb-1" style={{ fontSize: 13, lineHeight: 18 }}>
              Shop Category
            </Text>
            <Text className="font-inter-400 text-textSecondary mb-2.5" style={{ fontSize: 11, lineHeight: 14 }}>
              Your storefront, banner CTA and deals adapt to this category.
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {CATEGORY_TREE.map((c) => {
                const on = category === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCategory(on ? '' : c.id)}
                    className="px-3.5 py-2 rounded-full"
                    style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer }}
                  >
                    <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: on ? colors.onPrimary : colors.textPrimary }}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Store Hours */}
          <View className="p-4 rounded-figma-16 mt-2" style={{ backgroundColor: colors.surfaceContainerLow }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 18 }}>
                  Store Hours
                </Text>
                <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11, lineHeight: 14 }}>
                  Mon–Sat · 10:00–20:00
                </Text>
              </View>
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, color: '#22c55e' }}>
                  Open
                </Text>
              </View>
            </View>
          </View>

          {/* Danger zone */}
          <TouchableOpacity
            className="mt-6 p-4 rounded-figma-16"
            style={{ borderWidth: 1, borderColor: colors.error }}
            onPress={() => Alert.alert('Deactivate Shop', 'Your listings will be hidden. You can reactivate anytime.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Deactivate', style: 'destructive' },
            ])}
          >
            <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
              Deactivate Shop
            </Text>
            <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11, lineHeight: 14 }}>
              Temporarily hide your listings
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom action */}
      <View className="px-5 pt-3 pb-2" style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainer }}>
        <TouchableOpacity className="h-14 rounded-figma-16 items-center justify-center" style={{ backgroundColor: colors.primaryContainer }} onPress={save}>
          <Text className="font-inter-600 text-white" style={{ fontSize: 16, lineHeight: 24 }}>
            Save Changes
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}