import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionStorage } from '../utils/sessionStorage';

const ONBOARDED_KEY = '@susej_has_onboarded';
const FEED_WELCOME_KEY = '@susej_feed_welcome_seen';
const ONBOARDING_STEP_KEY = '@susej_onboarding_step';

export interface User {
  name: string;
  username: string;
  phone?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  interests?: string[];
  role?: 'buyer' | 'seller' | 'both';
  isSeller?: boolean;
  businessName?: string;
  category?: string;
  verification?: 'none' | 'pending' | 'approved' | 'rejected';
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  hasOnboarded: boolean;
  hasSeenFeedWelcome: boolean;
  onboardingStep: number;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  setOnboardingStep: (step: number) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setHasSeenFeedWelcome: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [hasSeenFeedWelcome, setHasSeenFeedWelcomeState] = useState(false);
  const [onboardingStep, setOnboardingStepState] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const storedUser = await sessionStorage.getUser();
        const session = await sessionStorage.getSession();
        if (storedUser && session) {
          setUser(storedUser);
          setIsLoggedIn(true);
        }
      } catch {
      }
      const [onboarded, welcome, step] = await Promise.all([
        AsyncStorage.getItem(ONBOARDED_KEY),
        AsyncStorage.getItem(FEED_WELCOME_KEY),
        AsyncStorage.getItem(ONBOARDING_STEP_KEY),
      ]);
      setHasOnboarded(onboarded === 'true');
      setHasSeenFeedWelcomeState(welcome === 'true');
      const parsedStep = step ? parseInt(step, 10) : 1;
      setOnboardingStepState(Number.isNaN(parsedStep) ? 1 : parsedStep);
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (nextUser: User) => {
    setUser(nextUser);
    setIsLoggedIn(true);
    await sessionStorage.saveUser(nextUser);
    await sessionStorage.saveSession(
      { accessToken: 'mock-token', refreshToken: 'mock-refresh' },
      1
    );
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setIsLoggedIn(false);
    setHasOnboarded(false);
    await sessionStorage.clearSession();
    await AsyncStorage.removeItem(ONBOARDED_KEY);
  }, []);

  const setOnboardingStep = useCallback(async (step: number) => {
    setOnboardingStepState(step);
    await AsyncStorage.setItem(ONBOARDING_STEP_KEY, String(step));
  }, []);

  const completeOnboarding = useCallback(async () => {
    setHasOnboarded(true);
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
  }, []);

  const setHasSeenFeedWelcome = useCallback(async () => {
    setHasSeenFeedWelcomeState(true);
    await AsyncStorage.setItem(FEED_WELCOME_KEY, 'true');
  }, []);

  const updateUser = useCallback(
    async (patch: Partial<User>) => {
      setUser((prev) => {
        const next = { ...(prev ?? ({} as User)), ...patch };
        sessionStorage.saveUser(next);
        return next;
      });
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        isLoading,
        hasOnboarded,
        hasSeenFeedWelcome,
        onboardingStep,
        login,
        logout,
        setOnboardingStep,
        completeOnboarding,
        setHasSeenFeedWelcome,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
