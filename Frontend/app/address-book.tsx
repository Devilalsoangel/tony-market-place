import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, MapPinIcon, CheckIcon, PlusIcon, CloseIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';

export interface SavedAddress {
  id: string;
  type: string;
  name: string;
  street: string;
  city: string;
  phone: string;
}

export const ADDRESSES_KEY_BASE = '@susej_addresses';
export const SELECTED_ADDRESS_KEY_BASE = '@susej_selected_address';
// Back-compat aliases — prefer the BASE keys with per-user suffix.
export const ADDRESSES_KEY = ADDRESSES_KEY_BASE;
export const SELECTED_ADDRESS_KEY = SELECTED_ADDRESS_KEY_BASE;

function addressesKey(username?: string | null) {
  const u = username?.trim();
  return u ? `${ADDRESSES_KEY_BASE}:${u}` : ADDRESSES_KEY_BASE;
}
function selectedAddressKey(username?: string | null) {
  const u = username?.trim();
  return u ? `${SELECTED_ADDRESS_KEY_BASE}:${u}` : SELECTED_ADDRESS_KEY_BASE;
}

export async function getSelectedAddress(username?: string | null): Promise<SavedAddress | null> {
  try {
    const raw = await AsyncStorage.getItem(selectedAddressKey(username ?? null));
    if (raw) return JSON.parse(raw) as SavedAddress;
    // Fallback legacy global only when per-user empty.
    if (username) {
      const legacy = await AsyncStorage.getItem(SELECTED_ADDRESS_KEY_BASE);
      return legacy ? (JSON.parse(legacy) as SavedAddress) : null;
    }
    return null;
  } catch {
    return null;
  }
}

const ADDRESS_TYPES = ['Home', 'Work', 'Other'];

