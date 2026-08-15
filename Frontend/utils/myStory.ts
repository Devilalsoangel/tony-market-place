// myStory.ts — the user's OWN uploaded story (create-story -> feed/profile/viewer).
// Saved as JSON under @susej_my_story; feed + profile + story viewer all read it so an
// uploaded story is actually VISIBLE (ring + image + caption) instead of vanishing.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const MY_STORY_KEY = '@susej_my_story';

export interface MyStory {
  image: string; // uri of the story media
  caption: string;
  time: number; // epoch ms when posted
}

export const loadMyStory = async (): Promise<MyStory | null> => {
  try {
    const raw = await AsyncStorage.getItem(MY_STORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MyStory;
    if (!parsed || typeof parsed.image !== 'string' || !parsed.image) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveMyStory = async (story: MyStory): Promise<void> => {
  await AsyncStorage.setItem(MY_STORY_KEY, JSON.stringify(story));
};

/** Time ago label for the viewer header, e.g. "Just now", "2h" */
export const storyAge = (time: number): string => {
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};
