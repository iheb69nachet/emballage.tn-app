import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../services/api';

const TOKEN_KEY = '@auth_token';
const USER_KEY = '@auth_user';
const ONBOARDING_KEY = '@onboarding_seen';

export const useAuthStore = create((set) => ({
  token: null,
  user: null,
  hydrated: false,
  hasSeenOnboarding: false,

  hydrate: async () => {
    try {
      const [token, userJson, onboardingSeen] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(ONBOARDING_KEY),
      ]);
      if (token) {
        api.setAuthToken(token);
        set({ token, user: userJson ? JSON.parse(userJson) : null });
      }
      set({ hasSeenOnboarding: !!onboardingSeen });
    } catch (_) {}
    set({ hydrated: true });
  },

  markOnboardingSeen: async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    set({ hasSeenOnboarding: true });
  },

  login: async (email, password) => {
    const { accessToken, user } = await api.auth.login(email, password);
    api.setAuthToken(accessToken);
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token: accessToken, user });
    return user;
  },

  loginWithToken: async (accessToken, user) => {
    api.setAuthToken(accessToken);
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token: accessToken, user });
  },

  updateUser: async (data) => {
    const updated = await api.users.updateProfile(data);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
    set({ user: updated });
    return updated;
  },

  logout: async () => {
    api.clearAuthToken();
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
}));
