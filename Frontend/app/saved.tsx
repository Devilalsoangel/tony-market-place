import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookmarkIcon, ChevronLeftIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useBookmark } from '../contexts/BookmarkContext';
import { productImages } from '../utils/productImages';
import { savedCollectionImages } from '../utils/screenImages';

type Tab = 'collections' | 'items';

interface Collection {
  id: string;
  name: string;
  count: number;
  itemIds?: string[];
}

const initialCollections: Collection[] = [
  { id: 'c1', name: 'Wishlist', count: 42, itemIds: ['post_001', 'post_002', 'post_003'] },
  { id: 'c2', name: 'Home Decor', count: 18, itemIds: ['post_003', 'post_007'] },
  { id: 'c3', name: 'Gifts for Family', count: 12, itemIds: ['post_001', 'post_005'] },
  { id: 'c4', name: 'Travel Gear', count: 9, itemIds: ['post_002'] },
  { id: 'c5', name: 'Desk Setup', count: 15, itemIds: ['post_002', 'post_006'] },
  { id: 'c6', name: 'Cozy Nights', count: 7, itemIds: ['post_003'] },
  { id: 'c7', name: 'Fitness Kit', count: 11, itemIds: ['post_005'] },
  { id: 'c8', name: 'Book Club', count: 24, itemIds: ['post_010'] },
];