export default function AddressBookScreen() {
  const insets = useSafeAreaInsets();
  const { user, tokenSeq } = useAuth();
  const username = user?.username ?? null;
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', street: '', city: '', type: 'Home' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const key = addressesKey(username);
        let stored = await AsyncStorage.getItem(key);
        if (!stored && key !== ADDRESSES_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(ADDRESSES_KEY_BASE);
          if (legacy) stored = legacy;
        }
        const parsed = stored ? (JSON.parse(stored) as SavedAddress[]) : null;
        if (!active) return;
        const real = (parsed ?? []).filter(
          (a) => a && a.id && !['home', 'work', 'other'].includes(String(a.id))
        );
        setAddresses(real);
        const selected = await getSelectedAddress(username);
        if (active) setSelectedId(selected?.id ?? real[0]?.id ?? null);
        // Server truth (cross-device): replace the mirror when reachable.
        // Offline/unreachable keeps the local cache — never blank the book.
        try {
          const mod = await import('../utils/serverApi');
          const res = await mod.serverApi.getAddresses();
          if (active && res.ok && Array.isArray(res.data?.addresses) && res.data.addresses.length > 0) {
            const server = res.data.addresses.map((a) => ({
              id: a.id,
              type: a.type,
              name: a.name,
              street: a.street,
              city: a.city,
              phone: a.phone,
            }));
            setAddresses(server);
            await AsyncStorage.setItem(addressesKey(username), JSON.stringify(server)).catch(() => {});
            const sel = await getSelectedAddress(username);
            if (!sel) {
              const def = res.data.addresses.find((a) => a.isDefault) ?? res.data.addresses[0];
              const match = server.find((s) => s.id === def.id);
              if (match) {
                await AsyncStorage.setItem(selectedAddressKey(username), JSON.stringify(match)).catch(() => {});
                setSelectedId(match.id);
              }
            }
          }
        } catch {
          // offline — local mirror stands
        }
      } catch {
        if (active) setLoadFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [username, tokenSeq]);

  const persist = useCallback((next: SavedAddress[]) => {
    AsyncStorage.setItem(addressesKey(username), JSON.stringify(next)).catch(() => {});
  }, [username]);

  const selectAddress = useCallback((addr: SavedAddress) => {
    AsyncStorage.setItem(selectedAddressKey(username), JSON.stringify(addr)).catch(() => {});
    router.back();
  }, [username]);

  const canSave =
    form.name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.street.trim().length > 0 &&
    form.city.trim().length > 0;

  const saveAddress = useCallback(() => {
    if (!canSave || !addresses) return;
    const addr: SavedAddress = {
      id: `addr_${Date.now()}`,
      type: form.type,
      name: form.name.trim(),
      street: form.street.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
    };
    const next = [addr, ...addresses];
    setAddresses(next);
    persist(next);
    AsyncStorage.setItem(selectedAddressKey(username), JSON.stringify(addr)).catch(() => {});
    setSelectedId(addr.id);
    setModalOpen(false);
    setForm({ name: '', phone: '', street: '', city: '', type: 'Home' });
    // Mirror to the server (cross-device truth). Fire-and-forget: offline
    // keeps the local entry; the next load pulls server truth when reachable.
    import('../utils/serverApi')
      .then((mod) =>
        mod.serverApi.addAddress({
          type: addr.type,
          street: addr.street,
          city: addr.city,
          phone: addr.phone,
          isDefault: addresses.length === 0,
        })
      )
      .catch(() => {});
  }, [addresses, canSave, form, persist, username]);

  const openAdd = () => setModalOpen(true);

  return (
    <View className="flex-1 bg-surface">
      {/* Header — h52 safe area */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-[20px] font-inter-700" style={{ lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
          Address Book
        </Text>
        <TouchableOpacity onPress={openAdd} className="flex-row items-center">
          <PlusIcon size={12} color={colors.primary} />
          <Text className="text-[13px] font-inter-600 ml-1" style={{ color: colors.primary }}>Add</Text>
        </TouchableOpacity>
      </View>

      {addresses === null && !loadFailed && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primaryContainer} />
        </View>
      )}

      {loadFailed && (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[18px] font-inter-600 text-textPrimary mb-2" style={{ lineHeight: 28 }}>
            Couldn't load addresses
          </Text>
          <Text className="text-[14px] font-inter-400 text-textSecondary text-center mb-6" style={{ lineHeight: 20 }}>
            Something went wrong while reading your saved addresses.
          </Text>
          <TouchableOpacity
            className="px-6 py-3 rounded-full"
            style={{ backgroundColor: colors.primaryContainer }}
            onPress={() => {
              setLoadFailed(false);
              setAddresses(null);
              setSelectedId(null);
              router.replace('/address-book');
            }}
          >
            <Text className="text-[14px] font-inter-600 text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {addresses !== null && (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 pb-8"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, rowGap: 16 }}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedId;
            return (
              <TouchableOpacity
                className="rounded-[24px] p-4"
                style={{
                  backgroundColor: colors.surfaceContainerLowest,
                  borderWidth: 1.5,
                  borderColor: isSelected ? colors.primaryContainer : colors.surfaceContainer,
                  shadowColor: colors.textPrimary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.04,
                  shadowRadius: 20,
                  elevation: 2,
                }}
                onPress={() => selectAddress(item)}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full items-center justify-center mr-2" style={{ backgroundColor: colors.primaryBg }}>
                      <MapPinIcon size={16} color={colors.primaryContainer} />
                    </View>
                    <Text className="text-[14px] font-inter-700 text-textPrimary" style={{ lineHeight: 20 }}>
                      {item.type} — {item.name}
                    </Text>
                  </View>
                  {isSelected && (
                    <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryContainer }}>
                      <CheckIcon size={12} color={colors.surfaceContainerLowest} />
                    </View>
                  )}
                </View>
                <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
                  {item.street}
                </Text>
                <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
                  {item.city}
                </Text>
                <Text className="text-[13px] font-inter-500 text-textPrimary mt-1" style={{ lineHeight: 18 }}>
                  {item.phone}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <MapPinIcon size={40} color={colors.textSecondary} />
              <Text className="text-[16px] font-inter-600 text-textPrimary mt-4 mb-2" style={{ lineHeight: 24 }}>
                No saved addresses
              </Text>
              <Text className="text-[14px] font-inter-400 text-textSecondary text-center" style={{ lineHeight: 20 }}>
                Tap "Add" to save a delivery address
              </Text>
            </View>
          }
        />
      )}

      {/* Add address modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          className="flex-1 justify-end"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setModalOpen(false)}>
            <View className="flex-1" style={{ backgroundColor: colors.overlay }} />
          </TouchableOpacity>
          <View
            className="rounded-t-[24px] px-5 pt-5"
            style={{ backgroundColor: colors.surfaceContainerLowest, paddingBottom: insets.bottom + 24 }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[18px] font-inter-700 text-textPrimary" style={{ lineHeight: 26 }}>
                Add Address
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <CloseIcon size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Type chips */}
              <View className="flex-row mb-3" style={{ gap: 8 }}>
                {ADDRESS_TYPES.map((t) => {
                  const active = form.type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      className="px-4 py-2 rounded-full"
                      style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow }}
                      onPress={() => setForm((f) => ({ ...f, type: t }))}
                    >
                      <Text className="text-[13px] font-inter-600" style={{ color: active ? colors.surfaceContainerLowest : colors.textSecondary }}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ rowGap: 12 }}>
                <TextInput
                  className="rounded-[16px] px-4"
                  placeholder="Full name"
                  placeholderTextColor={colors.placeholder}
                  style={{ height: 52, backgroundColor: colors.surfaceContainerLow, fontSize: 15, fontFamily: 'Inter', color: colors.textPrimary }}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                />
                <TextInput
                  className="rounded-[16px] px-4"
                  placeholder="Phone number"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="phone-pad"
                  style={{ height: 52, backgroundColor: colors.surfaceContainerLow, fontSize: 15, fontFamily: 'Inter', color: colors.textPrimary }}
                  value={form.phone}
                  onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                />
                <TextInput
                  className="rounded-[16px] px-4"
                  placeholder="Street, building, area"
                  placeholderTextColor={colors.placeholder}
                  style={{ height: 52, backgroundColor: colors.surfaceContainerLow, fontSize: 15, fontFamily: 'Inter', color: colors.textPrimary }}
                  value={form.street}
                  onChangeText={(v) => setForm((f) => ({ ...f, street: v }))}
                />
                <TextInput
                  className="rounded-[16px] px-4"
                  placeholder="City, PIN"
                  placeholderTextColor={colors.placeholder}
                  style={{ height: 52, backgroundColor: colors.surfaceContainerLow, fontSize: 15, fontFamily: 'Inter', color: colors.textPrimary }}
                  value={form.city}
                  onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
                />
              </View>
              <TouchableOpacity
                className="w-full items-center justify-center mt-5"
                style={{ height: 56, borderRadius: 16, backgroundColor: canSave ? colors.primaryContainer : colors.disabled }}
                disabled={!canSave}
                onPress={saveAddress}
              >
                <Text className="text-[16px] font-inter-600" style={{ color: canSave ? colors.surfaceContainerLowest : colors.disabledText }}>
                  Save Address
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
