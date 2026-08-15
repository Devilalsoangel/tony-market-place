import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../contexts/NotificationContext';
import { colors } from '../../utils/theme';

function FeedIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primaryContainer : colors.secondary;
  return (
    <Svg width={16} height={18} viewBox="0 0 16 18" fill="none">
      <Path d="M2 0h12a2 2 0 012 2v14a2 2 0 01-2 2H2a2 2 0 01-2-2V2a2 2 0 012-2z" stroke={color} strokeWidth="1.5" fill="none" />
      <Path d="M4 5h8M4 9h8M4 13h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function ExploreIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primaryContainer : colors.secondary;
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 1.6l2.1 6.3 6.3 2.1-6.3 2.1L10 18.4l-2.1-6.3-6.3-2.1 6.3-2.1L10 1.6z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="10" cy="10" r="2.1" fill={color} />
    </Svg>
  );
}

function CreateIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.surfaceContainerLowest : colors.surfaceContainerLowest;
  return (
    <View
      className="w-14 h-14 rounded-full items-center justify-center"
      style={{
        backgroundColor: colors.primaryContainer,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
        transform: [{ translateY: -14 }],
      }}
    >
      <Svg width={27} height={27} viewBox="0 0 27 27" fill="none">
        <Path d="M13.5 6v15M6 13.5h15" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ChatIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primaryContainer : colors.secondary;
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M18 15a2 2 0 01-2 2H4l-3 3V3a2 2 0 012-2h14a2 2 0 012 2v12z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

function ProfileIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primaryContainer : colors.secondary;
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Circle cx="8" cy="5" r="3.5" stroke={color} strokeWidth="1.5" fill="none" />
      <Path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
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
      }}
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
        name="create"
        options={{
          title: 'Sell',
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <CreateIcon focused={focused} />
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
