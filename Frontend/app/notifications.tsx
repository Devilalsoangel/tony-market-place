import { useMemo, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, HeartIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useNotifications, AppNotification, NotifType } from '../contexts/NotificationContext';
import { notificationImages } from '../utils/screenImages';

type Tab = 'All' | 'Orders' | 'Social';
const tabs: Tab[] = ['All', 'Orders', 'Social'];

const ORDER_TYPES: NotifType[] = ['order'];
const SOCIAL_TYPES: NotifType[] = ['follower', 'like', 'comment', 'bookmark', 'promotion'];

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

// Inline glyphs (Material-shape paths, per project rule: inline Svg icons)
const GearPathIcon =
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z';
const TruckIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
      fill={colors.surfaceContainerLowest}
    />
  </Svg>
);
const TagIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"
      fill={colors.surfaceContainerLowest}
    />
  </Svg>
);
const GearIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d={GearPathIcon} fill={colors.primary} />
  </Svg>
);

const AVATAR_KEYS: Record<string, number> = {};
const avatarIndexFor = (id: string) => {
  if (!(id in AVATAR_KEYS)) AVATAR_KEYS[id] = Object.keys(AVATAR_KEYS).length;
  return AVATAR_KEYS[id] % notificationImages.length;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  const filtered = useMemo(() => {
    if (activeTab === 'Orders') return notifications.filter((n) => ORDER_TYPES.includes(n.type));
    if (activeTab === 'Social') return notifications.filter((n) => SOCIAL_TYPES.includes(n.type));
    return notifications;
  }, [notifications, activeTab]);

  const titleFor = (n: AppNotification): string => {
    switch (n.type) {
      case 'follower': return 'New Follower';
      case 'like': return 'New Like';
      case 'comment': return 'New Comment';
      case 'bookmark': return 'New Save';
      case 'order': return 'Order Update';
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
        router.push('/orders');
        break;
      case 'bookmark':
        router.push('/saved');
        break;
      case 'promotion':
        router.push('/(tabs)/explore');
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
            <Image source={notificationImages[avatarIndexFor(n.id)]} className="w-full h-full rounded-full" resizeMode="cover" />
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
            <Image source={notificationImages[avatarIndexFor(n.id)]} className="w-full h-full rounded-full" resizeMode="cover" />
            <View className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full items-center justify-center border-2" style={{ backgroundColor: colors.surfaceContainer, borderColor: colors.surface }}>
              <Text style={{ fontSize: 10, lineHeight: 12, color: colors.primary }}>◆</Text>
            </View>
          </View>
        );
      case 'promotion':
        return (
          <View className="w-[64px] h-[64px] rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
            <TagIcon />
          </View>
        );
      default:
        return (
          <Image source={notificationImages[avatarIndexFor(n.id)]} className="w-[64px] h-[64px] rounded-full" resizeMode="cover" />
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
      {/* Header — Figma core: back + title centered + gear right */}
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
            <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={8}>
              <GearIcon />
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