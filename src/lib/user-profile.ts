import {
  getActiveApiKeys,
  getInitialInterestedIds,
  getInitialWatchedIds,
  FirestoreSyncTelemetry,
} from './api';
import {
  GraphScopeMode,
  GravityPreset,
  MediaItem,
  RegionCode,
  UserAuthMode,
  UserProfile,
} from './types';

const STORAGE_USER_PROFILES_KEY = 'sixdegrees_user_profiles_v1';
const STORAGE_ACTIVE_USER_ID_KEY = 'sixdegrees_active_user_id_v1';
const STORAGE_USER_AUTH_TOKENS_KEY = 'sixdegrees_user_auth_tokens_v1';

export const ARCHIVAL_AVATAR_COLORS = [
  { label: 'Archival Crimson', hex: '#B8292F' },
  { label: 'Ultramarine Film', hex: '#234B6E' },
  { label: 'Verdigris Theme', hex: '#2A6B53' },
  { label: 'Broadcast Plum', hex: '#6B3A6E' },
  { label: 'Ochre Gold', hex: '#B86B14' },
  { label: 'Terracotta Score', hex: '#A63A2B' },
] as const;

export function normalizeUserHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

/**
 * Extracts snapshots of any MediaItems that the user has in a list
 * (Watched or Interested), so their personal graph always retains full metadata for titles.
 */
export function extractCustomMediaItems(
  itemIds: string[],
  allMediaItems: MediaItem[]
): MediaItem[] {
  const idSet = new Set(itemIds);
  const custom: MediaItem[] = [];
  for (const item of allMediaItems) {
    if (idSet.has(item.id)) {
      custom.push(item);
    }
  }
  return custom.slice(0, 150);
}

export const extractWatchedCustomItems = extractCustomMediaItems;

export function getSavedAuthTokens(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_USER_AUTH_TOKENS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function saveAuthTokenForHandle(handle: string, token?: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    const clean = normalizeUserHandle(handle);
    const current = getSavedAuthTokens();
    current[clean] = token;
    localStorage.setItem(STORAGE_USER_AUTH_TOKENS_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage error
  }
}

export function getSavedUserProfiles(): UserProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_USER_PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is UserProfile =>
          Boolean(
            p && typeof p.id === 'string' && typeof p.handle === 'string'
          )
      )
      .map((p) => ({
        ...p,
        defaultGraphScope:
          p.defaultGraphScope === 'WATCHED_ONLY' || !p.defaultGraphScope
            ? 'FULL_ARCHIVE'
            : p.defaultGraphScope,
        watchedIds: Array.isArray(p.watchedIds) ? p.watchedIds : [],
        watchedCustomItems: Array.isArray(p.watchedCustomItems)
          ? p.watchedCustomItems
          : [],
        interestedIds: Array.isArray(p.interestedIds) ? p.interestedIds : [],
        interestedCustomItems: Array.isArray(p.interestedCustomItems)
          ? p.interestedCustomItems
          : [],
      }));
  } catch {
    return [];
  }
}

export function saveUserProfilesToStorage(profiles: UserProfile[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_USER_PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // Ignore storage quota errors
  }
}

export function getActiveUserIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(STORAGE_ACTIVE_USER_ID_KEY);
  if (!val || val === 'GUEST') return null;
  return val;
}

export function setActiveUserIdInStorage(userId: string | null): void {
  if (typeof window === 'undefined') return;
  if (!userId) {
    localStorage.setItem(STORAGE_ACTIVE_USER_ID_KEY, 'GUEST');
  } else {
    localStorage.setItem(STORAGE_ACTIVE_USER_ID_KEY, userId);
  }
}

export function getInitialActiveUserProfile(): UserProfile | null {
  const profiles = getSavedUserProfiles();
  const activeId = getActiveUserIdFromStorage();
  if (!activeId) return null;
  return (
    profiles.find((p) => p.id === activeId || p.handle === activeId) || null
  );
}

function mergeCustomItems(
  activeIds: string[],
  existingCustom: MediaItem[] | undefined,
  allMediaItems: MediaItem[] | undefined
): MediaItem[] {
  const extracted = allMediaItems
    ? extractCustomMediaItems(activeIds, allMediaItems)
    : existingCustom || [];

  const mergedMap = new Map<string, MediaItem>();
  for (const prevItem of existingCustom || []) {
    if (activeIds.includes(prevItem.id)) {
      mergedMap.set(prevItem.id, prevItem);
    }
  }
  for (const item of extracted) {
    mergedMap.set(item.id, item);
  }
  return Array.from(mergedMap.values()).slice(0, 150);
}

