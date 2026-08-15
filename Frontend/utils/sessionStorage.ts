/**
 * Secure session persistence using AsyncStorage
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKENS_KEY = 'app_tokens';
const USER_KEY = 'app_user';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  userId: number;
  expiresAt: number;
}

export const sessionStorage = {
  async saveSession(tokens: {accessToken: string; refreshToken: string}, userId: number): Promise<void> {
    try {
      const session: StoredSession = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userId,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };
      await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  },

  async getSession(): Promise<StoredSession | null> {
    try {
      const data = await AsyncStorage.getItem(TOKENS_KEY);
      if (!data) return null;
      const session = JSON.parse(data) as StoredSession;
      // Check expiration
      if (session.expiresAt < Date.now()) {
        await sessionStorage.clearSession();
        return null;
      }
      return session;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  },

  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([TOKENS_KEY, USER_KEY]);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  },

  async saveUser(user: any): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  },

  async getUser(): Promise<any> {
    try {
      const data = await AsyncStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  },
};
