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
  setActiveUserIdInStorage,
  signInWithCredentials,
  signInWithGoogleIdToken,
  syncUserProfileToServer,
  updateSavedUserLists,
} from '@/lib/user-profile';
import { SEED_MEDIA_ITEMS } from '@/lib/seed-data';
import {
  buildSpatialGraph,
  calculateSimilarity,
  hasConcreteSharedConnection,
  isValidPersonName,
} from '@/lib/similarity';
import {
  CameraMode,
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
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>(() =>
    getInitialMediaLibrary()
  );
  // Default home page state: show ALL movies and TV shows in the graph (not centered on any single title)
  const [focalId, setFocalId] = useState<string | null>(null);
  const [inspectedMediaId, setInspectedMediaId] = useState<string | null>(null);
  const [activeEntityNode, setActiveEntityNode] = useState<GraphNode | null>(
    null
  );

  const [viewMode, setViewMode] = useState<ViewMode>('3D');
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
    DIRECTOR: true,
    ACTOR: true,
    TROPE: true,
    COMPOSER: true,
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
  const [autoExpandTarget, setAutoExpandTarget] = useState<number>(180);
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
    return initialUser?.defaultGraphScope || 'FULL_ARCHIVE';
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
    useState<GraphLayoutMode>('FORCE_CONSTELLATION');
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

    fetchServerCachedCatalog().then(({ items, quota, firestore }) => {
      if (cancelled) return;
      if (quota) setQuotaTelemetry(quota);
      if (firestore) setFirestoreTelemetry(firestore);
      if (items.length > 0) {
        setMediaLibrary((prev) => {
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
   * Executes a single quota-safe auto-expansion batch (5 titles, 0 OMDb calls, paced TMDB calls)
   */
  const runAutoExpandStep = useCallback(
    async (isManualTrigger = false) => {
      if (isAutoExpanding || isBuildingCluster) return;

      const collaborator = pickNextCollaboratorToCrawl();
      if (!collaborator) return;

      setIsAutoExpanding(true);
      setLastCollaboratorCrawled(collaborator);
      markCollaboratorQueried(collaborator);

      if (isManualTrigger) {
        setAutoExpandTarget((prev) =>
          Math.max(prev, mediaLibraryRef.current.length + 10)
        );
      }

      const res = await fetchAutoExpandBatch(
        collaborator,
        mediaLibraryRef.current,
        5
      );

      setIsAutoExpanding(false);

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

            // Only retain titles that share a concrete craft connection with the archive
            const hasConnection = Array.from(map.values()).some((existing) =>
              hasConcreteSharedConnection(
                calculateSimilarity(existing, candidate)
              )
            );
            if (hasConnection) {
              map.set(candidate.id, candidate);
              addedCount += 1;
            }
          }
          return Array.from(map.values());
        });

        if (addedCount > 0 && isManualTrigger) {
          setLiveStatusToast(
            `Auto-expanded +${addedCount} connected ${
              addedCount === 1 ? 'title' : 'titles'
            } via ${collaborator} (0 OMDb quota used)`
          );
          setTimeout(() => setLiveStatusToast(null), 4000);
        }
      }
    },
    [isAutoExpanding, isBuildingCluster, pickNextCollaboratorToCrawl]
  );

  // Gentle background trickle scheduler (runs every 18s while enabled and below target)
  useEffect(() => {
    if (!autoExpandEnabled) return;
    if (mediaLibrary.length >= autoExpandTarget) return;

    const delayMs =
      mediaLibrary.length <= SEED_MEDIA_ITEMS.length ? 3000 : 18000;
    const timer = setTimeout(() => {
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
    setLiveStatusToast('Reset catalog to base seed titles.');
    setTimeout(() => setLiveStatusToast(null), 3500);
  }, []);

  const expandedCount = Math.max(
    0,
    mediaLibrary.length - SEED_MEDIA_ITEMS.length
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

  // Recommendations for the right inspector panel — strictly require a concrete shared connection
  const inspectorRecommendations = useMemo(() => {
    if (!focalItem && inspectedItem) {
      return mediaLibrary
        .filter((m) => m.id !== inspectedItem.id)
        .map((m) => ({
          item: m,
          similarity: calculateSimilarity(inspectedItem, m, preset),
        }))
        .filter(
          ({ similarity }) =>
            hasConcreteSharedConnection(similarity) &&
            similarity.totalScore >= forceSettings.matchThreshold
        )
        .sort((a, b) => b.similarity.totalScore - a.similarity.totalScore);
    }
    return rankedMatches;
  }, [
    focalItem,
    inspectedItem,
    mediaLibrary,
    preset,
    rankedMatches,
    forceSettings.matchThreshold,
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
    if (Object.values(visibility).some((v) => !v)) count += 1;
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
      DIRECTOR: true,
      ACTOR: true,
      TROPE: true,
      COMPOSER: true,
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
      DIRECTOR: true,
      ACTOR: true,
      TROPE: true,
      COMPOSER: true,
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
    setLayoutMode('FORCE_CONSTELLATION');
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
    }) => {
      setIsSyncingProfile(true);
      const { profile, allProfiles } = createOrUpdateUserProfile({
        ...input,
        hasPinOrPassword: input.clearPin
          ? false
          : Boolean(input.pinOrPassword || activeUser?.hasPinOrPassword),
        watchedIds,
        interestedIds,
        allMediaItems: mediaLibrary,
      });
      setSavedProfiles(allProfiles);
      setActiveUser(profile);
      setRegion(profile.preferredRegion);
      setPreset(profile.defaultPreset);
      setGraphScope(profile.defaultGraphScope);

      const syncRes = await syncUserProfileToServer(profile, {
        pinOrPassword: input.pinOrPassword,
        clearPin: input.clearPin,
        action: input.pinOrPassword ? 'auth-signup' : 'save',
      });
      setIsSyncingProfile(false);
      if (syncRes?.profile) {
        setActiveUser(syncRes.profile);
        setSavedProfiles(getSavedUserProfiles());
      }
      if (syncRes?.firestore) {
        setFirestoreTelemetry(syncRes.firestore);
      }

      setLiveStatusToast(
        syncRes?.syncedFirestore
          ? `Saved @${profile.handle} (${profile.watchedIds.length} watched · ${profile.interestedIds.length} interested) & synced to Cloud Firestore`
          : `Saved personal profile @${profile.handle} (${profile.watchedIds.length} watched · ${profile.interestedIds.length} interested)`
      );
      setTimeout(() => setLiveStatusToast(null), 4000);
    },
    [watchedIds, interestedIds, mediaLibrary, activeUser?.hasPinOrPassword]
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
        setGraphScope(loaded.defaultGraphScope || 'WATCHED_ONLY');
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
          setGraphScope(nextUser.defaultGraphScope || 'WATCHED_ONLY');
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
        setGraphScope(loaded.defaultGraphScope || 'WATCHED_ONLY');
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
    <div className="archival-folio-surface relative w-screen h-screen overflow-hidden flex flex-col bg-[#F6F1E7] text-[#171412]">
      {/* A. Top Navigation Bar (h-14, fixed) */}
      <TopNavBar
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
      />

      {/* Main Workspace Below Fixed Top Bar */}
      <div className="pt-14 flex-1 flex overflow-hidden relative">
        {/* B. Left Curatorial Rail */}
        <LeftSidebar
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
        />

        {/* C. Central 3D/2D Constellation, Critical Ledger, or Watch Next Suggestion Studio */}
        <main className="flex-1 relative h-[calc(100vh-3.5rem)] overflow-hidden">
          {/* Catalog Update Status Banner */}
          {(isBuildingCluster ||
            isFetchingLiveSuggestions ||
            liveStatusToast) && (
            <div className="absolute top-16 right-[424px] z-30 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival text-xs font-medium text-[#171412]">
              {isBuildingCluster || isFetchingLiveSuggestions ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B8292F] shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2A6B53] shrink-0" />
              )}
              <span>{liveStatusToast || 'Updating catalog connections…'}</span>
            </div>
          )}

          {viewMode === 'SUGGEST' ? (
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
          inspectedItem={inspectedItem}
          activeEntityNode={activeEntityNode}
          focalItem={focalItem}
          allMediaItems={activeMediaItems}
          similarity={inspectedSimilarity}
          region={region}
          onMakeFocal={handleMakeFocal}
          onClearFocal={handleClearFocal}
          onClearInspected={handleClearSelection}
          onResetEverything={handleResetEverything}
          onOrbitNode={handleOrbitNode}
          onSelectEntityNode={handleSelectNodeById}
          topRecommendations={inspectorRecommendations}
          onSelectMedia={(item) => {
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
