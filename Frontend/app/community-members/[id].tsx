import { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { BackIcon, VerifiedIcon } from '../../utils/icons';
import { colors, formatCount } from '../../utils/theme';
import { useCommunities } from '../../contexts/CommunityContext';
import { storyAvatars } from '../../utils/productImages';

type Role = 'Admin' | 'Moderator' | 'Member';

interface SeedMember {
  name: string;
  username: string;
  role: Role;
  verified: boolean;
  joinedDays: number;
  avatar: any;
}

const SEED_MEMBERS: SeedMember[] = [
  { name: 'Elara Moda', username: 'elara_mod', role: 'Admin', verified: true, joinedDays: 210, avatar: storyAvatars['1'] },
  { name: 'Arc Design Studio', username: 'arc_design', role: 'Admin', verified: true, joinedDays: 186, avatar: storyAvatars['2'] },
  { name: 'Lux Gems', username: 'lux_gems', role: 'Moderator', verified: true, joinedDays: 142, avatar: storyAvatars['3'] },
  { name: 'Hype Vault', username: 'hype_vault', role: 'Moderator', verified: false, joinedDays: 118, avatar: storyAvatars['4'] },
  { name: 'Ananya Rao', username: 'ananya', role: 'Member', verified: false, joinedDays: 96, avatar: { uri: 'https://picsum.photos/seed/ananya/200/200' } },
  { name: 'Vikram Mehta', username: 'vikram', role: 'Member', verified: false, joinedDays: 88, avatar: { uri: 'https://picsum.photos/seed/vikram/200/200' } },
  { name: 'Kavya Sharma', username: 'kavya', role: 'Member', verified: false, joinedDays: 74, avatar: { uri: 'https://picsum.photos/seed/kavya/200/200' } },
  { name: 'Sameer Khan', username: 'sameer', role: 'Member', verified: false, joinedDays: 61, avatar: { uri: 'https://picsum.photos/seed/sameer/200/200' } },
  { name: 'Neha Gupta', username: 'neha', role: 'Member', verified: true, joinedDays: 52, avatar: { uri: 'https://picsum.photos/seed/neha/200/200' } },
  { name: 'Arjun Nair', username: 'arjun', role: 'Member', verified: false, joinedDays: 47, avatar: { uri: 'https://picsum.photos/seed/arjun/200/200' } },
  { name: 'Priya Verma', username: 'priya', role: 'Member', verified: false, joinedDays: 39, avatar: { uri: 'https://picsum.photos/seed/priya/200/200' } },
  { name: 'Rohit Malhotra', username: 'rohit', role: 'Member', verified: false, joinedDays: 33, avatar: { uri: 'https://picsum.photos/seed/rohit/200/200' } },
  { name: 'Sneha Iyer', username: 'sneha', role: 'Member', verified: true, joinedDays: 28, avatar: { uri: 'https://picsum.photos/seed/sneha/200/200' } },
  { name: 'Aditya Bose', username: 'aditya', role: 'Member', verified: false, joinedDays: 19, avatar: { uri: 'https://picsum.photos/seed/aditya/200/200' } },
  { name: 'Farah Sheikh', username: 'farah', role: 'Member', verified: false, joinedDays: 12, avatar: { uri: 'https://picsum.photos/seed/farah/200/200' } },
];

const ROLE_STYLE: Record<Role, { bg: string; text: string }> = {
  Admin: { bg: colors.primaryContainer, text: colors.onPrimary },
  Moderator: { bg: colors.surfaceContainer, text: colors.tertiary },
  Member: { bg: colors.surfaceContainerLow, text: colors.textSecondary },
};

export default function CommunityMembersScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const communityId = Array.isArray(id) ? id[0] : id ?? '';
  const { communities } = useCommunities();
  const community = communities.find((c) => c.id === communityId);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const admins = SEED_MEMBERS.filter((m) => m.role !== 'Member');
  const members = SEED_MEMBERS.filter((m) => m.role === 'Member');
  const count = community?.memberCount ?? SEED_MEMBERS.length;

  const handleInvite = () => {
    const link = `https://susej.app/c/${communityId || 'community'}`;
    Share.share({
      message: `Join "${community?.name ?? 'the community'}" on susej — ${formatCount(count)} members and counting. ${link}`,
    }).catch(() => {});
  };

  const renderRow = (m: SeedMember) => {
    const roleStyle = ROLE_STYLE[m.role];
    return (
      <TouchableOpacity
        className="flex-row items-center px-5 py-3"
        onPress={() => router.push(`/seller/${m.username}`)}
      >
        <View className="w-12 h-12 rounded-full overflow-hidden mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
          <Image source={m.avatar} className="w-full h-full" resizeMode="cover" />
        </View>
        <View className="flex-1 pr-2">
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Text className="font-inter-600" numberOfLines={1} style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textPrimary }}>
              {m.name}
            </Text>
            {m.verified ? <VerifiedIcon size={14} /> : null}
            <View className="px-2 py-0.5 rounded-figma-full ml-1" style={{ backgroundColor: roleStyle.bg }}>
              <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 12, color: roleStyle.text }}>
                {m.role}
              </Text>
            </View>
          </View>
          <Text className="font-inter-500 mt-0.5" numberOfLines={1} style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.2, color: colors.textSecondary }}>
            @{m.username}
          </Text>
        </View>
        <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
          Joined {m.joinedDays} days ago
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View
        className="flex-row items-center px-5"
        style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <BackIcon size={16} color={colors.primaryContainer} />
        </TouchableOpacity>
        <View className="flex-1 flex-row items-baseline">
          <Text className="font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.textPrimary }}>
            Members
          </Text>
          <Text className="font-inter-500 ml-2" style={{ fontSize: 14, lineHeight: 28, color: colors.textSecondary }}>
            {formatCount(count)}
          </Text>
        </View>
        <TouchableOpacity
          className="px-3.5 py-1.5 rounded-figma-full"
          style={{ backgroundColor: colors.primaryContainer }}
          onPress={handleInvite}
        >
          <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
            Invite
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primaryContainer} />
          <Text className="font-inter-500 mt-3 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
            Loading members…
          </Text>
        </View>
      ) : SEED_MEMBERS.length === 0 || !communityId ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
            {communityId ? 'No members yet. Invite people to join the community.' : 'Community not found.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.username}
          contentContainerClassName="pb-24"
          ListHeaderComponent={
            <View>
              <Text
                className="font-inter-600 mt-2 mb-1 px-5"
                style={{ fontSize: 13, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary }}
              >
                Admins &amp; Moderators
              </Text>
              {admins.map((m) => <View key={m.username}>{renderRow(m)}</View>)}
              <Text
                className="font-inter-600 mt-3 mb-1 px-5"
                style={{ fontSize: 13, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary }}
              >
                Members
              </Text>
            </View>
          }
          renderItem={({ item }) => renderRow(item)}
        />
      )}
    </View>
  );
}
