import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../services/api';

const TOKEN_KEY = '@auth_token';
const USER_KEY = '@auth_user';
const ONBOARDING_KEY = '@onboarding_seen';

/**
 * Login returns role names (['admin']) but PATCH /users/me returns role
 * entities ([{ id, name, … }]). The app checks `roles.includes('admin')`, so
 * keep names only — otherwise an admin who edits their profile falls back to
 * the client screens.
 */
const normalizeUser = (user) =>
  user ? { ...user, roles: (user.roles || []).map(r => (typeof r === 'string' ? r : r?.name)).filter(Boolean) } : user;

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
        // Also repairs a user stored by an older version with role entities
        set({ token, user: userJson ? normalizeUser(JSON.parse(userJson)) : null });
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
    const { accessToken, user: raw } = await api.auth.login(email, password);
    const user = normalizeUser(raw);
    api.setAuthToken(accessToken);
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token: accessToken, user });
    return user;
  },

  loginWithToken: async (accessToken, raw) => {
    const user = normalizeUser(raw);
    api.setAuthToken(accessToken);
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token: accessToken, user });
  },

  updateUser: async (data) => {
    const updated = normalizeUser(await api.users.updateProfile(data));
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

// An expired or revoked session (401 on an authenticated call) signs the user
// out, so the app shows its signed-out state instead of failing every request.
api.setUnauthorizedHandler(() => useAuthStore.getState().logout());
