import { useMemo, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, HeartIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useNotifications, AppNotification, NotifType } from '../contexts/NotificationContext';
import { useSettings } from '../contexts/SettingsContext';
import { resolveAvatar } from '../utils/productImages';

type Tab = 'All' | 'Orders' | 'Social';
const tabs: Tab[] = ['All', 'Orders', 'Social'];

const ORDER_TYPES: NotifType[] = ['order', 'wallet'];
const SOCIAL_TYPES: NotifType[] = ['follower', 'like', 'comment', 'bookmark', 'promotion'];
// System warnings (imageless listings, etc.) surface under BOTH tabs: they
// are the one notification class that must never hide behind a filter.

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const { notifications, markAsRead, markAllAsRead, loadMore, hasMore } = useNotifications();
  const { settings } = useSettings();
  const pushOff = settings.pushNotifications === false;

  const filtered = useMemo(() => {
    if (activeTab === 'Orders') return notifications.filter((n) => n.type === 'warning' || ORDER_TYPES.includes(n.type));
    if (activeTab === 'Social') return notifications.filter((n) => n.type === 'warning' || SOCIAL_TYPES.includes(n.type));
    return notifications;
  }, [notifications, activeTab]);

  const titleFor = (n: AppNotification): string => {
    switch (n.type) {
      case 'follower': return 'New Follower';
      case 'like': return 'New Like';
      case 'comment': return 'New Comment';
      case 'bookmark': return 'New Save';
      case 'order': return 'Order Update';
      case 'wallet': return 'Wallet Update';
      case 'promotion': return n.userName;
      default: return n.userName;
    }
  };

  const messageFor = (n: AppNotification): string => {
    const subject = n.target ? ` on ${n.target}` : '';
    switch (n.type) {
      case 'follower': return `${n.userName} started following you.`;
      case 'like': return `${n.userName} liked your post${subject}.`;
      case 'comment': return `${n.userName} ${n.action}.`;
      case 'bookmark': return `${n.userName} ${n.action}.`;
      case 'order': return `${n.userName} ${n.action}${subject}.`;
      case 'wallet': return `${n.userName} ${n.action}.`;
      case 'promotion': return n.action;
      default: return n.action;
    }
  };

  const openNotification = (n: AppNotification) => {
    markAsRead(n.id);
    const targetId = n.targetId || n.target;
    switch (n.type) {
      case 'follower': {
        const handle = n.userHandle || n.targetId;
        router.push(handle ? `/seller/${handle}` : '/search');
        break;
      }
      case 'order':
        // Deep-link the receipt when the tell carries it (tracking id):
        // every order tell stamps targetId, and getOrder resolves
        // #-prefixed numbers — landing on the generic list wasted it.
        router.push(targetId ? `/order/${encodeURIComponent(String(targetId))}` : '/orders');
        break;
      case 'wallet':
        router.push('/wallet');
        break;
      case 'bookmark':
        router.push('/saved');
        break;
      case 'promotion':
        router.push('/(tabs)/explore');
        break;
      case 'warning':
        // Imageless-listing warnings carry the listing id: land on the
        // listing that needs the photo, not the generic feed.
        router.push(targetId ? `/product/${targetId}` : '/(tabs)/feed');
        break;
      case 'like':
      case 'comment':
        router.push(targetId ? `/product/${targetId}` : '/(tabs)/feed');
        break;
      default:
        router.push('/(tabs)/feed');
    }
  };

  // Industry-practical: avatars vary per person; system notifications use icon circles (Figma core)
  const renderAvatar = (n: AppNotification) => {
    switch (n.type) {
      case 'like':
        return (
          <View
            className="w-[64px] h-[64px] rounded-full items-center justify-center relative"
            style={{ backgroundColor: colors.surfaceContainerLow }}
          >
            <Image source={resolveAvatar(n.userHandle || n.userName || n.id)} className="w-full h-full rounded-full" resizeMode="cover" />
            <View
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full items-center justify-center border-2"
              style={{ backgroundColor: '#E8DEF8', borderColor: colors.surface }}
            >
              <HeartIcon size={10} color="#B3261E" />
            </View>
          </View>
        );
      case 'bookmark':
        return (
          <View
            className="w-[64px] h-[64px] rounded-full items-center justify-center relative"
            style={{ backgroundColor: colors.surfaceContainerLow }}
          >
            <Image source={resolveAvatar(n.userHandle || n.userName || n.id)} className="w-full h-full rounded-full" resizeMode="cover" />
            <View className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full items-center justify-center border-2" style={{ backgroundColor: colors.surfaceContainer, borderColor: colors.surface }}>
              <Text style={{ fontSize: 10, lineHeight: 12, color: colors.primary }}>◆</Text>
            </View>
          </View>
        );
      case 'promotion':
        return (
          <View className="w-[64px] h-[64px] rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
            <Text style={{ fontSize: 16, lineHeight: 18, color: '#FFFFFF' }}>★</Text>
          </View>
        );
      default:
        return (
          <Image source={resolveAvatar(n.userHandle || n.userName || n.id)} className="w-[64px] h-[64px] rounded-full" resizeMode="cover" />
        );
    }
  };

  const renderRow = (item: AppNotification) => (
    <TouchableOpacity
      className="mx-4 mb-3 p-4"
      style={{
        backgroundColor: colors.surfaceContainerLowest,
        borderRadius: 24,
        shadowColor: '#1a1a2e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 20,
        elevation: 2,
        opacity: item.read ? 0.85 : 1,
      }}
      onPress={() => openNotification(item)}
    >
      <View className="flex-row items-start">
        {renderAvatar(item)}
        <View className="flex-1 ml-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
              {titleFor(item)}
            </Text>
            <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: colors.textTertiary }}>
              {timeAgo(item.timestamp)}
            </Text>
          </View>
          <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>
            {messageFor(item)}
          </Text>
          {!item.read && (
            <View className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: colors.primaryContainer }} />
          )}
          {item.type === 'comment' && (
            <View className="flex-row gap-2 mt-3">
              <TouchableOpacity
                className="px-4 py-2 rounded-full"
                style={{ backgroundColor: colors.primaryContainer }}
                onPress={() => router.push('/(tabs)/chat')}
              >
                <Text className="font-inter-600 text-white" style={{ fontSize: 12, lineHeight: 14 }}>
                  Reply
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="px-4 py-2 rounded-full border"
                style={{ borderColor: colors.outlineVariant }}
                onPress={() => markAsRead(item.id)}
              >
                <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
                  Dismiss
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header — back + centered title + mark-all-read (Figma core) */}
      <View style={{ backgroundColor: colors.surface, paddingTop: insets.top }}>
        <View className="flex-row items-center h-[52px] px-5">
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeftIcon size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
            Notifications
          </Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={markAllAsRead} hitSlop={8}>
              <Text className="font-inter-500 text-primary" style={{ fontSize: 12, lineHeight: 14 }}>
                Mark all read
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs — Figma core: plain labels + active underline, no pills */}
      <View
        className="flex-row items-center justify-between px-6 pt-2"
        style={{ borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
      >
        {tabs.map((tab) => {
          const active = tab === activeTab;
          return (
            <TouchableOpacity key={tab} className="items-center pb-3 px-3" onPress={() => setActiveTab(tab)}>
              <Text
                className="font-inter-600"
                style={{ fontSize: 14, lineHeight: 16, color: active ? colors.primary : colors.secondary, letterSpacing: 0.14 }}
              >
                {tab}
              </Text>
              {active && (
                <View className="absolute bottom-0 w-[44px] h-[2px] rounded-full" style={{ backgroundColor: colors.primary }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: insets.bottom + 80 }}
        renderItem={({ item }) => renderRow(item)}
        ListHeaderComponent={
          pushOff ? (
            <Text className="font-inter-400 px-5 pb-2 text-secondary" style={{ fontSize: 12, lineHeight: 16 }}>
              Push is off in Settings — showing your saved list. New activity will not arrive until it is back on.
            </Text>
          ) : null
        }
        ListFooterComponent={
          !pushOff && hasMore ? (
            <TouchableOpacity onPress={loadMore} className="items-center py-4">
              <Text className="font-inter-600 text-primary" style={{ fontSize: 13, lineHeight: 16 }}>
                Load older
              </Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center py-16 px-4">
            <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 15, lineHeight: 20 }}>
              No {activeTab === 'All' ? '' : activeTab.toLowerCase() + ' '}notifications
            </Text>
            <Text className="font-inter-400 text-secondary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
              New activity will show up here
            </Text>
          </View>
        }
      />
    </View>
  );
}