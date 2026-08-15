// storyTray.ts — industry-style story tray (IG pattern): 8 seller stories shared by
// Feed (row) and Story Viewer (per-user slides + tray navigation).
// Avatars are REAL Figma assets — no picsum fallbacks needed.

export type StoryUser = {
  id: string;
  name: string; // display label under the ring
  route: string; // seller username the story links to (also /story/<route>)
  avatar: any; // require()'d Figma image
};

export const STORY_TRAY: StoryUser[] = [
  { id: '1', name: 'Aarav', route: 'elara_mod', avatar: require('../assets/images/screens/feed/img-223-48.png') },
  { id: '2', name: 'Priya', route: 'arc_design', avatar: require('../assets/images/screens/feed/img-223-53.png') },
  { id: '3', name: 'Neha', route: 'lux_gems', avatar: require('../assets/images/screens/feed/img-223-58.png') },
  { id: '4', name: 'Rohan', route: 'hype_vault', avatar: require('../assets/images/screens/feed/img-223-63.png') },
  { id: '5', name: 'Vintage Loft', route: 'vintage_loft', avatar: require('../assets/images/img-1-3626.png') },
  { id: '6', name: 'TechNova', route: 'technova_labs', avatar: require('../assets/images/screens/feed/img-223-192.png') },
  { id: '7', name: 'FluentFirst', route: 'fluentfirst', avatar: require('../assets/images/screens/feed/img-223-135.png') },
  { id: '8', name: 'Urban Kicks', route: 'urban_kicks', avatar: require('../assets/images/screens/feed/img-223-148.png') },
];

/** Per-user slide captions (story viewer shows 3 slides per user, IG-style) */
export const storySlides = (user: StoryUser): string[] => [
  `Fresh drop from ${user.name} — check this out.`,
  `Backstage look at what ${user.name} is making.`,
  'Tap below to see everything we sell.',
];

export const storyById = (id: string): StoryUser | undefined => STORY_TRAY.find((s) => String(s.id) === id);

export const storyByRoute = (route: string): StoryUser | undefined => STORY_TRAY.find((s) => s.route === route);

export const storyAvatarByRoute = (route: string): any | undefined => {
  const u = storyByRoute(route);
  return u ? u.avatar : undefined;
};

/** Serialize the whole tray into a deep-link param for the viewer (IG-style tray navigation) */
export const trayParam = (): string => STORY_TRAY.map((s) => s.id).join(',');
