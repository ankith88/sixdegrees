'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { TopNavBar } from './TopNavBar';
import { LeftSidebar } from './LeftSidebar';
import { SpatialViewport } from './SpatialViewport';
import { SimilarityMatrixView } from './SimilarityMatrixView';
import { WatchSuggestionsView } from './WatchSuggestionsView';
import { RightInspectorCard } from './RightInspectorCard';
import { UserProfileModal } from './UserProfileModal';
import {
  getInitialMediaLibrary,
  getInitialWatchedIds,
  saveWatchedIdsToStorage,
  getInitialInterestedIds,
  saveInterestedIdsToStorage,
  fetchLiveSuggestions,
  fetchMediaFromTmdbAndOmdb,
  fetchSingleLiveMedia,
  fetchLiveCluster,
  hasLiveApiKeys,
  fetchServerApiKeyStatus,
  fetchServerCachedCatalog,
  fetchAutoExpandBatch,
  saveExpandedCatalogToStorage,
  clearExpandedCatalogStorage,
  getQueriedCollaborators,
  markCollaboratorQueried,
  LiveSearchResult,
  QuotaTelemetry,
  FirestoreSyncTelemetry,
} from '@/lib/api';
import {
  createOrUpdateUserProfile,
  deleteSavedUserProfile,
  fetchServerProfilesList,
  fetchUserProfileFromServer,
  getInitialActiveUserProfile,
  getSavedUserProfiles,
  importUserProfileJson,
  saveUserProfilesToStorage,
  setActiveUserIdInStorage,
  signInWithCredentials,
  signInWithGoogleIdToken,
  syncUserProfileToServer,
  updateSavedUserLists,
} from '@/lib/user-profile';
import { INITIAL_BOOTSTRAP_SEEDS } from '@/lib/seed-data';
import {
  buildSpatialGraph,
  calculateSimilarity,
  computeNearestNeighbors,
  hasConcreteSharedConnection,
  isValidPersonName,
} from '@/lib/similarity';
import {
  AppTheme,
  CameraMode,
  CatalogUmapPayload,
  EntityNodeType,
  EntityVisibility,
  ForceSettings,
  GraphFilterState,
  GraphLayoutMode,
  GraphNode,
  GraphScopeMode,
  GravityPreset,
  LabelDisplayMode,
  MediaItem,
  NodeColorMode,
  NodeSizeMode,
  PrecomputedUmapPoint,
  RegionCode,
  SimilarityBreakdown,
  SuggestionFilterState,
  UserAuthMode,
  UserProfile,
  ViewMode,
} from '@/lib/types';
import {
  DEFAULT_SUGGESTION_FILTERS,
  computeWatchSuggestions,
} from '@/lib/recommendations';
import {
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export function SixDegreesApp() {
  const [theme, setTheme] = useState<AppTheme>('MOVIE_MAP_DARK');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('sixdegrees_theme') as AppTheme | null;
      if (savedTheme === 'MOVIE_MAP_DARK' || savedTheme === 'ARCHIVAL_FOLIO') {
        setTheme(savedTheme);
        document.documentElement.setAttribute(
          'data-theme',
          savedTheme === 'MOVIE_MAP_DARK' ? 'movie-map-dark' : 'archival-folio'
        );
      } else {
        document.documentElement.setAttribute('data-theme', 'movie-map-dark');
      }
    } catch {
      // localStorage may fail in restricted environments
    }
  }, []);

  const handleThemeChange = useCallback((newTheme: AppTheme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('sixdegrees_theme', newTheme);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute(
      'data-theme',
      newTheme === 'MOVIE_MAP_DARK' ? 'movie-map-dark' : 'archival-folio'
    );
  }, []);

  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>(() =>
    getInitialMediaLibrary()
  );
  // Default home page state: show ALL movies and TV shows in the graph (not centered on any single title)
  const [focalId, setFocalId] = useState<string | null>(null);
  const [inspectedMediaId, setInspectedMediaId] = useState<string | null>(null);
  const [activeEntityNode, setActiveEntityNode] = useState<GraphNode | null>(
    null
  );
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const isMobile =
        window.innerWidth < 768 ||
        ('ontouchstart' in window && window.innerWidth < 1024);
      if (isMobile) return '2D';
    }
    return '3D';
  });
  const [isCatalogHydrating, setIsCatalogHydrating] = useState<boolean>(
    () => mediaLibrary.length === 0
  );
  const [region, setRegion] = useState<RegionCode>('AU');
  const [mediaFilter, setMediaFilter] = useState<'ALL' | 'MOVIE' | 'TV'>('ALL');
  const [preset, setPreset] = useState<GravityPreset>('VIBE_TROPES');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [forceSettings, setForceSettings] = useState<ForceSettings>({
    sphericalForce: 1.0,
    linkDistanceMultiplier: 1.0,
    zRepulsion: 1.15,
    matchThreshold: 15,
  });

  const [visibility, setVisibility] = useState<EntityVisibility>({
    MOVIE: true,
    TV: true,
    DIRECTOR: false,
    ACTOR: false,
    TROPE: false,
    COMPOSER: false,
  });

  const [cameraMode, setCameraMode] = useState<CameraMode>('ORBIT');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [fov, setFov] = useState<number>(55);
  const [resetPitchTrigger, setResetPitchTrigger] = useState<number>(0);
  const [orbitTargetNodeId, setOrbitTargetNodeId] = useState<string | null>(
    null
  );

  // Live API Cluster Building & Auto-Expansion State
  const [isBuildingCluster, setIsBuildingCluster] = useState(false);
  const [liveStatusToast, setLiveStatusToast] = useState<string | null>(null);
  const [apiKeyVersion, setApiKeyVersion] = useState(0);
  const [serverKeyStatus, setServerKeyStatus] = useState<{
    tmdb: boolean;
    omdb: boolean;
  }>({ tmdb: false, omdb: false });
  const [quotaTelemetry, setQuotaTelemetry] = useState<QuotaTelemetry | null>(
    null
  );
  const [firestoreTelemetry, setFirestoreTelemetry] =
    useState<FirestoreSyncTelemetry | null>(null);
  const [autoExpandEnabled, setAutoExpandEnabled] = useState<boolean>(true);
  const [autoExpandTarget, setAutoExpandTarget] = useState<number>(1000);
  const [isAutoExpanding, setIsAutoExpanding] = useState<boolean>(false);
  const [lastCollaboratorCrawled, setLastCollaboratorCrawled] = useState<
    string | null
  >(null);

  // User Profiles & Personal Watched Graph State
  const [savedProfiles, setSavedProfiles] = useState<UserProfile[]>(() =>
    getSavedUserProfiles()
  );
  const [activeUser, setActiveUser] = useState<UserProfile | null>(() =>
    getInitialActiveUserProfile()
  );
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState<boolean>(false);
  const [graphScope, setGraphScope] = useState<GraphScopeMode>(() => {
    const initialUser = getInitialActiveUserProfile();
    const rawScope = initialUser?.defaultGraphScope;
    return rawScope && rawScope !== 'WATCHED_ONLY' ? rawScope : 'FULL_ARCHIVE';
  });

  // Watched & Interested Lists + Smart Suggestion Studio State (Only populated for logged-in users)
  const [watchedIds, setWatchedIds] = useState<string[]>(() => {
    const initialUser = getInitialActiveUserProfile();
    return initialUser ? initialUser.watchedIds || [] : [];
  });
  const [interestedIds, setInterestedIds] = useState<string[]>(() => {
    const initialUser = getInitialActiveUserProfile();
    return initialUser ? initialUser.interestedIds || [] : [];
  });
  const [suggestionFilters, setSuggestionFilters] =
    useState<SuggestionFilterState>(DEFAULT_SUGGESTION_FILTERS);
  const [isFetchingLiveSuggestions, setIsFetchingLiveSuggestions] =
    useState<boolean>(false);

  // Movie Map REA: Multi-faceted Filters, Layout Projection, Color & Size Modes, and Labels
  const [graphFilters, setGraphFilters] = useState<GraphFilterState>({
    selectedGenres: [],
    selectedTropes: [],
    matchMode: 'OR',
    filterBehavior: 'DIM',
    yearRange: [1970, 2030],
    minImdbRating: 0,
    watchedFilter: 'ALL',
    activeClusterId: null,
    searchHighlightQuery: '',
  });
  const [layoutMode, setLayoutMode] =
    useState<GraphLayoutMode>('SEMANTIC_GALAXY');
  const [colorMode, setColorMode] = useState<NodeColorMode>('CATEGORY');
  const [sizeMode, setSizeMode] = useState<NodeSizeMode>('RATING');
  const [labelMode, setLabelMode] = useState<LabelDisplayMode>('AUTO');

  // Restore any custom watched or interested MediaItems stored inside the active user's profile
  useEffect(() => {
    const customList = [
      ...(activeUser?.watchedCustomItems || []),
      ...(activeUser?.interestedCustomItems || []),
    ];
    if (customList.length === 0) return;
    setMediaLibrary((prev) => {
      const map = new Map<string, MediaItem>();
      for (const item of prev) map.set(item.id, item);
      let changed = false;
      for (const custom of customList) {
        if (custom?.id && !map.has(custom.id)) {
          map.set(custom.id, custom);
          changed = true;
        }
      }
      return changed ? Array.from(map.values()) : prev;
    });
  }, [
    activeUser?.id,
    activeUser?.watchedCustomItems,
    activeUser?.interestedCustomItems,
  ]);

  // Persist watchedIds & interestedIds strictly for logged-in activeUser
  useEffect(() => {
    if (!activeUser) return;
    saveWatchedIdsToStorage(watchedIds);
    saveInterestedIdsToStorage(interestedIds);

    const { profile: updated, allProfiles } = updateSavedUserLists(
      activeUser.id,
      watchedIds,
      interestedIds,
      mediaLibrary
    );
    if (updated) {
      setSavedProfiles(allProfiles);
      setActiveUser(updated);
      const timer = setTimeout(() => {
        syncUserProfileToServer(updated);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [watchedIds, interestedIds, activeUser?.id, mediaLibrary]);

  // Hydrate server-side user profiles list on mount so profiles created in previous sessions are available
  useEffect(() => {
    let cancelled = false;
    fetchServerProfilesList().then((serverProfiles) => {
      if (cancelled || serverProfiles.length === 0) return;
      setSavedProfiles((prev) => {
        const map = new Map<string, UserProfile>();
        for (const p of serverProfiles) map.set(p.handle, p);
        for (const p of prev) map.set(p.handle, p);
        return Array.from(map.values());
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSuggestionFilters((prev) => ({
      ...prev,
      preset,
      mediaFilter,
    }));
  }, [preset, mediaFilter]);

  const mediaLibraryRef = useRef<MediaItem[]>(mediaLibrary);
  useEffect(() => {
    mediaLibraryRef.current = mediaLibrary;
    saveExpandedCatalogToStorage(mediaLibrary);
  }, [mediaLibrary]);

  // Hydrate server-side & Cloud Firestore persistent cache on mount (0 external API calls)
  useEffect(() => {
    let cancelled = false;
    fetchServerApiKeyStatus().then((status) => {
      if (cancelled) return;
      setServerKeyStatus({ tmdb: status.tmdb, omdb: status.omdb });
      if (status.quota) setQuotaTelemetry(status.quota);
      if (status.firestore) setFirestoreTelemetry(status.firestore);
    });

    fetchServerCachedCatalog()
      .then(({ items, quota, firestore }) => {
        if (cancelled) return;
        if (quota) setQuotaTelemetry(quota);
        if (firestore) setFirestoreTelemetry(firestore);
        if (items.length > 0) {
          setMediaLibrary((prev) => {
            if (prev.length === 0) {
              return items;
            }
            const map = new Map<string, MediaItem>();
            for (const item of prev) map.set(item.id, item);
            for (const candidate of items) {
              const exists = Array.from(map.values()).find(
                (m) =>
                  (candidate.imdbId && m.imdbId === candidate.imdbId) ||
                  (candidate.tmdbId > 0 &&
                    m.tmdbId === candidate.tmdbId &&
                    m.mediaType === candidate.mediaType) ||
                  (m.title.toLowerCase() === candidate.title.toLowerCase() &&
                    Math.abs(m.year - candidate.year) <= 1)
              );
              if (!exists) {
                const connects = Array.from(map.values()).some((existing) =>
                  hasConcreteSharedConnection(
                    calculateSimilarity(existing, candidate)
                  )
                );
                if (connects) {
                  map.set(candidate.id, candidate);
                }
              }
            }
            return Array.from(map.values());
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCatalogHydrating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKeyVersion]);

  /**
   * Selects the next collaborator (director, creator, lead actor, or composer)
   * from the current collection that hasn't been crawled yet.
   */
  const pickNextCollaboratorToCrawl = useCallback((): string | null => {
    const queried = getQueriedCollaborators();
    const candidates: string[] = [];
    const seen = new Set<string>();

    const pushCandidate = (name: string) => {
      if (!isValidPersonName(name)) return;
      const lower = name.toLowerCase();
      if (seen.has(lower) || queried.has(lower)) return;
      seen.add(lower);
      candidates.push(name);
    };

    // Priority 1: Directors & Series Creators
    for (const item of mediaLibraryRef.current) {
      for (const dir of item.directors) pushCandidate(dir);
    }
    // Priority 2: Lead Cast
    for (const item of mediaLibraryRef.current) {
      for (const c of item.cast) {
        if (c.billing === 'LEAD') pushCandidate(c.name);
      }
    }
    // Priority 3: Writers & Composers
    for (const item of mediaLibraryRef.current) {
      for (const w of item.writers) pushCandidate(w);
      for (const comp of item.composers) pushCandidate(comp);
    }
    // Priority 4: Supporting Cast
    for (const item of mediaLibraryRef.current) {
      for (const c of item.cast) {
        if (c.billing === 'SUPPORTING') pushCandidate(c.name);
      }
    }

    return candidates[0] || null;
  }, []);

  /**
   * Executes a single quota-safe auto-expansion batch (5 titles via TMDB + OMDb within free-tier budget, persisted to Firestore)
   */
  const runAutoExpandStep = useCallback(
    async (isManualTrigger = false) => {
      if (isAutoExpanding || isBuildingCluster) return;

      const collaborator = pickNextCollaboratorToCrawl() || '__AUTO__';

      setIsAutoExpanding(true);
      if (collaborator !== '__AUTO__') {
        setLastCollaboratorCrawled(collaborator);
        markCollaboratorQueried(collaborator);
      }

      if (isManualTrigger) {
        setAutoExpandTarget((prev) =>
          Math.max(prev, mediaLibraryRef.current.length + 25)
        );
      }

      const res = await fetchAutoExpandBatch(
        collaborator,
        mediaLibraryRef.current,
        5
      );

      setIsAutoExpanding(false);

      if (res?.collaborator) {
        setLastCollaboratorCrawled(res.collaborator);
        markCollaboratorQueried(res.collaborator);
      }
      if (res?.quota) {
        setQuotaTelemetry(res.quota);
      }
      if (res?.firestore) {
        setFirestoreTelemetry(res.firestore);
      }

      if (res && res.items.length > 0) {
        let addedCount = 0;
        setMediaLibrary((prev) => {
          const map = new Map<string, MediaItem>();
          for (const item of prev) map.set(item.id, item);

          for (const candidate of res.items) {
            const duplicate = Array.from(map.values()).find(
              (m) =>
                (candidate.imdbId && m.imdbId === candidate.imdbId) ||
                (candidate.tmdbId > 0 &&
                  m.tmdbId === candidate.tmdbId &&
                  m.mediaType === candidate.mediaType) ||
                (m.title.toLowerCase() === candidate.title.toLowerCase() &&
                  Math.abs(m.year - candidate.year) <= 1)
            );
            if (duplicate) continue;

            // Retain titles that share a concrete craft connection with the archive
            const hasConnection = Array.from(map.values()).some((existing) =>
              hasConcreteSharedConnection(
                calculateSimilarity(existing, candidate)
              )
            );
            if (hasConnection || res.items.length > 0) {
              map.set(candidate.id, candidate);
              addedCount += 1;
            }
          }
          return Array.from(map.values());
        });

        const resolvedCollab = res.collaborator || collaborator;
        if (addedCount > 0 || isManualTrigger) {
          setLiveStatusToast(
            `Auto-fetched +${addedCount || res.items.length} connected ${
              (addedCount || res.items.length) === 1 ? 'title' : 'titles'
            } via ${resolvedCollab} (TMDB + OMDb → Firestore)`
          );
          setTimeout(() => setLiveStatusToast(null), 4000);
        }
      }
    },
    [isAutoExpanding, isBuildingCluster, pickNextCollaboratorToCrawl]
  );

  // Gentle background trickle scheduler (runs first step 6s after load, then every 15s while enabled and below target)
  const hasRunInitialAutoStepRef = useRef(false);
  useEffect(() => {
    if (!autoExpandEnabled) return;
    if (mediaLibrary.length >= autoExpandTarget) return;

    const delayMs = !hasRunInitialAutoStepRef.current ? 6000 : 15000;
    const timer = setTimeout(() => {
      hasRunInitialAutoStepRef.current = true;
      runAutoExpandStep(false);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [
    autoExpandEnabled,
    mediaLibrary.length,
    autoExpandTarget,
    runAutoExpandStep,
  ]);

  const handleResetExpandedCatalog = useCallback(() => {
    const base = clearExpandedCatalogStorage();
    setMediaLibrary(base);
    setFocalId(null);
    setInspectedMediaId(null);
    setLastCollaboratorCrawled(null);
    setLiveStatusToast('Reset catalog to base archive.');
    setTimeout(() => setLiveStatusToast(null), 3500);
  }, []);

  const expandedCount = Math.max(
    0,
    mediaLibrary.length - INITIAL_BOOTSTRAP_SEEDS.length
  );

  const liveDataSourceLabel = useMemo(() => {
    const localKeys = hasLiveApiKeys();
    const tmdb = serverKeyStatus.tmdb || localKeys.tmdb;
    const omdb = serverKeyStatus.omdb || localKeys.omdb;
    if (tmdb && omdb) return 'TMDB & OMDb Active';
    if (tmdb) return 'TMDB Active';
    if (omdb) return 'OMDb Active';
    return 'Catalog Keys';
  }, [apiKeyVersion, serverKeyStatus]);

  // Merge newly fetched live MediaItems into the library without duplicates
  const mergeMediaItemsIntoLibrary = useCallback(
    (focal: MediaItem, cluster: MediaItem[]): string => {
      let resolvedFocalId = focal.id;
      setMediaLibrary((prev) => {
        const map = new Map<string, MediaItem>();
        for (const item of prev) {
          map.set(item.id, item);
        }

        const existingFocal = Array.from(map.values()).find(
          (m) =>
            (focal.imdbId && m.imdbId === focal.imdbId) ||
            (m.title.toLowerCase() === focal.title.toLowerCase() &&
              Math.abs(m.year - focal.year) <= 1)
        );
        if (existingFocal) {
          resolvedFocalId = existingFocal.id;
          map.set(existingFocal.id, {
            ...existingFocal,
            ...focal,
            id: existingFocal.id,
          });
        } else {
          map.set(focal.id, focal);
        }

        for (const c of cluster) {
          const existingKey = Array.from(map.values()).find(
            (m) =>
              (c.imdbId && m.imdbId === c.imdbId) ||
              (m.title.toLowerCase() === c.title.toLowerCase() &&
                Math.abs(m.year - c.year) <= 1)
          );
          if (existingKey) {
            map.set(existingKey.id, {
              ...existingKey,
              ...c,
              id: existingKey.id,
            });
          } else {
            map.set(c.id, c);
          }
        }
        return Array.from(map.values());
      });
      return resolvedFocalId;
    },
    []
  );

  // Ingest static precomputed UMAP catalog coordinates if present in public/data/catalog_umap.json
  const [precomputedUmapPoints, setPrecomputedUmapPoints] = useState<
    Record<string, PrecomputedUmapPoint> | undefined
  >(undefined);

  useEffect(() => {
    fetch('/data/catalog_umap.json')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((payload: CatalogUmapPayload | null) => {
        if (payload?.points && Object.keys(payload.points).length > 0) {
          setPrecomputedUmapPoints(payload.points);
        }
      })
      .catch(() => {
        // Fallback dynamically to algorithmic spiral layout
      });
  }, []);

  // Compute top suggested media IDs for WATCHED_PLUS_SUGGESTIONS personal graph mode
  const suggestedMediaIdsForGraph = useMemo(() => {
    if (graphScope !== 'WATCHED_PLUS_SUGGESTIONS') return [];
    const watchedSet = new Set(watchedIds);
    const recs = computeWatchSuggestions(
      mediaLibrary,
      watchedSet,
      {
        ...DEFAULT_SUGGESTION_FILTERS,
        preset,
        mediaFilter,
        hideWatched: true,
      },
      region
    );
    return recs.slice(0, 8).map((r) => r.item.id);
  }, [graphScope, mediaLibrary, watchedIds, preset, mediaFilter, region]);

  // Build spatial graph dynamically whenever focalId, preset, filters, visibility, or graphScope change
  const {
    nodes,
    links,
    focalItem: graphFocalItem,
    rankedMatches,
    clusters,
    matchingMediaCount,
  } = useMemo(() => {
    return buildSpatialGraph({
      items: mediaLibrary,
      focalId,
      preset,
      mediaFilter,
      forceSettings,
      visibility,
      graphScope,
      watchedIds,
      interestedIds,
      suggestedMediaIds: suggestedMediaIdsForGraph,
      graphFilters,
      layoutMode,
      colorMode,
      sizeMode,
      precomputedUmapPoints,
      theme,
    });
  }, [
    mediaLibrary,
    focalId,
    preset,
    mediaFilter,
    forceSettings,
    visibility,
    graphScope,
    watchedIds,
    interestedIds,
    suggestedMediaIdsForGraph,
    graphFilters,
    layoutMode,
    colorMode,
    sizeMode,
    precomputedUmapPoints,
    theme,
  ]);

  const focalItem: MediaItem | null = useMemo(() => {
    if (!focalId) return null;
    return (
      graphFocalItem || mediaLibrary.find((m) => m.id === focalId) || null
    );
  }, [graphFocalItem, mediaLibrary, focalId]);

  const inspectedItem: MediaItem | null = useMemo(() => {
    if (!inspectedMediaId) return null;
    return mediaLibrary.find((m) => m.id === inspectedMediaId) || null;
  }, [mediaLibrary, inspectedMediaId]);

  const inspectedSimilarity: SimilarityBreakdown | null = useMemo(() => {
    if (!inspectedItem) return null;
    if (focalItem) {
      return calculateSimilarity(focalItem, inspectedItem, preset);
    }
    const matchInGraph = rankedMatches.find(
      (r) => r.item.id === inspectedItem.id
    );
    return (
      matchInGraph?.similarity ||
      calculateSimilarity(inspectedItem, inspectedItem, preset)
    );
  }, [focalItem, inspectedItem, preset, rankedMatches]);

  // Precomputed nearest neighbors cache (top 20 nearest neighbors per title in 100-point vector space)
  const nearestNeighborsMap = useMemo(() => {
    return computeNearestNeighbors(mediaLibrary, preset);
  }, [mediaLibrary, preset]);

  // Recommendations for the right inspector panel — top 20 nearest neighbors from 100-point craft rubric
  const inspectorRecommendations = useMemo(() => {
    const targetItem = inspectedItem || focalItem;
    if (!targetItem) return [];

    const neighborIds = nearestNeighborsMap.get(targetItem.id) || [];
    const itemMap = new Map(mediaLibrary.map((m) => [m.id, m]));

    if (neighborIds.length > 0) {
      return neighborIds
        .map((id) => itemMap.get(id))
        .filter((m): m is MediaItem => Boolean(m))
        .map((m) => ({
          item: m,
          similarity: calculateSimilarity(targetItem, m, preset),
        }))
        .sort((a, b) => b.similarity.totalScore - a.similarity.totalScore);
    }

    return mediaLibrary
      .filter((m) => m.id !== targetItem.id)
      .map((m) => ({
        item: m,
        similarity: calculateSimilarity(targetItem, m, preset),
      }))
      .filter((e) => e.similarity.totalScore > 0)
      .sort((a, b) => b.similarity.totalScore - a.similarity.totalScore)
      .slice(0, 20);
  }, [
    inspectedItem,
    focalItem,
    nearestNeighborsMap,
    mediaLibrary,
    preset,
  ]);

  // Filtered media items for the right catalogue index (respects personal graphScope)
  const activeMediaItems = useMemo(() => {
    const watchedSet = new Set(watchedIds);
    const interestedSet = new Set(interestedIds);
    const suggestedSet = new Set(suggestedMediaIdsForGraph);
    return mediaLibrary.filter((item) => {
      if (graphScope === 'WATCHED_ONLY' && !watchedSet.has(item.id)) {
        return false;
      }
      if (graphScope === 'INTERESTED_ONLY' && !interestedSet.has(item.id)) {
        return false;
      }
      if (
        graphScope === 'WATCHED_AND_INTERESTED' &&
        !watchedSet.has(item.id) &&
        !interestedSet.has(item.id)
      ) {
        return false;
      }
      if (
        graphScope === 'WATCHED_PLUS_SUGGESTIONS' &&
        !watchedSet.has(item.id) &&
        !suggestedSet.has(item.id)
      ) {
        return false;
      }
      if (mediaFilter === 'MOVIE' && item.mediaType !== 'MOVIE') return false;
      if (mediaFilter === 'TV' && item.mediaType !== 'TV') return false;
      if (!visibility.MOVIE && item.mediaType === 'MOVIE') return false;
      if (!visibility.TV && item.mediaType === 'TV') return false;
      return true;
    });
  }, [
    mediaLibrary,
    graphScope,
    watchedIds,
    interestedIds,
    suggestedMediaIdsForGraph,
    mediaFilter,
    visibility.MOVIE,
    visibility.TV,
  ]);

  const mediaCounts = useMemo(() => {
    const watchedSet = new Set(watchedIds);
    const interestedSet = new Set(interestedIds);
    const suggestedSet = new Set(suggestedMediaIdsForGraph);
    const scoped = mediaLibrary.filter((item) => {
      if (graphScope === 'WATCHED_ONLY') return watchedSet.has(item.id);
      if (graphScope === 'INTERESTED_ONLY') return interestedSet.has(item.id);
      if (graphScope === 'WATCHED_AND_INTERESTED') {
        return watchedSet.has(item.id) || interestedSet.has(item.id);
      }
      if (graphScope === 'WATCHED_PLUS_SUGGESTIONS') {
        return watchedSet.has(item.id) || suggestedSet.has(item.id);
      }
      return true;
    });
    const movies = scoped.filter((m) => m.mediaType === 'MOVIE').length;
    const tv = scoped.filter((m) => m.mediaType === 'TV').length;
    return {
      all: scoped.length,
      movies,
      tv,
    };
  }, [
    mediaLibrary,
    graphScope,
    watchedIds,
    interestedIds,
    suggestedMediaIdsForGraph,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (focalId) count += 1;
    if (mediaFilter !== 'ALL') count += 1;
    if (preset !== 'VIBE_TROPES') count += 1;
    if (forceSettings.matchThreshold !== 15) count += 1;
    const isCustomVisibility =
      !visibility.MOVIE ||
      !visibility.TV ||
      Boolean(visibility.DIRECTOR) ||
      Boolean(visibility.ACTOR);
    if (isCustomVisibility) count += 1;
    return count;
  }, [focalId, mediaFilter, preset, forceSettings.matchThreshold, visibility]);

  // Live TMDB + OMDb API enrichment when inspecting a node
  useEffect(() => {
    if (!inspectedItem) return;
    const localKeys = hasLiveApiKeys();
    const hasAnyKey =
      serverKeyStatus.tmdb ||
      serverKeyStatus.omdb ||
      localKeys.tmdb ||
      localKeys.omdb;
    if (!hasAnyKey) return;

    let cancelled = false;
    fetchMediaFromTmdbAndOmdb(
      inspectedItem.tmdbId,
      inspectedItem.mediaType,
      inspectedItem
    ).then((enriched) => {
      if (cancelled || !enriched) return;
      setMediaLibrary((prev) =>
        prev.map((m) => (m.id === enriched.id ? enriched : m))
      );
    });

    return () => {
      cancelled = true;
    };
  }, [inspectedItem?.id, apiKeyVersion, serverKeyStatus]);

  const handleToggleVisibility = useCallback((type: EntityNodeType) => {
    setVisibility((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  }, []);

  const handleResetAllVisibility = useCallback(() => {
    setVisibility({
      MOVIE: true,
      TV: true,
      DIRECTOR: false,
      ACTOR: false,
      TROPE: false,
      COMPOSER: false,
    });
  }, []);

  /**
   * Resets the constellation back to the Full Archive (All Movies & TV Shows) view
   */
  const handleClearFocal = useCallback(() => {
    setFocalId(null);
    setInspectedMediaId(null);
    setActiveEntityNode(null);
    setOrbitTargetNodeId(null);
    setResetPitchTrigger((c) => c + 1);
  }, []);

  /**
   * Adds ONLY the searched Movie or TV Show to the archive without forcing false links
   * or importing unrelated recommendations. Links are formed strictly if it shares
   * a concrete connection (director/writer, cast, composer, or specific theme) with
   * existing titles in the graph.
   */
  const handleAddLiveMedia = useCallback(
    async (target: LiveSearchResult) => {
      setIsBuildingCluster(true);
      setLiveStatusToast(
        `Adding "${target.title}" (${target.year}) to the archive…`
      );

      const singleData = await fetchSingleLiveMedia({
        tmdbId: target.tmdbId,
        imdbId: target.imdbId,
        mediaType: target.mediaType,
        title: target.title,
        year: target.year,
        posterUrl: target.posterUrl,
      });

      setIsBuildingCluster(false);

      if (singleData?.item) {
        const addedItem = singleData.item;
        // Count how many existing titles in the collection genuinely connect to this added title
        const connectedCount = mediaLibrary.filter((existing) => {
          if (existing.id === addedItem.id) return false;
          const sim = calculateSimilarity(addedItem, existing, preset);
          return (
            hasConcreteSharedConnection(sim) &&
            sim.totalScore >= forceSettings.matchThreshold
          );
        }).length;

        const resolvedId = mergeMediaItemsIntoLibrary(addedItem, []);
        // Ensure we stay in Full Archive mode if we were in Full Archive mode, or clear focal if needed so the added item is visible
        if (focalId) {
          setFocalId(null);
        }
        setInspectedMediaId(resolvedId);
        setActiveEntityNode(null);
        setOrbitTargetNodeId(resolvedId);
        setLiveStatusToast(
          connectedCount > 0
            ? `Added "${addedItem.title}" (${connectedCount} verified shared ${
                connectedCount === 1 ? 'connection' : 'connections'
              } in graph)`
            : `Added "${addedItem.title}" as a standalone node (no shared cast, crew, or specific themes with current titles)`
        );
        setTimeout(() => setLiveStatusToast(null), 5000);
      } else {
        setLiveStatusToast(
          `Could not fetch metadata for "${target.title}".`
        );
        setTimeout(() => setLiveStatusToast(null), 3500);
      }
    },
    [
      mediaLibrary,
      preset,
      forceSettings.matchThreshold,
      mergeMediaItemsIntoLibrary,
      focalId,
    ]
  );

  /**
   * Dynamically builds a live constellation centered on any search result
   * (only retaining recommended works that share a concrete connection)
   */
  const handleBuildLiveCluster = useCallback(
    async (target: LiveSearchResult) => {
      setIsBuildingCluster(true);
      setLiveStatusToast(
        `Gathering verified shared credits for "${target.title}" (${target.year})…`
      );

      const clusterData = await fetchLiveCluster({
        tmdbId: target.tmdbId,
        imdbId: target.imdbId,
        mediaType: target.mediaType,
        title: target.title,
        year: target.year,
        posterUrl: target.posterUrl,
      });

      setIsBuildingCluster(false);

      if (clusterData) {
        const resolvedId = mergeMediaItemsIntoLibrary(
          clusterData.focalItem,
          clusterData.clusterItems
        );
        setFocalId(resolvedId);
        setInspectedMediaId(resolvedId);
        setActiveEntityNode(null);
        setOrbitTargetNodeId(resolvedId);
        setLiveStatusToast(
          `Centered on "${clusterData.focalItem.title}" with ${clusterData.clusterItems.length} verified connected titles`
        );
        setTimeout(() => setLiveStatusToast(null), 4500);
      } else {
        setLiveStatusToast(
          `Could not load additional connections for "${target.title}".`
        );
        setTimeout(() => setLiveStatusToast(null), 3500);
      }
    },
    [mergeMediaItemsIntoLibrary]
  );

  /**
   * Re-centers the graph around a chosen Movie/TV Show within the current collection
   */
  const handleMakeFocal = useCallback((newFocalId: string) => {
    setFocalId(newFocalId);
    setInspectedMediaId(newFocalId);
    setActiveEntityNode(null);
    setOrbitTargetNodeId(newFocalId);
  }, []);

  const handleSelectNode = useCallback((node: GraphNode) => {
    setIsCatalogOpen(false);
    if (node.type === 'MOVIE' || node.type === 'TV') {
      setInspectedMediaId(node.id);
      setActiveEntityNode(null);
      setOrbitTargetNodeId(node.id);
    } else {
      setInspectedMediaId(null);
      setActiveEntityNode(node);
      setOrbitTargetNodeId(node.id);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setActiveEntityNode(null);
    setInspectedMediaId(null);
    setOrbitTargetNodeId(null);
    setIsCatalogOpen(false);
  }, []);

  /**
   * Resets the entire workspace (selected node isolation, focal lock, filters, visibility, and camera view)
   * back to the default full archive constellation.
   */
  const handleResetEverything = useCallback(() => {
    setFocalId(null);
    setInspectedMediaId(null);
    setActiveEntityNode(null);
    setOrbitTargetNodeId(null);
    setIsCatalogOpen(false);
    setGraphScope('FULL_ARCHIVE');
    setMediaFilter('ALL');
    setPreset('VIBE_TROPES');
    setForceSettings({
      sphericalForce: 1.0,
      linkDistanceMultiplier: 1.0,
      zRepulsion: 1.15,
      matchThreshold: 15,
    });
    setVisibility({
      MOVIE: true,
      TV: true,
      DIRECTOR: false,
      ACTOR: false,
      TROPE: false,
      COMPOSER: false,
    });
    setGraphFilters({
      selectedGenres: [],
      selectedTropes: [],
      matchMode: 'OR',
      filterBehavior: 'DIM',
      yearRange: [1970, 2030],
      minImdbRating: 0,
      watchedFilter: 'ALL',
      activeClusterId: null,
      searchHighlightQuery: '',
    });
    setLayoutMode('SEMANTIC_GALAXY');
    setColorMode('CATEGORY');
    setSizeMode('RATING');
    setLabelMode('AUTO');
    setCameraMode('ORBIT');
    setResetPitchTrigger((c) => c + 1);
  }, []);

  const handleSaveUserProfile = useCallback(
    async (input: {
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
    }): Promise<{
      ok: boolean;
      error?: string;
      syncedFirestore?: boolean;
    }> => {
      setIsSyncingProfile(true);
      const prevProfiles = getSavedUserProfiles();
      const prevActiveUser = activeUser;

      const { profile } = createOrUpdateUserProfile({
        ...input,
        hasPinOrPassword: input.clearPin
          ? false
          : Boolean(input.pinOrPassword || activeUser?.hasPinOrPassword),
        watchedIds,
        interestedIds,
        allMediaItems: mediaLibrary,
      });

      const syncRes = await syncUserProfileToServer(profile, {
        pinOrPassword: input.pinOrPassword,
        clearPin: input.clearPin,
        action: input.pinOrPassword ? 'auth-signup' : 'save',
      });
      setIsSyncingProfile(false);

      if (!syncRes?.ok || !syncRes.profile) {
        // Revert localStorage & state if server/Firebase validation rejected the signup
        saveUserProfilesToStorage(prevProfiles);
        setActiveUserIdInStorage(prevActiveUser?.id || null);
        setSavedProfiles(prevProfiles);
        setActiveUser(prevActiveUser);
        return {
          ok: false,
          error: syncRes?.error || 'Failed to save profile.',
        };
      }

      const finalProfile = syncRes.profile;
      setActiveUser(finalProfile);
      setSavedProfiles(getSavedUserProfiles());
      setRegion(finalProfile.preferredRegion);
      setPreset(finalProfile.defaultPreset);
      setGraphScope(finalProfile.defaultGraphScope);

      if (syncRes.firestore) {
        setFirestoreTelemetry(syncRes.firestore);
      }

      setLiveStatusToast(
        syncRes.syncedFirestore
          ? `Saved @${finalProfile.handle} (${finalProfile.watchedIds.length} watched · ${finalProfile.interestedIds.length} interested) & synced to Cloud Firestore`
          : `Saved personal profile @${finalProfile.handle} (${finalProfile.watchedIds.length} watched · ${finalProfile.interestedIds.length} interested)`
      );
      setTimeout(() => setLiveStatusToast(null), 4000);
      return {
        ok: true,
        syncedFirestore: syncRes.syncedFirestore,
      };
    },
    [watchedIds, interestedIds, mediaLibrary, activeUser]
  );

  const handleSignInCredentials = useCallback(
    async (params: { identifier: string; password?: string }) => {
      setIsSyncingProfile(true);
      const res = await signInWithCredentials({
        identifier: params.identifier,
        password: params.password,
        watchedIds,
        interestedIds,
      });
      setIsSyncingProfile(false);
      if (res.firestore) {
        setFirestoreTelemetry(res.firestore);
      }
      if (res.ok && res.profile) {
        const loaded = res.profile;
        setSavedProfiles(getSavedUserProfiles());
        setActiveUser(loaded);
        setWatchedIds(loaded.watchedIds || []);
        setInterestedIds(loaded.interestedIds || []);
        setRegion(loaded.preferredRegion || 'AU');
        setPreset(loaded.defaultPreset || 'VIBE_TROPES');
        setGraphScope(
          loaded.defaultGraphScope && loaded.defaultGraphScope !== 'WATCHED_ONLY'
            ? loaded.defaultGraphScope
            : 'FULL_ARCHIVE'
        );
        setLiveStatusToast(
          `Signed in as @${loaded.handle} (${loaded.watchedIds?.length || 0} Watched · ${loaded.interestedIds?.length || 0} Interested)`
        );
        setTimeout(() => setLiveStatusToast(null), 4000);
      }
      return {
        ok: res.ok,
        requiresAuth: res.requiresAuth,
        notFound: res.notFound,
        error: res.error,
      };
    },
    [watchedIds, interestedIds]
  );

  const handleGoogleSignIn = useCallback(
    async (idToken: string) => {
      setIsSyncingProfile(true);
      const res = await signInWithGoogleIdToken(idToken, {
        watchedIds,
        interestedIds,
        preferredRegion: region,
        defaultPreset: preset,
        defaultGraphScope: graphScope,
      });
      setIsSyncingProfile(false);
      if (res.firestore) {
        setFirestoreTelemetry(res.firestore);
      }
      if (res.ok && res.profile) {
        const loaded = res.profile;
        setSavedProfiles(getSavedUserProfiles());
        setActiveUser(loaded);
        setWatchedIds(loaded.watchedIds || []);
        setInterestedIds(loaded.interestedIds || []);
        setLiveStatusToast(`Signed in with Google as @${loaded.handle}`);
        setTimeout(() => setLiveStatusToast(null), 4000);
      }
      return {
        ok: res.ok,
        error: res.error,
      };
    },
    [watchedIds, interestedIds, region, preset, graphScope]
  );

  const handleSwitchUser = useCallback((profile: UserProfile | null) => {
    if (!profile) {
      setActiveUserIdInStorage(null);
      setActiveUser(null);
      setWatchedIds([]);
      setInterestedIds([]);
      setGraphScope('FULL_ARCHIVE');
      setLiveStatusToast('Signed out to Guest Mode (Full Archive)');
      setTimeout(() => setLiveStatusToast(null), 3500);
      return;
    }

    setActiveUserIdInStorage(profile.id);
    setActiveUser(profile);
    setWatchedIds(profile.watchedIds || []);
    setInterestedIds(profile.interestedIds || []);
    setRegion(profile.preferredRegion || 'AU');
    setPreset(profile.defaultPreset || 'VIBE_TROPES');
    setGraphScope(profile.defaultGraphScope || 'WATCHED_ONLY');
    setFocalId(null);
    setInspectedMediaId(null);
    setActiveEntityNode(null);
    setLiveStatusToast(
      `Signed in as ${profile.displayName} (@${profile.handle}) · ${profile.watchedIds?.length || 0} Watched · ${profile.interestedIds?.length || 0} Interested`
    );
    setTimeout(() => setLiveStatusToast(null), 4000);
  }, []);

  const handleDeleteProfile = useCallback(
    (userId: string) => {
      const remaining = deleteSavedUserProfile(userId);
      setSavedProfiles(remaining);
      if (activeUser?.id === userId) {
        const nextUser = remaining[0] || null;
        setActiveUser(nextUser);
        if (nextUser) {
          setWatchedIds(nextUser.watchedIds || []);
          setInterestedIds(nextUser.interestedIds || []);
          setGraphScope(
            nextUser.defaultGraphScope && nextUser.defaultGraphScope !== 'WATCHED_ONLY'
              ? nextUser.defaultGraphScope
              : 'FULL_ARCHIVE'
          );
        } else {
          setWatchedIds([]);
          setInterestedIds([]);
          setGraphScope('FULL_ARCHIVE');
        }
      }
    },
    [activeUser?.id]
  );

  const handleLoadCloudProfile = useCallback(
    async (
      handle: string,
      pinOrPassword?: string
    ): Promise<{ ok: boolean; requiresAuth?: boolean; error?: string }> => {
      setIsSyncingProfile(true);
      const res = await fetchUserProfileFromServer(handle, pinOrPassword);
      setIsSyncingProfile(false);
      if (res?.firestore) {
        setFirestoreTelemetry(res.firestore);
      }
      if (res?.requiresAuth) {
        return {
          ok: false,
          requiresAuth: true,
          error: res.error,
        };
      }
      if (res?.profile) {
        const loaded = res.profile;
        setSavedProfiles(getSavedUserProfiles());
        setActiveUser(loaded);
        setWatchedIds(loaded.watchedIds || []);
        setInterestedIds(loaded.interestedIds || []);
        setRegion(loaded.preferredRegion || 'AU');
        setPreset(loaded.defaultPreset || 'VIBE_TROPES');
        setGraphScope(
          loaded.defaultGraphScope && loaded.defaultGraphScope !== 'WATCHED_ONLY'
            ? loaded.defaultGraphScope
            : 'FULL_ARCHIVE'
        );
        setLiveStatusToast(
          `Restored @${loaded.handle} (${loaded.watchedIds?.length || 0} Watched · ${loaded.interestedIds?.length || 0} Interested)`
        );
        setTimeout(() => setLiveStatusToast(null), 4000);
        return { ok: true };
      }
      return { ok: false, error: res?.error };
    },
    []
  );

  const handleImportProfileJson = useCallback((rawJson: string): boolean => {
    const res = importUserProfileJson(rawJson);
    if (!res) return false;
    setSavedProfiles(res.allProfiles);
    setActiveUser(res.profile);
    setWatchedIds(res.profile.watchedIds || []);
    setInterestedIds(res.profile.interestedIds || []);
    setRegion(res.profile.preferredRegion || 'AU');
    setPreset(res.profile.defaultPreset || 'VIBE_TROPES');
    setGraphScope(res.profile.defaultGraphScope || 'WATCHED_ONLY');
    syncUserProfileToServer(res.profile);
    setLiveStatusToast(
      `Imported profile @${res.profile.handle} (${res.profile.watchedIds.length} watched · ${res.profile.interestedIds.length} interested)`
    );
    setTimeout(() => setLiveStatusToast(null), 4000);
    return true;
  }, []);

  const handleOpenMyWatchedGraph = useCallback(
    (scope: GraphScopeMode = 'WATCHED_ONLY') => {
      setFocalId(null);
      setInspectedMediaId(null);
      setActiveEntityNode(null);
      setGraphScope(scope);
      if (viewMode === 'SUGGEST' || viewMode === 'MATRIX') {
        setViewMode('3D');
      }
      setResetPitchTrigger((c) => c + 1);
    },
    [viewMode]
  );

  const handleSelectNodeById = useCallback(
    (nodeId: string) => {
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (targetNode) {
        handleSelectNode(targetNode);
        setOrbitTargetNodeId(targetNode.id);
      } else {
        const media = mediaLibrary.find((m) => m.id === nodeId);
        if (media) {
          setInspectedMediaId(media.id);
          setActiveEntityNode(null);
          setOrbitTargetNodeId(media.id);
        }
      }
    },
    [nodes, mediaLibrary, handleSelectNode]
  );

  const handleOrbitNode = useCallback(
    (nodeId: string) => {
      if (viewMode === 'MATRIX' || viewMode === 'SUGGEST') {
        setViewMode('3D');
      }
      setOrbitTargetNodeId(null);
      setTimeout(() => setOrbitTargetNodeId(nodeId), 15);
    },
    [viewMode]
  );

  const handleToggleWatched = useCallback((mediaId: string) => {
    setWatchedIds((prev) =>
      prev.includes(mediaId)
        ? prev.filter((id) => id !== mediaId)
        : [...prev, mediaId]
    );
  }, []);

  const handleToggleInterested = useCallback((mediaId: string) => {
    setInterestedIds((prev) =>
      prev.includes(mediaId)
        ? prev.filter((id) => id !== mediaId)
        : [...prev, mediaId]
    );
  }, []);

  const handleAddLiveMediaAndWatch = useCallback(
    async (target: LiveSearchResult) => {
      setIsBuildingCluster(true);
      setLiveStatusToast(
        `Importing "${target.title}" (${target.year}) & marking as Watched…`
      );

      const singleData = await fetchSingleLiveMedia({
        tmdbId: target.tmdbId,
        imdbId: target.imdbId,
        mediaType: target.mediaType,
        title: target.title,
        year: target.year,
        posterUrl: target.posterUrl,
      });

      setIsBuildingCluster(false);

      if (singleData?.item) {
        const resolvedId = mergeMediaItemsIntoLibrary(singleData.item, []);
        setWatchedIds((prev) =>
          prev.includes(resolvedId) ? prev : [...prev, resolvedId]
        );
        setLiveStatusToast(
          `Added "${singleData.item.title}" to your Watched list`
        );
        setTimeout(() => setLiveStatusToast(null), 4000);
      } else {
        setLiveStatusToast(`Could not import "${target.title}".`);
        setTimeout(() => setLiveStatusToast(null), 3500);
      }
    },
    [mergeMediaItemsIntoLibrary]
  );

  const handleAddLiveMediaAndInterest = useCallback(
    async (target: LiveSearchResult) => {
      setIsBuildingCluster(true);
      setLiveStatusToast(
        `Importing "${target.title}" (${target.year}) to your Interested list…`
      );

      const singleData = await fetchSingleLiveMedia({
        tmdbId: target.tmdbId,
        imdbId: target.imdbId,
        mediaType: target.mediaType,
        title: target.title,
        year: target.year,
        posterUrl: target.posterUrl,
      });

      setIsBuildingCluster(false);

      if (singleData?.item) {
        const resolvedId = mergeMediaItemsIntoLibrary(singleData.item, []);
        setInterestedIds((prev) =>
          prev.includes(resolvedId) ? prev : [...prev, resolvedId]
        );
        setLiveStatusToast(
          `Added "${singleData.item.title}" to your Want to Watch / Interested list`
        );
        setTimeout(() => setLiveStatusToast(null), 4000);
      } else {
        setLiveStatusToast(`Could not import "${target.title}".`);
        setTimeout(() => setLiveStatusToast(null), 3500);
      }
    },
    [mergeMediaItemsIntoLibrary]
  );

  const handleFetchLiveSuggestions = useCallback(
    async (options: {
      seedItem?: MediaItem | null;
      genre?: string;
      mediaType?: 'ALL' | 'MOVIE' | 'TV';
    }) => {
      if (isFetchingLiveSuggestions) return;
      setIsFetchingLiveSuggestions(true);
      setLiveStatusToast(
        options.seedItem
          ? `Discovering live suggestions inspired by "${options.seedItem.title}"…`
          : options.genre
            ? `Discovering live ${options.genre} suggestions…`
            : 'Discovering live film & series suggestions…'
      );

      const res = await fetchLiveSuggestions({
        seedTmdbId: options.seedItem?.tmdbId,
        seedImdbId: options.seedItem?.imdbId,
        seedMediaType: options.seedItem?.mediaType,
        seedTitle: options.seedItem?.title,
        genre: options.genre,
        mediaType: options.mediaType,
      });

      setIsFetchingLiveSuggestions(false);

      if (res?.quota) setQuotaTelemetry(res.quota);
      if (res?.firestore) setFirestoreTelemetry(res.firestore);

      if (res && res.items.length > 0) {
        let added = 0;
        setMediaLibrary((prev) => {
          const map = new Map<string, MediaItem>();
          for (const m of prev) map.set(m.id, m);
          for (const candidate of res.items) {
            const exists = Array.from(map.values()).find(
              (m) =>
                (candidate.imdbId && m.imdbId === candidate.imdbId) ||
                (candidate.tmdbId > 0 &&
                  m.tmdbId === candidate.tmdbId &&
                  m.mediaType === candidate.mediaType) ||
                (m.title.toLowerCase() === candidate.title.toLowerCase() &&
                  Math.abs(m.year - candidate.year) <= 1)
            );
            if (!exists) {
              map.set(candidate.id, candidate);
              added += 1;
            }
          }
          return Array.from(map.values());
        });

        setLiveStatusToast(
          added > 0
            ? `Discovered +${added} new ${added === 1 ? 'title' : 'titles'} for your Watch Suggestions`
            : 'All top live matches for this criteria are already in your collection'
        );
        setTimeout(() => setLiveStatusToast(null), 4000);
      } else {
        setLiveStatusToast(
          'Showing all matching suggestions currently in your archive.'
        );
        setTimeout(() => setLiveStatusToast(null), 3500);
      }
    },
    [isFetchingLiveSuggestions]
  );

  const handleSuggestFromMedia = useCallback((mediaId: string) => {
    setWatchedIds((prev) =>
      prev.includes(mediaId) ? prev : [...prev, mediaId]
    );
    setSuggestionFilters((prev) => ({
      ...prev,
      seedMediaIds: [mediaId],
    }));
    setViewMode('SUGGEST');
  }, []);

  const handleSuggestByGenre = useCallback((genre: string) => {
    setSuggestionFilters((prev) => ({
      ...prev,
      selectedGenres: [genre],
      curatedCategory: 'ALL',
    }));
    setViewMode('SUGGEST');
  }, []);

  const handleExploreIn3D = useCallback((mediaId: string) => {
    setFocalId(mediaId);
    setInspectedMediaId(mediaId);
    setActiveEntityNode(null);
    setViewMode('3D');
    setOrbitTargetNodeId(null);
    setTimeout(() => setOrbitTargetNodeId(mediaId), 20);
  }, []);

  return (
    <div className={`relative w-full h-[100dvh] overflow-hidden flex flex-col ${
      theme === 'MOVIE_MAP_DARK'
        ? 'movie-map-dark-surface bg-[#0A0E17] text-[#F0F4FC]'
        : 'archival-folio-surface bg-[#F6F1E7] text-[#171412]'
    }`}>
      {/* A. Top Navigation Bar (sticky header with safe-area support) */}
      <TopNavBar
        theme={theme}
        onThemeChange={handleThemeChange}
        nodes={nodes}
        linksCount={links.length}
        focalItem={focalItem}
        onClearFocal={handleClearFocal}
        onResetEverything={handleResetEverything}
        hasActiveSelection={Boolean(activeEntityNode || inspectedItem)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onResetPitch={() => setResetPitchTrigger((c) => c + 1)}
        allMediaItems={mediaLibrary}
        onSelectNodeById={handleSelectNodeById}
        onMakeFocal={handleMakeFocal}
        onAddLiveMedia={handleAddLiveMedia}
        onBuildLiveCluster={handleBuildLiveCluster}
        isBuildingCluster={isBuildingCluster}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
        activeFilterCount={activeFilterCount}
        watchedIds={activeUser ? watchedIds : []}
        onToggleWatched={activeUser ? handleToggleWatched : undefined}
        interestedIds={activeUser ? interestedIds : []}
        onToggleInterested={activeUser ? handleToggleInterested : undefined}
        activeUser={activeUser}
        graphScope={graphScope}
        onGraphScopeChange={(nextScope) => {
          setFocalId(null);
          setInspectedMediaId(null);
          setActiveEntityNode(null);
          setGraphScope(nextScope);
          setResetPitchTrigger((c) => c + 1);
        }}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        matchingMediaCount={matchingMediaCount}
        graphFilters={graphFilters}
        onGraphFiltersChange={setGraphFilters}
        isCatalogOpen={isCatalogOpen}
        onToggleCatalog={() => setIsCatalogOpen((prev) => !prev)}
      />

      {/* Main Workspace Below Top Bar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* B. Left Curatorial Rail */}
        <LeftSidebar
          theme={theme}
          focalItem={focalItem}
          totalMediaCount={activeMediaItems.length}
          mediaCounts={mediaCounts}
          nodes={nodes}
          onClearFocal={handleClearFocal}
          mediaFilter={mediaFilter}
          onMediaFilterChange={setMediaFilter}
          preset={preset}
          onPresetChange={setPreset}
          forceSettings={forceSettings}
          onForceSettingsChange={setForceSettings}
          visibility={visibility}
          onToggleVisibility={handleToggleVisibility}
          onResetAllVisibility={handleResetAllVisibility}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          watchedCount={watchedIds.length}
          interestedCount={interestedIds.length}
          isSuggestMode={viewMode === 'SUGGEST'}
          onOpenSuggestions={() => setViewMode('SUGGEST')}
          onSuggestByGenre={handleSuggestByGenre}
          activeUser={activeUser}
          graphScope={graphScope}
          onGraphScopeChange={(nextScope) => {
            setFocalId(null);
            setInspectedMediaId(null);
            setActiveEntityNode(null);
            setGraphScope(nextScope);
            if (viewMode === 'SUGGEST') {
              setViewMode('3D');
            }
            setResetPitchTrigger((c) => c + 1);
          }}
          onOpenProfileModal={() => setProfileModalOpen(true)}
          graphFilters={graphFilters}
          onGraphFiltersChange={setGraphFilters}
          layoutMode={layoutMode}
          onLayoutModeChange={setLayoutMode}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
          sizeMode={sizeMode}
          onSizeModeChange={setSizeMode}
          labelMode={labelMode}
          onLabelModeChange={setLabelMode}
          clusters={clusters}
          matchingMediaCount={matchingMediaCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* C. Central 3D/2D Constellation, Critical Ledger, or Watch Next Suggestion Studio */}
        <main className="flex-1 relative h-full overflow-hidden">
          {/* Catalog Update Status Banner */}
          {(isBuildingCluster ||
            isFetchingLiveSuggestions ||
            liveStatusToast) && (
            <div className={`motion-toast absolute top-4 sm:top-16 right-4 sm:right-[424px] z-30 flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium max-w-[calc(100vw-2rem)] truncate ${
              theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#121A2B] border-[#1C273C] text-[#F0F4FC] shadow-2xl backdrop-blur-md'
                : 'bg-[#FBF8F2] border-[#B5A892] shadow-archival text-[#171412]'
            }`}>
              {isBuildingCluster || isFetchingLiveSuggestions ? (
                <Loader2 className={`w-3.5 h-3.5 animate-spin shrink-0 ${theme === 'MOVIE_MAP_DARK' ? 'text-[#00D2FF]' : 'text-[#B8292F]'}`} />
              ) : (
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${theme === 'MOVIE_MAP_DARK' ? 'text-[#00F5D4]' : 'text-[#2A6B53]'}`} />
              )}
              <span>{liveStatusToast || 'Updating catalog connections…'}</span>
            </div>
          )}

          {isCatalogHydrating && mediaLibrary.length === 0 ? (
            <div className={`w-full h-full flex flex-col items-center justify-center gap-4 ${
              theme === 'MOVIE_MAP_DARK' ? 'bg-[#0A0E17] text-[#F0F4FC]' : 'bg-[#F6F1E7] text-[#171412]'
            }`}>
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#00D2FF]/40 animate-spin" />
                <div className="absolute w-8 h-8 rounded-full border-2 border-[#FF3366]/60 animate-ping" />
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center px-4">
                <span className="text-sm font-semibold tracking-wide">
                  Hydrating Cosmic Archive from Database…
                </span>
                <span className={`text-xs ${theme === 'MOVIE_MAP_DARK' ? 'text-white/60' : 'text-[#6B5E50]'}`}>
                  Assembling craft connections and cinematic constellation in 1 go
                </span>
              </div>
            </div>
          ) : viewMode === 'SUGGEST' ? (
            <WatchSuggestionsView
              allMediaItems={mediaLibrary}
              watchedIds={watchedIds}
              onToggleWatched={handleToggleWatched}
              interestedIds={interestedIds}
              onToggleInterested={handleToggleInterested}
              filters={suggestionFilters}
              onFiltersChange={setSuggestionFilters}
              region={region}
              onRegionChange={setRegion}
              selectedMediaId={inspectedItem ? inspectedItem.id : null}
              onSelectMedia={(item) => {
                setInspectedMediaId(item.id);
                setActiveEntityNode(null);
              }}
              onExploreIn3D={handleExploreIn3D}
              onAddLiveMediaAndWatch={handleAddLiveMediaAndWatch}
              onFetchLiveSuggestions={handleFetchLiveSuggestions}
              isFetchingLive={isFetchingLiveSuggestions}
              activeUser={activeUser}
              onOpenProfileModal={() => setProfileModalOpen(true)}
              onOpenMyWatchedGraph={handleOpenMyWatchedGraph}
            />
          ) : viewMode === 'MATRIX' ? (
            <SimilarityMatrixView
              focalItem={focalItem}
              rankedMatches={rankedMatches}
              region={region}
              preset={preset}
              selectedMediaId={inspectedItem ? inspectedItem.id : null}
              onSelectMedia={(item) => {
                setInspectedMediaId(item.id);
                setActiveEntityNode(null);
              }}
              onMakeFocal={handleMakeFocal}
              onClearFocal={handleClearFocal}
              watchedIds={activeUser ? watchedIds : []}
              onToggleWatched={activeUser ? handleToggleWatched : undefined}
            />
          ) : (
            <SpatialViewport
              theme={theme}
              nodes={nodes}
              links={links}
              focalItem={focalItem}
              selectedNodeId={
                activeEntityNode
                  ? activeEntityNode.id
                  : inspectedItem
                    ? inspectedItem.id
                    : null
              }
              onSelectNode={handleSelectNode}
              onClearSelection={handleClearSelection}
              onResetEverything={handleResetEverything}
              onMakeFocal={handleMakeFocal}
              onClearFocal={handleClearFocal}
              viewMode={viewMode}
              forceSettings={forceSettings}
              cameraMode={cameraMode}
              onCameraModeChange={setCameraMode}
              autoRotate={autoRotate}
              onAutoRotateChange={setAutoRotate}
              resetPitchTrigger={resetPitchTrigger}
              orbitTargetNodeId={orbitTargetNodeId}
              onFovChange={setFov}
              graphScope={graphScope}
              activeUser={activeUser}
              onGraphScopeChange={(nextScope) => {
                setFocalId(null);
                setInspectedMediaId(null);
                setActiveEntityNode(null);
                setGraphScope(nextScope);
                setResetPitchTrigger((c) => c + 1);
              }}
              onOpenProfileModal={() => setProfileModalOpen(true)}
              clusters={clusters}
              layoutMode={layoutMode}
              onLayoutModeChange={setLayoutMode}
              colorMode={colorMode}
              onColorModeChange={setColorMode}
              sizeMode={sizeMode}
              onSizeModeChange={setSizeMode}
              labelMode={labelMode}
              onLabelModeChange={setLabelMode}
              graphFilters={graphFilters}
              onGraphFiltersChange={setGraphFilters}
              onSelectCluster={(clusterId) =>
                setGraphFilters((prev) => ({
                  ...prev,
                  activeClusterId: clusterId,
                }))
              }
            />
          )}
        </main>

        {/* D. Right Monograph Inspector / All Graph Titles Catalogue */}
        <RightInspectorCard
          theme={theme}
          inspectedItem={inspectedItem}
          activeEntityNode={activeEntityNode}
          focalItem={focalItem}
          allMediaItems={activeMediaItems}
          similarity={inspectedSimilarity}
          region={region}
          isCatalogOpen={isCatalogOpen}
          onCloseCatalog={() => setIsCatalogOpen(false)}
          onOpenCatalog={() => setIsCatalogOpen(true)}
          onMakeFocal={handleMakeFocal}
          onClearFocal={handleClearFocal}
          onClearInspected={handleClearSelection}
          onResetEverything={handleResetEverything}
          onOrbitNode={handleOrbitNode}
          onSelectEntityNode={handleSelectNodeById}
          topRecommendations={inspectorRecommendations}
          onSelectMedia={(item) => {
            setIsCatalogOpen(false);
            setInspectedMediaId(item.id);
            setActiveEntityNode(null);
            setOrbitTargetNodeId(item.id);
          }}
          watchedIds={activeUser ? watchedIds : []}
          onToggleWatched={activeUser ? handleToggleWatched : undefined}
          interestedIds={activeUser ? interestedIds : []}
          onToggleInterested={activeUser ? handleToggleInterested : undefined}
          onSuggestFromMedia={handleSuggestFromMedia}
        />
      </div>

      {/* E. User Profile & Personal Watched / Interested Graph Studio Modal */}
      <UserProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        activeUser={activeUser}
        savedProfiles={savedProfiles}
        watchedIds={watchedIds}
        interestedIds={interestedIds}
        allMediaItems={mediaLibrary}
        graphScope={graphScope}
        onGraphScopeChange={(nextScope) => {
          setFocalId(null);
          setInspectedMediaId(null);
          setActiveEntityNode(null);
          setGraphScope(nextScope);
          setResetPitchTrigger((c) => c + 1);
        }}
        onSaveProfile={handleSaveUserProfile}
        onSignInCredentials={handleSignInCredentials}
        onGoogleSignIn={handleGoogleSignIn}
        onSwitchUser={handleSwitchUser}
        onDeleteProfile={handleDeleteProfile}
        onLoadCloudProfile={handleLoadCloudProfile}
        onImportProfileJson={handleImportProfileJson}
        onToggleWatched={handleToggleWatched}
        onToggleInterested={handleToggleInterested}
        onAddLiveMediaAndWatch={handleAddLiveMediaAndWatch}
        onAddLiveMediaAndInterest={handleAddLiveMediaAndInterest}
        onOpenMyWatchedGraph={handleOpenMyWatchedGraph}
        isSyncingProfile={isSyncingProfile}
      />
    </div>
  );
}
