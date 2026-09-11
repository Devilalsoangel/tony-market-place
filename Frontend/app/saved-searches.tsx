import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Switch, ActivityIndicator, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, BellIcon, SearchIcon, CloseIcon, PlusIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';

const SEARCHES_KEY_BASE = '@susej_saved_searches';

interface SavedSearch {
  id: string;
  query: string;
  savedAt: number;
  priceAlert: boolean;
}

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function SavedSearchesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const searchesKey = user?.username ? `${SEARCHES_KEY_BASE}:${user.username}` : SEARCHES_KEY_BASE;
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState('');
  const [alertOn, setAlertOn] = useState(false);

  const persist = useCallback((next: SavedSearch[]) => {
    setSaved(next);
    AsyncStorage.setItem(searchesKey, JSON.stringify(next)).catch(() => {});
  }, [searchesKey]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    AsyncStorage.getItem(searchesKey)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            const parsed = JSON.parse(data) as SavedSearch[];
            setSaved(Array.isArray(parsed) ? parsed.slice().sort((a, b) => b.savedAt - a.savedAt).filter((s) => !String(s.id).startsWith('seed_')) : []);
          } catch {
            if (!cancelled) setSaved([]);
          }
        } else {
          if (!cancelled) setSaved([]);
        }
        if (!cancelled) setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) { setSaved([]); setLoaded(true); }
      });
    return () => { cancelled = true; };
  }, [searchesKey]);

  const addSearch = () => {
    const q = draft.trim();
    if (!q) return;
    if (!saved.some((s) => s.query.toLowerCase() === q.toLowerCase())) {
      const entry: SavedSearch = {
        id: `ss_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        query: q,
        savedAt: Date.now(),
        priceAlert: alertOn,
      };
      persist([entry, ...saved]);
    }
    setDraft('');
    setAlertOn(false);
    setShowForm(false);
    Keyboard.dismiss();
  };

  const removeSearch = (id: string) => persist(saved.filter((s) => s.id !== id));

  const toggleAlert = (id: string, value: boolean) =>
    persist(saved.map((s) => (s.id === id ? { ...s, priceAlert: value } : s)));

  if (!loaded) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={colors.primaryContainer} />
      </View>
    );
  }

  const renderRow = ({ item }: { item: SavedSearch }) => (
    <View
      className="bg-surfaceContainerLowest rounded-figma-16 px-4 py-3 mb-3"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <TouchableOpacity
        className="flex-row items-center gap-3"
        onPress={() => router.push(`/search?q=${encodeURIComponent(item.query)}`)}
      >
        <View className="w-10 h-10 rounded-figma-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <SearchIcon size={16} color={colors.secondary} />
        </View>
        <View className="flex-1 pr-1">
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={1}>
            {item.query}
          </Text>
          <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
            Saved {timeAgo(item.savedAt)}
          </Text>
        </View>
        <TouchableOpacity className="p-2" hitSlop={8} onPress={() => removeSearch(item.id)}>
          <CloseIcon size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
      {item.priceAlert ? (
        <View className="flex-row items-center self-start mt-2 px-2.5 py-1 rounded-figma-full" style={{ backgroundColor: colors.surfaceContainerLow, gap: 6 }}>
          <BellIcon size={12} color={colors.primaryContainer} />
          <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, color: colors.tertiary }}>
            Alerting on price drops
          </Text>
        </View>
      ) : null}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: colors.surfaceContainer }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <BellIcon size={14} color={item.priceAlert ? colors.primaryContainer : colors.secondary} />
          <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: item.priceAlert ? colors.primary : colors.textSecondary }}>
            {item.priceAlert ? 'Price-drop alert on' : 'Price-drop alert off'}
          </Text>
        </View>
        <Switch
          value={item.priceAlert}
          onValueChange={(v) => toggleAlert(item.id, v)}
          trackColor={{ false: colors.surfaceContainer, true: colors.primaryContainer }}
          thumbColor={colors.surfaceContainerLowest}
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row items-center px-4 gap-3 bg-surface" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.primaryContainer} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-textPrimary" style={{ fontSize: 17, lineHeight: 24 }}>
          Saved Searches
        </Text>
        <TouchableOpacity
          className="flex-row items-center h-9 px-3.5 rounded-figma-full"
          style={{ backgroundColor: colors.primaryContainer }}
          onPress={() => {
            setShowForm((v) => !v);
            setDraft('');
          }}
        >
          <PlusIcon size={10} color={colors.onPrimary} />
          <Text className="ml-1.5 font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
            New
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={saved}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={
          <View className="pt-4 pb-2">
            {showForm ? (
              <View
                className="p-4 mb-3 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
              >
                <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 14, lineHeight: 20 }}>
                  New saved search
                </Text>
                <View className="flex-row items-center h-12 px-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainer }}>
                  <SearchIcon size={16} color={colors.secondary} />
                  <TextInput
                    className="flex-1 ml-3 font-inter-400 text-textPrimary h-full"
                    style={{ fontSize: 14 }}
                    placeholder="e.g. vintage watch"
                    placeholderTextColor={colors.placeholder}
                    value={draft}
                    onChangeText={setDraft}
                    returnKeyType="done"
                    onSubmitEditing={addSearch}
                    autoFocus
                  />
                </View>
                <View className="flex-row items-center justify-between mt-3 px-1">
                  <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
                    Alert me on price drop
                  </Text>
                  <Switch
                    value={alertOn}
                    onValueChange={setAlertOn}
                    trackColor={{ false: colors.surfaceContainer, true: colors.primaryContainer }}
                    thumbColor={colors.surfaceContainerLowest}
                  />
                </View>
                <TouchableOpacity
                  className="mt-3 h-12 items-center justify-center rounded-figma-16"
                  style={{ backgroundColor: draft.trim() ? colors.primaryContainer : colors.surfaceContainerLow }}
                  disabled={!draft.trim()}
                  onPress={addSearch}
                >
                  <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: draft.trim() ? colors.onPrimary : colors.textSecondary }}>
                    Save search
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View className="flex-row items-center justify-between px-1 mb-1">
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                Saved searches
              </Text>
              <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                {saved.length} saved
              </Text>
            </View>
            <Text className="font-inter-400 text-textSecondary px-1 mb-3" style={{ fontSize: 12, lineHeight: 16 }}>
              Tap a search to run it. Turn on alerts to get notified when prices drop.
            </Text>
          </View>
        }
        renderItem={renderRow}
        ListEmptyComponent={
          <View className="items-center py-16 px-8">
            <View className="w-16 h-16 rounded-figma-full items-center justify-center mb-4" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <BellIcon size={26} color={colors.secondary} />
            </View>
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
              No saved searches yet
            </Text>
            <Text className="font-inter-400 text-textSecondary text-center mt-1" style={{ fontSize: 13, lineHeight: 20 }}>
              Save searches you want to revisit, and turn on price alerts to get notified on drops.
            </Text>
            <TouchableOpacity
              className="mt-5 h-11 px-6 items-center justify-center rounded-figma-full"
              style={{ backgroundColor: colors.primaryContainer }}
              onPress={() => setShowForm(true)}
            >
              <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 20, color: colors.onPrimary }}>
                New search
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
