import { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon, SendIcon, PlusIcon, MinusIcon, CloseIcon } from '../../utils/icons';
import { colors, formatCount } from '../../utils/theme';
import { useCommunities } from '../../contexts/CommunityContext';
import type { CommunityMessage } from '../../contexts/CommunityContext';
import { communityChatAvatars } from '../../utils/screenImages';

export interface PollMessage {
  id: string;
  communityId: string;
  author: string;
  authorUsername: string;
  kind: 'poll';
  question: string;
  options: string[];
  votes: number[];
  votedOption: number | null;
  createdAt: number;
}

type ChatItem = CommunityMessage | PollMessage;

function PeopleIcon({ size = 14, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="4" stroke={color} strokeWidth="2" />
      <Path d="M2.5 20v-1.5a6.5 6.5 0 0113 0V20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="17" cy="9.5" r="3" stroke={color} strokeWidth="2" />
      <Path d="M16.5 20v-1.5a5.5 5.5 0 013-4.9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function BarChartIcon({ size = 20, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21V11" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M10 21V4" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M16 21v-7" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M22 21H2" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

const LIVE_POOL: { author: string; authorUsername: string; text: string }[] = [
  { author: 'Ananya', authorUsername: 'ananya', text: 'Anyone tried the new saree collection?' },
  { author: 'Vikram', authorUsername: 'vikram', text: 'I posted pics in the group' },
  { author: 'Kavya', authorUsername: 'kavya', text: 'Shipping was fast for me' },
  { author: 'Sameer', authorUsername: 'sameer', text: 'Is the 30% off still live?' },
  { author: 'Neha', authorUsername: 'neha', text: 'The handloom pieces are selling out fast' },
  { author: 'Arjun', authorUsername: 'arjun', text: 'Just picked up the summer drop' },
  { author: 'Ritu', authorUsername: 'ritu', text: 'Anyone selling iPhone covers? Need two for delivery' },
  { author: 'Imran', authorUsername: 'imran', text: 'Do sellers give GST invoice on bulk orders?' },
  { author: 'Priya', authorUsername: 'priya', text: 'The verified badge makes such a difference, zero spam sellers now' },
  { author: 'Dev', authorUsername: 'dev', text: 'My order came in two days, Delhi to Mumbai. Impressive' },
  { author: 'Shreya', authorUsername: 'shreya', text: 'Set up my new kitchen with Local Foodies sellers, all at great prices' },
  { author: 'Karan', authorUsername: 'karan', text: 'Negotiated 15% off in chat, sellers here are really responsive' },
  { author: 'Muskaan', authorUsername: 'muskaan', text: 'Looking for a Kanjeevaram saree seller, any suggestions?' },
  { author: 'Rohan', authorUsername: 'rohan', text: 'Just listed my old gaming console, open to offers' },
];

export default function CommunityChatScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const communityId = Array.isArray(id) ? id[0] : id ?? '';
  const { communities, messagesFor, sendMessage, join, leave } = useCommunities();
  const [text, setText] = useState('');

  const community = communities.find((c) => c.id === communityId);
  const messages = messagesFor(communityId);
  const listRef = useRef<FlatList<ChatItem>>(null);
  const [liveMessages, setLiveMessages] = useState<CommunityMessage[]>([]);
  const [typingAuthor, setTypingAuthor] = useState<string | null>(null);
  const [pollMessages, setPollMessages] = useState<PollMessage[]>([]);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const liveId = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentPicks = useRef<string[]>([]);
  const joinPromptShown = useRef(false);
  const contextLenRef = useRef(messages.length);

  useEffect(() => {
    contextLenRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (!communityId || !community?.joined) return;
    const pickSeed = () => {
      let seed = LIVE_POOL[Math.floor(Math.random() * LIVE_POOL.length)];
      let guard = 0;
      while (recentPicks.current.includes(seed.authorUsername) && guard < LIVE_POOL.length) {
        seed = LIVE_POOL[Math.floor(Math.random() * LIVE_POOL.length)];
        guard += 1;
      }
      recentPicks.current = [...recentPicks.current.slice(-9), seed.authorUsername];
      return seed;
    };
    const appendLive = () => {
      const seed = pickSeed();
      setTypingAuthor(seed.author);
      typingTimeout.current = setTimeout(() => {
        liveId.current += 1;
        const msg: CommunityMessage = {
          id: `live_${Date.now()}_${liveId.current}`,
          communityId,
          author: seed.author,
          authorUsername: seed.authorUsername,
          text: seed.text,
          createdAt: Date.now(),
        };
        setTypingAuthor(null);
        setLiveMessages((prev) => {
          const next = [...prev, msg];
          const drop = Math.max(0, next.length + contextLenRef.current - 40);
          return drop > 0 ? next.slice(drop) : next;
        });
      }, 1000);
    };
    const interval = setInterval(appendLive, 8000);
    return () => {
      clearInterval(interval);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [communityId, communities, community?.joined]);

  const data: ChatItem[] = [...messages, ...liveMessages, ...pollMessages].sort(
    (a, b) => a.createdAt - b.createdAt
  );

  const handleSend = () => {
    if (!text.trim()) return;
    if (!community?.joined) {
      if (!joinPromptShown.current) {
        joinPromptShown.current = true;
        Alert.alert('Join the community to post', 'Tap Join in the header, then send your message.');
      }
      return;
    }
    sendMessage(communityId, text);
    setText('');
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const removePollOption = (index: number) => {
    setPollOptions((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  };

  const sendPoll = () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question || options.length < 2) return;
    const seeded = options.length === 2 ? [5, 4] : options.length === 3 ? [5, 3, 2] : [5, 3, 2, 2];
    const poll: PollMessage = {
      id: `poll_${Date.now()}`,
      communityId,
      author: 'You',
      authorUsername: 'you',
      kind: 'poll',
      question,
      options,
      votes: seeded,
      votedOption: null,
      createdAt: Date.now(),
    };
    setPollMessages((prev) => [...prev, poll]);
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollBuilder(false);
  };

  const cancelPoll = () => {
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollBuilder(false);
  };

  const handleVote = (pollId: string, optionIndex: number) => {
    setPollMessages((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p;
        if (p.votedOption === optionIndex) return p;
        const votes = [...p.votes];
        if (p.votedOption !== null) votes[p.votedOption] = Math.max(0, votes[p.votedOption] - 1);
        votes[optionIndex] += 1;
        return { ...p, votes, votedOption: optionIndex };
      })
    );
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center h-[66px] px-5" style={{ backgroundColor: colors.surface, height: 66 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 20, lineHeight: 28 }}>
            {community?.name ?? 'Community'}
          </Text>
          <View className="flex-row items-center justify-center">
            <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
              {community ? `${formatCount(community.memberCount)} members` : 'Join the conversation'}
            </Text>
            <View
              className="flex-row items-center ml-2 px-2 py-0.5 rounded-figma-full"
              style={{ backgroundColor: colors.errorContainer }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.error }} />
              <Text
                className="font-inter-600"
                style={{ fontSize: 10, lineHeight: 12, color: colors.error, marginLeft: 4 }}
              >
                Live
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          className={`px-3 py-1.5 rounded-figma-full ${community?.joined ? 'bg-surfaceContainerLow' : 'bg-primaryContainer'}`}
          onPress={() => (community?.joined ? leave(communityId) : join(communityId))}
        >
          <Text
            className={`font-inter-600 ${community?.joined ? 'text-secondary' : 'text-white'}`}
            style={{ fontSize: 12, lineHeight: 16 }}
          >
            {community?.joined ? 'Leave' : 'Join'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Members pill */}
      <TouchableOpacity
        className="self-center flex-row items-center mb-2 px-4 py-1.5 rounded-figma-full"
        style={{ backgroundColor: colors.surfaceContainerLow }}
        onPress={() => router.push(`/community-members/${communityId}`)}
      >
        <PeopleIcon size={14} color={colors.textSecondary} />
        <Text className="font-inter-600 mx-1.5 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
          Members {formatCount(community?.memberCount ?? 248)}
        </Text>
        <ChevronRightIcon size={8} color={colors.textSecondary} />
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pb-32 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + (showPollBuilder ? 340 : 128) }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View className="flex-row items-center mb-4 mt-2">
            <View className="flex-1 h-px bg-outlineVariant" />
            <Text className="font-inter-500 text-textSecondary mx-3" style={{ fontSize: 12, lineHeight: 14 }}>
              Today
            </Text>
            <View className="flex-1 h-px bg-outlineVariant" />
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center pt-16 px-8">
            <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
              No messages yet. Be the first to start the conversation.
            </Text>
          </View>
        }
        ListFooterComponent={
          typingAuthor ? (
            <View className="flex-row items-center mb-5">
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                {typingAuthor} is typing…
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          if ('kind' in item) {
            const p = item;
            const total = p.votes.reduce((a, b) => a + b, 0);
            const isSelf = p.author === 'You';
            return (
              <View className={`mb-5 ${isSelf ? 'items-end' : 'items-start'}`}>
                <View className={`flex-row items-center mb-1 ${isSelf ? 'justify-end' : ''}`}>
                  <Text className={`font-inter-600 ${isSelf ? 'text-primaryContainer' : 'text-textPrimary'}`} style={{ fontSize: 14, lineHeight: 16 }}>
                    {p.author}
                  </Text>
                  <Text className="font-inter-500 text-textSecondary ml-2" style={{ fontSize: 12, lineHeight: 14 }}>
                    {formatTime(p.createdAt)}
                  </Text>
                </View>
                <View
                  className="rounded-figma-16 px-4 py-3"
                  style={{ backgroundColor: colors.surfaceContainerLow, width: '90%' }}
                >
                  <View className="flex-row items-center mb-2">
                    <View className="px-2 py-0.5 rounded-figma-full mr-2" style={{ backgroundColor: colors.surfaceContainer }}>
                      <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 12, color: colors.tertiary }}>
                        Poll
                      </Text>
                    </View>
                    <Text className="flex-1 font-inter-700 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                      {p.question}
                    </Text>
                  </View>
                  {p.options.map((opt, i) => {
                    const pct = total > 0 ? Math.round((p.votes[i] / total) * 100) : 0;
                    const voted = p.votedOption === i;
                    return (
                      <TouchableOpacity
                        key={`${p.id}_${i}`}
                        className="mb-2"
                        style={{
                          borderRadius: 12,
                          overflow: 'hidden',
                          backgroundColor: voted ? colors.primaryContainer : colors.surfaceContainer,
                        }}
                        onPress={() => handleVote(p.id, i)}
                      >
                        <View
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: `${pct}%`,
                            backgroundColor: colors.primaryContainer,
                            opacity: 0.18,
                          }}
                        />
                        <View className="flex-row items-center justify-between px-3" style={{ height: 40 }}>
                          <Text
                            className={`flex-1 font-inter-600 pr-2 ${voted ? 'text-white' : 'text-textPrimary'}`}
                            numberOfLines={1}
                            style={{ fontSize: 14, lineHeight: 20 }}
                          >
                            {opt}
                            {voted ? '  ·  You' : ''}
                          </Text>
                          <Text
                            className={`font-inter-600 ${voted ? 'text-white' : 'text-textSecondary'}`}
                            style={{ fontSize: 12, lineHeight: 16 }}
                          >
                            {pct}%
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <Text className="font-inter-500 text-textSecondary mt-1" style={{ fontSize: 12, lineHeight: 14 }}>
                    Votes {total}
                  </Text>
                </View>
              </View>
            );
          }
          const isSelf = item.author === 'You';
          const isLive = item.id.startsWith('live_');
          return (
            <View className={`mb-5 ${isSelf ? 'items-end' : ''}`}>
              {/* User name + time */}
              <View className={`flex-row items-center ${isSelf ? 'justify-end' : ''} mb-1`}>
                {!isSelf ? (
                  <Image source={communityChatAvatars[index % communityChatAvatars.length]} className="w-9 h-9 rounded-full mr-2" style={{ backgroundColor: colors.surfaceContainer }} />
                ) : null}
                <Text className={`font-inter-600 ${isSelf ? 'text-primaryContainer' : 'text-textPrimary'}`} style={{ fontSize: 14, lineHeight: 16 }}>
                  {item.author}
                </Text>
                <Text className="font-inter-500 text-textSecondary ml-2" style={{ fontSize: 12, lineHeight: 14 }}>
                  {isLive ? 'Just now' : formatTime(item.createdAt)}
                </Text>
              </View>

              {/* Message bubble — Figma: content-width white cards, soft shadow; outgoing purple */}
              <View
                className={`max-w-[78%] rounded-figma-16 px-4 py-3`}
                style={
                  isSelf
                    ? { backgroundColor: colors.primaryContainer }
                    : {
                        backgroundColor: colors.surfaceContainerLowest,
                        shadowColor: '#1a1a2e',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 8,
                        elevation: 1,
                      }
                }
              >
                <Text
                  className={`${isSelf ? 'text-white' : 'text-textPrimary'} font-inter-400`}
                  style={{ fontSize: 16, lineHeight: 24 }}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input Bar */}
      <View
        className="absolute bottom-0 left-0 right-0"
        style={{
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceContainer,
          paddingBottom: insets.bottom + 12,
          paddingTop: showPollBuilder ? 12 : 0,
        }}
      >
        {showPollBuilder ? (
          <View className="px-4 mb-3">
            <View className="rounded-figma-16 p-4" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <View className="flex-row items-center mb-3">
                <Text className="flex-1 font-inter-700 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }}>
                  Create a poll
                </Text>
                <TouchableOpacity onPress={cancelPoll}>
                  <CloseIcon size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View className="h-10 bg-surfaceContainer rounded-figma-12 px-3 mb-3 justify-center">
                <TextInput
                  className="font-inter-400 text-textPrimary"
                  style={{ fontSize: 14, lineHeight: 18 }}
                  placeholder="Ask a question"
                  placeholderTextColor={colors.textSecondary}
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                />
              </View>
              {pollOptions.map((opt, i) => (
                <View className="flex-row items-center mb-2" key={i} style={{ gap: 8 }}>
                  <View className="flex-1 h-10 bg-surfaceContainer rounded-figma-12 px-3 justify-center">
                    <TextInput
                      className="font-inter-400 text-textPrimary"
                      style={{ fontSize: 14, lineHeight: 18 }}
                      placeholder={`Option ${i + 1}`}
                      placeholderTextColor={colors.textSecondary}
                      value={opt}
                      onChangeText={(t) => updatePollOption(i, t)}
                    />
                  </View>
                  {pollOptions.length > 2 ? (
                    <TouchableOpacity
                      className="w-8 h-8 rounded-figma-full items-center justify-center"
                      style={{ backgroundColor: colors.surfaceContainer }}
                      onPress={() => removePollOption(i)}
                    >
                      <MinusIcon size={10} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {pollOptions.length < 4 ? (
                <TouchableOpacity
                  className="flex-row items-center mt-1"
                  onPress={() => setPollOptions((prev) => [...prev, ''])}
                >
                  <PlusIcon size={11} color={colors.primaryContainer} />
                  <Text className="font-inter-600 ml-1.5" style={{ fontSize: 13, lineHeight: 16, color: colors.primaryContainer }}>
                    Add option
                  </Text>
                </TouchableOpacity>
              ) : null}
              <View className="flex-row mt-3" style={{ gap: 8 }}>
                <TouchableOpacity
                  className="flex-1 h-10 items-center justify-center rounded-figma-12"
                  style={{ backgroundColor: colors.surfaceContainer }}
                  onPress={cancelPoll}
                >
                  <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.textSecondary }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 h-10 items-center justify-center rounded-figma-12"
                  style={{ backgroundColor: colors.primaryContainer }}
                  onPress={sendPoll}
                >
                  <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.onPrimary }}>
                    Send poll
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            className="w-11 h-11 mr-3 rounded-figma-16 items-center justify-center"
            style={{ backgroundColor: showPollBuilder ? colors.surfaceContainer : colors.surfaceContainerLow }}
            onPress={() => setShowPollBuilder((v) => !v)}
          >
            <BarChartIcon size={20} color={colors.primaryContainer} />
          </TouchableOpacity>
          <View className="flex-1 h-11 bg-surfaceContainerLow rounded-figma-16 px-4 justify-center mr-3">
            <TextInput
              className="font-inter-400 text-textPrimary"
              style={{ fontSize: 16, lineHeight: 24 }}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSecondary}
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleSend}
            />
          </View>
          <TouchableOpacity className="w-11 h-11 bg-primaryContainer rounded-figma-full items-center justify-center" onPress={handleSend}>
            <SendIcon size={18} color={colors.surfaceContainerLowest} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
