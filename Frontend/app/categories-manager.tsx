import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { CATEGORY_TREE, findMainCategory } from '../utils/categories';
import CategoryPicker from '../components/CategoryPicker';
import { useAuth } from '../contexts/AuthContext';
import { isApprovedSeller } from '../utils/marketplace';
import SellerGate from '../components/SellerGate';

const STORE_CATEGORIES_KEY_BASE = '@susej_store_categories';

function getStoreCategoriesKey(username?: string | null): string {
  return username ? `${STORE_CATEGORIES_KEY_BASE}:${username}` : STORE_CATEGORIES_KEY_BASE;
}

interface StoreCategories {
  main: string;
  children: string[];
}

const DEFAULTS: StoreCategories = { main: 'fashion', children: ['Kurtas & Ethnic', 'Sarees'] };

export default function CategoriesManagerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const storeKey = getStoreCategoriesKey(user?.username);
  const [main, setMain] = useState<string>(DEFAULTS.main);
  const [children, setChildren] = useState<string[]>(DEFAULTS.children);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(storeKey);
        if (!raw && storeKey !== STORE_CATEGORIES_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(STORE_CATEGORIES_KEY_BASE);
          if (legacy) {
            raw = legacy;
            try { await AsyncStorage.setItem(storeKey, legacy); } catch {}
          }
        }
        if (active && raw) {
          const parsed = JSON.parse(raw) as StoreCategories;
          setMain(findMainCategory(parsed.main)?.id ?? parsed.main ?? DEFAULTS.main);
          setChildren(Array.isArray(parsed.children) ? parsed.children : []);
        }
      } catch (err) {
        // ignore corrupt/nonexistent store; keep defaults
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [storeKey]);

  const persist = async (nextMain: string, nextChildren: string[]) => {
    try {
      await AsyncStorage.setItem(getStoreCategoriesKey(user?.username), JSON.stringify({ main: nextMain, children: nextChildren } as StoreCategories));
    } catch (err) {
      // storage write failed — surface silently, state still holds the values
    }
  };

  const handleMainChange = (id: string) => {
    // One-shop-one-category lock (H8): approved sellers can't silently move
    // mains here while edit-shop/become-seller lock it — same rule everywhere.
    if (isApprovedSeller(user)) {
      Alert.alert('Category locked', 'Your primary category is locked after approval. Contact support to change it.');
      return;
    }
    setMain(id);
    persist(id, children);
  };

  const handleChildrenChange = (next: string[]) => {
    setChildren(next);
    // keep selected chips attached to the current main so selections never leak
    persist(main, next);
  };

  const handleSave = () => {
    persist(main, children);
    Alert.alert('Saved on this device', 'Sub-category chips preview here. Buyer-side curation arrives with the next storefront sync — buyers currently see the standard taxonomy.');
  };

  const mainNode = findMainCategory(main);
  const previewChips = ['All', ...children];
  const pickerSiblings = mainNode ? mainNode.children : [];

  // Approved sellers only (SELLER-C1): buyers/pending deep-links get status,
  // never tools. Matches server 403s. After all hooks (rules-of-hooks safe).
  if (!isApprovedSeller(user)) return <SellerGate title="Store categories" user={user} />;

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 font-inter-700 text-center" style={{ fontSize: 20, lineHeight: 26, color: colors.primary }}>
          Categories & Sub-categories
        </Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}>
        {/* Main category selector */}
        <Text className="font-inter-600 text-textPrimary mb-3" style={{ fontSize: 13, lineHeight: 18 }}>
          Main category
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }}>
          {CATEGORY_TREE.map((c) => {
            const active = c.id === main;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => handleMainChange(c.id)}
                className="h-9 px-4 items-center justify-center"
                style={{ borderRadius: 9999, backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow }}
              >
                <Text className={active ? 'font-inter-600' : 'font-inter-500'} style={{ fontSize: 13, lineHeight: 18, color: active ? colors.onPrimary : colors.textPrimary }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Subcategory picker */}
        <View className="mt-6">
          <Text className="font-inter-600 text-textPrimary mb-3" style={{ fontSize: 13, lineHeight: 18 }}>
            Sub-categories
          </Text>
          <CategoryPicker
            value={children}
            onChange={handleChildrenChange}
            mainCategory={main}
            onMainChange={handleMainChange}
            hideMains
          />
          {children.length === 0 && (
            <Text className="font-inter-400 mt-3" style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
              Pick a category to add sub-categories
            </Text>
          )}
        </View>

        {/* Live storefront preview */}
        <Text className="font-inter-600 text-textPrimary mt-8 mb-3" style={{ fontSize: 13, lineHeight: 18 }}>
          Storefront preview
        </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {previewChips.map((chip) => (
            <View
              key={chip}
              className="h-9 px-4 items-center justify-center"
              style={{ borderRadius: 9999, backgroundColor: colors.surfaceContainerLow }}
            >
              <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                {chip}
              </Text>
            </View>
          ))}
        </ScrollView>

        <Text className="font-inter-400 text-textSecondary mt-6" style={{ fontSize: 12, lineHeight: 17 }}>
          {mainNode ? `${mainNode.label} — ${pickerSiblings.length} available sub-categories` : 'Select a main category to see its sub-categories'}
        </Text>
      </ScrollView>

      {/* Fixed bottom save bar */}
      <View className="px-5 pt-3 pb-2" style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainer, paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          className="h-12 items-center justify-center"
          style={{ borderRadius: 14, backgroundColor: colors.primaryContainer }}
          onPress={handleSave}
        >
          <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 22, color: colors.onPrimary }}>
            Save
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}