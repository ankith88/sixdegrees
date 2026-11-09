'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TopNavBar } from './TopNavBar';
import { LeftSidebar } from './LeftSidebar';
import { SpatialViewport } from './SpatialViewport';
import { SimilarityMatrixView } from './SimilarityMatrixView';
import { RightInspectorCard } from './RightInspectorCard';
import {
  getInitialMediaLibrary,
  fetchMediaFromTmdbAndOmdb,
  fetchLiveCluster,
  hasLiveApiKeys,
  LiveSearchResult,
} from '@/lib/api';
import { buildSpatialGraph, calculateSimilarity } from '@/lib/similarity';
import {
  CameraMode,
  EntityNodeType,
  EntityVisibility,
  ForceSettings,
  GraphNode,
  GravityPreset,
  MediaItem,
  RegionCode,
  SimilarityBreakdown,
  ViewMode,
} from '@/lib/types';
import {
  Award,
  UserCheck,
  Hash,
  Music,
  X,
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

  // Live API Cluster Building State
  const [isBuildingCluster, setIsBuildingCluster] = useState(false);
  const [liveStatusToast, setLiveStatusToast] = useState<string | null>(null);
  const [apiKeyVersion, setApiKeyVersion] = useState(0);

  const liveDataSourceLabel = useMemo(() => {
    const keys = hasLiveApiKeys();
    if (keys.tmdb && keys.omdb) return 'TMDB & OMDb Active';
    if (keys.tmdb) return 'TMDB Active';
    if (keys.omdb) return 'OMDb Active';
    return 'Catalog Keys';
  }, [apiKeyVersion]);

  // Merge newly fetched live MediaItems into the library without duplicates
  const mergeMediaItemsIntoLibrary = useCallback(
    (focal: MediaItem, cluster: MediaItem[]) => {
      setMediaLibrary((prev) => {
        const map = new Map<string, MediaItem>();
        for (const item of prev) {
          map.set(item.id, item);
        }
        map.set(focal.id, focal);
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
    },
    []
  );

  // Build spatial graph dynamically whenever focalId, preset, filters, or visibility change
  const {
    nodes,
    links,
    focalItem: graphFocalItem,
    rankedMatches,
  } = useMemo(() => {
    return buildSpatialGraph({
      items: mediaLibrary,
      focalId,
      preset,
      mediaFilter,
      forceSettings,
      visibility,
    });
  }, [mediaLibrary, focalId, preset, mediaFilter, forceSettings, visibility]);

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

  // Recommendations for the right inspector panel
  const inspectorRecommendations = useMemo(() => {
    if (!focalItem && inspectedItem) {
      return mediaLibrary
        .filter((m) => m.id !== inspectedItem.id)
        .map((m) => ({
          item: m,
          similarity: calculateSimilarity(inspectedItem, m, preset),
        }))
        .sort((a, b) => b.similarity.totalScore - a.similarity.totalScore);
    }
    return rankedMatches;
  }, [focalItem, inspectedItem, mediaLibrary, preset, rankedMatches]);

  // Filtered media items for the right catalogue index
  const activeMediaItems = useMemo(() => {
    return mediaLibrary.filter((item) => {
      if (mediaFilter === 'MOVIE' && item.mediaType !== 'MOVIE') return false;
      if (mediaFilter === 'TV' && item.mediaType !== 'TV') return false;
      if (!visibility.MOVIE && item.mediaType === 'MOVIE') return false;
      if (!visibility.TV && item.mediaType === 'TV') return false;
      return true;
    });
  }, [mediaLibrary, mediaFilter, visibility.MOVIE, visibility.TV]);

  // Live TMDB + OMDb API enrichment when inspecting a node
  useEffect(() => {
    if (!inspectedItem) return;
    const keys = hasLiveApiKeys();
    if (!keys.tmdb && !keys.omdb) return;

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
  }, [inspectedItem?.id, apiKeyVersion]);

  const handleToggleVisibility = useCallback((type: EntityNodeType) => {
    setVisibility((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
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
   * Dynamically builds a live constellation from any search result
   */
  const handleBuildLiveCluster = useCallback(
    async (target: LiveSearchResult) => {
      setIsBuildingCluster(true);
      setLiveStatusToast(
        `Gathering shared credits and connections for "${target.title}" (${target.year})…`
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
        mergeMediaItemsIntoLibrary(
          clusterData.focalItem,
          clusterData.clusterItems
        );
        setFocalId(clusterData.focalItem.id);
        setInspectedMediaId(clusterData.focalItem.id);
        setActiveEntityNode(null);
        setOrbitTargetNodeId(clusterData.focalItem.id);
        setLiveStatusToast(
          `Centered on "${clusterData.focalItem.title}" with ${clusterData.clusterItems.length} connected titles`
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
   * Re-centers the graph around a chosen Movie/TV Show AND fetches additional live recommendations
   */
  const handleMakeFocal = useCallback(
    async (newFocalId: string) => {
      setFocalId(newFocalId);
      setInspectedMediaId(newFocalId);
      setActiveEntityNode(null);
      setOrbitTargetNodeId(newFocalId);

      const targetItem = mediaLibrary.find((m) => m.id === newFocalId);
      if (!targetItem) return;

      setIsBuildingCluster(true);
      const clusterData = await fetchLiveCluster({
        tmdbId: targetItem.tmdbId,
        imdbId: targetItem.imdbId,
        mediaType: targetItem.mediaType,
        title: targetItem.title,
        year: targetItem.year,
        posterUrl: targetItem.posterUrl,
      });
      setIsBuildingCluster(false);

      if (clusterData && clusterData.clusterItems.length > 0) {
        mergeMediaItemsIntoLibrary(
          {
            ...clusterData.focalItem,
            id: targetItem.id,
          },
          clusterData.clusterItems
        );
        setLiveStatusToast(
          `Updated constellation with ${clusterData.clusterItems.length} related titles for "${targetItem.title}"`
        );
        setTimeout(() => setLiveStatusToast(null), 3500);
      }
    },
    [mediaLibrary, mergeMediaItemsIntoLibrary]
  );

  const handleSelectNode = useCallback((node: GraphNode) => {
    if (node.type === 'MOVIE' || node.type === 'TV') {
      setInspectedMediaId(node.id);
      setActiveEntityNode(null);
    } else {
      setActiveEntityNode(node);
      setOrbitTargetNodeId(node.id);
    }
  }, []);

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
        }
      }
    },
    [nodes, mediaLibrary, handleSelectNode]
  );

  const handleOrbitNode = useCallback(
    (nodeId: string) => {
      if (viewMode === 'MATRIX') {
        setViewMode('3D');
      }
      setOrbitTargetNodeId(null);
      setTimeout(() => setOrbitTargetNodeId(nodeId), 15);
    },
    [viewMode]
  );

  const connectedEntityTitles = useMemo(() => {
    if (!activeEntityNode) return [];
    return mediaLibrary.filter((m) =>
      activeEntityNode.connectedMediaIds.includes(m.id)
    );
  }, [activeEntityNode, mediaLibrary]);

  const entityRoleLabel = (type: EntityNodeType) => {
    switch (type) {
      case 'DIRECTOR':
        return 'Director / Screenwriter';
      case 'ACTOR':
        return 'Shared Cast';
      case 'TROPE':
        return 'Narrative Theme';
      case 'COMPOSER':
        return 'Score & Cinematography';
      default:
        return type;
    }
  };

  return (
    <div className="archival-folio-surface relative w-screen h-screen overflow-hidden flex flex-col bg-[#F6F1E7] text-[#171412]">
      {/* A. Top Navigation Bar (h-14, fixed) */}
      <TopNavBar
        nodes={nodes}
        linksCount={links.length}
        fov={fov}
        focalItem={focalItem}
        onClearFocal={handleClearFocal}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        region={region}
        onRegionChange={setRegion}
        onResetPitch={() => setResetPitchTrigger((c) => c + 1)}
        allMediaItems={mediaLibrary}
        onSelectNodeById={handleSelectNodeById}
        onMakeFocal={handleMakeFocal}
        onBuildLiveCluster={handleBuildLiveCluster}
        isBuildingCluster={isBuildingCluster}
        liveDataSourceLabel={liveDataSourceLabel}
        onApiKeysUpdated={() => setApiKeyVersion((v) => v + 1)}
      />

      {/* Main Workspace Below Fixed Top Bar */}
      <div className="pt-14 flex-1 flex overflow-hidden relative">
        {/* B. Left Curatorial Rail */}
        <LeftSidebar
          focalItem={focalItem}
          totalMediaCount={activeMediaItems.length}
          onClearFocal={handleClearFocal}
          mediaFilter={mediaFilter}
          onMediaFilterChange={setMediaFilter}
          preset={preset}
          onPresetChange={setPreset}
          forceSettings={forceSettings}
          onForceSettingsChange={setForceSettings}
          visibility={visibility}
          onToggleVisibility={handleToggleVisibility}
        />

        {/* C. Central 3D/2D Constellation or Critical Ledger */}
        <main className="flex-1 relative h-[calc(100vh-3.5rem)] overflow-hidden">
          {/* Catalog Update Status Banner */}
          {(isBuildingCluster || liveStatusToast) && (
            <div className="absolute top-16 right-[424px] z-30 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival text-xs font-medium text-[#171412]">
              {isBuildingCluster ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B8292F]" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2A6B53]" />
              )}
              <span>{liveStatusToast || 'Updating catalog connections…'}</span>
            </div>
          )}

          {/* Active Collaborator / Theme Drawer (when clicking a Director, Actor, Theme, or Composer node) */}
          {activeEntityNode && (
            <div className="absolute top-16 left-4 z-30 max-w-md p-3.5 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  {activeEntityNode.type === 'DIRECTOR' && (
                    <Award className="w-4 h-4 text-[#B8292F] shrink-0" />
                  )}
                  {activeEntityNode.type === 'ACTOR' && (
                    <UserCheck className="w-4 h-4 text-[#B86B14] shrink-0" />
                  )}
                  {activeEntityNode.type === 'TROPE' && (
                    <Hash className="w-4 h-4 text-[#2A6B53] shrink-0" />
                  )}
                  {activeEntityNode.type === 'COMPOSER' && (
                    <Music className="w-4 h-4 text-[#A63A2B] shrink-0" />
                  )}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="font-heading text-base font-bold text-[#171412]">
                      {activeEntityNode.label}
                    </h3>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: activeEntityNode.color }}
                    >
                      · {entityRoleLabel(activeEntityNode.type)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveEntityNode(null)}
                  className="p-1 rounded text-[#52483E] hover:text-[#171412] hover:bg-[#E5DEC9]"
                  aria-label="Close collaborator panel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-[#52483E] mb-2">
                Connects {connectedEntityTitles.length} titles in this view:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {connectedEntityTitles.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setInspectedMediaId(item.id);
                      setOrbitTargetNodeId(item.id);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                      item.id === inspectedMediaId
                        ? 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6] font-semibold'
                        : 'bg-[#EFE8DA] text-[#171412] border-[#C8BEAA] hover:bg-[#E5DEC9]'
                    }`}
                  >
                    {item.title} ({item.year})
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'MATRIX' ? (
            <SimilarityMatrixView
              focalItem={focalItem}
              rankedMatches={rankedMatches}
              region={region}
              preset={preset}
              selectedMediaId={inspectedItem ? inspectedItem.id : null}
              onSelectMedia={(item) => setInspectedMediaId(item.id)}
              onMakeFocal={handleMakeFocal}
              onClearFocal={handleClearFocal}
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
            />
          )}
        </main>

        {/* D. Right Monograph Inspector / All Graph Titles Catalogue */}
        <RightInspectorCard
          inspectedItem={inspectedItem}
          focalItem={focalItem}
          allMediaItems={activeMediaItems}
          similarity={inspectedSimilarity}
          region={region}
          onMakeFocal={handleMakeFocal}
          onClearFocal={handleClearFocal}
          onClearInspected={() => setInspectedMediaId(null)}
          onOrbitNode={handleOrbitNode}
          onSelectEntityNode={handleSelectNodeById}
          topRecommendations={inspectorRecommendations}
          onSelectMedia={(item) => {
            setInspectedMediaId(item.id);
            setOrbitTargetNodeId(item.id);
          }}
        />
      </div>
    </div>
  );
}
