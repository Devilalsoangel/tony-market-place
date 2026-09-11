import { useSyncExternalStore } from 'react';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { isApprovedSeller } from '../../utils/marketplace';
import { colors } from '../../utils/theme';
import { subscribeImmersiveNav, getImmersiveNav } from '../../utils/immersiveNav';

function FeedIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primaryContainer : colors.secondary;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {focused ? (
        <Path
          d="M12 3.5l9 8V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V11.5l9-8z"
          fill={color}
        />
      ) : (
        <Path
          d="M12 3.5l9 8V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V11.5l9-8z"
          stroke={color}
          strokeWidth={1.75}
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </Svg>
  );
}

function ExploreIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primaryContainer : colors.secondary;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {focused ? (
        <>
          <Circle cx="11" cy="11" r="7" fill={color} />
          <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={1.75} fill="none" />
          <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

function CreateIcon({ focused }: { focused: boolean }) {
  return (
    <View
      className="w-14 h-14 rounded-full items-center justify-center"
      style={{
        backgroundColor: colors.primaryContainer,
        shadowColor: colors.primaryContainer,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
        transform: [{ translateY: -14 }],
      }}
    >
      <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
        <Path d="M13 6v14M6 13h14" stroke={colors.surfaceContainerLowest} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ChatIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primaryContainer : colors.secondary;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {focused ? (
        <Path
          d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
          fill={color}
        />
      ) : (
        <Path
          d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
          stroke={color}
          strokeWidth={1.75}
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </Svg>
  );
}

function ProfileIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primaryContainer : colors.secondary;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {focused ? (
        <>
          <Circle cx="12" cy="8" r="4" fill={color} />
          <Path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" fill={color} />
        </>
      ) : (
        <>
          <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.75} fill="none" />
          <Path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke={color} strokeWidth={1.75} strokeLinecap="round" fill="none" />
        </>
      )}
    </Svg>
  );
}

// Buyer center-tab icon (role-based nav): shopping bag glyph.
function OrdersIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primaryContainer : colors.secondary;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {focused ? (
        <>
          <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" fill={color} />
          <Path d="M3 6h18" stroke={colors.surfaceContainerLowest} strokeWidth={1.5} />
          <Path d="M16 10a4 4 0 01-8 0" stroke={colors.surfaceContainerLowest} strokeWidth={1.5} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" stroke={color} strokeWidth={1.75} strokeLinejoin="round" fill="none" />
          <Path d="M3 6h18" stroke={color} strokeWidth={1.75} />
          <Path d="M16 10a4 4 0 01-8 0" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      )}
    </Svg>
  );
}

function NotifBadge({ badge }: { badge?: number }) {
  if (!badge || badge <= 0) return null;
  return (
    <View className="absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-error items-center justify-center px-1">
      <Text className="text-[9px] font-inter-700 text-white">{badge > 9 ? '9+' : badge}</Text>
    </View>
  );
}

function FeedTabIcon({ focused }: { focused: boolean }) {
  const { unreadCount } = useNotifications();
  return (
    <View className="items-center justify-center">
      <FeedIcon focused={focused} />
      <NotifBadge badge={unreadCount} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // ROLE-BASED BOTTOM NAV: APPROVED sellers get the Sell "+" center tab;
  // buyers (and pending applicants) get an Orders center tab instead.
  // Creation surfaces never render for buyers.
  const { user } = useAuth();
  const isSeller = isApprovedSeller(user);
  // Immersive surfaces (DM thread, community room) hide the tab bar via the
  // reactive bridge in utils/immersiveNav.ts - screenOptions-as-function is
  // the only hiding mechanism this router combination honors (Aug 25 proof).
  const immersive = useSyncExternalStore(subscribeImmersiveNav, getImmersiveNav);
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          // Fullscreen immersive camera surface hides the tab bar entirely;
          // DM thread + community rooms opt in through the bridge.
          ...(route.name === 'creator' || immersive ? { display: 'none' as const } : {}),
          backgroundColor: colors.surfaceContainerLowest,
          borderTopWidth: 0,
          height: 74 + insets.bottom,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primaryContainer,
        tabBarInactiveTintColor: colors.secondary,
        tabBarLabelStyle: {
          fontSize: 12,
          lineHeight: 14,
          letterSpacing: 0.24,
          fontFamily: 'Inter_500Medium',
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      })}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ focused }) => <FeedTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <ExploreIcon focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="creator"
        options={{
          title: 'Sell',
          href: isSeller ? undefined : null,
          // Fullscreen immersive camera surface - never show the tab bar here.
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <CreateIcon focused={focused} />
            </View>
          ),
        }}
      />
      {/* create = Post editor only now; reached from the creator launcher, not the tab bar. */}
      <Tabs.Screen
        name="create"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          href: isSeller ? null : undefined,
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <OrdersIcon focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <ChatIcon focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <ProfileIcon focused={focused} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