export function createOrUpdateUserProfile(input: {
  handle: string;
  displayName: string;
  email?: string;
  bio?: string;
  avatarColor?: string;
  authMode?: UserAuthMode;
  firebaseUid?: string;
  hasPinOrPassword?: boolean;
  watchedIds?: string[];
  interestedIds?: string[];
  allMediaItems?: MediaItem[];
  preferredRegion?: RegionCode;
  defaultPreset?: GravityPreset;
  defaultGraphScope?: GraphScopeMode;
}): { profile: UserProfile; allProfiles: UserProfile[] } {
  const cleanHandle =
    normalizeUserHandle(input.handle) ||
    normalizeUserHandle(input.displayName) ||
    (input.email ? normalizeUserHandle(input.email.split('@')[0]) : '') ||
    'cinephile';
  const profiles = getSavedUserProfiles();
  const existing = profiles.find(
    (p) => p.handle === cleanHandle || p.id === `user:${cleanHandle}`
  );
  const now = new Date().toISOString();

  const watchedIds = Array.from(
    new Set(input.watchedIds ?? existing?.watchedIds ?? [])
  );
  const interestedIds = Array.from(
    new Set(input.interestedIds ?? existing?.interestedIds ?? [])
  );

  const profile: UserProfile = {
    id: `user:${cleanHandle}`,
    handle: cleanHandle,
    displayName: input.displayName.trim() || existing?.displayName || cleanHandle,
    email:
      input.email !== undefined
        ? input.email.trim() || undefined
        : existing?.email,
    bio:
      input.bio !== undefined ? input.bio.trim() || undefined : existing?.bio,
    avatarColor:
      input.avatarColor ||
      existing?.avatarColor ||
      ARCHIVAL_AVATAR_COLORS[profiles.length % ARCHIVAL_AVATAR_COLORS.length].hex,
    authMode: input.authMode || existing?.authMode || 'HANDLE_ONLY',
    firebaseUid: input.firebaseUid || existing?.firebaseUid,
    hasPinOrPassword:
      input.hasPinOrPassword !== undefined
        ? input.hasPinOrPassword
        : existing?.hasPinOrPassword,
    watchedIds,
    watchedCustomItems: mergeCustomItems(
      watchedIds,
      existing?.watchedCustomItems,
      input.allMediaItems
    ),
    interestedIds,
    interestedCustomItems: mergeCustomItems(
      interestedIds,
      existing?.interestedCustomItems,
      input.allMediaItems
    ),
    preferredRegion: input.preferredRegion || existing?.preferredRegion || 'AU',
    defaultPreset:
      input.defaultPreset || existing?.defaultPreset || 'VIBE_TROPES',
    defaultGraphScope:
      input.defaultGraphScope ||
      (existing?.defaultGraphScope && existing.defaultGraphScope !== 'WATCHED_ONLY'
        ? existing.defaultGraphScope
        : 'FULL_ARCHIVE'),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const nextProfiles = [
    profile,
    ...profiles.filter(
      (p) => p.id !== profile.id && p.handle !== profile.handle
    ),
  ];
  saveUserProfilesToStorage(nextProfiles);
  setActiveUserIdInStorage(profile.id);

  return { profile, allProfiles: nextProfiles };
}

export function updateSavedUserLists(
  userId: string,
  watchedIds: string[],
  interestedIds: string[],
  allMediaItems: MediaItem[]
): { profile: UserProfile | null; allProfiles: UserProfile[] } {
  const profiles = getSavedUserProfiles();
  const idx = profiles.findIndex(
    (p) => p.id === userId || p.handle === userId
  );
  if (idx === -1) return { profile: null, allProfiles: profiles };

  const current = profiles[idx];
  const uniqueWatched = Array.from(new Set(watchedIds));
  const uniqueInterested = Array.from(new Set(interestedIds));

  const updated: UserProfile = {
    ...current,
    watchedIds: uniqueWatched,
    watchedCustomItems: mergeCustomItems(
      uniqueWatched,
      current.watchedCustomItems,
      allMediaItems
    ),
    interestedIds: uniqueInterested,
    interestedCustomItems: mergeCustomItems(
      uniqueInterested,
      current.interestedCustomItems,
      allMediaItems
    ),
    updatedAt: new Date().toISOString(),
  };

  const nextProfiles = [...profiles];
  nextProfiles[idx] = updated;
  saveUserProfilesToStorage(nextProfiles);

  return { profile: updated, allProfiles: nextProfiles };
}

export function updateSavedUserWatchedList(
  userId: string,
  watchedIds: string[],
  allMediaItems: MediaItem[]
): { profile: UserProfile | null; allProfiles: UserProfile[] } {
  const profiles = getSavedUserProfiles();
  const current = profiles.find((p) => p.id === userId || p.handle === userId);
  return updateSavedUserLists(
    userId,
    watchedIds,
    current?.interestedIds || [],
    allMediaItems
  );
}

export function deleteSavedUserProfile(userId: string): UserProfile[] {
  const profiles = getSavedUserProfiles();
  const next = profiles.filter((p) => p.id !== userId && p.handle !== userId);
  saveUserProfilesToStorage(next);
  if (getActiveUserIdFromStorage() === userId) {
    setActiveUserIdInStorage(next[0]?.id || null);
  }
  return next;
}

export async function syncUserProfileToServer(
  profile: UserProfile,
  options?: {
    pinOrPassword?: string;
    clearPin?: boolean;
    action?: 'save' | 'auth-signup';
  }
): Promise<{
  profile: UserProfile;
  syncedFirestore: boolean;
  firestore?: FirestoreSyncTelemetry;
  error?: string;
} | null> {
  const { firebaseProjectId, firebaseApiKey } = getActiveApiKeys();
  const tokens = getSavedAuthTokens();
  const authToken = tokens[normalizeUserHandle(profile.handle)];

  try {
    const res = await fetch('/api/user-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: options?.action || 'save',
        profile,
        pinOrPassword: options?.pinOrPassword || undefined,
        clearPin: options?.clearPin || undefined,
        authToken: authToken || undefined,
        firebaseProjectId: firebaseProjectId || undefined,
        firebaseApiKey: firebaseApiKey || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.profile) {
      return null;
    }
    const savedProfile = data.profile as UserProfile;
    if (data.authToken) {
      saveAuthTokenForHandle(savedProfile.handle, data.authToken);
    }

    // Update local storage copy with server flags (hasPinOrPassword, firebaseUid, authMode)
    const existing = getSavedUserProfiles();
    const merged = [
      savedProfile,
      ...existing.filter(
        (p) => p.id !== savedProfile.id && p.handle !== savedProfile.handle
      ),
    ];
    saveUserProfilesToStorage(merged);

    return {
      profile: savedProfile,
      syncedFirestore: Boolean(data.syncedFirestore),
      firestore: data.firestore,
    };
  } catch {
    return null;
  }
}

export async function signInWithCredentials(params: {
  identifier: string;
  password?: string;
  watchedIds?: string[];
  interestedIds?: string[];
}): Promise<{
  ok: boolean;
  profile?: UserProfile;
  source?: string;
  requiresAuth?: boolean;
  notFound?: boolean;
  error?: string;
  firestore?: FirestoreSyncTelemetry;
}> {
  const { firebaseProjectId, firebaseApiKey } = getActiveApiKeys();
  try {
    const res = await fetch('/api/user-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'auth-signin',
        identifier: params.identifier.trim(),
        password: params.password || '',
        watchedIds: params.watchedIds,
        interestedIds: params.interestedIds,
        firebaseProjectId: firebaseProjectId || undefined,
        firebaseApiKey: firebaseApiKey || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.profile) {
      return {
        ok: false,
        requiresAuth: Boolean(data?.requiresAuth),
        notFound: Boolean(data?.notFound),
        error: data?.error || 'Authentication failed',
      };
    }

    const loaded = data.profile as UserProfile;
    if (data.authToken) {
      saveAuthTokenForHandle(loaded.handle, data.authToken);
    }

    const existing = getSavedUserProfiles();
    const merged = [
      loaded,
      ...existing.filter(
        (p) => p.id !== loaded.id && p.handle !== loaded.handle
      ),
    ];
    saveUserProfilesToStorage(merged);
    setActiveUserIdInStorage(loaded.id);

    return {
      ok: true,
      profile: loaded,
      source: data.source || 'SERVER_CACHE',
      firestore: data.firestore,
    };
  } catch {
    return {
      ok: false,
      error: 'Network error while signing in',
    };
  }
}

export async function signInWithGoogleIdToken(
  idToken: string,
  currentProfileDraft?: Partial<UserProfile>
): Promise<{
  ok: boolean;
  profile?: UserProfile;
  error?: string;
  firestore?: FirestoreSyncTelemetry;
}> {
  const { firebaseProjectId, firebaseApiKey } = getActiveApiKeys();
  try {
    const res = await fetch('/api/user-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'google-signin',
        idToken,
        profile: currentProfileDraft,
        firebaseProjectId: firebaseProjectId || undefined,
        firebaseApiKey: firebaseApiKey || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.profile) {
      return {
        ok: false,
        error: data?.error || 'Google Sign-In verification failed',
      };
    }
    const loaded = data.profile as UserProfile;
    if (data.authToken) {
      saveAuthTokenForHandle(loaded.handle, data.authToken);
    }
    const existing = getSavedUserProfiles();
    const merged = [
      loaded,
      ...existing.filter(
        (p) => p.id !== loaded.id && p.handle !== loaded.handle
      ),
    ];
    saveUserProfilesToStorage(merged);
    setActiveUserIdInStorage(loaded.id);

    return {
      ok: true,
      profile: loaded,
      firestore: data.firestore,
    };
  } catch {
    return {
      ok: false,
      error: 'Network error during Google Sign-In',
    };
  }
}

export async function fetchUserProfileFromServer(
  handle: string,
  pinOrPassword?: string
): Promise<{
  profile: UserProfile | null;
  source: string;
  requiresAuth?: boolean;
  error?: string;
  firestore?: FirestoreSyncTelemetry;
} | null> {
  const clean = handle.includes('@') && !handle.startsWith('@')
    ? handle.trim().toLowerCase()
    : normalizeUserHandle(handle);
  if (!clean) return null;

  const { firebaseProjectId, firebaseApiKey } = getActiveApiKeys();
  const tokens = getSavedAuthTokens();
  const savedToken = tokens[normalizeUserHandle(clean)];

  const params = new URLSearchParams({ handle: clean });
  if (pinOrPassword) params.set('pin', pinOrPassword);
  if (savedToken) params.set('authToken', savedToken);
  if (firebaseProjectId) params.set('firebaseProjectId', firebaseProjectId);
  if (firebaseApiKey) params.set('firebaseApiKey', firebaseApiKey);

  try {
    const res = await fetch(`/api/user-profile?${params.toString()}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    if (res.status === 401 && data?.requiresAuth) {
      return {
        profile: null,
        source: 'PROTECTED',
        requiresAuth: true,
        error: data.error,
        firestore: data.firestore,
      };
    }
    if (!res.ok) return null;
    if (data?.profile) {
      const existing = getSavedUserProfiles();
      const loaded = data.profile as UserProfile;
      if (data.authToken) {
        saveAuthTokenForHandle(loaded.handle, data.authToken);
      }
      const merged = [
        loaded,
        ...existing.filter(
          (p) => p.id !== loaded.id && p.handle !== loaded.handle
        ),
      ];
      saveUserProfilesToStorage(merged);
      setActiveUserIdInStorage(loaded.id);
    }
    return {
      profile: (data?.profile as UserProfile) || null,
      source: data?.source || 'SERVER_CACHE',
      firestore: data?.firestore,
    };
  } catch {
    return null;
  }
}

export async function fetchServerProfilesList(): Promise<UserProfile[]> {
  const { firebaseProjectId, firebaseApiKey } = getActiveApiKeys();
  const params = new URLSearchParams();
  if (firebaseProjectId) params.set('firebaseProjectId', firebaseProjectId);
  if (firebaseApiKey) params.set('firebaseApiKey', firebaseApiKey);

  try {
    const res = await fetch(`/api/user-profile?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.profiles) ? (data.profiles as UserProfile[]) : [];
  } catch {
    return [];
  }
}

export function exportUserProfileJson(profile: UserProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function importUserProfileJson(rawJson: string): {
  profile: UserProfile;
  allProfiles: UserProfile[];
} | null {
  try {
    const parsed = JSON.parse(rawJson) as Partial<UserProfile>;
    if (!parsed || typeof parsed !== 'object') return null;
    const handle = normalizeUserHandle(
      parsed.handle || parsed.displayName || ''
    );
    if (!handle) return null;

    const mergedCustom = [
      ...(Array.isArray(parsed.watchedCustomItems)
        ? parsed.watchedCustomItems
        : []),
      ...(Array.isArray(parsed.interestedCustomItems)
        ? parsed.interestedCustomItems
        : []),
    ];

    return createOrUpdateUserProfile({
      handle,
      displayName: parsed.displayName || handle,
      email: parsed.email,
      bio: parsed.bio,
      avatarColor: parsed.avatarColor,
      watchedIds: Array.isArray(parsed.watchedIds) ? parsed.watchedIds : [],
      interestedIds: Array.isArray(parsed.interestedIds)
        ? parsed.interestedIds
        : [],
      allMediaItems: mergedCustom.length > 0 ? mergedCustom : undefined,
      preferredRegion: parsed.preferredRegion,
      defaultPreset: parsed.defaultPreset,
      defaultGraphScope: parsed.defaultGraphScope,
    });
  } catch {
    return null;
  }
}