export default function SavedScreen() {
  const [tab, setTab] = useState<Tab>('collections');
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [newModalVisible, setNewModalVisible] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [renameTarget, setRenameTarget] = useState<Collection | null>(null);
  const { bookmarksList, bookmarkCount } = useBookmark();
  const insets = useSafeAreaInsets();

  const openCollection = (collection: Collection) => {
    setSelectedCollectionId(collection.id);
    setActiveCollection(collection);
  };

  const closeCollection = () => {
    setActiveCollection(null);
  };

  const openNewModal = () => {
    setNewCollectionName('');
    setNewModalVisible(true);
  };

  const saveCollection = () => {
    const name = newCollectionName.trim();
    setCollections((prev) => [...prev, { id: String(Date.now()), name: name || 'My Collection', count: 0 }]);
    setNewCollectionName('');
    setNewModalVisible(false);
  };

  // Long-press a collection -> manage (rename / delete) like Instagram
  const openManageCollection = (collection: Collection) => {
    Alert.alert(collection.name, undefined, [
      {
        text: 'Rename',
        onPress: () => {
          setNewCollectionName(collection.name);
          setRenameTarget(collection);
          setNewModalVisible(true);
        },
      },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCollection(collection.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const deleteCollection = (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    if (activeCollection?.id === id) setActiveCollection(null);
  };

  const confirmSave = () => {
    if (renameTarget) {
      const name = newCollectionName.trim() || renameTarget.name;
      setCollections((prev) => prev.map((c) => (c.id === renameTarget.id ? { ...c, name } : c)));
      if (activeCollection?.id === renameTarget.id) setActiveCollection({ ...activeCollection, name });
      setRenameTarget(null);
    } else {
      saveCollection();
    }
    setNewModalVisible(false);
  };

  const activeItems = activeCollection
    ? bookmarksList.filter((b) => (activeCollection.itemIds ?? []).includes(b.productId))
    : [];

  const renderBookmarkTile = (itemId: string, index: number) => (
    <TouchableOpacity
      className="flex-1 overflow-hidden"
      style={{ aspectRatio: 1, backgroundColor: colors.surfaceContainer, borderRadius: 8 }}
      onPress={() => router.push(`/product/${itemId}`)}
    >
      <Image
        source={productImages[itemId] ?? savedCollectionImages[index % savedCollectionImages.length]}
        className="w-full h-full"
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <>
      {/* Header - back chevron + Saved title + New button */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="font-inter-700" style={{ fontSize: 20, lineHeight: 28, color: colors.textPrimary }}>
          Saved
        </Text>
        <TouchableOpacity className="bg-primaryContainer rounded-figma-8 px-4 py-2" onPress={openNewModal}>
          <Text className="font-inter-400 text-white" style={{ fontSize: 16, lineHeight: 24 }}>
            New
          </Text>
        </TouchableOpacity>
      </View>

      {/* Title Section */}
      <View className="px-5 mb-4">
        <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.8 }}>
          Saved Items
        </Text>
        <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 16, lineHeight: 24 }}>
          Organize your inspirations and{'\n'}wishlist
        </Text>
      </View>

      {/* Segmented Tab Control */}
      <View className="flex-row mx-5 mb-4 bg-surfaceContainerLow rounded-figma-12 p-1">
        <TouchableOpacity
          className={`flex-1 flex-row items-center justify-center py-2 rounded-figma-8 ${tab === 'collections' ? 'bg-white' : ''}`}
          style={{ gap: 4 }}
          onPress={() => setTab('collections')}
        >
          <Text className={`font-inter-600 ${tab === 'collections' ? 'text-primaryContainer' : 'text-textSecondary'}`} style={{ fontSize: 14, lineHeight: 16 }}>
            Collections
          </Text>
          <View className={`px-1.5 py-0.5 rounded-full ${tab === 'collections' ? 'bg-primaryContainer' : ''}`}>
            <Text className={`font-inter-700 ${tab === 'collections' ? 'text-white' : 'text-textSecondary'}`} style={{ fontSize: 10, lineHeight: 15 }}>
              {collections.length}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 flex-row items-center justify-center py-2 rounded-figma-8 ${tab === 'items' ? 'bg-white' : ''}`}
          style={{ gap: 4 }}
          onPress={() => setTab('items')}
        >
          <Text className={`font-inter-600 ${tab === 'items' ? 'text-primaryContainer' : 'text-textSecondary'}`} style={{ fontSize: 14, lineHeight: 16 }}>
            All Items
          </Text>
          <View className={`px-1.5 py-0.5 rounded-full ${tab === 'items' ? 'bg-primaryContainer' : ''}`}>
            <Text className={`font-inter-500 ${tab === 'items' ? 'text-white' : 'text-textSecondary'}`} style={{ fontSize: 10, lineHeight: 15 }}>
              {bookmarkCount}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'collections' ? (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 + insets.bottom, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8 py-16">
              <View className="w-24 h-24 rounded-full bg-surfaceContainerLow items-center justify-center mb-6">
                <BookmarkIcon size={36} color={colors.primaryContainer} />
              </View>
              <Text className="font-inter-700 text-textPrimary mb-2 text-center" style={{ fontSize: 18, lineHeight: 24 }}>
                No collections yet
              </Text>
              <Text className="font-inter-400 text-textSecondary text-center mb-6" style={{ fontSize: 14, lineHeight: 20 }}>
                Group your saved items into collections to keep inspiration organized
              </Text>
              <TouchableOpacity className="bg-primary rounded-figma-8 px-6 py-3" onPress={openNewModal}>
                <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 20 }}>
                  Create a collection
                </Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item, index }) => {
            const isSelected = selectedCollectionId === item.id;
            return (
              <TouchableOpacity
                className="flex-1 overflow-hidden mb-3 rounded-figma-16 bg-white p-4"
                style={{
                  borderColor: isSelected ? colors.primaryContainer : 'transparent',
                  borderWidth: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                }}
                activeOpacity={0.8}
                onPress={() => openCollection(item)}
                onLongPress={() => openManageCollection(item)}
              >
                <View className="w-full h-[112px] rounded-figma-8 mb-3 bg-surfaceContainer overflow-hidden">
                  <Image source={savedCollectionImages[index % savedCollectionImages.length]} className="w-full h-full" resizeMode="cover" />
                </View>
                <Text className="font-inter-600 text-textPrimary mb-0.5" style={{ fontSize: 14, lineHeight: 16 }}>
                  {item.name}
                </Text>
                <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
                  {item.count} items
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      ) : bookmarkCount === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-24 h-24 rounded-full bg-surfaceContainerLow items-center justify-center mb-6">
            <BookmarkIcon size={36} color={colors.primaryContainer} />
          </View>
          <Text className="font-inter-700 text-textPrimary mb-2 text-center" style={{ fontSize: 18, lineHeight: 24 }}>
            No saved items yet
          </Text>
          <Text className="font-inter-400 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
            Tap the bookmark icon on any product to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarksList}
          keyExtractor={(item) => item.productId}
          numColumns={3}
          columnWrapperStyle={{ gap: 4 }}
          contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 100 + insets.bottom }}
          renderItem={({ item, index }) => renderBookmarkTile(item.productId, index)}
        />
      )}
    </>
  );

  const renderCollectionDetail = () => {
    if (!activeCollection) return null;
    return (
      <>
        {/* Header - back chevron + collection title */}
        <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={closeCollection}>
            <ChevronLeftIcon size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text className="font-inter-700 flex-1 text-center mr-8" style={{ fontSize: 20, lineHeight: 28, color: colors.textPrimary }} numberOfLines={1}>
            {activeCollection.name}
          </Text>
          <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 13, lineHeight: 16 }}>
            {activeItems.length} saved
          </Text>
        </View>

        {/* Detail content */}
        <FlatList
          data={activeItems}
          keyExtractor={(item) => item.productId}
          numColumns={3}
          columnWrapperStyle={{ gap: 4 }}
          contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 100 + insets.bottom, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8">
              <View className="w-24 h-24 rounded-full bg-surfaceContainerLow items-center justify-center mb-6">
                <BookmarkIcon size={36} color={colors.primaryContainer} />
              </View>
              <Text className="font-inter-700 text-textPrimary mb-2 text-center" style={{ fontSize: 18, lineHeight: 24 }}>
                No items in this collection yet
              </Text>
              <Text className="font-inter-400 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
                Browse the feed and bookmark products to fill this collection
              </Text>
            </View>
          }
          renderItem={({ item, index }) => renderBookmarkTile(item.productId, index)}
        />
      </>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {activeCollection ? renderCollectionDetail() : renderHeader()}

      {/* New / Rename Collection Modal */}
      <Modal visible={newModalVisible} transparent animationType="fade" onRequestClose={() => setNewModalVisible(false)}>
        <View className="flex-1 justify-center px-8" style={{ paddingHorizontal: 32 }}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.inverseSurface, opacity: 0.55 }}
            onPress={() => { setNewModalVisible(false); setRenameTarget(null); }}
          />
          <View className="rounded-figma-24 p-5" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 }}>
            <Text className="font-inter-700 text-textPrimary mb-4" style={{ fontSize: 20, lineHeight: 26 }}>
              {renameTarget ? 'Rename Collection' : 'New Collection'}
            </Text>
            <TextInput
              className="font-inter-400"
              style={{ backgroundColor: colors.inputBg, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, lineHeight: 24, color: colors.textPrimary }}
              placeholder="Collection name"
              placeholderTextColor={colors.placeholder}
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmSave}
            />
            <View className="flex-row mt-4" style={{ gap: 12 }}>
              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-figma-8 py-3"
                style={{ backgroundColor: colors.surfaceContainerLow }}
                onPress={() => { setNewModalVisible(false); setRenameTarget(null); }}
              >
                <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-figma-8 py-3"
                style={{ backgroundColor: colors.primaryContainer }}
                onPress={confirmSave}
              >
                <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 24, color: colors.onPrimary }}>
                  {renameTarget ? 'Rename' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}