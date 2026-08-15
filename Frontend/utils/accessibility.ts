/**
 * Accessibility utilities for React Native
 * Provides helper functions to ensure WCAG AA compliance
 */

/**
 * Standard accessibility labels for common actions
 */
export const a11yLabels = {
  // Navigation
  feedTab: 'Feed, double tap to view social feed',
  chatTab: 'Chat, double tap to send messages',
  storiesTab: 'Stories, double tap to view stories',
  profileTab: 'Profile, double tap to view your profile',
  stocksTab: 'Market, double tap to view and trade stocks',
  forexTab: 'Forex, double tap to trade currency pairs',
  
  // Actions
  likePost: 'Like post',
  commentPost: 'Reply to post',
  sharePost: 'Share post',
  buyStock: 'Buy shares',
  sellStock: 'Sell shares',
  addToWatchlist: 'Add to watchlist',
  removeFromWatchlist: 'Remove from watchlist',
  
  // Auth
  login: 'Log in to your account',
  signup: 'Create a new account',
  logout: 'Log out',
  forgotPassword: 'Reset your password',
  
  // Controls
  toggleTheme: 'Toggle between light and dark mode',
  toggleWatchlist: 'Filter by watchlist',
  toggleMiniApps: 'Open mini applications',
  
  // Inputs
  emailInput: 'Email address input',
  passwordInput: 'Password input, content hidden',
  searchInput: 'Search input',
  messageInput: 'Message input field',
  quantityInput: 'Number of shares to trade',
  priceInput: 'Price per share',
};

/**
 * Generates accessible component props for interactive elements
 */
export function getA11yProps(elementType: string, label?: string) {
  const baseProps: any = {
    accessible: true,
    accessibilityRole: elementType === 'button' ? 'button' : elementType === 'link' ? 'link' : 'none',
  };

  if (label) {
    baseProps.accessibilityLabel = label;
  }

  return baseProps;
}

/**
 * Color contrast helper for WCAG AA compliance
 * Returns true if contrast ratio is acceptable
 */
export function meetsWCAGAAContrast(
  foreground: string,
  background: string
): boolean {
  const colorToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  const fgRgb = colorToRgb(foreground);
  const bgRgb = colorToRgb(background);

  if (!fgRgb || !bgRgb) return false;

  const getLuminance = (rgb: {r: number; g: number; b: number}) => {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const fgLum = getLuminance(fgRgb);
  const bgLum = getLuminance(bgRgb);

  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);

  const contrast = (lighter + 0.05) / (darker + 0.05);

  // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
  return contrast >= 4.5;
}

/**
 * Validates text/background color combinations for accessibility
 */
export function validateColorContrast(
  foreground: string,
  background: string,
  componentType: 'text' | 'button' | 'link' = 'text'
): {meetsAA: boolean; ratio: number} {
  const minRatio = componentType === 'button' ? 4.5 : 4.5;
  // Calculate contrast ratio (simplified)
  return {
    meetsAA: meetsWCAGAAContrast(foreground, background),
    ratio: 0, // Would calculate actual ratio
  };
}

/**
 * Common a11y patterns for navigation
 */
export const navigationA11yProps = {
  accessible: true,
  accessibilityRole: 'tab',
  accessibilityLiveRegion: 'polite' as const,
};

/**
 * Common a11y patterns for buttons
 */
export function createButtonA11yProps(label: string, hint?: string) {
  return {
    accessible: true,
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityLiveRegion: 'polite' as const,
  };
}

/**
 * Common a11y patterns for form inputs
 */
export function createInputA11yProps(label: string, required?: boolean) {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: required ? 'Required field' : 'Optional field',
    accessibilityRole: 'textbox' as const,
  };
}

/**
 * Semantic heading levels for screen readers
 */
export const headingRoles = {
  h1: { accessibilityRole: 'header' as const, accessibilityLabel: 'Main heading' },
  h2: { accessibilityRole: 'header' as const, accessibilityLabel: 'Section heading' },
  h3: { accessibilityRole: 'header' as const, accessibilityLabel: 'Subsection heading' },
};

/**
 * Announcement helpers for screen readers
 */
export function createAnnouncementProps(message: string, priority = 'polite') {
  const liveRegion: 'polite' | 'assertive' = priority === 'assertive' ? 'assertive' : 'polite';
  return {
    accessible: true,
    accessibilityLiveRegion: liveRegion,
    accessibilityLabel: message,
  };
}
