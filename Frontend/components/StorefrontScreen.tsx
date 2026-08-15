import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VerifiedIcon, ChevronLeftIcon, MoreIcon, StarIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useFollow } from '../contexts/FollowContext';
import { usePosts } from '../contexts/PostContext';
import { useAuth } from '../contexts/AuthContext';
import { productImages } from '../utils/productImages';
import type { ShopProfile } from '../utils/storefronts';
import {
  ChipRail,
  InfoChipRow,
  MarketingBanner,
  StatsBar,
  ActionRow,
  DealsRail,
  ProductGridSection,
  MenuListSection,
  ServiceCategoryGrid,
  TrendingRail,
  ServicesListSection,
  JobListSection,
  ListingsListSection,
  BulkDealsRail,
  BulkProductList,
  EmptyStorefront,
  ReviewsSection,
  AboutSection,
  StickyActionBar,
  StatusBadge,
  SectionTitle,
} from '../components/StorefrontSections';

const BLOCKED_KEY = '@susej_blocked';

export default function StorefrontScreen({ username, profile }: { username: string; profile: ShopProfile }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(profile.tabLabels[0]);
  const [activeChip, setActiveChip] = useState('all');
  const { isFollowing, toggleFollow } = useFollow();
  const following = isFollowing(username);
  const { user } = useAuth();
  const isOwner = user?.username?.toLowerCase() === username.toLowerCase();
  const { posts } = usePosts();

  const sellerPosts = useMemo(
    () => posts.filter((p) => p.sellerUsername.toLowerCase() === username.toLowerCase()),
    [posts, username]
  );

  const gridItems = useMemo(() => {
    if (sellerPosts.length > 0) {
      return sellerPosts.map((p) => ({
        id: p.id,
        title: (p.description || '').split('\n')[0],
        price: p.price || 0,
        image: p.image ? { uri: p.image } : productImages[p.id],
      }));
    }
    return (profile.deals || []).map((d) => ({ id: d.id, title: d.title, price: d.price, image: d.image }));
  }, [sellerPosts, profile.deals]);

  const handleDemo = (what: string) => {
    Alert.alert(what, 'Request sent — the seller will respond in chat.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Chat', onPress: () => router.push('/(tabs)/chat') },
    ]);
  };

  const handleMore = () => {
    Alert.alert(`@${username}`, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report user', onPress: () => Alert.alert('Thanks — our team will review', `We will review @${username} and take action within 24 hours.`) },
      { text: 'Block user', style: 'destructive', onPress: () => Alert.alert('User blocked', `@${username} can no longer see your profile, posts or message you.`) },
    ]);
  };

  // ── Profile header (all archetypes) ──
  const profileHeader = (
    <View>
      <View className="flex-row items-center">
        <View className="w-[72px] h-[72px] rounded-full items-center justify-center">
          <Image source={profile.avatar} className="w-[72px] h-[72px] rounded-full" />
          {profile.verified && (
            <View
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-surfaceContainerLowest items-center justify-center"
              style={{ borderWidth: 1, borderColor: colors.outlineVariant }}
            >
              <VerifiedIcon size={16} />
            </View>
          )}
        </View>
        <View className="flex-1 ml-3">
          <View className="flex-row items-center gap-1.5">
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 18, lineHeight: 24 }} numberOfLines={1}>
              {profile.name}
            </Text>
            {profile.statusBadge && <StatusBadge label={profile.statusBadge} />}
          </View>
          <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
            {profile.tagline}
          </Text>
          {profile.rating > 0 && (
            <View className="flex-row items-center mt-0.5">
              <StarIcon size={14} color={colors.primaryContainer} />
              <Text className="font-inter-600 text-textPrimary ml-1" style={{ fontSize: 13, lineHeight: 16 }}>
                {profile.rating}
              </Text>
              <Text className="font-inter-400 text-textSecondary ml-1" style={{ fontSize: 13, lineHeight: 16 }}>
                ({profile.reviews})
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="mt-4">
        <StatsBar stats={profile.stats} />
      </View>

      {profile.statusLine && (
        <View className="flex-row items-center mt-3 px-4 py-2.5 rounded-figma-12" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 12, lineHeight: 16 }}>
            {profile.statusLine}
          </Text>
        </View>
      )}

      <Text className="font-inter-400 text-textPrimary mt-3" style={{ fontSize: 14, lineHeight: 22 }}>
        {profile.bio}
      </Text>

      {profile.infoChips && (
        <View className="mt-3">
          <InfoChipRow labels={profile.infoChips} />
        </View>
      )}

      <View className="mt-4 mb-6">
        <ActionRow
          primary={isOwner ? (following ? 'Following' : 'Follow') : profile.actionRow.primary}
          secondary={profile.actionRow.secondary}
          primaryFilled={!following}
          onPrimary={() => {
            if (profile.archetype === 'goods' || profile.archetype === 'empty' || profile.actionRow.primary === 'Follow') {
              toggleFollow(username);
            } else {
              handleDemo(profile.actionRow.primary);
            }
          }}
          onSecondary={() => {
            if (profile.actionRow.secondary === 'Message') router.push('/(tabs)/chat');
            else handleDemo(profile.actionRow.secondary);
          }}
        />
      </View>
    </View>
  );

  // ── Tab bar ──
  const tabBar = (
    <View className="flex-row border-b" style={{ borderBottomColor: colors.surfaceContainer }}>
      {profile.tabLabels.map((tab) => (
        <TouchableOpacity key={tab} className="flex-1 items-center" style={{ paddingVertical: 14 }} onPress={() => setActiveTab(tab)}>
          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, color: activeTab === tab ? colors.primaryContainer : colors.secondary }}>
            {tab}
          </Text>
          {activeTab === tab && (
            <View style={{ position: 'absolute', bottom: 0, height: 2, width: 60, backgroundColor: colors.primaryContainer, borderRadius: 1 }} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Archetype sections ──
  const renderFirstTab = () => {
    switch (profile.archetype) {
      case 'goods':
        return (
          <>
            <View className="mb-4">
              <ChipRail chips={profile.chips} active={activeChip} onSelect={setActiveChip} />
            </View>
            <View className="mb-5">
              <MarketingBanner banner={profile.banner} height={168} />
            </View>
            <View className="mb-2">
              <SectionTitle title="Top Deals" action="See all" />
            </View>
            <View className="mb-6">
              <DealsRail deals={profile.deals || []} />
            </View>
            <View className="mb-2">
              <SectionTitle title="All Products" />
            </View>
            <View className="mx-5 mb-6">
              <ProductGridSection items={gridItems} onPress={(id) => router.push(`/product/${id}`)} />
            </View>
          </>
        );
      case 'food':
        return (
          <>
            <View className="mb-2">
              <SectionTitle title="Top Deals" action="See all" />
            </View>
            <View className="mb-6">
              <DealsRail deals={profile.deals || []} />
            </View>
            <View className="mb-3">
              <ChipRail chips={profile.chips} active={activeChip} onSelect={setActiveChip} />
            </View>
            <MenuListSection items={profile.menu || []} />
          </>
        );
      case 'service':
        return (
          <>
            <View className="mb-2">
              <SectionTitle title="Trending Services" action="See all" />
            </View>
            <View className="mb-6">
              <TrendingRail items={profile.trendingServices || []} />
            </View>
            <View className="mb-3">
              <SectionTitle title="Browse Categories" />
            </View>
            <View className="mb-6">
              <ServiceCategoryGrid categories={profile.serviceCategories || []} />
            </View>
            <View className="mb-3">
              <SectionTitle title="All Services" />
            </View>
            <ServicesListSection items={profile.services || []} />
          </>
        );
      case 'job':
        return (
          <>
            <View className="mb-4">
              <ChipRail chips={profile.jobFilters || []} active={activeChip} onSelect={setActiveChip} />
            </View>
            <View className="mb-2">
              <SectionTitle title="Open Roles" action="12 open" />
            </View>
            <JobListSection jobs={profile.jobs || []} onApply={(id) => handleDemo('Apply Now')} />
          </>
        );
      case 'realestate':
        return (
          <>
            <View className="mb-4">
              <ChipRail chips={profile.listingTypes || []} active={activeChip} onSelect={setActiveChip} />
            </View>
            <ListingsListSection listings={profile.listings || []} onPress={(id) => handleDemo('Enquire')} />
          </>
        );
      case 'b2b':
        return (
          <>
            <View className="mb-4">
              <ChipRail chips={profile.categoryFilter || []} active={activeChip} onSelect={setActiveChip} />
            </View>
            <View className="mb-2">
              <SectionTitle title="Bulk Deals" action="See all" />
            </View>
            <View className="mb-6">
              <BulkDealsRail deals={profile.bulkDeals || []} />
            </View>
            <View className="mb-2">
              <SectionTitle title="Products" />
            </View>
            <BulkProductList products={profile.bulkProducts || []} onQuote={(id) => handleDemo('Get Quote')} />
          </>
        );
      default:
        return (
          <>
            <View className="mb-5">
              <EmptyStorefront isOwner={isOwner} />
            </View>
            <View className="mb-2">
              <SectionTitle title="Banner Placeholder" />
            </View>
            <View className="mx-5 h-24 rounded-figma-16 items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                Featured banner appears here
              </Text>
            </View>
          </>
        );
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'Reviews') return <ReviewsSection username={username} />;
    if (activeTab === 'About') return <AboutSection profile={profile} />;
    if (activeTab === 'Agents') {
      return (
        <View className="mx-5" style={{ gap: 12 }}>
          {['Priya Menon', 'Rohan Kapoor', 'Sneha Iyer'].map((agent, i) => (
            <View key={agent} className="flex-row items-center p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest }}>
              <View className="w-11 h-11 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
                <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 20, color: colors.primaryContainer }}>
                  {agent.split(' ').map((w) => w[0]).join('')}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }}>
                  {agent}
                </Text>
                <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }}>
                  {i === 0 ? 'Senior Consultant · 9 yrs' : i === 1 ? 'Rentals Lead · 6 yrs' : 'Commercial Specialist · 5 yrs'}
                </Text>
              </View>
              <StarIcon size={14} color={colors.primary} />
              <Text className="font-inter-600 text-textPrimary ml-1" style={{ fontSize: 13, lineHeight: 16 }}>
                {5 - i * 0.2}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    if (activeTab === 'Bulk Deals') {
      return (
        <View className="mb-6">
          <BulkDealsRail deals={profile.bulkDeals || []} />
        </View>
      );
    }
    return renderFirstTab();
  };

  const stickyLabel =
    profile.archetype === 'service' ? 'Book Appointment' : profile.archetype === 'food' ? 'Order Now' : profile.archetype === 'b2b' ? 'Get Quote' : null;

  return (
    <View className="flex-1 bg-surface">
      {/* Header — TopAppBar */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          susej
        </Text>
        <TouchableOpacity style={{ marginRight: 16 }} onPress={() => router.push(`/qr/${username}`)}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={colors.textSecondary} strokeWidth="2" />
            <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={colors.textSecondary} strokeWidth="2" />
            <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={colors.textSecondary} strokeWidth="2" />
            <Path d="M14.5 14.5h2.5v2.5h-2.5zM17.5 17.5h2v2h-2zM14.5 18.5h1v1h-1zM19 19.5h1v1h-1zM20.5 14.5h1v1h-1z" fill={colors.textSecondary} />
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMore}>
          <MoreIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (stickyLabel ? 96 : 48) }}
      >
        {/* Hero banner (food/service/job/realestate/b2b) — above profile for all except empty */}
        {profile.archetype !== 'empty' && (
          <View className="mb-5">
            <MarketingBanner banner={profile.banner} height={180} />
          </View>
        )}

        <View className="px-5">{profileHeader}</View>

        <View className="mt-2">{tabBar}</View>

        <View className="mt-5">{renderTabContent()}</View>
      </ScrollView>

      {stickyLabel && <StickyActionBar label={stickyLabel} onPress={() => handleDemo(stickyLabel)} />}
    </View>
  );
}
