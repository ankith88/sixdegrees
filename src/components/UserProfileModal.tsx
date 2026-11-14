'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  User,
  UserPlus,
  Check,
  X,
  Film,
  Tv,
  Orbit,
  Sparkles,
  Cloud,
  Download,
  Upload,
  LogOut,
  Search,
  Plus,
  Trash2,
  Loader2,
  Award,
  UserCheck,
  Hash,
  RefreshCw,
  Bookmark,
  Lock,
  KeyRound,
  ShieldCheck,
  Mail,
  LogIn,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import {
  GraphScopeMode,
  GravityPreset,
  MediaItem,
  RegionCode,
  UserAuthMode,
  UserProfile,
} from '@/lib/types';
import {
  ARCHIVAL_AVATAR_COLORS,
  exportUserProfileJson,
  normalizeUserHandle,
} from '@/lib/user-profile';
import { LiveSearchResult, searchLiveCatalog } from '@/lib/api';
import { getPosterFallbackDataUri } from '@/lib/seed-data';

interface UserProfileModalProps {
  open: boolean;
  onClose: () => void;
  activeUser: UserProfile | null;
  savedProfiles: UserProfile[];
  watchedIds: string[];
  interestedIds: string[];
  allMediaItems: MediaItem[];
  graphScope: GraphScopeMode;
  onGraphScopeChange: (scope: GraphScopeMode) => void;
  onSaveProfile: (input: {
    handle: string;
    displayName: string;
    email?: string;
    bio?: string;
    avatarColor: string;
    authMode?: UserAuthMode;
    pinOrPassword?: string;
    clearPin?: boolean;
    preferredRegion: RegionCode;
    defaultPreset: GravityPreset;
    defaultGraphScope: GraphScopeMode;
  }) => Promise<{
    ok: boolean;
    error?: string;
    syncedFirestore?: boolean;
  }>;
  onSignInCredentials: (params: {
    identifier: string;
    password?: string;
  }) => Promise<{
    ok: boolean;
    requiresAuth?: boolean;
    notFound?: boolean;
    error?: string;
  }>;
  onGoogleSignIn?: (idToken: string) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  onSwitchUser: (profile: UserProfile | null) => void;
  onDeleteProfile: (userId: string) => void;
  onLoadCloudProfile: (
    handle: string,
    pinOrPassword?: string
  ) => Promise<{
    ok: boolean;
    requiresAuth?: boolean;
    error?: string;
  }>;
  onImportProfileJson: (json: string) => boolean;
  onToggleWatched: (mediaId: string) => void;
  onToggleInterested: (mediaId: string) => void;
  onAddLiveMediaAndWatch: (target: LiveSearchResult) => Promise<void>;
  onAddLiveMediaAndInterest: (target: LiveSearchResult) => Promise<void>;
  onOpenMyWatchedGraph: (scope?: GraphScopeMode) => void;
  isSyncingProfile?: boolean;
  initialTab?: ModalTab;
}

export type ModalTab =
  | 'PROFILE'
  | 'WATCHED_GRAPH'
  | 'INTERESTED_GRAPH'
  | 'SWITCH_SYNC';

function HoldToDeleteButton({
  profileName,
  onConfirm,
}: {
  profileName: string;
  onConfirm: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHold = () => {
    setHolding(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startHold = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHolding(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setHolding(false);
      onConfirm();
    }, 2000);
  };

  useEffect(() => () => cancelHold(), []);

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        if (e.button === 0) startHold();
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          startHold();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') cancelHold();
      }}
      onBlur={cancelHold}
      className="btn-press relative overflow-hidden p-1.5 rounded text-[#6B5E50] hover:text-[#8C1D22] hover:bg-[#F5E4E4] transition-colors cursor-pointer select-none"
      title="Hold 2 seconds to delete profile"
      aria-label={`Hold 2 seconds to delete profile ${profileName}`}
    >
      <span
        aria-hidden="true"
        data-holding={holding ? 'true' : 'false'}
        className="hold-confirm-fill pointer-events-none absolute inset-0 bg-[#B8292F]/25"
      />
      <Trash2 className="relative z-10 w-3.5 h-3.5" />
    </button>
  );
}

