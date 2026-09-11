import { View, Text, Image, FlatList, TouchableOpacity, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { BackIcon, VerifiedIcon } from '../../utils/icons';
import { colors, formatCount } from '../../utils/theme';
import { useCommunities } from '../../contexts/CommunityContext';
import { useAuth } from '../../contexts/AuthContext';

type Role = 'Admin' | 'Moderator' | 'Member';

interface SeedMember {
  name: string;
  username: string;
  role: Role;
  verified: boolean;
  joinedDays: number;
  avatar?: { uri: string };
}

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
  const { user } = useAuth();
  const community = communities.find((c) => c.id === communityId);

  // Real roster: server-resolved member profiles for this community.
  // Falls back to the signed-in user row when the roster hasn't synced yet.
  // Never fabricated — unresolvable handles are skipped server-side.
  const serverMembers: SeedMember[] = (community?.members ?? []).map((m) => ({
    name: m.name || m.username,
    username: m.username,
    role: (community?.ownerName && (m.name === community.ownerName || m.username === community.ownerName) ? 'Admin' : 'Member') as Role,
    verified: !!m.verified,
    joinedDays: 0,
    avatar: m.avatar ? { uri: m.avatar } : undefined,
  }));
  const selfRow: SeedMember[] =
    serverMembers.length === 0 && community?.joined && user?.username
      ? [
          {
            name: user.name || user.username,
            username: user.username,
            role: 'Member' as Role,
            verified: user.verification === 'approved',
            joinedDays: 0,
            avatar: user.avatar ? { uri: user.avatar } : undefined,
          },
        ]
      : [];
  const members: SeedMember[] = serverMembers.length > 0 ? serverMembers : selfRow;
  const admins = members.filter((m) => m.role !== 'Member');
  const count = community?.memberCount ?? members.length;

  const handleInvite = () => {
    Share.share({
      message: `Join "${community?.name ?? 'the community'}" on SUSEJ — search for it in the Communities tab.`,
    }).catch(() => {});
  };

  const renderRow = (m: SeedMember) => {
    const roleStyle = ROLE_STYLE[m.role];
    return (
      <TouchableOpacity
        className="flex-row items-center px-5 py-3"
        onPress={() => router.push(`/seller/${m.username}`)}
      >
        <View className="w-12 h-12 rounded-full overflow-hidden mr-3 items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
          {m.avatar ? (
            <Image source={m.avatar} className="w-full h-full" resizeMode="cover" />
          ) : (
            <Text className="font-inter-700" style={{ fontSize: 18, lineHeight: 22, color: colors.primaryContainer }}>
              {m.name.charAt(0).toUpperCase()}
            </Text>
          )}
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
          {m.joinedDays > 0 ? `Joined ${m.joinedDays} days ago` : 'New member'}
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

      {members.length === 0 || !communityId ? (
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
            admins.length > 0 ? (
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
            ) : null
          }
          renderItem={({ item }) => renderRow(item)}
        />
      )}
    </View>
  );
}