export function UserProfileModal({
  open,
  onClose,
  activeUser,
  savedProfiles,
  watchedIds,
  interestedIds,
  allMediaItems,
  graphScope,
  onGraphScopeChange,
  onSaveProfile,
  onSignInCredentials,
  onGoogleSignIn,
  onSwitchUser,
  onDeleteProfile,
  onLoadCloudProfile,
  onImportProfileJson,
  onToggleWatched,
  onToggleInterested,
  onAddLiveMediaAndWatch,
  onAddLiveMediaAndInterest,
  onOpenMyWatchedGraph,
  isSyncingProfile = false,
  initialTab,
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab || 'PROFILE');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [profileSubMode, setProfileSubMode] = useState<'EDIT_OR_CREATE' | 'SIGN_IN'>(
    activeUser ? 'EDIT_OR_CREATE' : 'SIGN_IN'
  );
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showAdvancedTokenSignIn, setShowAdvancedTokenSignIn] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // Form state for Create / Edit Profile
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [clearPin, setClearPin] = useState(false);
  const [avatarColor, setAvatarColor] = useState<string>(
    ARCHIVAL_AVATAR_COLORS[0].hex
  );
  const [preferredRegion, setPreferredRegion] = useState<RegionCode>('AU');
  const [defaultPreset, setDefaultPreset] =
    useState<GravityPreset>('VIBE_TROPES');
  const [defaultGraphScope, setDefaultGraphScope] =
    useState<GraphScopeMode>('WATCHED_ONLY');

  // Sign-In Form state
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInSecret, setSignInSecret] = useState('');
  const [googleIdTokenInput, setGoogleIdTokenInput] = useState('');
  const [authFeedback, setAuthFeedback] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);

  // Watched & Interested search inside modal
  const [mediaQuery, setMediaQuery] = useState('');
  const [liveResults, setLiveResults] = useState<LiveSearchResult[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);

  // Cloud handle lookup & JSON import
  const [cloudHandleInput, setCloudHandleInput] = useState('');
  const [cloudPinInput, setCloudPinInput] = useState('');
  const [cloudNeedsPin, setCloudNeedsPin] = useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);

  useEffect(() => {
    if (!activeUser && (activeTab === 'WATCHED_GRAPH' || activeTab === 'INTERESTED_GRAPH')) {
      setActiveTab('PROFILE');
    }
  }, [activeUser, activeTab]);

  useEffect(() => {
    if (!open) return;
    setAuthFeedback(null);
    setPinOrPassword('');
    setClearPin(false);
    setShowSignInPassword(false);
    setShowCreatePassword(false);
    if (activeUser && !isCreatingNew) {
      setProfileSubMode('EDIT_OR_CREATE');
      setDisplayName(activeUser.displayName);
      setHandle(activeUser.handle);
      setEmail(activeUser.email || '');
      setBio(activeUser.bio || '');
      setAvatarColor(activeUser.avatarColor || ARCHIVAL_AVATAR_COLORS[0].hex);
      setPreferredRegion(activeUser.preferredRegion || 'AU');
      setDefaultPreset(activeUser.defaultPreset || 'VIBE_TROPES');
      setDefaultGraphScope(activeUser.defaultGraphScope || 'WATCHED_ONLY');
    } else if (!activeUser || isCreatingNew) {
      if (!activeUser) {
        setProfileSubMode('SIGN_IN');
      }
      setDisplayName('');
      setHandle('');
      setEmail('');
      setBio('');
      setAvatarColor(
        ARCHIVAL_AVATAR_COLORS[
          savedProfiles.length % ARCHIVAL_AVATAR_COLORS.length
        ].hex
      );
      setPreferredRegion('AU');
      setDefaultPreset('VIBE_TROPES');
      setDefaultGraphScope('WATCHED_ONLY');
    }
  }, [open, activeUser, isCreatingNew, savedProfiles.length]);

  useEffect(() => {
    const q = mediaQuery.trim();
    if (q.length < 2) {
      setLiveResults([]);
      setIsSearchingLive(false);
      return;
    }

    let cancelled = false;
    setIsSearchingLive(true);
    const timer = setTimeout(async () => {
      const { results } = await searchLiveCatalog(q);
      if (!cancelled) {
        setLiveResults(results);
        setIsSearchingLive(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mediaQuery]);

  const watchedItems = useMemo(() => {
    const set = new Set(watchedIds);
    return allMediaItems.filter((m) => set.has(m.id));
  }, [allMediaItems, watchedIds]);

  const interestedItems = useMemo(() => {
    const set = new Set(interestedIds);
    return allMediaItems.filter((m) => set.has(m.id));
  }, [allMediaItems, interestedIds]);

  const computeGraphStats = (items: MediaItem[]) => {
    const movies = items.filter((m) => m.mediaType === 'MOVIE').length;
    const tv = items.filter((m) => m.mediaType === 'TV').length;

    const dirCounts = new Map<string, number>();
    const actorCounts = new Map<string, number>();
    const tropeCounts = new Map<string, number>();

    for (const item of items) {
      for (const d of item.directors) {
        dirCounts.set(d, (dirCounts.get(d) || 0) + 1);
      }
      for (const c of item.cast.slice(0, 5)) {
        actorCounts.set(c.name, (actorCounts.get(c.name) || 0) + 1);
      }
      for (const t of item.tropes) {
        tropeCounts.set(t, (tropeCounts.get(t) || 0) + 1);
      }
    }

    const sharedDirectors = Array.from(dirCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([name]) => name);
    const sharedActors = Array.from(actorCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([name]) => name);
    const sharedTropes = Array.from(tropeCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([name]) => name);

    return {
      movies,
      tv,
      sharedDirectors,
      sharedActors,
      sharedTropes,
      totalSharedBridges:
        sharedDirectors.length + sharedActors.length + sharedTropes.length,
    };
  };

  const personalGraphStats = useMemo(
    () => computeGraphStats(watchedItems),
    [watchedItems]
  );

  const interestedGraphStats = useMemo(
    () => computeGraphStats(interestedItems),
    [interestedItems]
  );

  const filteredLocalSearch = useMemo(() => {
    const q = mediaQuery.trim().toLowerCase();
    if (!q) return allMediaItems.slice(0, 12);
    return allMediaItems
      .filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.directors.some((d) => d.toLowerCase().includes(q)) ||
          m.cast.some((c) => c.name.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [allMediaItems, mediaQuery]);

  if (!open) return null;

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);

    const resolvedName =
      displayName.trim() ||
      handle.trim() ||
      (email.includes('@') ? email.split('@')[0] : '');
    if (!resolvedName) return;

    const resolvedHandle =
      normalizeUserHandle(handle || resolvedName) || 'cinephile';

    if (email.trim() && !email.includes('@')) {
      setAuthFeedback({
        type: 'error',
        message: 'Please enter a valid email address.',
      });
      return;
    }

    if (email.trim() && pinOrPassword.trim() && !clearPin && pinOrPassword.trim().length < 6) {
      setAuthFeedback({
        type: 'error',
        message: 'Password must be at least 6 characters for Firebase Authentication.',
      });
      return;
    }

    const resolvedAuthMode: UserAuthMode =
      email.trim() && pinOrPassword.trim()
        ? 'FIREBASE_EMAIL'
        : pinOrPassword.trim() || (activeUser?.hasPinOrPassword && !clearPin)
          ? 'PIN_PROTECTED'
          : 'HANDLE_ONLY';

    const res = await onSaveProfile({
      handle: resolvedHandle,
      displayName: resolvedName,
      email: email.trim() || undefined,
      bio: bio.trim() || undefined,
      avatarColor,
      authMode: resolvedAuthMode,
      pinOrPassword: pinOrPassword.trim() || undefined,
      clearPin,
      preferredRegion,
      defaultPreset,
      defaultGraphScope,
    });
    if (!res.ok) {
      setAuthFeedback({
        type: 'error',
        message: res.error || 'Failed to save profile.',
      });
      return;
    }
    setPinOrPassword('');
    setClearPin(false);
    setIsCreatingNew(false);
    setAuthFeedback({
      type: 'success',
      message: res.syncedFirestore
        ? `Profile @${resolvedHandle} saved & synced to Firebase!`
        : `Profile @${resolvedHandle} saved successfully!`,
    });
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);
    if (!signInIdentifier.trim()) {
      setAuthFeedback({
        type: 'error',
        message: 'Please enter your username or email address.',
      });
      return;
    }

    const res = await onSignInCredentials({
      identifier: signInIdentifier.trim(),
      password: signInSecret.trim() || undefined,
    });

    if (res.ok) {
      setSignInSecret('');
      setAuthFeedback({
        type: 'success',
        message: 'Welcome back! Your personal collection has been loaded.',
      });
      setProfileSubMode('EDIT_OR_CREATE');
    } else {
      setAuthFeedback({
        type: 'error',
        message:
          res.error ||
          "We couldn't sign you in with those details. Please check your username or password.",
      });
    }
  };

  const handleGoogleSignInClick = async () => {
    setAuthFeedback(null);
    if (!googleIdTokenInput.trim()) {
      setAuthFeedback({
        type: 'error',
        message: 'Please paste your Google token to continue.',
      });
      return;
    }
    if (!onGoogleSignIn) return;
    const res = await onGoogleSignIn(googleIdTokenInput.trim());
    if (res.ok) {
      setGoogleIdTokenInput('');
      setAuthFeedback({
        type: 'success',
        message: 'Signed in with Google successfully!',
      });
      setProfileSubMode('EDIT_OR_CREATE');
    } else {
      setAuthFeedback({
        type: 'error',
        message: res.error || 'Sign-in failed. Please verify the token.',
      });
    }
  };

  const handleDownloadBackup = () => {
    if (!activeUser) return;
    const json = exportUserProfileJson(activeUser);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sixdegrees-profile-${activeUser.handle}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="User Profile, Authentication & Personal Graphs Studio"
      className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[#171412]/55 backdrop-blur-xs p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className={`motion-modal w-full ${
          activeTab === 'PROFILE' ? 'max-w-xl' : 'max-w-4xl'
        } max-h-[92vh] rounded-2xl bg-[#F6F1E7] border border-[#B5A892] shadow-archival flex flex-col overflow-hidden text-[#171412]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-5 py-4 bg-[#EFE8DA] border-b border-[#D5CCB9] flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#FBF8F2] font-heading font-bold text-base shadow-archival-sm shrink-0 border border-[#FBF8F2]/60"
              style={{
                backgroundColor: activeUser
                  ? activeUser.avatarColor
                  : '#52483E',
              }}
            >
              {activeUser
                ? activeUser.displayName.slice(0, 2).toUpperCase()
                : '6D'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-heading text-lg font-bold text-[#171412] truncate">
                  {activeUser
                    ? activeUser.displayName
                    : profileSubMode === 'SIGN_IN'
                      ? 'Sign In to SixDegrees'
                      : 'Join SixDegrees'}
                </h2>
                {activeUser ? (
                  <>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-tabular font-semibold bg-[#E4F0EA] text-[#1E563F] border border-[#B3D4C5]">
                      <Cloud className="w-3 h-3" aria-hidden="true" />@
                      {activeUser.handle}
                    </span>
                    {activeUser.hasPinOrPassword && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6EEF6] text-[#234B6E] border border-[#B6C8DC]">
                        <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                        Protected Profile
                      </span>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E5DEC9] text-[#52483E] border border-[#C8BEAA]">
                    Guest Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-[#52483E] truncate">
                {activeUser
                  ? `${watchedIds.length} watched · ${interestedIds.length} want to watch in your collection`
                  : profileSubMode === 'SIGN_IN'
                    ? 'Sync your watchlists and explore your personal cinema connections'
                    : 'Save films you love and explore connections across cinema history'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeUser && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onOpenMyWatchedGraph('WATCHED_ONLY');
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] border border-[#8C1D22] shadow-archival-sm transition-colors cursor-pointer"
                >
                  <Orbit className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Watched Graph ({watchedIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenMyWatchedGraph('INTERESTED_ONLY');
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#234B6E] hover:bg-[#193854] text-[#FBF8F2] border border-[#193854] shadow-archival-sm transition-colors cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Interested Graph ({interestedIds.length})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#FBF8F2] hover:bg-[#E5DEC9] border border-[#C8BEAA] flex items-center justify-center text-[#52483E] hover:text-[#171412] transition-colors cursor-pointer"
              aria-label="Close User Profile Modal"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Personal Graph Telemetry & Scope Bar (Only visible when logged in) */}
        {activeUser && (
          <div className="px-5 py-2.5 bg-[#FBF8F2] border-b border-[#D5CCB9] flex items-center justify-between flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-3.5 text-xs font-tabular flex-wrap">
              <span className="inline-flex items-center gap-1 text-[#B8292F] font-semibold">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                {watchedIds.length} Watched ({personalGraphStats.movies}F /{' '}
                {personalGraphStats.tv}TV)
              </span>
              <span className="inline-flex items-center gap-1 text-[#234B6E] font-semibold">
                <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
                {interestedIds.length} Want to Watch ({interestedGraphStats.movies}
                F / {interestedGraphStats.tv}TV)
              </span>
              <span className="inline-flex items-center gap-1 text-[#2A6B53] font-semibold">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                {personalGraphStats.totalSharedBridges +
                  interestedGraphStats.totalSharedBridges}{' '}
                Personal Bridges
              </span>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[11px] font-semibold text-[#52483E] mr-0.5">
                Graph Scope:
              </span>
              {(
                [
                  { id: 'WATCHED_ONLY', label: 'My Watched' },
                  { id: 'INTERESTED_ONLY', label: 'My Interested' },
                  { id: 'WATCHED_AND_INTERESTED', label: 'Watched + Interested' },
                  { id: 'WATCHED_PLUS_SUGGESTIONS', label: 'Watched + Suggested' },
                  { id: 'FULL_ARCHIVE', label: 'Full Archive' },
                ] as const
              ).map((sc) => {
                const active = graphScope === sc.id;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => onGraphScopeChange(sc.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                      active
                        ? sc.id === 'INTERESTED_ONLY'
                          ? 'bg-[#234B6E] text-[#FBF8F2] border-[#193854]'
                          : 'bg-[#B8292F] text-[#FBF8F2] border-[#8C1D22]'
                        : 'bg-[#EFE8DA] text-[#52483E] hover:text-[#171412] border-[#C8BEAA]'
                    }`}
                  >
                    {sc.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 pt-2.5 bg-[#EFE8DA]/60 border-b border-[#D5CCB9] flex items-center gap-1.5 overflow-x-auto shrink-0">
          {(
            [
              {
                id: 'PROFILE' as const,
                label:
                  activeUser && !isCreatingNew
                    ? 'Profile'
                    : profileSubMode === 'SIGN_IN'
                      ? 'Sign In'
                      : 'Create Profile',
                icon: User,
                show: true,
              },
              {
                id: 'WATCHED_GRAPH' as const,
                label: `Watched (${watchedIds.length})`,
                icon: Orbit,
                show: Boolean(activeUser),
              },
              {
                id: 'INTERESTED_GRAPH' as const,
                label: `Want to Watch (${interestedIds.length})`,
                icon: Bookmark,
                show: Boolean(activeUser),
              },
              {
                id: 'SWITCH_SYNC' as const,
                label: `Profiles & Sync (${savedProfiles.length})`,
                icon: Cloud,
                show: true,
              },
            ]
          )
            .filter((t) => t.show)
            .map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold border-t border-x transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#F6F1E7] text-[#B8292F] border-[#C8BEAA] -mb-px pb-2.5'
                    : 'bg-transparent text-[#52483E] hover:text-[#171412] border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'PROFILE' && (
            <div className="space-y-4">
              {/* Mode Switcher: Sign In vs Create/Edit Profile */}
              {(!activeUser || isCreatingNew) ? (
                <div className="flex items-center justify-center p-1 bg-[#EBE3D3] rounded-xl border border-[#D5CCB9] max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSubMode('SIGN_IN');
                      setAuthFeedback(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                      profileSubMode === 'SIGN_IN'
                        ? 'bg-[#FBF8F2] text-[#171412] shadow-xs font-bold'
                        : 'text-[#6B5E50] hover:text-[#171412]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSubMode('EDIT_OR_CREATE');
                      setAuthFeedback(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                      profileSubMode === 'EDIT_OR_CREATE'
                        ? 'bg-[#FBF8F2] text-[#171412] shadow-xs font-bold'
                        : 'text-[#6B5E50] hover:text-[#171412]'
                    }`}
                  >
                    Create Profile
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                  <div className="text-xs font-bold text-[#171412]">
                    Signed in as @{activeUser.handle}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(true);
                      setProfileSubMode('EDIT_OR_CREATE');
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border border-[#C8BEAA] transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#B8292F]" />
                    <span>New Profile</span>
                  </button>
                </div>
              )}

              {authFeedback && (
                <div
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                    authFeedback.type === 'success'
                      ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                      : 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6]'
                  }`}
                >
                  <span>{authFeedback.message}</span>
                  <button
                    type="button"
                    onClick={() => setAuthFeedback(null)}
                    className="ml-2 opacity-75 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {profileSubMode === 'SIGN_IN' ? (
                <div className="space-y-4">
                  <div className="text-center sm:text-left space-y-1">
                    <h3 className="font-heading text-lg font-bold text-[#171412]">
                      Welcome back
                    </h3>
                    <p className="text-xs text-[#52483E]">
                      Sign in to access your saved films, watchlists, and personal connections.
                    </p>
                  </div>

                  <form
                    onSubmit={handleSignInSubmit}
                    className="p-4 sm:p-5 rounded-2xl bg-[#FBF8F2] border border-[#C8BEAA] space-y-3.5 shadow-archival-sm"
                  >
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#171412]">
                        Email or username
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#8C7E6D] absolute left-3 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={signInIdentifier}
                          onChange={(e) => setSignInIdentifier(e.target.value)}
                          placeholder="e.g. alex or alex@example.com"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F6F1E7] border border-[#C8BEAA] focus:border-[#B8292F] focus:ring-2 focus:ring-[#B8292F]/15 focus:outline-none text-xs text-[#171412] placeholder:text-[#9E9080] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-[#171412]">
                          Password
                        </label>
                        <span className="text-[11px] text-[#6B5E50]">
                          Optional if not set
                        </span>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#8C7E6D] absolute left-3 top-2.5 pointer-events-none" />
                        <input
                          type={showSignInPassword ? 'text' : 'password'}
                          value={signInSecret}
                          onChange={(e) => setSignInSecret(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-10 pl-9 pr-10 rounded-xl bg-[#F6F1E7] border border-[#C8BEAA] focus:border-[#B8292F] focus:ring-2 focus:ring-[#B8292F]/15 focus:outline-none text-xs text-[#171412] placeholder:text-[#9E9080] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignInPassword(!showSignInPassword)}
                          className="absolute right-3 top-2.5 text-[#8C7E6D] hover:text-[#171412] transition-colors cursor-pointer"
                          aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                        >
                          {showSignInPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSyncingProfile}
                      className="w-full h-10 mt-1 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] shadow-sm transition-all cursor-pointer disabled:opacity-60"
                    >
                      {isSyncingProfile ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogIn className="w-4 h-4" />
                      )}
                      <span>{isSyncingProfile ? 'Signing in…' : 'Sign In'}</span>
                    </button>
                  </form>

                  {/* Optional Google Token Sign-In Expander */}
                  {onGoogleSignIn && (
                    <div className="pt-2 border-t border-[#D5CCB9]">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedTokenSignIn(!showAdvancedTokenSignIn)}
                        className="text-[11px] font-medium text-[#6B5E50] hover:text-[#171412] inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Have an institutional or Google token?</span>
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            showAdvancedTokenSignIn ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {showAdvancedTokenSignIn && (
                        <div className="mt-2 p-3 rounded-xl bg-[#EFE8DA]/80 border border-[#C8BEAA] space-y-2 text-left">
                          <p className="text-[11px] text-[#52483E]">
                            Paste your Google token below to sign in:
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={googleIdTokenInput}
                              onChange={(e) => setGoogleIdTokenInput(e.target.value)}
                              placeholder="Paste token here…"
                              className="flex-1 h-8 px-2.5 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] text-xs font-mono text-[#171412] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleGoogleSignInClick}
                              className="h-8 px-3 rounded-lg text-xs font-semibold bg-[#234B6E] hover:bg-[#193854] text-[#FBF8F2] transition-colors cursor-pointer shrink-0"
                            >
                              Verify
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-3 border-t border-[#D5CCB9] text-center">
                    <p className="text-xs text-[#52483E]">
                      Don&apos;t have a profile yet?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileSubMode('EDIT_OR_CREATE');
                          setAuthFeedback(null);
                        }}
                        className="font-semibold text-[#B8292F] hover:underline cursor-pointer"
                      >
                        Create one in seconds
                      </button>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center sm:text-left space-y-1">
                    <h3 className="font-heading text-lg font-bold text-[#171412]">
                      {activeUser && !isCreatingNew ? 'Edit Your Profile' : 'Create your film profile'}
                    </h3>
                    <p className="text-xs text-[#52483E]">
                      {activeUser && !isCreatingNew
                        ? 'Update your name, bio, and catalog preferences.'
                        : 'Save films you love, build your watchlist, and uncover connections across cinema history.'}
                    </p>
                  </div>

                  <form onSubmit={handleSubmitProfile} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-[#171412]">
                          Your Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => {
                            setDisplayName(e.target.value);
                            if (!activeUser || isCreatingNew) {
                              setHandle(normalizeUserHandle(e.target.value));
                            }
                          }}
                          placeholder="e.g. Clara Oswald"
                          className="w-full h-9 px-3 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] focus:border-[#B8292F] focus:ring-2 focus:ring-[#B8292F]/15 focus:outline-none text-xs text-[#171412] placeholder:text-[#9E9080] transition-colors"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-[#171412]">
                          Username (@handle) *
                        </label>
                        <div className="flex items-center h-9 px-3 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] focus-within:border-[#B8292F] focus-within:ring-2 focus-within:ring-[#B8292F]/15">
                          <span className="text-xs text-[#8C7E6D] font-tabular mr-1 select-none">
                            @
                          </span>
                          <input
                            type="text"
                            required
                            value={handle}
                            onChange={(e) => setHandle(normalizeUserHandle(e.target.value))}
                            placeholder="clara"
                            className="w-full bg-transparent text-xs text-[#171412] font-tabular focus:outline-none placeholder:text-[#9E9080]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-[#171412]">
                            Email
                          </label>
                          <span className="text-[11px] text-[#6B5E50]">Optional</span>
                        </div>
                        <div className="relative">
                          <Mail className="w-3.5 h-3.5 text-[#8C7E6D] absolute left-3 top-2.5 pointer-events-none" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full h-9 pl-8 pr-3 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] focus:border-[#B8292F] focus:ring-2 focus:ring-[#B8292F]/15 focus:outline-none text-xs text-[#171412] placeholder:text-[#9E9080] transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-[#171412]">
                            Password or Passcode
                          </label>
                          {activeUser?.hasPinOrPassword && !isCreatingNew ? (
                            <button
                              type="button"
                              onClick={() => setClearPin((v) => !v)}
                              className="text-[10px] font-semibold text-[#8C1D22] hover:underline cursor-pointer"
                            >
                              {clearPin ? 'Keep existing password' : 'Remove password'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#6B5E50]">Optional</span>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="w-3.5 h-3.5 text-[#8C7E6D] absolute left-3 top-2.5 pointer-events-none" />
                          <input
                            type={showCreatePassword ? 'text' : 'password'}
                            disabled={clearPin}
                            value={pinOrPassword}
                            onChange={(e) => setPinOrPassword(e.target.value)}
                            placeholder={
                              clearPin
                                ? 'Password will be removed on save'
                                : activeUser?.hasPinOrPassword && !isCreatingNew
                                  ? '•••••••• (leave blank to keep current)'
                                  : '4-digit PIN or password'
                            }
                            className="w-full h-9 pl-8 pr-9 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] focus:border-[#B8292F] focus:ring-2 focus:ring-[#B8292F]/15 focus:outline-none text-xs text-[#171412] disabled:opacity-50 placeholder:text-[#9E9080] transition-colors"
                          />
                          {!clearPin && (
                            <button
                              type="button"
                              onClick={() => setShowCreatePassword(!showCreatePassword)}
                              className="absolute right-2.5 top-2 text-[#8C7E6D] hover:text-[#171412] transition-colors cursor-pointer"
                              aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                            >
                              {showCreatePassword ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Taste Note */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-[#171412]">
                          Cinema taste note
                        </label>
                        <span className="text-[11px] text-[#6B5E50]">Optional</span>
                      </div>
                      <input
                        type="text"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="e.g. Atmospheric sci-fi, French New Wave, and slow cinema"
                        className="w-full h-9 px-3 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] focus:border-[#B8292F] focus:ring-2 focus:ring-[#B8292F]/15 focus:outline-none text-xs text-[#171412] placeholder:text-[#9E9080] transition-colors"
                      />
                    </div>

                    {/* Avatar Color Picker */}
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-xs font-semibold text-[#171412]">
                        Profile accent color
                      </label>
                      <div className="flex items-center gap-2 pt-0.5">
                        {ARCHIVAL_AVATAR_COLORS.map((col) => (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => setAvatarColor(col.hex)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                              avatarColor === col.hex
                                ? 'scale-110 ring-2 ring-[#171412] ring-offset-2 ring-offset-[#F6F1E7]'
                                : 'opacity-75 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: col.hex }}
                            title={col.label}
                          >
                            {avatarColor === col.hex && (
                              <Check className="w-3.5 h-3.5 text-[#FBF8F2]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preferences Accordion */}
                    <div className="pt-2 border-t border-[#D5CCB9]">
                      <button
                        type="button"
                        onClick={() => setShowPreferences(!showPreferences)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-[#52483E] hover:text-[#171412] py-1 cursor-pointer transition-colors"
                      >
                        <span>Curatorial preferences (Region &amp; Lens)</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            showPreferences ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {showPreferences && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-medium text-[#52483E]">
                              Startup View
                            </label>
                            <select
                              value={defaultGraphScope}
                              onChange={(e) => setDefaultGraphScope(e.target.value as GraphScopeMode)}
                              className="w-full h-8 px-2 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] text-xs text-[#171412] focus:outline-none focus:border-[#B8292F]"
                            >
                              <option value="WATCHED_ONLY">My Watched Films</option>
                              <option value="INTERESTED_ONLY">Want to Watch Only</option>
                              <option value="WATCHED_AND_INTERESTED">Watched + Watchlist</option>
                              <option value="WATCHED_PLUS_SUGGESTIONS">Watched + Suggestions</option>
                              <option value="FULL_ARCHIVE">Full Archive</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-medium text-[#52483E]">
                              Starting Lens
                            </label>
                            <select
                              value={defaultPreset}
                              onChange={(e) => setDefaultPreset(e.target.value as GravityPreset)}
                              className="w-full h-8 px-2 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] text-xs text-[#171412] focus:outline-none focus:border-[#B8292F]"
                            >
                              <option value="VIBE_TROPES">Story &amp; Themes (1×)</option>
                              <option value="AUTEUR_ORBIT">Director &amp; Craft (2×)</option>
                              <option value="STAR_CONSTELLATION">Shared Cast (3×)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-medium text-[#52483E]">
                              Streaming Region
                            </label>
                            <select
                              value={preferredRegion}
                              onChange={(e) => setPreferredRegion(e.target.value as RegionCode)}
                              className="w-full h-8 px-2 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] text-xs text-[#171412] focus:outline-none focus:border-[#B8292F]"
                            >
                              <option value="AU">Australia (AU)</option>
                              <option value="US">United States (US)</option>
                              <option value="UK">United Kingdom (UK)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Buttons */}
                    <div className="pt-3 flex items-center justify-between gap-3 border-t border-[#D5CCB9]">
                      <div>
                        {activeUser && (
                          <button
                            type="button"
                            onClick={() => onSwitchUser(null)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FBF8F2] hover:bg-[#F5E4E4] text-[#52483E] hover:text-[#8C1D22] border border-[#C8BEAA] transition-colors cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Switch to Guest</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isCreatingNew && activeUser && (
                          <button
                            type="button"
                            onClick={() => setIsCreatingNew(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EFE8DA] text-[#52483E] hover:text-[#171412] border border-[#C8BEAA] cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={isSyncingProfile}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] shadow-sm transition-all cursor-pointer disabled:opacity-60"
                        >
                          {isSyncingProfile ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {activeUser && !isCreatingNew
                              ? 'Save Profile Changes'
                              : 'Create Profile'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </form>

                  {(!activeUser || isCreatingNew) && (
                    <div className="pt-2 text-center">
                      <p className="text-xs text-[#52483E]">
                        Already have a profile?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setProfileSubMode('SIGN_IN');
                            setAuthFeedback(null);
                          }}
                          className="font-semibold text-[#B8292F] hover:underline cursor-pointer"
                        >
                          Sign in here
                        </button>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY WATCHED LIST & GRAPH */}
          {activeTab === 'WATCHED_GRAPH' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#EFE8DA] border border-[#C8BEAA] space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-heading text-sm font-bold text-[#171412]">
                      Your Personal Watched Constellation ({watchedItems.length})
                    </h3>
                    <p className="text-xs text-[#52483E]">
                      Movies and TV shows you have watched. SixDegrees connects
                      them into your own 3D/2D graph via shared Directors, Cast,
                      Composers, and Themes.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMyWatchedGraph('WATCHED_ONLY');
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] border border-[#8C1D22] cursor-pointer"
                    >
                      <Orbit className="w-3.5 h-3.5" />
                      <span>Open My Watched Graph</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMyWatchedGraph('WATCHED_PLUS_SUGGESTIONS');
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border border-[#C8BEAA] cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#2A6B53]" />
                      <span>+ Suggested Bridges</span>
                    </button>
                  </div>
                </div>

                {personalGraphStats.totalSharedBridges > 0 && (
                  <div className="pt-1.5 border-t border-[#D5CCB9] flex items-center flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#52483E] mr-1">
                      Top Watched Bridges:
                    </span>
                    {personalGraphStats.sharedDirectors
                      .slice(0, 3)
                      .map((dir) => (
                        <span
                          key={dir}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]"
                        >
                          <Award className="w-2.5 h-2.5" />
                          {dir}
                        </span>
                      ))}
                    {personalGraphStats.sharedActors.slice(0, 3).map((act) => (
                      <span
                        key={act}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F7ECE1] text-[#8A4F0D] border border-[#DFC4A6]"
                      >
                        <UserCheck className="w-2.5 h-2.5" />
                        {act}
                      </span>
                    ))}
                    {personalGraphStats.sharedTropes.slice(0, 3).map((tr) => (
                      <span
                        key={tr}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E4F0EA] text-[#1E563F] border border-[#B3D4C5]"
                      >
                        <Hash className="w-2.5 h-2.5" />
                        {tr}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Search & Add Any Movie or TV Show to Watched */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#171412]">
                  Add Movies &amp; TV Series You&apos;ve Watched
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#6B5E50] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={mediaQuery}
                    onChange={(e) => setMediaQuery(e.target.value)}
                    placeholder="Search any movie or TV show (e.g. Severance, Dune, The Prestige)…"
                    className="w-full h-9 pl-8 pr-8 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] focus:border-[#B8292F] focus:outline-none text-xs text-[#171412]"
                  />
                  {mediaQuery && (
                    <button
                      type="button"
                      onClick={() => setMediaQuery('')}
                      className="absolute right-2.5 top-2 text-[#6B5E50] hover:text-[#171412] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {mediaQuery.trim().length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] max-h-56 overflow-y-auto space-y-2">
                    {filteredLocalSearch.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#52483E] px-1">
                          Archive Matches
                        </div>
                        {filteredLocalSearch.map((item) => {
                          const isWatched = watchedIds.includes(item.id);
                          const isInterested = interestedIds.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EFE8DA] transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {item.mediaType === 'MOVIE' ? (
                                  <Film className="w-3.5 h-3.5 text-[#234B6E] shrink-0" />
                                ) : (
                                  <Tv className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" />
                                )}
                                <span className="text-xs font-semibold text-[#171412] truncate">
                                  {item.title} ({item.year})
                                </span>
                                <span className="text-[11px] text-[#52483E] truncate">
                                  · {item.directors[0] || item.primaryGenre}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onToggleInterested(item.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer ${
                                    isInterested
                                      ? 'bg-[#E6EEF6] text-[#234B6E] border-[#B6C8DC]'
                                      : 'bg-[#FBF8F2] text-[#52483E] border-[#C8BEAA]'
                                  }`}
                                >
                                  <Bookmark className="w-3 h-3" />
                                  {isInterested ? 'Interested' : '+ Interested'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onToggleWatched(item.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer ${
                                    isWatched
                                      ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                                      : 'bg-[#FBF8F2] text-[#171412] border-[#C8BEAA]'
                                  }`}
                                >
                                  {isWatched ? (
                                    <>
                                      <Check className="w-3 h-3" /> Watched
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3 h-3" /> Mark Watched
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Worldwide Live Search Results */}
                    {mediaQuery.trim().length >= 2 && (
                      <div className="pt-1 border-t border-[#D5CCB9] space-y-1">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2A6B53]">
                            Worldwide Catalog
                          </span>
                          {isSearchingLive && (
                            <Loader2 className="w-3 h-3 animate-spin text-[#B8292F]" />
                          )}
                        </div>
                        {liveResults.slice(0, 6).map((live) => {
                          const existing = allMediaItems.find(
                            (m) =>
                              (live.imdbId && m.imdbId === live.imdbId) ||
                              (live.tmdbId > 0 &&
                                m.tmdbId === live.tmdbId &&
                                m.mediaType === live.mediaType)
                          );
                          const isWatched = existing
                            ? watchedIds.includes(existing.id)
                            : false;

                          return (
                            <div
                              key={`${live.source}-${live.id}-${live.imdbId}`}
                              onClick={async () => {
                                if (existing) {
                                  onToggleWatched(existing.id);
                                } else {
                                  await onAddLiveMediaAndWatch(live);
                                  setMediaQuery('');
                                }
                              }}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EFE8DA] cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {live.mediaType === 'MOVIE' ? (
                                  <Film className="w-3.5 h-3.5 text-[#234B6E] shrink-0" />
                                ) : (
                                  <Tv className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" />
                                )}
                                <span className="text-xs font-semibold text-[#171412] truncate">
                                  {live.title} ({live.year})
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border shrink-0 ${
                                  isWatched
                                    ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                                    : 'bg-[#B8292F] text-[#FBF8F2] border-[#8C1D22]'
                                }`}
                              >
                                {isWatched ? (
                                  <>
                                    <Check className="w-3 h-3" /> In Watched
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3" /> Import &amp;
                                    Watch
                                  </>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Current Watched Titles Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#171412]">
                    Saved Watched Titles ({watchedItems.length})
                  </span>
                </div>

                {watchedItems.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#FBF8F2] border border-[#D5CCB9] text-center space-y-2">
                    <p className="text-xs font-semibold text-[#171412]">
                      No watched titles in this profile yet.
                    </p>
                    <p className="text-xs text-[#52483E]">
                      Use the search bar above to add movies and TV shows
                      you&apos;ve watched and generate your personal graph.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {watchedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2.5 p-2 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={
                              item.posterUrl || getPosterFallbackDataUri(item)
                            }
                            alt=""
                            onError={(e) => {
                              const fb = getPosterFallbackDataUri(item);
                              if (e.currentTarget.src !== fb) {
                                e.currentTarget.src = fb;
                              }
                            }}
                            className="w-8 h-11 rounded object-cover border border-[#C8BEAA] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#171412] truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-[#52483E] truncate">
                              {item.year} ·{' '}
                              {item.mediaType === 'MOVIE' ? 'Film' : 'Series'} ·{' '}
                              {item.directors[0] || item.primaryGenre}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleWatched(item.id)}
                          className="p-1.5 rounded hover:bg-[#F5E4E4] text-[#6B5E50] hover:text-[#8C1D22] transition-colors cursor-pointer shrink-0"
                          title="Remove from Watched"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WANT TO WATCH / INTERESTED LIST & GRAPH */}
          {activeTab === 'INTERESTED_GRAPH' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#E6EEF6]/70 border border-[#B6C8DC] space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-heading text-sm font-bold text-[#171412]">
                      Your Want to Watch / Interested Constellation (
                      {interestedItems.length})
                    </h3>
                    <p className="text-xs text-[#52483E]">
                      Save movies and TV shows you want to watch next. Launch{' '}
                      <strong>My Interested Graph</strong> to explore how your
                      watchlist connects in 3D/2D, or combine{' '}
                      <strong>Watched + Interested</strong>!
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMyWatchedGraph('INTERESTED_ONLY');
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#234B6E] hover:bg-[#193854] text-[#FBF8F2] border border-[#193854] cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Open My Interested Graph</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMyWatchedGraph('WATCHED_AND_INTERESTED');
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#171412] border border-[#C8BEAA] cursor-pointer"
                    >
                      <Orbit className="w-3.5 h-3.5 text-[#B8292F]" />
                      <span>Watched + Interested Graph</span>
                    </button>
                  </div>
                </div>

                {interestedGraphStats.totalSharedBridges > 0 && (
                  <div className="pt-1.5 border-t border-[#B6C8DC] flex items-center flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#234B6E] mr-1">
                      Top Bridges in Interested List:
                    </span>
                    {interestedGraphStats.sharedDirectors
                      .slice(0, 3)
                      .map((dir) => (
                        <span
                          key={dir}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]"
                        >
                          <Award className="w-2.5 h-2.5" />
                          {dir}
                        </span>
                      ))}
                    {interestedGraphStats.sharedActors
                      .slice(0, 3)
                      .map((act) => (
                        <span
                          key={act}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F7ECE1] text-[#8A4F0D] border border-[#DFC4A6]"
                        >
                          <UserCheck className="w-2.5 h-2.5" />
                          {act}
                        </span>
                      ))}
                    {interestedGraphStats.sharedTropes.slice(0, 3).map((tr) => (
                      <span
                        key={tr}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E4F0EA] text-[#1E563F] border border-[#B3D4C5]"
                      >
                        <Hash className="w-2.5 h-2.5" />
                        {tr}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Search & Add Any Movie or TV Show to Interested */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#171412]">
                  Add Movies &amp; TV Series to Your Interested / Want to Watch
                  List
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#6B5E50] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={mediaQuery}
                    onChange={(e) => setMediaQuery(e.target.value)}
                    placeholder="Search any movie or TV show to bookmark for later (e.g. Andor, Nosferatu, Anatomy of a Fall)…"
                    className="w-full h-9 pl-8 pr-8 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] focus:border-[#234B6E] focus:outline-none text-xs text-[#171412]"
                  />
                  {mediaQuery && (
                    <button
                      type="button"
                      onClick={() => setMediaQuery('')}
                      className="absolute right-2.5 top-2 text-[#6B5E50] hover:text-[#171412] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {mediaQuery.trim().length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] max-h-56 overflow-y-auto space-y-2">
                    {filteredLocalSearch.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#52483E] px-1">
                          Archive Matches
                        </div>
                        {filteredLocalSearch.map((item) => {
                          const isInterested = interestedIds.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => onToggleInterested(item.id)}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EFE8DA] cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {item.mediaType === 'MOVIE' ? (
                                  <Film className="w-3.5 h-3.5 text-[#234B6E] shrink-0" />
                                ) : (
                                  <Tv className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" />
                                )}
                                <span className="text-xs font-semibold text-[#171412] truncate">
                                  {item.title} ({item.year})
                                </span>
                                <span className="text-[11px] text-[#52483E] truncate">
                                  · {item.directors[0] || item.primaryGenre}
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border shrink-0 ${
                                  isInterested
                                    ? 'bg-[#E6EEF6] text-[#234B6E] border-[#B6C8DC]'
                                    : 'bg-[#FBF8F2] text-[#171412] border-[#C8BEAA]'
                                }`}
                              >
                                <Bookmark className="w-3 h-3" />
                                {isInterested
                                  ? 'In Interested'
                                  : '+ Want to Watch'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Worldwide Live Search Results for Interested */}
                    {mediaQuery.trim().length >= 2 && (
                      <div className="pt-1 border-t border-[#D5CCB9] space-y-1">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#234B6E]">
                            Worldwide Catalog
                          </span>
                          {isSearchingLive && (
                            <Loader2 className="w-3 h-3 animate-spin text-[#234B6E]" />
                          )}
                        </div>
                        {liveResults.slice(0, 6).map((live) => {
                          const existing = allMediaItems.find(
                            (m) =>
                              (live.imdbId && m.imdbId === live.imdbId) ||
                              (live.tmdbId > 0 &&
                                m.tmdbId === live.tmdbId &&
                                m.mediaType === live.mediaType)
                          );
                          const isInterested = existing
                            ? interestedIds.includes(existing.id)
                            : false;

                          return (
                            <div
                              key={`${live.source}-${live.id}-${live.imdbId}`}
                              onClick={async () => {
                                if (existing) {
                                  onToggleInterested(existing.id);
                                } else {
                                  await onAddLiveMediaAndInterest(live);
                                  setMediaQuery('');
                                }
                              }}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EFE8DA] cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {live.mediaType === 'MOVIE' ? (
                                  <Film className="w-3.5 h-3.5 text-[#234B6E] shrink-0" />
                                ) : (
                                  <Tv className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" />
                                )}
                                <span className="text-xs font-semibold text-[#171412] truncate">
                                  {live.title} ({live.year})
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border shrink-0 ${
                                  isInterested
                                    ? 'bg-[#E6EEF6] text-[#234B6E] border-[#B6C8DC]'
                                    : 'bg-[#234B6E] text-[#FBF8F2] border-[#193854]'
                                }`}
                              >
                                <Bookmark className="w-3 h-3" />
                                {isInterested
                                  ? 'In Interested'
                                  : 'Import to Interested'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Current Interested Titles Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#171412]">
                    Saved Want to Watch / Interested Titles (
                    {interestedItems.length})
                  </span>
                </div>

                {interestedItems.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#FBF8F2] border border-[#D5CCB9] text-center space-y-2">
                    <p className="text-xs font-semibold text-[#171412]">
                      Your Want to Watch / Interested list is empty.
                    </p>
                    <p className="text-xs text-[#52483E]">
                      Search above or click the{' '}
                      <strong>Interested / Bookmark</strong> button on any film
                      or series card to build your personal Interested graph!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {interestedItems.map((item) => {
                      const isAlsoWatched = watchedIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2.5 p-2 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={
                                item.posterUrl || getPosterFallbackDataUri(item)
                              }
                              alt=""
                              onError={(e) => {
                                const fb = getPosterFallbackDataUri(item);
                                if (e.currentTarget.src !== fb) {
                                  e.currentTarget.src = fb;
                                }
                              }}
                              className="w-8 h-11 rounded object-cover border border-[#C8BEAA] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#171412] truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-[#52483E] truncate">
                                {item.year} ·{' '}
                                {item.mediaType === 'MOVIE' ? 'Film' : 'Series'}{' '}
                                · {item.directors[0] || item.primaryGenre}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!isAlsoWatched && (
                              <button
                                type="button"
                                onClick={() => {
                                  onToggleWatched(item.id);
                                  onToggleInterested(item.id);
                                }}
                                className="px-2 py-1 rounded text-[10px] font-semibold bg-[#E4F0EA] hover:bg-[#2A6B53] text-[#1E563F] hover:text-[#FBF8F2] border border-[#B3D4C5] transition-colors cursor-pointer"
                                title="Move to Watched"
                              >
                                Move to Watched
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onToggleInterested(item.id)}
                              className="p-1.5 rounded hover:bg-[#F5E4E4] text-[#6B5E50] hover:text-[#8C1D22] transition-colors cursor-pointer"
                              title="Remove from Interested"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SWITCH USER / CLOUD SYNC */}
          {activeTab === 'SWITCH_SYNC' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm font-bold text-[#171412]">
                    Saved User Profiles ({savedProfiles.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(true);
                      setProfileSubMode('EDIT_OR_CREATE');
                      setActiveTab('PROFILE');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-[#B8292F] text-[#FBF8F2] cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Create New User</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {savedProfiles.map((prof) => {
                    const isCurrent = activeUser?.id === prof.id;
                    return (
                      <div
                        key={prof.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                          isCurrent
                            ? 'bg-[#F5E4E4]/50 border-[#B8292F]'
                            : 'bg-[#FBF8F2] border-[#C8BEAA]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-[#FBF8F2] font-heading font-bold text-xs shrink-0"
                            style={{ backgroundColor: prof.avatarColor }}
                          >
                            {prof.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[#171412] truncate">
                                {prof.displayName}
                              </span>
                              <span className="text-[11px] font-tabular text-[#52483E]">
                                @{prof.handle}
                              </span>
                              {prof.hasPinOrPassword && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E6EEF6] text-[#234B6E]">
                                  <Lock className="w-2.5 h-2.5" /> Protected
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#B8292F] text-[#FBF8F2]">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#52483E] font-tabular">
                              {prof.watchedIds?.length || 0} Watched ·{' '}
                              {prof.interestedIds?.length || 0} Interested ·
                              Region: {prof.preferredRegion}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => onSwitchUser(prof)}
                              className="px-2.5 py-1 rounded text-xs font-semibold bg-[#EFE8DA] hover:bg-[#B8292F] text-[#171412] hover:text-[#FBF8F2] border border-[#C8BEAA] transition-colors cursor-pointer"
                            >
                              Switch
                            </button>
                          )}
                          <HoldToDeleteButton
                            profileName={prof.displayName}
                            onConfirm={() => onDeleteProfile(prof.id)}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Guest Mode Option */}
                  <div
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border ${
                      !activeUser
                        ? 'bg-[#EFE8DA] border-[#8F816B]'
                        : 'bg-[#FBF8F2] border-[#C8BEAA]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-[#171412]">
                        Browse as Guest
                      </div>
                      <div className="text-[11px] text-[#52483E]">
                        Explore the cinema constellation freely without saving changes to a profile.
                      </div>
                    </div>
                    {activeUser && (
                      <button
                        type="button"
                        onClick={() => onSwitchUser(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EFE8DA] hover:bg-[#171412] text-[#171412] hover:text-[#FBF8F2] border border-[#C8BEAA] transition-colors cursor-pointer"
                      >
                        Use Guest Mode
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Restore profile from another device */}
              <div className="p-4 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] space-y-2.5">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-[#2A6B53]" />
                  <h4 className="text-xs font-bold text-[#171412]">
                    Restore Profile from Another Device
                  </h4>
                </div>
                <p className="text-[11px] text-[#52483E]">
                  Already have an account? Enter your username or email address to sync it to this browser.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={cloudHandleInput}
                    onChange={(e) => {
                      setCloudHandleInput(e.target.value);
                      setCloudNeedsPin(false);
                    }}
                    placeholder="Username or email (e.g. @alex)"
                    className="flex-1 min-w-[180px] h-9 px-3 rounded-lg bg-[#F6F1E7] border border-[#C8BEAA] text-xs text-[#171412] focus:outline-none focus:border-[#B8292F]"
                  />
                  {(cloudNeedsPin || cloudPinInput) && (
                    <input
                      type="password"
                      value={cloudPinInput}
                      onChange={(e) => setCloudPinInput(e.target.value)}
                      placeholder="Password or PIN"
                      className="w-44 h-9 px-3 rounded-lg bg-[#F6F1E7] border border-[#234B6E] text-xs text-[#171412] focus:outline-none"
                    />
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!cloudHandleInput.trim()) return;
                      setCloudStatusMsg('Looking up profile…');
                      const res = await onLoadCloudProfile(
                        cloudHandleInput,
                        cloudPinInput || undefined
                      );
                      if (res.ok) {
                        setCloudNeedsPin(false);
                        setCloudPinInput('');
                        setCloudStatusMsg(
                          `Restored profile "${cloudHandleInput.trim()}"!`
                        );
                      } else if (res.requiresAuth) {
                        setCloudNeedsPin(true);
                        setCloudStatusMsg(
                          res.error ||
                            'This profile requires a password. Please enter it above and click Restore.'
                        );
                      } else {
                        setCloudStatusMsg(
                          res.error ||
                            `No profile found for "${cloudHandleInput.trim()}".`
                        );
                      }
                    }}
                    className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-[#234B6E] hover:bg-[#193854] text-[#FBF8F2] transition-colors cursor-pointer shrink-0"
                  >
                    Restore Profile
                  </button>
                </div>
                {cloudStatusMsg && (
                  <p
                    className={`text-[11px] font-semibold ${
                      cloudNeedsPin ? 'text-[#8C1D22]' : 'text-[#2A6B53]'
                    }`}
                  >
                    {cloudStatusMsg}
                  </p>
                )}
              </div>

              {/* Export / Import JSON Backup */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {activeUser && (
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#171412] border border-[#C8BEAA] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#234B6E]" />
                    <span>Export Profile JSON</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowImportBox((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#171412] border border-[#C8BEAA] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#2A6B53]" />
                  <span>Import Profile JSON</span>
                </button>
              </div>

              {showImportBox && (
                <div className="space-y-2 p-3 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA]">
                  <textarea
                    rows={3}
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder="Paste exported SixDegrees profile JSON here…"
                    className="w-full p-2 rounded bg-[#F6F1E7] border border-[#C8BEAA] text-xs font-mono text-[#171412] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const ok = onImportProfileJson(importJsonText);
                      if (ok) {
                        setImportJsonText('');
                        setShowImportBox(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-[#2A6B53] text-[#FBF8F2] cursor-pointer"
                  >
                    Restore from JSON
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
