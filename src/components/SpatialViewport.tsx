'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Film,
  Tv,
  UserCheck,
  Award,
  Music,
  Hash,
  Link2,
  Map as MapIcon,
  Palette,
  Tag,
  SlidersHorizontal,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';
import { SpatialQuadtree } from '@/lib/spatial-index';
import {
  AppTheme,
  CameraMode,
  ForceSettings,
  GraphFilterBehavior,
  GraphFilterState,
  GraphLayoutMode,
  GraphLink,
  GraphNode,
  GraphScopeMode,
  LabelDisplayMode,
  MediaItem,
  NodeColorMode,
  NodeSizeMode,
  SemanticCluster,
  UserProfile,
  ViewMode,
} from '@/lib/types';
import { getPosterFallbackDataUri } from '@/lib/seed-data';

interface SpatialViewportProps {
  nodes: GraphNode[];
  links: GraphLink[];
  focalItem: MediaItem | null;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode) => void;
  onClearSelection?: () => void;
  onResetEverything?: () => void;
  onMakeFocal: (mediaId: string) => void;
  onClearFocal?: () => void;
  viewMode: '2D' | '3D';
  forceSettings: ForceSettings;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  autoRotate: boolean;
  onAutoRotateChange: (val: boolean) => void;
  resetPitchTrigger: number;
  orbitTargetNodeId: string | null;
  onFovChange?: (fov: number) => void;
  graphScope?: GraphScopeMode;
  activeUser?: UserProfile | null;
  onGraphScopeChange?: (scope: GraphScopeMode) => void;
  onOpenProfileModal?: () => void;
  // Movie Map REA Integration Props
  clusters?: SemanticCluster[];
  layoutMode?: GraphLayoutMode;
  onLayoutModeChange?: (mode: GraphLayoutMode) => void;
  colorMode?: NodeColorMode;
  onColorModeChange?: (mode: NodeColorMode) => void;
  sizeMode?: NodeSizeMode;
  onSizeModeChange?: (mode: NodeSizeMode) => void;
  labelMode?: LabelDisplayMode;
  onLabelModeChange?: (mode: LabelDisplayMode) => void;
  graphFilters?: GraphFilterState;
  onGraphFiltersChange?: (next: GraphFilterState) => void;
  onSelectCluster?: (clusterId: string | null) => void;
  onToggleTerritories?: () => void;
  theme?: AppTheme;
}

interface HoveredTooltipState {
  node: GraphNode;
  x: number;
  y: number;
}

interface LinkedMediaSummary {
  node: GraphNode;
  sharedReasons: string[];
  directScore?: number;
}

interface LinkedEntitySummary {
  node: GraphNode;
  roleLabel: string;
  connectedCount: number;
}

interface LinkedSubgraphResult {
  focusNode: GraphNode | null;
  linkedNodeIds: Set<string>;
  directLinkIds: Set<string>;
  bridgeLinkIds: Set<string>;
  allIlluminatedLinkIds: Set<string>;
  linkedMedia: LinkedMediaSummary[];
  linkedEntities: LinkedEntitySummary[];
}

function getEntityRoleLabel(type: GraphNode['type']): string {
  switch (type) {
    case 'DIRECTOR':
      return 'Director / Writer';
    case 'ACTOR':
      return 'Cast';
    case 'TROPE':
      return 'Theme';
    case 'COMPOSER':
      return 'Score & Camera';
    case 'MOVIE':
      return 'Film';
    case 'TV':
      return 'Series';
  }
}

/**
 * Computes the complete connected subgraph (linked Media nodes, linked Collaborator/Theme nodes,
 * direct links, and shared entity bridge links) for a clicked or hovered node.
 */
function computeLinkedSubgraph(
  focusNodeId: string | null,
  nodes: GraphNode[],
  links: GraphLink[]
): LinkedSubgraphResult {
  const emptyResult: LinkedSubgraphResult = {
    focusNode: null,
    linkedNodeIds: new Set(),
    directLinkIds: new Set(),
    bridgeLinkIds: new Set(),
    allIlluminatedLinkIds: new Set(),
    linkedMedia: [],
    linkedEntities: [],
  };

  if (!focusNodeId) return emptyResult;

  const nodeById = new Map<string, GraphNode>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
  }

  const focusNode = nodeById.get(focusNodeId) || null;
  if (!focusNode) return emptyResult;

  const linkedNodeIds = new Set<string>([focusNodeId]);
  const directLinkIds = new Set<string>();
  const bridgeLinkIds = new Set<string>();
  const allIlluminatedLinkIds = new Set<string>();
  const mediaReasonsMap = new Map<string, Set<string>>();
  const mediaDirectScoreMap = new Map<string, number>();
  const entityNodeSet = new Set<string>();

  const isFocusMedia = focusNode.type === 'MOVIE' || focusNode.type === 'TV';

  if (isFocusMedia) {
    // 1. Direct links incident to the selected Media node
    for (const link of links) {
      if (link.source !== focusNodeId && link.target !== focusNodeId) continue;
      directLinkIds.add(link.id);
      allIlluminatedLinkIds.add(link.id);

      const otherId = link.source === focusNodeId ? link.target : link.source;
      const otherNode = nodeById.get(otherId);
      if (!otherNode) continue;

      linkedNodeIds.add(otherId);

      if (otherNode.type === 'MOVIE' || otherNode.type === 'TV') {
        const score = Math.round(link.weight * 100);
        if (score > 0) {
          mediaDirectScoreMap.set(otherId, score);
        }
        if (!mediaReasonsMap.has(otherId)) {
          mediaReasonsMap.set(otherId, new Set());
        }
      } else {
        entityNodeSet.add(otherId);
      }
    }

    // 2. Second-hop links from each connected Collaborator/Theme entity node to other Media nodes sharing that entity
    for (const entId of entityNodeSet) {
      const entNode = nodeById.get(entId);
      if (!entNode) continue;

      for (const link of links) {
        if (link.source !== entId && link.target !== entId) continue;
        const peerId = link.source === entId ? link.target : link.source;
        if (peerId === focusNodeId) continue;
        const peerNode = nodeById.get(peerId);
        if (
          !peerNode ||
          (peerNode.type !== 'MOVIE' && peerNode.type !== 'TV')
        ) {
          continue;
        }

        bridgeLinkIds.add(link.id);
        allIlluminatedLinkIds.add(link.id);
        linkedNodeIds.add(peerId);

        if (!mediaReasonsMap.has(peerId)) {
          mediaReasonsMap.set(peerId, new Set());
        }
        mediaReasonsMap
          .get(peerId)!
          .add(`${getEntityRoleLabel(entNode.type)}: ${entNode.label}`);
      }
    }

    // 3. Also highlight any direct similarity link between focusNodeId and discovered peer media nodes
    for (const link of links) {
      if (
        link.kind === 'SIMILARITY_DIRECT' &&
        linkedNodeIds.has(link.source) &&
        linkedNodeIds.has(link.target) &&
        (link.source === focusNodeId || link.target === focusNodeId)
      ) {
        directLinkIds.add(link.id);
        allIlluminatedLinkIds.add(link.id);
      }
    }

    // 4. Enrich shared reasons for direct-linked media nodes if not already populated via entity nodes
    for (const id of linkedNodeIds) {
      if (id === focusNodeId) continue;
      const peerNode = nodeById.get(id);
      if (!peerNode || (peerNode.type !== 'MOVIE' && peerNode.type !== 'TV')) {
        continue;
      }
      const reasons = mediaReasonsMap.get(id) || new Set<string>();
      if (reasons.size === 0 && focusNode.mediaItem && peerNode.mediaItem) {
        for (const d of focusNode.mediaItem.directors) {
          if (peerNode.mediaItem.directors.includes(d)) {
            reasons.add(`Director: ${d}`);
          }
        }
        for (const c of focusNode.mediaItem.cast) {
          if (peerNode.mediaItem.cast.some((pc) => pc.name === c.name)) {
            reasons.add(`Cast: ${c.name}`);
          }
        }
        for (const comp of focusNode.mediaItem.composers) {
          if (peerNode.mediaItem.composers.includes(comp)) {
            reasons.add(`Score: ${comp}`);
          }
        }
        for (const t of focusNode.mediaItem.tropes) {
          if (
            peerNode.mediaItem.tropes.some(
              (pt) => pt.toLowerCase() === t.toLowerCase()
            )
          ) {
            reasons.add(`Theme: ${t}`);
          }
        }
      }
      mediaReasonsMap.set(id, reasons);
    }
  } else {
    // Focus node is a Collaborator or Theme Entity node (DIRECTOR, ACTOR, TROPE, COMPOSER)
    for (const link of links) {
      if (link.source !== focusNodeId && link.target !== focusNodeId) continue;
      directLinkIds.add(link.id);
      allIlluminatedLinkIds.add(link.id);

      const otherId = link.source === focusNodeId ? link.target : link.source;
      const otherNode = nodeById.get(otherId);
      if (!otherNode) continue;

      linkedNodeIds.add(otherId);
      if (otherNode.type === 'MOVIE' || otherNode.type === 'TV') {
        mediaReasonsMap.set(
          otherId,
          new Set([
            `${getEntityRoleLabel(focusNode.type)}: ${focusNode.label}`,
          ])
        );
      }
    }

    for (const mId of focusNode.connectedMediaIds) {
      if (nodeById.has(mId)) {
        linkedNodeIds.add(mId);
        if (!mediaReasonsMap.has(mId)) {
          mediaReasonsMap.set(
            mId,
            new Set([
              `${getEntityRoleLabel(focusNode.type)}: ${focusNode.label}`,
            ])
          );
        }
      }
    }

    // Illuminate direct similarity links among the titles connected by this entity
    for (const link of links) {
      if (
        link.kind === 'SIMILARITY_DIRECT' &&
        linkedNodeIds.has(link.source) &&
        linkedNodeIds.has(link.target)
      ) {
        bridgeLinkIds.add(link.id);
        allIlluminatedLinkIds.add(link.id);
      }
    }
  }

  const linkedMedia: LinkedMediaSummary[] = [];
  const linkedEntities: LinkedEntitySummary[] = [];

  for (const id of linkedNodeIds) {
    if (id === focusNodeId) continue;
    const n = nodeById.get(id);
    if (!n) continue;

    if (n.type === 'MOVIE' || n.type === 'TV') {
      const reasons = Array.from(mediaReasonsMap.get(id) || []);
      const directScore = mediaDirectScoreMap.get(id) ?? n.matchScore;
      linkedMedia.push({
        node: n,
        sharedReasons: reasons,
        directScore,
      });
    } else {
      linkedEntities.push({
        node: n,
        roleLabel: getEntityRoleLabel(n.type),
        connectedCount: n.connectedMediaIds.length,
      });
    }
  }

  linkedMedia.sort(
    (a, b) =>
      (b.directScore ?? 0) - (a.directScore ?? 0) ||
      b.sharedReasons.length - a.sharedReasons.length ||
      (b.node.mediaItem?.imdbRating ?? 0) - (a.node.mediaItem?.imdbRating ?? 0)
  );

  linkedEntities.sort(
    (a, b) =>
      b.connectedCount - a.connectedCount ||
      a.node.label.localeCompare(b.node.label)
  );

  return {
    focusNode,
    linkedNodeIds,
    directLinkIds,
    bridgeLinkIds,
    allIlluminatedLinkIds,
    linkedMedia,
    linkedEntities,
  };
}

/**
 * Computes a clean, balanced radial 3D/2D layout centered at (0, 0, 0) for the isolated
 * interconnected subgraph when a user selects a node, so that only the selected node and
 * its connected nodes are shown in a clear, non-overlapping constellation.
 */
function computeIsolatedLayoutTargets(
  sub: LinkedSubgraphResult
): Map<string, { x: number; y: number; z: number }> {
  const targets = new Map<string, { x: number; y: number; z: number }>();
  if (!sub.focusNode) return targets;

  // Selected focus node sits at the center of the isolated view
  targets.set(sub.focusNode.id, { x: 0, y: 0, z: 0 });

  const entityCount = sub.linkedEntities.length;
  const mediaCount = sub.linkedMedia.length;

  // Inner/mid ring: shared collaborators & themes
  sub.linkedEntities.forEach(({ node }, idx) => {
    const angle = (Math.PI * 2 * idx) / Math.max(1, entityCount) - Math.PI / 2;
    const radius = entityCount > 6 ? 72 + (idx % 2) * 16 : 74;
    const zOffset = ((idx % 3) - 1) * 18;
    targets.set(node.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: zOffset,
    });
  });

  // Outer ring: connected films & series
  sub.linkedMedia.forEach(({ node }, idx) => {
    const angleOffset = entityCount > 0 ? Math.PI / Math.max(4, mediaCount) : 0;
    const angle =
      (Math.PI * 2 * idx) / Math.max(1, mediaCount) -
      Math.PI / 2 +
      angleOffset;
    const baseRadius = entityCount > 0 ? 128 : 108;
    const radius =
      mediaCount > 7 ? baseRadius + (idx % 2) * 24 : baseRadius;
    const zOffset = Math.sin(idx * 1.7) * 24;
    targets.set(node.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: zOffset,
    });
  });

  return targets;
}

/**
 * Draws a recognizable category-specific icon inside a 2D canvas context centered at (cx, cy):
 * - MOVIE: 35mm Cinema Film Reel with 5 spool holes
 * - TV: Widescreen Television Monitor with twin rabbit-ear antennae & stand
 * - DIRECTOR: Director's Clapperboard with angled striped clap-stick
 * - ACTOR: Classic 5-Pointed Cinema Star
 * - TROPE: Open Story Book / Screenplay Tome with spine & page lines
 * - COMPOSER: Beamed Musical Eighth Note (♫)
 */
function drawCategoryGlyph2D(
  ctx: CanvasRenderingContext2D,
  type: GraphNode['type'],
  cx: number,
  cy: number,
  r: number,
  color: string,
  fillStyle?: string,
  cutoutColor = '#FBF8F2'
) {
  ctx.save();
  ctx.translate(cx, cy);
  const mainColor = fillStyle || color;
  const vellumCutout = cutoutColor;
  ctx.strokeStyle = mainColor;
  ctx.fillStyle = mainColor;

  if (type === 'MOVIE') {
    // 35mm Cinema Film Reel: outer reel disc + 5 circular spool cutouts + center spindle
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.02, 0, Math.PI * 2);
    ctx.fill();

    // Outer metallic rim highlight
    ctx.strokeStyle = vellumCutout;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();

    // 5 film spool holes
    ctx.fillStyle = vellumCutout;
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const hx = Math.cos(angle) * r * 0.52;
      const hy = Math.sin(angle) * r * 0.52;
      ctx.beginPath();
      ctx.arc(hx, hy, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center hub hole
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'TV') {
    // Television Set: widescreen cabinet + screen cutout + rabbit-ear V-antennae + base stand
    const w = r * 1.85;
    const h = r * 1.25;
    const yOff = r * 0.12;

    // Rabbit-ear antennae
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(1.4, r * 0.18);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, yOff - h / 2);
    ctx.lineTo(-r * 0.62, yOff - h / 2 - r * 0.52);
    ctx.moveTo(r * 0.15, yOff - h / 2);
    ctx.lineTo(r * 0.62, yOff - h / 2 - r * 0.52);
    ctx.stroke();

    // TV Cabinet
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(-w / 2, yOff - h / 2, w, h, Math.max(2, r * 0.25));
    ctx.fill();

    // Inner glass screen
    ctx.fillStyle = vellumCutout;
    ctx.beginPath();
    ctx.roundRect(
      -w * 0.38,
      yOff - h * 0.34,
      w * 0.76,
      h * 0.68,
      Math.max(1.5, r * 0.14)
    );
    ctx.fill();

    // Pedestal stand
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(1.4, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, yOff + h / 2 + r * 0.18);
    ctx.lineTo(r * 0.42, yOff + h / 2 + r * 0.18);
    ctx.stroke();
  } else if (type === 'DIRECTOR') {
    // Director's Clapperboard: lower slate body + hinged open striped clap-stick
    const w = r * 1.75;
    const h = r * 1.15;
    const bodyY = -r * 0.05;

    // Slate body
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(-w / 2, bodyY, w, h * 0.78, Math.max(1.5, r * 0.18));
    ctx.fill();

    // Slate info lines
    ctx.strokeStyle = vellumCutout;
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, bodyY + h * 0.32);
    ctx.lineTo(w * 0.32, bodyY + h * 0.32);
    ctx.moveTo(-w * 0.32, bodyY + h * 0.55);
    ctx.lineTo(w * 0.15, bodyY + h * 0.55);
    ctx.stroke();

    // Hinged upper clap-bar tilted open
    ctx.save();
    ctx.translate(-w / 2, bodyY);
    ctx.rotate(-0.28);
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(0, -h * 0.28, w, h * 0.26, Math.max(1, r * 0.12));
    ctx.fill();

    // Diagonal clapper stripes
    ctx.strokeStyle = vellumCutout;
    ctx.lineWidth = Math.max(1.2, r * 0.16);
    for (let s = 1; s <= 3; s++) {
      const sx = (w / 4) * s;
      ctx.beginPath();
      ctx.moveTo(sx - r * 0.12, -h * 0.26);
      ctx.lineTo(sx + r * 0.12, -h * 0.03);
      ctx.stroke();
    }
    ctx.restore();
  } else if (type === 'ACTOR') {
    // Classic 5-Pointed Cinema Star
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    const spikes = 5;
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? r * 1.12 : r * 0.46;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = Math.cos(angle) * rad;
      const y = Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Subtle inner star facet dot
    ctx.fillStyle = vellumCutout;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'TROPE') {
    // Open Story Book: left & right open arched pages + central binding spine
    const w = r * 1.85;
    const h = r * 1.32;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    // Left page
    ctx.moveTo(0, -h * 0.38);
    ctx.quadraticCurveTo(-w * 0.26, -h * 0.54, -w * 0.5, -h * 0.36);
    ctx.lineTo(-w * 0.5, h * 0.42);
    ctx.quadraticCurveTo(-w * 0.26, h * 0.26, 0, h * 0.44);
    // Right page
    ctx.quadraticCurveTo(w * 0.26, h * 0.26, w * 0.5, h * 0.42);
    ctx.lineTo(w * 0.5, -h * 0.36);
    ctx.quadraticCurveTo(w * 0.26, -h * 0.54, 0, -h * 0.38);
    ctx.closePath();
    ctx.fill();

    // Central spine & page lines in vellum
    ctx.strokeStyle = vellumCutout;
    ctx.lineWidth = Math.max(1.2, r * 0.15);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.36);
    ctx.lineTo(0, h * 0.42);
    ctx.stroke();
  } else {
    // COMPOSER: Beamed Musical Eighth Note (♫)
    ctx.fillStyle = mainColor;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(1.6, r * 0.22);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const leftX = -r * 0.46;
    const rightX = r * 0.42;
    const headY = r * 0.46;
    const topLeftY = -r * 0.62;
    const topRightY = -r * 0.82;

    // Two note heads (tilted ovals)
    ctx.beginPath();
    ctx.ellipse(leftX, headY, r * 0.36, r * 0.26, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(
      rightX,
      headY - r * 0.16,
      r * 0.36,
      r * 0.26,
      -0.35,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Stems & top connecting beam
    ctx.beginPath();
    ctx.moveTo(leftX + r * 0.26, headY);
    ctx.lineTo(leftX + r * 0.26, topLeftY);
    ctx.lineTo(rightX + r * 0.26, topRightY);
    ctx.lineTo(rightX + r * 0.26, headY - r * 0.16);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Builds a sleek procedural studio environment map so metallic, glass, and ceramic 3D nodes
 * catch crisp modern specular highlights without external HDR network assets.
 */
function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xf6f1e7);

  // Overhead warm gallery softbox
  const topLightGeo = new THREE.PlaneGeometry(120, 120);
  const topLightMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const topLight = new THREE.Mesh(topLightGeo, topLightMat);
  topLight.position.set(0, 75, 0);
  topLight.rotation.x = Math.PI / 2;
  envScene.add(topLight);

  // Key warm rim panel
  const keyPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    new THREE.MeshBasicMaterial({ color: 0xfff3de, side: THREE.DoubleSide })
  );
  keyPanel.position.set(65, 25, 65);
  keyPanel.lookAt(0, 0, 0);
  envScene.add(keyPanel);

  // Cool architectural fill panel
  const coolPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    new THREE.MeshBasicMaterial({ color: 0xdbe7f2, side: THREE.DoubleSide })
  );
  coolPanel.position.set(-70, -15, -60);
  coolPanel.lookAt(0, 0, 0);
  envScene.add(coolPanel);

  const envRT = pmremGenerator.fromScene(envScene, 0.04);
  pmremGenerator.dispose();
  return envRT.texture;
}

/**
 * Creates a rounded/beveled 3D rectangular prism for TV cabinets and Clapperboard slates
 */
function createRoundedRectPrismGeometry(
  width: number,
  height: number,
  depth: number,
  cornerRadius: number
): THREE.BufferGeometry {
  const r = Math.min(cornerRadius, width * 0.35, height * 0.35);
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;

  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: r * 0.35,
    bevelThickness: r * 0.35,
  });
  geo.center();
  return geo;
}

/**
 * Creates an authentic 35mm Cinema Film Reel 3D geometry with 5 circular spool holes & center spindle hole
 */
function createFilmReelGeometry(radius: number): THREE.BufferGeometry {
  const reelShape = new THREE.Shape();
  reelShape.absarc(0, 0, radius, 0, Math.PI * 2, false);

  // Center spindle hole
  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, radius * 0.16, 0, Math.PI * 2, true);
  reelShape.holes.push(centerHole);

  // 5 classic circular film spool cutouts
  const holeCount = 5;
  for (let i = 0; i < holeCount; i++) {
    const angle = (i * Math.PI * 2) / holeCount;
    const hx = Math.cos(angle) * radius * 0.54;
    const hy = Math.sin(angle) * radius * 0.54;
    const spoolHole = new THREE.Path();
    spoolHole.absarc(hx, hy, radius * 0.21, 0, Math.PI * 2, true);
    reelShape.holes.push(spoolHole);
  }

  const geo = new THREE.ExtrudeGeometry(reelShape, {
    depth: radius * 0.28,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: radius * 0.04,
    bevelThickness: radius * 0.04,
  });
  geo.center();
  return geo;
}

/**
 * Creates a beveled 3D 5-Pointed Cinema Star geometry for Actor / Cast nodes
 */
function createFivePointStarGeometry(
  outerRadius: number,
  innerRadius: number,
  depth: number
): THREE.BufferGeometry {
  const starShape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = Math.cos(angle) * rad;
    const y = Math.sin(angle) * rad;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();

  const geo = new THREE.ExtrudeGeometry(starShape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: outerRadius * 0.06,
    bevelThickness: outerRadius * 0.06,
  });
  geo.center();
  return geo;
}

interface NodeAssemblyRecord {
  group: THREE.Group;
  primaryMaterials: THREE.MeshPhysicalMaterial[];
  accentMaterials: THREE.Material[];
  outerShell: THREE.Object3D | null;
  secondaryRing: THREE.Object3D | null;
  coreObject: THREE.Object3D;
  phaseOffset: number;
  nodeType: GraphNode['type'];
  isFocal: boolean;
  selectionHalo: THREE.Mesh;
  selectionHaloMat: THREE.MeshBasicMaterial;
  outerRingHalo: THREE.Mesh;
  outerRingHaloMat: THREE.MeshBasicMaterial;
  statusRing?: THREE.Mesh | null;
  statusRingMat?: THREE.MeshBasicMaterial | null;
  labelSprite: THREE.Sprite | null;
  baseLabelScale: number;
}

/**
 * Constructs a recognizable, modern, sleek 3D model directly representing each category:
 * - MOVIE: 35mm Cinema Film Reel with 5 spool cutouts, metallic hub & outer film rim
 * - TV: Widescreen Television Monitor with glowing recessed screen, pedestal stand & rabbit-ear V-antennae
 * - DIRECTOR: Director's Clapperboard with angled hinged striped clap-stick
 * - ACTOR: 5-Pointed Cinema Star Trophy on a circular Walk-of-Fame ring
 * - TROPE: Open Story Book with angled covers, vellum pages, bound spine & golden bookmark
 * - COMPOSER: Beamed Musical Eighth Note (♫) with twin note heads, stems, beam & acoustic wave ring
 */
function createCategoryNodeAssembly(
  node: GraphNode,
  index: number
): {
  record: NodeAssemblyRecord;
  hitMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.position.set(node.x, node.y, node.z);

  const baseColor = new THREE.Color(node.color);
  const glowColor = new THREE.Color(node.glowColor || node.color);
  const champagneGold = new THREE.Color(0xd4a86a);
  const warmPlatinum = new THREE.Color(0xfbf8f2);

  const primaryMaterials: THREE.MeshPhysicalMaterial[] = [];
  const accentMaterials: THREE.Material[] = [];

  // Primary sleek ceramic/anodized material with high clearcoat
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    emissive: glowColor,
    emissiveIntensity: node.isFocal ? 0.34 : 0.16,
    roughness: 0.16,
    metalness: 0.28,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    reflectivity: 0.95,
    transparent: true,
    opacity: 0.98,
  });
  primaryMaterials.push(coreMat);

  // Secondary metallic trim material
  const metalAccentMat = new THREE.MeshPhysicalMaterial({
    color: baseColor.clone().lerp(champagneGold, 0.45),
    emissive: glowColor,
    emissiveIntensity: 0.12,
    roughness: 0.22,
    metalness: 0.82,
    clearcoat: 0.85,
    transparent: true,
    opacity: 0.95,
  });
  primaryMaterials.push(metalAccentMat);

  // Warm archival vellum / ivory contrast material (for book pages, clapper stripes, TV screen)
  const ivoryContrastMat = new THREE.MeshPhysicalMaterial({
    color: warmPlatinum,
    emissive: baseColor.clone().lerp(warmPlatinum, 0.7),
    emissiveIntensity: 0.22,
    roughness: 0.18,
    metalness: 0.08,
    clearcoat: 0.9,
    transparent: true,
    opacity: 0.96,
  });
  primaryMaterials.push(ivoryContrastMat);

  // Subtle luminous halo ring material
  const glassShellMat = new THREE.MeshPhysicalMaterial({
    color: baseColor.clone().lerp(warmPlatinum, 0.55),
    emissive: glowColor,
    emissiveIntensity: 0.1,
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  accentMaterials.push(glassShellMat);

  const r = node.radius;

  // Sleek Obsidian-Style Glowing Celestial Orb
  const sphereGeo = new THREE.SphereGeometry(r, 20, 20);
  const coreObject = new THREE.Mesh(sphereGeo, coreMat);
  group.add(coreObject);

  let outerShell: THREE.Object3D | null = null;
  let secondaryRing: THREE.Object3D | null = null;

  // Focal centerpiece gets an elegant thin luminous orbital ring
  if (node.isFocal) {
    const focalRingGeo = new THREE.TorusGeometry(
      r * 1.55,
      Math.max(0.22, r * 0.05),
      12,
      48
    );
    const focalRingMat = new THREE.MeshPhysicalMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
    });
    accentMaterials.push(focalRingMat);
    const focalRingMesh = new THREE.Mesh(focalRingGeo, focalRingMat);
    focalRingMesh.rotation.x = Math.PI / 3;
    group.add(focalRingMesh);
    outerShell = focalRingMesh;
  }

  // Camera-facing selection & linked-node beacon halo rings
  const haloRingGeo = new THREE.RingGeometry(r * 1.4, r * 1.65, 36);
  const selectionHaloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(node.isFocal ? '#FF3366' : node.color),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const selectionHalo = new THREE.Mesh(haloRingGeo, selectionHaloMat);
  group.add(selectionHalo);

  const outerHaloGeo = new THREE.RingGeometry(r * 1.8, r * 1.95, 36);
  const outerRingHaloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(node.isFocal ? '#FF3366' : '#00D2FF'),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const outerRingHalo = new THREE.Mesh(outerHaloGeo, outerRingHaloMat);
  group.add(outerRingHalo);

  // Concentric personal status halo ring for Watched / Interested nodes
  let statusRing: THREE.Mesh | null = null;
  let statusRingMat: THREE.MeshBasicMaterial | null = null;
  if (node.isWatched || node.isInterested) {
    const isWatched = Boolean(node.isWatched);
    const statusColorHex = isWatched ? '#10B981' : '#F59E0B';
    const statusGeo = new THREE.RingGeometry(r * 1.45, r * 1.68, 36);
    statusRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(statusColorHex),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    accentMaterials.push(statusRingMat);
    statusRing = new THREE.Mesh(statusGeo, statusRingMat);
    group.add(statusRing);
  }

  // Generous invisible raycast hit-sphere so sleek dots are effortless to click & hover
  const hitGeo = new THREE.SphereGeometry(Math.max(r * 1.8, 5.5), 14, 14);
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.userData = { nodeId: node.id };
  group.add(hitMesh);

  const baseLabelScale = node.isFocal
    ? 46
    : node.type === 'MOVIE' || node.type === 'TV'
      ? 35
      : 28;

  return {
    record: {
      group,
      primaryMaterials,
      accentMaterials,
      outerShell,
      secondaryRing,
      coreObject,
      phaseOffset: index * 0.73,
      nodeType: node.type,
      isFocal: Boolean(node.isFocal),
      selectionHalo,
      selectionHaloMat,
      outerRingHalo,
      outerRingHaloMat,
      statusRing,
      statusRingMat,
      labelSprite: null,
      baseLabelScale,
    },
    hitMesh,
  };
}

/**
 * Creates a high-DPI 3D Sprite label texture for a GraphNode styled as an engraved Criterion/museum vellum plate
 * with a category medallion emblem, double-hairline border, and downward pointer nib.
 */
function createLabelSprite(node: GraphNode, isDark = true): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const titleText = node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label;
    const isMedia = node.type === 'MOVIE' || node.type === 'TV';
    const subText = node.isFocal
      ? 'Focal Center'
      : isMedia && node.mediaItem
        ? `${node.mediaItem.year} · ★ ${node.mediaItem.imdbRating.toFixed(1)}`
        : getEntityRoleLabel(node.type);

    ctx.font = '600 22px "Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textWidth = ctx.measureText(titleText).width;
    const pillW = Math.min(440, Math.max(160, textWidth + 40));
    const pillH = 68;
    const pillX = (canvas.width - pillW) / 2;
    const pillY = 14;

    ctx.save();
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(23, 20, 18, 0.10)';
    ctx.shadowBlur = isDark ? 12 : 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = isDark ? 3 : 2;

    ctx.fillStyle = isDark
      ? 'rgba(14, 21, 36, 0.94)'
      : 'rgba(251, 248, 242, 0.96)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 12);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = node.isFocal ? 2.0 : 1.0;
    ctx.strokeStyle = node.isFocal
      ? (isDark ? '#FF3366' : '#B8292F')
      : (isDark ? 'rgba(255, 255, 255, 0.18)' : '#D5CCB9');
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 12);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#F0F4FC' : '#171412';
    ctx.font = '600 22px "Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, canvas.width / 2, pillY + 28);

    ctx.fillStyle = node.isFocal
      ? (isDark ? '#FF3366' : '#B8292F')
      : (isDark ? '#94A3B8' : '#6B5E50');
    ctx.font = '500 15px "Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(subText, canvas.width / 2, pillY + 50);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const scale = node.isFocal ? 24 : 18;
  sprite.scale.set(scale, scale * (96 / 480), 1);
  sprite.position.set(0, node.radius + 3.8, 0);
  return sprite;
}

/**
 * Creates a reusable radial gradient texture for soft archival watercolor territory washes.
 * Eliminates harsh geometric boundaries and donut holes, producing authentic diffuse density halos.
 */
function createRadialWashTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.76)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.48)');
    grad.addColorStop(0.68, 'rgba(255, 255, 255, 0.20)');
    grad.addColorStop(0.90, 'rgba(255, 255, 255, 0.04)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/**
 * Creates an exquisite, architectural 3D territory cartouche for each genre/theme.
 * Follows celestial star atlas and Criterion archival design principles:
 * - Refined Title Case typography on translucent museum vellum or obsidian card
 * - Prominent world dimensions (baseH: 46, baseW: ~170-220) scaled for effortless legibility across the galaxy
 * - Discreet tabular title count tag
 * - Delicate hairline border tinted in semantic cluster pigment
 * - Soft atmospheric elevation shadow
 */
function createClusterBannerSprite(
  cluster: SemanticCluster,
  isDark = true
): { sprite: THREE.Sprite; baseW: number; baseH: number } {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  let baseW = 180;
  const baseH = 46;

  if (ctx) {
    const labelText = cluster.shortLabel || cluster.label;
    const count = cluster.mediaIds ? cluster.mediaIds.length : 0;
    const countText = count > 0 ? `${count} TITLES` : '';

    // Set up canvas fonts for high-DPI rendering
    ctx.font = '700 32px "Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const labelW = ctx.measureText(labelText).width;

    ctx.font = '600 20px "Source Sans 3", monospace';
    const countW = count > 0 ? ctx.measureText(countText).width : 0;

    const padX = 24;
    const pipSpace = 24;
    const gap = count > 0 ? 18 : 0;
    const countBadgeW = count > 0 ? countW + 20 : 0;
    const totalContentW = pipSpace + labelW + gap + countBadgeW;

    const pillW = Math.max(220, Math.min(600, totalContentW + padX * 2));
    const pillH = 76;
    const pillX = (canvas.width - pillW) / 2;
    const pillY = (canvas.height - pillH) / 2;
    const pillRadius = 18;

    // 1. Soft atmospheric elevation shadow (gentle warm paper lift)
    ctx.save();
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(23, 20, 18, 0.12)';
    ctx.shadowBlur = isDark ? 16 : 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = isDark ? 4 : 2;

    // 2. Translucent museum vellum / obsidian fill
    ctx.fillStyle = isDark
      ? 'rgba(10, 14, 23, 0.94)'
      : 'rgba(251, 248, 242, 0.96)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillRadius);
    ctx.fill();
    ctx.restore();

    // 3. Delicate hairline border tinted with cluster pigment
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = isDark
      ? `${cluster.color}99`
      : `${cluster.color}88`;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillRadius);
    ctx.stroke();

    // Subtle inner bevel line
    ctx.lineWidth = 1;
    ctx.strokeStyle = isDark
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(23, 20, 18, 0.06)';
    ctx.beginPath();
    ctx.roundRect(pillX + 2, pillY + 2, pillW - 4, pillH - 4, pillRadius - 2);
    ctx.stroke();

    // 4. Subtle celestial pip
    const pipX = pillX + padX + 4;
    const pipY = pillY + pillH / 2;

    // Soft pigment aura
    ctx.beginPath();
    ctx.arc(pipX, pipY, 11, 0, Math.PI * 2);
    ctx.fillStyle = `${cluster.color}33`;
    ctx.fill();

    // Solid core
    ctx.beginPath();
    ctx.arc(pipX, pipY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = cluster.color;
    ctx.fill();

    // Center white/ivory pin
    ctx.beginPath();
    ctx.arc(pipX, pipY, 2, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#FFFFFF' : '#FFFDF9';
    ctx.fill();

    // 5. Crisp, tracked-out primary genre title in Title Case
    const textStartX = pipX + 16;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '700 32px "Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = isDark ? '#F0F4FC' : '#171412';
    ctx.fillText(labelText, textStartX, pipY);

    // 6. Refined tabular title count
    if (count > 0) {
      const countBadgeX = pillX + pillW - padX - countBadgeW;
      const countBadgeY = pipY - 17;
      const countBadgeH = 34;

      ctx.fillStyle = isDark
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(23, 20, 18, 0.06)';
      ctx.beginPath();
      ctx.roundRect(countBadgeX, countBadgeY, countBadgeW, countBadgeH, 10);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 20px "Source Sans 3", monospace';
      ctx.fillStyle = isDark ? '#9DAEC7' : '#6B5E50';
      ctx.fillText(countText, countBadgeX + countBadgeW / 2, pipY + 0.5);
    }

    // World scale: baseH is 46, width is proportional to content
    baseW = Math.round((pillW / pillH) * baseH);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(baseW, baseH, 1);
  return { sprite, baseW, baseH };
}

/**
 * Computes tight bounding volume of all active nodes and cluster centroids
 * to guarantee that all nodes fit inside any viewport size.
 */
function computeGraphBounds(nodes: GraphNode[], clusters?: SemanticCluster[]) {
  if (!nodes || nodes.length === 0) {
    return {
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      halfWidth: 550,
      halfHeight: 550,
      maxRadius: 650,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
    if (n.z < minZ) minZ = n.z;
    if (n.z > maxZ) maxZ = n.z;
  }

  if (clusters && clusters.length > 0) {
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      if (c.centroid.x < minX) minX = c.centroid.x;
      if (c.centroid.x > maxX) maxX = c.centroid.x;
      if (c.centroid.y < minY) minY = c.centroid.y;
      if (c.centroid.y > maxY) maxY = c.centroid.y;
      if (c.centroid.z < minZ) minZ = c.centroid.z;
      if (c.centroid.z > maxZ) maxZ = c.centroid.z;
    }
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Margin for node badges, territory banners, and labels
  const margin = 80;
  const halfWidth = Math.max(320, (maxX - minX) / 2 + margin);
  const halfHeight = Math.max(320, (maxY - minY) / 2 + margin);
  const maxRadius = Math.max(
    Math.hypot(halfWidth, halfHeight),
    Math.hypot(maxX - centerX, maxY - centerY) + margin
  );

  return {
    centerX,
    centerY,
    centerZ,
    halfWidth,
    halfHeight,
    maxRadius,
  };
}

/**
 * Calculates responsive 3D camera distance based on viewport aspect ratio and container dimensions
 * ensuring 100% of nodes and cluster labels fit inside the screen with safety padding.
 */
function computeResponsive3DDistance(
  containerWidth: number,
  containerHeight: number,
  bounds: ReturnType<typeof computeGraphBounds>,
  fovDegrees = 55
): number {
  const w = Math.max(
    320,
    containerWidth ||
      (typeof window !== 'undefined' ? window.innerWidth : 1280)
  );
  const h = Math.max(
    320,
    containerHeight ||
      (typeof window !== 'undefined' ? window.innerHeight : 800)
  );
  const aspect = w / h;
  const vFovRad = (fovDegrees * Math.PI) / 360;
  const tanV = Math.tan(vFovRad);
  const tanH = tanV * aspect;

  const paddingFactor = 1.18;
  const distV = (bounds.halfHeight * paddingFactor) / tanV;
  const distH = (bounds.halfWidth * paddingFactor) / tanH;

  return Math.round(Math.max(distV, distH, 850));
}

/**
 * Calculates responsive 2D canvas zoom scale so all nodes fit inside the screen with generous margins.
 */
function computeResponsive2DZoom(
  containerWidth: number,
  containerHeight: number,
  bounds: ReturnType<typeof computeGraphBounds>
): number {
  const w = Math.max(
    320,
    containerWidth ||
      (typeof window !== 'undefined' ? window.innerWidth : 1280)
  );
  const h = Math.max(
    320,
    containerHeight ||
      (typeof window !== 'undefined' ? window.innerHeight : 800)
  );

  const availW = w * 0.84;
  const availH = h * 0.84;

  const totalW = bounds.halfWidth * 2;
  const totalH = bounds.halfHeight * 2;

  const zoomW = availW / totalW;
  const zoomH = availH / totalH;

  const fittedZoom = Math.min(zoomW, zoomH, 1.05);
  return Math.max(0.24, Math.round(fittedZoom * 100) / 100);
}
export function SpatialViewport({
  nodes,
  links,
  focalItem,
  selectedNodeId,
  onSelectNode,
  onClearSelection,
  onResetEverything,
  onMakeFocal,
  onClearFocal,
  viewMode,
  forceSettings,
  cameraMode,
  onCameraModeChange,
  autoRotate,
  onAutoRotateChange,
  resetPitchTrigger,
  orbitTargetNodeId,
  onFovChange,
  graphScope = 'FULL_ARCHIVE',
  activeUser = null,
  onGraphScopeChange,
  onOpenProfileModal,
  clusters = [],
  layoutMode = 'SEMANTIC_GALAXY',
  onLayoutModeChange,
  colorMode = 'CATEGORY',
  onColorModeChange,
  sizeMode = 'RATING',
  onSizeModeChange,
  labelMode = 'AUTO',
  onLabelModeChange,
  graphFilters,
  onGraphFiltersChange,
  onSelectCluster,
  onToggleTerritories,
  theme = 'MOVIE_MAP_DARK',
}: SpatialViewportProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);

  const [hoveredTooltip, setHoveredTooltip] =
    useState<HoveredTooltipState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isNodeKeyOpen, setIsNodeKeyOpen] = useState(false);
  const [localTerritories, setLocalTerritories] = useState(true);
  const [mobileLensOpen, setMobileLensOpen] = useState(false);
  const showTerritories = graphFilters?.showTerritories ?? localTerritories;

  // Refs for mutable access inside animation loop
  const nodesRef = useRef<GraphNode[]>(nodes);
  const linksRef = useRef<GraphLink[]>(links);
  const forceRef = useRef<ForceSettings>(forceSettings);
  const hoveredIdRef = useRef<string | null>(null);
  const hoveredClusterIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedNodeId);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  const labelModeRef = useRef<LabelDisplayMode>(labelMode);
  labelModeRef.current = labelMode;
  const showTerritoriesRef = useRef<boolean>(showTerritories);
  showTerritoriesRef.current = showTerritories;
  const layoutModeRef = useRef<GraphLayoutMode>(layoutMode);
  layoutModeRef.current = layoutMode;
  const colorModeRef = useRef<NodeColorMode>(colorMode);
  colorModeRef.current = colorMode;
  const graphFiltersRef = useRef<GraphFilterState | undefined>(graphFilters);
  graphFiltersRef.current = graphFilters;
  const onSelectClusterRef = useRef(onSelectCluster);
  onSelectClusterRef.current = onSelectCluster;

  // Stable structural identity keys to prevent costly WebGL canvas destructions on color/layout/label toggles
  const nodeStructureKey = useMemo(() => {
    return `${nodes.length}:${nodes.map((n) => n.id).join(',')}`;
  }, [nodes]);

  const linksStructureKey = useMemo(() => {
    return `${links.length}:${links.map((l) => `${l.source}->${l.target}`).join(',')}`;
  }, [links]);

  // Context refs for zero-overhead in-place updates (60fps color shifts & smooth physics glides)
  const threeContextRef = useRef<{
    simNodes: GraphNode[];
    nodeAssembliesMap: Map<string, NodeAssemblyRecord>;
    homePositions3D: Map<string, { x: number; y: number; z: number }>;
    linkEntries: Array<{
      link: GraphLink;
      line: THREE.Line;
      material: THREE.LineBasicMaterial;
      beamMesh: THREE.Mesh;
      beamMaterial: THREE.MeshBasicMaterial;
    }>;
    territorySpritesGroup: THREE.Group;
  } | null>(null);

  const canvas2dContextRef = useRef<{
    simNodes: GraphNode[];
    homePositions2D: Map<string, { x: number; y: number }>;
  } | null>(null);

  // Memoized linked subgraph for the currently selected node (used by the persistent Linked Nodes HUD panel)
  const selectedSubgraph = useMemo(
    () => computeLinkedSubgraph(selectedNodeId, nodes, links),
    [selectedNodeId, nodes, links]
  );

  useEffect(() => {
    forceRef.current = forceSettings;
  }, [forceSettings]);

  useEffect(() => {
    selectedIdRef.current = selectedNodeId;
    if (!selectedNodeId) {
      // Smoothly return camera to full archive center when selection is cleared
      const bounds = computeGraphBounds(nodesRef.current, clusters);
      const w = containerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
      const h = containerRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
      const autoDist = computeResponsive3DDistance(w, h, bounds);
      const autoZoom = computeResponsive2DZoom(w, h, bounds);
      camSphericalRef.current.goalX = bounds.centerX;
      camSphericalRef.current.goalY = bounds.centerY;
      camSphericalRef.current.goalZ = bounds.centerZ;
      camSphericalRef.current.goalRadius = autoDist;
      pan2dRef.current.goalPanX = 0;
      pan2dRef.current.goalPanY = 0;
      pan2dRef.current.goalZoom = autoZoom;
    }
  }, [selectedNodeId, clusters]);

  // Curation counts for personal HUD and quick filters
  const mediaNodes = useMemo(
    () => nodes.filter((n) => n.type === 'MOVIE' || n.type === 'TV'),
    [nodes]
  );
  const watchedNodesCount = useMemo(
    () => mediaNodes.filter((n) => n.isWatched).length,
    [mediaNodes]
  );
  const interestedNodesCount = useMemo(
    () => mediaNodes.filter((n) => n.isInterested).length,
    [mediaNodes]
  );
  const unwatchedNodesCount = useMemo(
    () => mediaNodes.filter((n) => !n.isWatched).length,
    [mediaNodes]
  );

  // Allow pressing Escape at any time to exit the isolated subgraph view / reset selection
  // Allow pressing 'L' to toggle label display mode (Auto -> All -> Off)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Escape' && selectedIdRef.current) {
        onClearSelection?.();
      } else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey) {
        if (onLabelModeChange) {
          const next =
            labelMode === 'AUTO' ? 'ALL' : labelMode === 'ALL' ? 'OFF' : 'AUTO';
          onLabelModeChange(next);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClearSelection, labelMode, onLabelModeChange]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  // Camera spherical coordinates for smooth interactive 3D control
  const camSphericalRef = useRef({
    radius: 960,
    theta: 0.05,
    phi: 1.44,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    goalX: 0,
    goalY: 0,
    goalZ: 0,
    goalRadius: 960,
    flyIndex: 0,
    flyTimer: 0,
  });

  // 2D pan & zoom state ref so clicking/selecting a node smoothly frames its linked cluster in 2D too
  const pan2dRef = useRef({
    panX: 0,
    panY: 0,
    zoom: 0.68,
    goalPanX: 0,
    goalPanY: 0,
    goalZoom: 0.68,
  });

  /**
   * Smoothly frames the isolated interconnected subgraph centered at (0, 0, 0)
   * so that only the selected node and all of its connected nodes fill the viewport cleanly.
   */
  const frameNodeAndLinkedCluster = useCallback((nodeId: string) => {
    const curNodes = nodesRef.current;
    const curLinks = linksRef.current;
    const targetNode = curNodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    const sub = computeLinkedSubgraph(nodeId, curNodes, curLinks);
    const totalLinked = sub.linkedMedia.length + sub.linkedEntities.length;

    // Isolated subgraph arranges around (0, 0, 0)
    camSphericalRef.current.goalX = 0;
    camSphericalRef.current.goalY = 0;
    camSphericalRef.current.goalZ = 0;
    camSphericalRef.current.goalRadius =
      totalLinked > 8 ? 245 : totalLinked > 0 ? 220 : 175;

    pan2dRef.current.goalPanX = 0;
    pan2dRef.current.goalPanY = 0;
    pan2dRef.current.goalZoom = totalLinked > 8 ? 0.96 : 1.08;
  }, []);

  // Handle Reset View trigger
  useEffect(() => {
    if (resetPitchTrigger > 0) {
      const bounds = computeGraphBounds(nodesRef.current, clusters);
      const w = containerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
      const h = containerRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
      const autoDist = computeResponsive3DDistance(w, h, bounds);
      const autoZoom = computeResponsive2DZoom(w, h, bounds);
      camSphericalRef.current.phi = 1.44;
      camSphericalRef.current.theta = 0.05;
      camSphericalRef.current.goalX = bounds.centerX;
      camSphericalRef.current.goalY = bounds.centerY;
      camSphericalRef.current.goalZ = bounds.centerZ;
      camSphericalRef.current.goalRadius = autoDist;
      pan2dRef.current.goalPanX = 0;
      pan2dRef.current.goalPanY = 0;
      pan2dRef.current.goalZoom = autoZoom;
      onFovChange?.(55);
    }
  }, [resetPitchTrigger, onFovChange, clusters]);

  // Handle Focus in Map button from Right Inspector or Node Selection
  useEffect(() => {
    if (!orbitTargetNodeId) return;
    frameNodeAndLinkedCluster(orbitTargetNodeId);
  }, [orbitTargetNodeId, frameNodeAndLinkedCluster]);

  useEffect(() => {
    if (!selectedNodeId) return;
    frameNodeAndLinkedCluster(selectedNodeId);
  }, [selectedNodeId, frameNodeAndLinkedCluster]);

  const handleZoomStep = useCallback(
    (delta: number) => {
      camSphericalRef.current.goalRadius = Math.max(
        90,
        Math.min(950, camSphericalRef.current.goalRadius + delta)
      );
      pan2dRef.current.goalZoom = Math.max(
        0.25,
        Math.min(3.2, pan2dRef.current.goalZoom - delta * 0.003)
      );
      const nextFov = Math.max(
        35,
        Math.min(
          75,
          Math.round(35 + (camSphericalRef.current.goalRadius / 950) * 35)
        )
      );
      onFovChange?.(nextFov);
    },
    [onFovChange]
  );

  // ==================== 3D WEBGL SCENE EFFECT ====================
  useEffect(() => {
    if (viewMode !== '3D') return;
    const container = containerRef.current;
    if (!container) return;

    const simNodes: GraphNode[] = nodes.map((n) => ({ ...n }));
    nodesRef.current = simNodes;
    linksRef.current = links;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const bounds = computeGraphBounds(simNodes, clusters);
    const responsiveDist = computeResponsive3DDistance(width, height, bounds);

    if (!selectedIdRef.current && !focalItem) {
      camSphericalRef.current.radius = responsiveDist;
      camSphericalRef.current.goalRadius = responsiveDist;
      camSphericalRef.current.targetX = bounds.centerX;
      camSphericalRef.current.targetY = bounds.centerY;
      camSphericalRef.current.targetZ = bounds.centerZ;
      camSphericalRef.current.goalX = bounds.centerX;
      camSphericalRef.current.goalY = bounds.centerY;
      camSphericalRef.current.goalZ = bounds.centerZ;
    }

    const isDark = theme === 'MOVIE_MAP_DARK';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? 0x0a0e17 : 0xf6f1e7);
    scene.fog = new THREE.FogExp2(isDark ? 0x0a0e17 : 0xf6f1e7, 0.00035);

    const camera = new THREE.PerspectiveCamera(55, width / height, 1, 2200);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.25 : 1.12;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Procedural Studio Environment Map for modern metallic & clearcoat reflections
    const envTexture = createStudioEnvironment(renderer);
    scene.environment = envTexture;

    // Gallery Lighting (Luminous Night Sky vs Daylight Parchment)
    const ambientLight = new THREE.AmbientLight(
      isDark ? 0x141b2d : 0xfffdf9,
      isDark ? 2.3 : 1.9
    );
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(
      isDark ? 0x38e1ff : 0xfff8eb,
      isDark ? 1.6 : 1.85
    );
    dirLight.position.set(140, 210, 180);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(
      isDark ? 0xff3366 : 0xe4effa,
      isDark ? 1.4 : 1.15
    );
    rimLight.position.set(-160, 120, -160);
    scene.add(rimLight);

    const pointLightWarm = new THREE.PointLight(
      isDark ? 0xffaa00 : 0xd48324,
      1.25,
      750
    );
    pointLightWarm.position.set(120, 140, 160);
    scene.add(pointLightWarm);

    const pointLightPrussian = new THREE.PointLight(
      isDark ? 0x00d2ff : 0x234b6e,
      1.15,
      750
    );
    pointLightPrussian.position.set(-150, -110, -130);
    scene.add(pointLightPrussian);

    // Subtle Luminous Celestial / Pigment Motes
    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const palette = isDark
      ? [
        new THREE.Color('#00D2FF'),
        new THREE.Color('#FF3366'),
        new THREE.Color('#FFAA00'),
        new THREE.Color('#00F5D4'),
        new THREE.Color('#9D4EDD'),
      ]
      : [
        new THREE.Color('#B8292F'),
        new THREE.Color('#234B6E'),
        new THREE.Color('#B86B14'),
        new THREE.Color('#8F816B'),
      ];
    for (let i = 0; i < starCount; i++) {
      const r = 180 + Math.random() * 520;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
      const c = palette[i % palette.length];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3)
    );
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.7,
      vertexColors: true,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Engraved Meridian Rings around Selected Title (0,0,0)
    const orbitRadii = [72, 120, 168];
    const orbitRingsGroup = new THREE.Group();
    orbitRadii.forEach((rad, i) => {
      const ringGeo = new THREE.RingGeometry(rad - 0.35, rad + 0.35, 112);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xb8292f : i === 1 ? 0x234b6e : 0x8f816b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      orbitRingsGroup.add(ringMesh);
    });
    scene.add(orbitRingsGroup);

    // Create Sleek Multi-Part Category 3D Sculptures
    const nodeAssembliesMap = new Map<string, NodeAssemblyRecord>();
    const pickableMeshes: THREE.Object3D[] = [];
    let focalOuterOrbitalRing: THREE.Mesh | null = null;

    simNodes.forEach((node, idx) => {
      const { record, hitMesh } = createCategoryNodeAssembly(node, idx);
      pickableMeshes.push(hitMesh);

      if (node.isFocal) {
        const orb2Geo = new THREE.TorusGeometry(
          node.radius * 2.48,
          node.radius * 0.024,
          16,
          84
        );
        const orb2Mat = new THREE.MeshBasicMaterial({
          color: 0xb86b14,
          transparent: true,
          opacity: 0.48,
        });
        focalOuterOrbitalRing = new THREE.Mesh(orb2Geo, orb2Mat);
        focalOuterOrbitalRing.rotation.y = Math.PI / 3;
        record.group.add(focalOuterOrbitalRing);
        record.accentMaterials.push(orb2Mat);
      }

      const labelSprite = createLabelSprite(node, isDark);
      record.labelSprite = labelSprite;
      record.group.add(labelSprite);

      scene.add(record.group);
      nodeAssembliesMap.set(node.id, record);
    });

    // Create 3D Links + 3D Illuminated Connection Beams (for crisp visibility when a node is selected)
    interface LinkRenderEntry {
      link: GraphLink;
      line: THREE.Line;
      material: THREE.LineBasicMaterial;
      geometry: THREE.BufferGeometry;
      beamMesh: THREE.Mesh;
      beamMaterial: THREE.MeshBasicMaterial;
    }

    const sharedBeamUnitGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
    const linkEntries: LinkRenderEntry[] = [];
    links.forEach((link) => {
      const positions = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const isDirect = link.kind === 'SIMILARITY_DIRECT';
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(link.color),
        transparent: true,
        opacity: isDirect ? 0.52 : 0.28,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);

      const beamMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(link.color),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const beamMesh = new THREE.Mesh(sharedBeamUnitGeo, beamMaterial);
      beamMesh.visible = false;
      scene.add(beamMesh);

      linkEntries.push({
        link,
        line,
        material: mat,
        geometry: geo,
        beamMesh,
        beamMaterial,
      });
    });

    // Index nodes for rapid spatial lookups
    const nodeIndexMap = new Map<string, GraphNode>();
    const homePositions3D = new Map<
      string,
      { x: number; y: number; z: number }
    >();
    simNodes.forEach((n) => {
      nodeIndexMap.set(n.id, n);
      homePositions3D.set(n.id, { x: n.x, y: n.y, z: n.z });
    });

    // 3D Territory Sector Banner Sprites & Luminous Foundations (visible across the constellation)
    const territorySpritesGroup = new THREE.Group();
    interface ClusterBannerRecord {
      sprite: THREE.Sprite;
      baseW: number;
      baseH: number;
      cluster: SemanticCluster;
      haloRadius: number;
      boundaryRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
      washMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    }
    const clusterBannerRecords: ClusterBannerRecord[] = [];
    const pickableBannerSprites: THREE.Sprite[] = [];

    // Shared smooth radial gradient texture for soft archival watercolor washes
    const washTexture = createRadialWashTexture();

    if (clusters && clusters.length > 0) {
      interface BannerSlot {
        cluster: SemanticCluster;
        x: number;
        y: number;
        z: number;
        haloRadius: number;
        colorObj: THREE.Color;
      }
      const bannerSlots: BannerSlot[] = [];

      // 1. Calculate overall galaxy center
      let galaxyCenterX = 0;
      let galaxyCenterY = 0;
      let galaxyCenterZ = 0;
      for (const c of clusters) {
        galaxyCenterX += c.centroid.x;
        galaxyCenterY += c.centroid.y;
        galaxyCenterZ += c.centroid.z;
      }
      galaxyCenterX /= clusters.length;
      galaxyCenterY /= clusters.length;
      galaxyCenterZ /= clusters.length;

      // 2. Compute halo radius and radial outer frontier placement for each cluster
      for (let idx = 0; idx < clusters.length; idx++) {
        const c = clusters[idx];
        let maxDist = 70;
        const mediaSet = new Set(c.mediaIds || []);
        for (const mId of mediaSet) {
          const n = nodeIndexMap.get(mId);
          if (n) {
            const d = Math.hypot(n.x - c.centroid.x, n.y - c.centroid.y);
            if (d > maxDist) maxDist = d;
          }
        }

        const haloRadius = Math.max(80, Math.min(240, maxDist + 20));

        let dirX = c.centroid.x - galaxyCenterX;
        let dirY = c.centroid.y - galaxyCenterY;
        const distFromCenter = Math.hypot(dirX, dirY);

        if (distFromCenter < 12) {
          // If cluster is at the exact center, radiate outwards by slice index
          const angle = (idx / clusters.length) * Math.PI * 2;
          dirX = Math.cos(angle);
          dirY = Math.sin(angle);
        } else {
          dirX /= distFromCenter;
          dirY /= distFromCenter;
        }

        // Anchor banner along the outward frontier perimeter of the territory
        // Fans out around the constellation so central stars remain completely visible
        const radialOffset = haloRadius * 0.74 + 14;
        const bannerX = c.centroid.x + dirX * radialOffset;
        const bannerY = c.centroid.y + dirY * radialOffset;
        const bannerZ = c.centroid.z + 8;

        bannerSlots.push({
          cluster: c,
          x: bannerX,
          y: bannerY,
          z: bannerZ,
          haloRadius,
          colorObj: new THREE.Color(c.color),
        });
      }

      // 3. Multi-pass 2D spring relaxation de-collision pass (ensures zero overlap)
      const minGapX = 180;
      const minGapY = 52;
      for (let iter = 0; iter < 12; iter++) {
        for (let i = 0; i < bannerSlots.length; i++) {
          for (let j = i + 1; j < bannerSlots.length; j++) {
            const bA = bannerSlots[i];
            const bB = bannerSlots[j];
            let dx = bA.x - bB.x;
            let dy = bA.y - bB.y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx < minGapX && absDy < minGapY) {
              const overlapX = (minGapX - absDx) / 2;
              const overlapY = (minGapY - absDy) / 2;

              if (absDx === 0 && absDy === 0) {
                dx = (Math.random() - 0.5) * 2;
                dy = (Math.random() - 0.5) * 2;
              }

              if (dx >= 0) {
                bA.x += overlapX * 0.7;
                bB.x -= overlapX * 0.7;
              } else {
                bA.x -= overlapX * 0.7;
                bB.x += overlapX * 0.7;
              }

              if (dy >= 0) {
                bA.y += overlapY * 0.8;
                bB.y -= overlapY * 0.8;
              } else {
                bA.y -= overlapY * 0.8;
                bB.y += overlapY * 0.8;
              }
            }
          }
        }
      }

      for (const slot of bannerSlots) {
        const c = slot.cluster;

        // 1. Soft galactic territory watercolor floor wash (smooth radial density falloff, no donut hole)
        const washGeo = new THREE.PlaneGeometry(
          slot.haloRadius * 2,
          slot.haloRadius * 2
        );
        const washMat = new THREE.MeshBasicMaterial({
          map: washTexture,
          color: slot.colorObj,
          transparent: true,
          opacity: isDark ? 0.45 : 0.32,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const washMesh = new THREE.Mesh(washGeo, washMat);
        washMesh.position.set(c.centroid.x, c.centroid.y, c.centroid.z - 4);
        territorySpritesGroup.add(washMesh);

        // 2. Refined celestial latitude perimeter boundary ring (delicate frontier boundary)
        const boundaryGeo = new THREE.RingGeometry(
          slot.haloRadius * 0.85 - 0.9,
          slot.haloRadius * 0.85 + 0.9,
          96
        );
        const boundaryMat = new THREE.MeshBasicMaterial({
          color: slot.colorObj,
          transparent: true,
          opacity: isDark ? 0.35 : 0.28,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const boundaryMesh = new THREE.Mesh(boundaryGeo, boundaryMat);
        boundaryMesh.position.set(
          c.centroid.x,
          c.centroid.y,
          c.centroid.z - 3.8
        );
        territorySpritesGroup.add(boundaryMesh);

        // 3. Ground meridian beacon point at cluster centroid
        const beaconGeo = new THREE.RingGeometry(2, 5, 32);
        const beaconMat = new THREE.MeshBasicMaterial({
          color: slot.colorObj,
          transparent: true,
          opacity: isDark ? 0.40 : 0.30,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        beaconMesh.position.set(
          c.centroid.x,
          c.centroid.y,
          c.centroid.z - 3.2
        );
        territorySpritesGroup.add(beaconMesh);

        // 4. Hairline anchor tether linking centroid to floating plaque
        const tetherGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(c.centroid.x, c.centroid.y, c.centroid.z - 2),
          new THREE.Vector3(slot.x, slot.y - 12, slot.z),
        ]);
        const tetherMat = new THREE.LineBasicMaterial({
          color: slot.colorObj,
          transparent: true,
          opacity: isDark ? 0.28 : 0.20,
          depthWrite: false,
        });
        const tetherLine = new THREE.Line(tetherGeo, tetherMat);
        territorySpritesGroup.add(tetherLine);

        // 5. Refined celestial territory plaque
        const { sprite, baseW, baseH } = createClusterBannerSprite(c, isDark);
        sprite.position.set(slot.x, slot.y, slot.z);
        sprite.userData = { isClusterBanner: true, clusterId: c.id };
        territorySpritesGroup.add(sprite);

        clusterBannerRecords.push({
          sprite,
          baseW,
          baseH,
          cluster: c,
          haloRadius: slot.haloRadius,
          boundaryRing: boundaryMesh,
          washMesh,
        });
        pickableBannerSprites.push(sprite);
      }
    }
    scene.add(territorySpritesGroup);

    // Pointer / Raycasting state
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isDragging = false;
    let dragMoved = false;
    let prevX = 0;
    let prevY = 0;

    const onPointerDown = (e: MouseEvent) => {
      isDragging = true;
      dragMoved = false;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          dragMoved = true;
        }
        prevX = e.clientX;
        prevY = e.clientY;

        if (cameraModeRef.current === 'FREE_LOOK' || e.shiftKey) {
          camSphericalRef.current.goalX -= dx * 0.35;
          camSphericalRef.current.goalY += dy * 0.35;
        } else {
          camSphericalRef.current.theta -= dx * 0.0065;
          camSphericalRef.current.phi = Math.max(
            0.22,
            Math.min(Math.PI - 0.22, camSphericalRef.current.phi - dy * 0.0065)
          );
        }
        return;
      }

      pointer.x = (localX / rect.width) * 2 - 1;
      pointer.y = -(localY / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const visibleMeshes = selectedIdRef.current
        ? pickableMeshes.filter((m) => {
            const nId = m.userData?.nodeId as string;
            const grp = nodeAssembliesMap.get(nId)?.group;
            return grp ? grp.visible : true;
          })
        : pickableMeshes;

      const intersects = raycaster.intersectObjects(visibleMeshes, false);
      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData?.nodeId as string;
        const hitNode = simNodes.find((n) => n.id === hitId) || null;
        renderer.domElement.style.cursor = 'pointer';
        hoveredClusterIdRef.current = null;
        if (hitNode) {
          hoveredIdRef.current = hitNode.id;
          setHoveredNodeId(hitNode.id);
          setHoveredTooltip({
            node: hitNode,
            x: localX,
            y: localY,
          });
        }
      } else {
        // Check if cursor hovers over a genre territory nameplate
        const bannerIntersects = raycaster.intersectObjects(
          pickableBannerSprites,
          false
        );
        if (bannerIntersects.length > 0) {
          const hitBanner = bannerIntersects[0].object as THREE.Sprite;
          const hitClusterId = hitBanner.userData?.clusterId as string;
          renderer.domElement.style.cursor = 'pointer';
          hoveredClusterIdRef.current = hitClusterId;
        } else {
          hoveredClusterIdRef.current = null;
          renderer.domElement.style.cursor = 'grab';
        }
        if (hoveredIdRef.current !== null) {
          hoveredIdRef.current = null;
          setHoveredNodeId(null);
          setHoveredTooltip(null);
        }
      }
    };

    const onPointerUp = (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (dragMoved) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const visibleMeshes = selectedIdRef.current
        ? pickableMeshes.filter((m) => {
            const nId = m.userData?.nodeId as string;
            const grp = nodeAssembliesMap.get(nId)?.group;
            return grp ? grp.visible : true;
          })
        : pickableMeshes;

      const intersects = raycaster.intersectObjects(visibleMeshes, false);
      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData?.nodeId as string;
        const hitNode = simNodes.find((n) => n.id === hitId);
        if (hitNode) {
          onSelectNode(hitNode);
          frameNodeAndLinkedCluster(hitNode.id);
        }
      } else {
        // Check if user clicked a 3D genre territory banner
        const bannerIntersects = raycaster.intersectObjects(
          pickableBannerSprites,
          false
        );
        if (bannerIntersects.length > 0) {
          const hitBanner = bannerIntersects[0].object as THREE.Sprite;
          const hitClusterId = hitBanner.userData?.clusterId as string;
          const hitCluster = clusters.find((c) => c.id === hitClusterId);
          if (hitCluster) {
            onSelectClusterRef.current?.(
              graphFiltersRef.current?.activeClusterId === hitClusterId
                ? null
                : hitClusterId
            );
            const hitRecord = clusterBannerRecords.find(
              (r) => r.cluster.id === hitClusterId
            );
            const targetRadius = hitRecord
              ? Math.max(480, hitRecord.haloRadius * 2.7)
              : 600;
            camSphericalRef.current.goalX = hitCluster.centroid.x;
            camSphericalRef.current.goalY = hitCluster.centroid.y;
            camSphericalRef.current.goalZ = hitCluster.centroid.z;
            camSphericalRef.current.goalRadius = targetRadius;
            return;
          }
        } else {
          if (selectedIdRef.current) {
            onClearSelection?.();
          }
          if (graphFiltersRef.current?.activeClusterId) {
            onSelectClusterRef.current?.(null);
          }
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const visibleMeshes = selectedIdRef.current
        ? pickableMeshes.filter((m) => {
            const nId = m.userData?.nodeId as string;
            const grp = nodeAssembliesMap.get(nId)?.group;
            return grp ? grp.visible : true;
          })
        : pickableMeshes;

      const intersects = raycaster.intersectObjects(visibleMeshes, false);
      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData?.nodeId as string;
        const hitNode = simNodes.find((n) => n.id === hitId);
        if (
          hitNode &&
          (hitNode.type === 'MOVIE' || hitNode.type === 'TV') &&
          hitNode.mediaItem
        ) {
          onMakeFocal(hitNode.mediaItem.id);
          camSphericalRef.current.goalX = 0;
          camSphericalRef.current.goalY = 0;
          camSphericalRef.current.goalZ = 0;
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleZoomStep(e.deltaY * 0.22);
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domElem.addEventListener('dblclick', onDoubleClick);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (!selectedIdRef.current && !focalItem) {
        const bounds = computeGraphBounds(nodesRef.current, clusters);
        const nextDist = computeResponsive3DDistance(w, h, bounds);
        camSphericalRef.current.goalRadius = nextDist;
      }
    };
    window.addEventListener('resize', onResize);

    // 3D Force-Directed Layout & Render Loop
    let frameId = 0;
    let clock = 0;
    const upVec = new THREE.Vector3(0, 1, 0);
    const dirVec = new THREE.Vector3();

    let cachedSelectedId: string | null = null;
    let cachedSelectedSub: LinkedSubgraphResult | null = null;
    let cachedIsolatedTargets = new Map<
      string,
      { x: number; y: number; z: number }
    >();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      clock += 0.016;

      const fSettings = forceRef.current;
      const camState = camSphericalRef.current;
      const activeHover = hoveredIdRef.current;
      const activeSelected = selectedIdRef.current;
      const hasActiveFocus = Boolean(activeSelected || activeHover);

      if (activeSelected !== cachedSelectedId) {
        cachedSelectedId = activeSelected;
        cachedSelectedSub = activeSelected
          ? computeLinkedSubgraph(activeSelected, simNodes, linksRef.current)
          : null;
        cachedIsolatedTargets = cachedSelectedSub
          ? computeIsolatedLayoutTargets(cachedSelectedSub)
          : new Map();
      }

      const selSub = cachedSelectedSub;
      const isIsolatedMode = Boolean(selSub && selSub.focusNode);

      if (!isIsolatedMode) {
        for (let i = 0; i < simNodes.length; i++) {
          const nA = simNodes[i];
          if (nA.isFocal) {
            nA.x = 0;
            nA.y = 0;
            nA.z = 0;
            continue;
          }

          // Gentle restoring pull toward initial orbital / cluster seed position
          const home = homePositions3D.get(nA.id);
          const hasFocalMovie = Boolean(focalItem);

          if (hasFocalMovie && (nA.type === 'MOVIE' || nA.type === 'TV') && nA.similarity) {
            // ONLY in single-title Focal Mode: pull outward radially from (0,0,0) by similarity linkDistance
            const targetR =
              nA.similarity.linkDistance * fSettings.linkDistanceMultiplier;
            const curR =
              Math.sqrt(nA.x * nA.x + nA.y * nA.y + nA.z * nA.z) || 1;
            const radialDelta =
              (targetR - curR) * 0.032 * fSettings.sphericalForce;
            nA.vx += (nA.x / curR) * radialDelta;
            nA.vy += (nA.y / curR) * radialDelta;
            nA.vz += (nA.z / curR) * radialDelta;
            if (home) {
              nA.vx += (home.x - nA.x) * 0.015;
              nA.vy += (home.y - nA.y) * 0.015;
              nA.vz += (home.z - nA.z) * 0.015;
            }
          } else if (home) {
            // In Semantic Galaxy & Archive Constellation modes:
            // Every movie and TV show MUST stay clustered around its genre territory / UMAP centroid!
            const springK = 0.07;
            nA.vx += (home.x - nA.x) * springK;
            nA.vy += (home.y - nA.y) * springK;
            nA.vz += (home.z - nA.z) * springK;
          }

          for (let j = i + 1; j < simNodes.length; j++) {
            const nB = simNodes[j];
            const dx = nA.x - nB.x;
            const dy = nA.y - nB.y;
            const dz = nA.z - nB.z;
            const distSq = dx * dx + dy * dy + dz * dz + 1;
            if (distSq < 3600) {
              const force = (28 * fSettings.sphericalForce) / distSq;
              nA.vx += dx * force;
              nA.vy += dy * force;
              nA.vz += dz * force * fSettings.zRepulsion;
              if (!nB.isFocal) {
                nB.vx -= dx * force;
                nB.vy -= dy * force;
                nB.vz -= dz * force * fSettings.zRepulsion;
              }
            }
          }
        }

        for (const node of simNodes) {
          if (
            node.type !== 'MOVIE' &&
            node.type !== 'TV' &&
            node.connectedMediaIds.length > 0
          ) {
            let cx = 0;
            let cy = 0;
            let cz = 0;
            let cnt = 0;
            for (const mId of node.connectedMediaIds) {
              const mNode = nodeIndexMap.get(mId);
              if (mNode) {
                cx += mNode.x;
                cy += mNode.y;
                cz += mNode.z;
                cnt++;
              }
            }
            if (cnt > 0) {
              cx /= cnt;
              cy /= cnt;
              cz /= cnt;
              const norm = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
              const targetX = cx + (cx / norm) * 24;
              const targetY = cy + (cy / norm) * 24;
              const targetZ = (cz + (cz / norm) * 24) * fSettings.zRepulsion;
              node.vx += (targetX - node.x) * 0.04;
              node.vy += (targetY - node.y) * 0.04;
              node.vz += (targetZ - node.z) * 0.04;
            }
          }
        }
      }

      if (cameraModeRef.current === 'FLY_THROUGH' && !isDragging) {
        camState.flyTimer += 0.016;
        const mediaNodes = simNodes.filter(
          (n) =>
            (n.type === 'MOVIE' || n.type === 'TV') &&
            (!selSub || selSub.linkedNodeIds.has(n.id))
        );
        if (mediaNodes.length > 0) {
          if (camState.flyTimer > 4.2) {
            camState.flyTimer = 0;
            camState.flyIndex = (camState.flyIndex + 1) % mediaNodes.length;
          }
          const flyTarget = mediaNodes[camState.flyIndex];
          if (flyTarget) {
            camState.goalX = flyTarget.x;
            camState.goalY = flyTarget.y;
            camState.goalZ = flyTarget.z;
            camState.goalRadius = 125;
            camState.theta += 0.0045;
          }
        }
      } else if (
        autoRotateRef.current &&
        !isDragging &&
        !activeHover &&
        !activeSelected
      ) {
        camState.theta += 0.002;
      }

      camState.radius += (camState.goalRadius - camState.radius) * 0.08;
      camState.targetX += (camState.goalX - camState.targetX) * 0.08;
      camState.targetY += (camState.goalY - camState.targetY) * 0.08;
      camState.targetZ += (camState.goalZ - camState.targetZ) * 0.08;

      const camX =
        camState.targetX +
        camState.radius * Math.sin(camState.phi) * Math.sin(camState.theta);
      const camY =
        camState.targetY + camState.radius * Math.cos(camState.phi);
      const camZ =
        camState.targetZ +
        camState.radius * Math.sin(camState.phi) * Math.cos(camState.theta);

      camera.position.set(camX, camY, camZ);
      camera.lookAt(camState.targetX, camState.targetY, camState.targetZ);

      // Compute optional hover subgraph
      const hovSub =
        activeHover && activeHover !== activeSelected
          ? computeLinkedSubgraph(activeHover, simNodes, linksRef.current)
          : null;

      const highlightedNodeSet = new Set<string>();
      const illuminatedLinkSet = new Set<string>();
      const directLinkSet = new Set<string>();

      if (selSub) {
        for (const id of selSub.linkedNodeIds) highlightedNodeSet.add(id);
        for (const id of selSub.allIlluminatedLinkIds)
          illuminatedLinkSet.add(id);
        for (const id of selSub.directLinkIds) directLinkSet.add(id);
      } else if (hovSub) {
        for (const id of hovSub.linkedNodeIds) highlightedNodeSet.add(id);
        for (const id of hovSub.allIlluminatedLinkIds)
          illuminatedLinkSet.add(id);
        for (const id of hovSub.directLinkIds) directLinkSet.add(id);
      }

      for (const node of simNodes) {
        const isInIsolatedSubgraph =
          !isIsolatedMode || Boolean(selSub?.linkedNodeIds.has(node.id));

        if (isIsolatedMode) {
          if (isInIsolatedSubgraph) {
            const isoTarget = cachedIsolatedTargets.get(node.id);
            if (isoTarget) {
              node.vx = 0;
              node.vy = 0;
              node.vz = 0;
              node.x += (isoTarget.x - node.x) * 0.12;
              node.y += (isoTarget.y - node.y) * 0.12;
              node.z += (isoTarget.z - node.z) * 0.12;
            }
          }
        } else if (!node.isFocal) {
          node.vx *= 0.82;
          node.vy *= 0.82;
          node.vz *= 0.82;
          node.x += node.vx;
          node.y += node.vy;
          node.z += node.vz;
        }

        const assembly = nodeAssembliesMap.get(node.id);
        if (assembly) {
          const grp = assembly.group;
          // Strictly hide unconnected nodes when a node is selected
          grp.visible = isInIsolatedSubgraph;
          if (!isInIsolatedSubgraph) continue;

          grp.position.set(node.x, node.y, node.z);

          const isNodeSelected = node.id === activeSelected;
          const isNodeHovered = node.id === activeHover;
          const isNodeLinked =
            !hasActiveFocus ||
            isNodeSelected ||
            isNodeHovered ||
            highlightedNodeSet.has(node.id);

          const targetScale = isNodeHovered
            ? 1.32
            : isNodeSelected
              ? 1.26
              : hasActiveFocus && isNodeLinked
                ? 1.15
                : hasActiveFocus
                  ? 0.86
                  : 1.0;
          grp.scale.lerp(
            new THREE.Vector3(targetScale, targetScale, targetScale),
            0.15
          );

          // Orient selection & linked-node beacon rings toward camera
          assembly.selectionHalo.lookAt(camera.position);
          assembly.outerRingHalo.lookAt(camera.position);
          if (assembly.statusRing) {
            assembly.statusRing.lookAt(camera.position);
          }

          if (!hasActiveFocus) {
            assembly.selectionHaloMat.opacity = 0;
            assembly.outerRingHaloMat.opacity = 0;
          } else if (isNodeSelected || isNodeHovered) {
            assembly.selectionHaloMat.opacity = 0.92;
            assembly.outerRingHaloMat.opacity =
              0.68 + Math.sin(clock * 4.5) * 0.24;
            const pulse = 1.0 + Math.sin(clock * 4.5) * 0.08;
            assembly.outerRingHalo.scale.set(pulse, pulse, 1);
          } else if (isNodeLinked) {
            assembly.selectionHaloMat.opacity = 0.76;
            assembly.outerRingHaloMat.opacity = 0.32;
            assembly.outerRingHalo.scale.set(1, 1, 1);
          } else {
            assembly.selectionHaloMat.opacity = 0;
            assembly.outerRingHaloMat.opacity = 0;
          }

          // MOVIE MAP REA: FILTER DIMMING LOGIC
          const isFilterMatch = node.isFilterMatch !== false;

          // Update 3D Label Sprite opacity & scale with camera-distance, labelMode, & filter dimming
          if (assembly.labelSprite) {
            const baseS = assembly.baseLabelScale;
            const aspect = 188 / 680;

            if (labelModeRef.current === 'OFF') {
              assembly.labelSprite.material.opacity = 0;
            } else if (!isFilterMatch) {
              // Dimmed filtered nodes hide their labels so only matching nodes shine
              assembly.labelSprite.material.opacity = 0;
            } else if (labelModeRef.current === 'ALL') {
              assembly.labelSprite.material.opacity = 0.95;
              assembly.labelSprite.scale.set(baseS, baseS * aspect, 1);
            } else if (!hasActiveFocus) {
              const shouldShowInRest =
                node.isFocal ||
                (camState.radius < 170 &&
                  ((node.connectionCount ?? 0) >= 4 ||
                    (node.mediaItem && node.mediaItem.imdbRating >= 8.5)));
              assembly.labelSprite.material.opacity = shouldShowInRest ? 0.92 : 0;
              assembly.labelSprite.scale.set(baseS, baseS * aspect, 1);
            } else if (isNodeSelected || isNodeHovered) {
              assembly.labelSprite.material.opacity = 1.0;
              const s = baseS * 1.18;
              assembly.labelSprite.scale.set(s, s * aspect, 1);
            } else if (isNodeLinked) {
              assembly.labelSprite.material.opacity = 0.95;
              const s = baseS * 1.05;
              assembly.labelSprite.scale.set(s, s * aspect, 1);
            } else {
              assembly.labelSprite.material.opacity = 0;
              const s = baseS * 0.85;
              assembly.labelSprite.scale.set(s, s * aspect, 1);
            }
          }

          // Bespoke sleek per-category kinetic micro-animations for real 3D category models
          const phase = clock + assembly.phaseOffset;
          const speedBoost =
            isNodeHovered || isNodeSelected
              ? 2.2
              : hasActiveFocus && isNodeLinked
                ? 1.4
                : 1.0;

          if (assembly.nodeType === 'MOVIE') {
            assembly.coreObject.rotation.z -= 0.011 * speedBoost;
            assembly.coreObject.rotation.y =
              -0.25 + Math.sin(phase * 0.7) * 0.28;
          } else if (assembly.nodeType === 'TV') {
            assembly.coreObject.rotation.y = Math.sin(phase * 0.75) * 0.35;
            assembly.coreObject.rotation.x = Math.cos(phase * 0.5) * 0.08;
          } else if (assembly.nodeType === 'DIRECTOR') {
            assembly.coreObject.rotation.y = Math.sin(phase * 0.8) * 0.32;
            if (assembly.outerShell) {
              assembly.outerShell.rotation.z =
                isNodeHovered || isNodeSelected
                  ? Math.abs(Math.sin(clock * 7.5)) * 0.42
                  : 0.28 + Math.sin(phase * 1.4) * 0.08;
            }
          } else if (assembly.nodeType === 'ACTOR') {
            assembly.coreObject.rotation.y += 0.01 * speedBoost;
            assembly.coreObject.rotation.z = Math.sin(phase * 1.1) * 0.08;
          } else if (assembly.nodeType === 'TROPE') {
            assembly.coreObject.rotation.y = Math.sin(phase * 0.85) * 0.34;
            assembly.coreObject.rotation.x =
              0.35 + Math.cos(phase * 0.7) * 0.08;
          } else if (assembly.nodeType === 'COMPOSER') {
            assembly.coreObject.rotation.y = Math.sin(phase * 0.95) * 0.36;
            assembly.coreObject.rotation.z = Math.cos(phase * 1.3) * 0.09;
            if (assembly.outerShell) {
              assembly.outerShell.rotation.z += 0.014 * speedBoost;
              assembly.outerShell.rotation.x =
                Math.PI / 3 + Math.sin(phase) * 0.16;
            }
          }

          if (assembly.isFocal && assembly.secondaryRing) {
            assembly.secondaryRing.rotation.z += 0.009 * speedBoost;
          }

          for (const mat of assembly.primaryMaterials) {
            if (!isFilterMatch) {
              // In DIM mode, non-matching nodes remain visibly grounded as a soft celestial field
              mat.opacity = isDark ? 0.32 : 0.44;
              mat.emissiveIntensity = isDark ? 0.04 : 0.07;
            } else if (!hasActiveFocus) {
              mat.opacity = 0.98;
              mat.emissiveIntensity = node.isFocal ? 0.34 : 0.18;
            } else {
              mat.opacity = isNodeLinked ? 1.0 : (isDark ? 0.18 : 0.26);
              mat.emissiveIntensity =
                isNodeSelected || isNodeHovered
                  ? 0.52
                  : isNodeLinked
                    ? 0.38
                    : 0.03;
            }
          }
          for (const accMat of assembly.accentMaterials) {
            if (!isFilterMatch) {
              accMat.opacity = isDark ? 0.12 : 0.20;
            } else {
              accMat.opacity = !hasActiveFocus ? 0.98 : isNodeLinked ? 1.0 : 0.16;
            }
          }
        }
      }

      for (const entry of linkEntries) {
        const src = nodeIndexMap.get(entry.link.source);
        const tgt = nodeIndexMap.get(entry.link.target);
        if (!src || !tgt) continue;

        const isLinkInIsolated =
          !isIsolatedMode ||
          Boolean(selSub?.allIlluminatedLinkIds.has(entry.link.id));

        // Strictly hide unconnected links when a node is selected
        entry.line.visible = isLinkInIsolated;
        if (!isLinkInIsolated) {
          entry.beamMesh.visible = false;
          continue;
        }

        const posAttr = entry.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        posAttr.setXYZ(0, src.x, src.y, src.z);
        posAttr.setXYZ(1, tgt.x, tgt.y, tgt.z);
        posAttr.needsUpdate = true;

        if (!hasActiveFocus) {
          const endpointsMatch = (src.isFilterMatch !== false) && (tgt.isFilterMatch !== false);
          entry.material.opacity = !endpointsMatch
            ? (isDark ? 0.03 : 0.05)
            : entry.link.kind === 'SIMILARITY_DIRECT'
              ? 0.52
              : 0.28;
          entry.beamMesh.visible = false;
        } else {
          const lit = illuminatedLinkSet.has(entry.link.id);
          entry.material.opacity = lit ? 0.98 : 0.04;

          if (lit) {
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dz = tgt.z - src.z;
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (len > 0.001) {
              entry.beamMesh.visible = true;
              entry.beamMesh.position.set(
                (src.x + tgt.x) * 0.5,
                (src.y + tgt.y) * 0.5,
                (src.z + tgt.z) * 0.5
              );
              dirVec.set(dx / len, dy / len, dz / len);
              entry.beamMesh.quaternion.setFromUnitVectors(upVec, dirVec);
              const isDirect = directLinkSet.has(entry.link.id);
              const thickness = isDirect ? 0.56 : 0.38;
              entry.beamMesh.scale.set(thickness, len, thickness);
              entry.beamMaterial.opacity = isDirect ? 0.85 : 0.62;
            } else {
              entry.beamMesh.visible = false;
            }
          } else {
            entry.beamMesh.visible = false;
          }
        }
      }

      if (focalOuterOrbitalRing) {
        focalOuterOrbitalRing.rotation.x -= 0.007;
        focalOuterOrbitalRing.rotation.y += 0.005;
      }

      territorySpritesGroup.visible = Boolean(
        (layoutModeRef.current === 'SEMANTIC_GALAXY' || layoutModeRef.current === 'FORCE_CONSTELLATION') && showTerritoriesRef.current && !isIsolatedMode
      );
      orbitRingsGroup.visible = Boolean(focalItem);

      // Dynamic distance-aware scaling and graceful zoom fading for territory plaques
      const camDist = camState.radius;
      const bannerScaleFactor = Math.max(0.9, Math.min(1.35, camDist / 780));
      const zoomOpacity = Math.max(0.45, Math.min(1.0, (camDist - 120) / 200));

      for (let i = 0; i < clusterBannerRecords.length; i++) {
        const item = clusterBannerRecords[i];
        const isSelected = graphFiltersRef.current?.activeClusterId === item.cluster.id;
        const isHovered = hoveredClusterIdRef.current === item.cluster.id;
        const hasAnyClusterActive = Boolean(graphFiltersRef.current?.activeClusterId);

        const highlightMultiplier = isSelected ? 1.20 : isHovered ? 1.08 : 1.0;
        item.sprite.scale.set(
          item.baseW * bannerScaleFactor * highlightMultiplier,
          item.baseH * bannerScaleFactor * highlightMultiplier,
          1
        );
        item.sprite.material.opacity = isSelected
          ? 1.0
          : isHovered
            ? 1.0
            : hasAnyClusterActive
              ? zoomOpacity * 0.45
              : zoomOpacity;

        if (item.boundaryRing) {
          (item.boundaryRing.material as THREE.MeshBasicMaterial).opacity = isSelected
            ? 0.70
            : isHovered
              ? 0.50
              : hasAnyClusterActive
                ? (isDark ? 0.14 : 0.10)
                : (isDark ? 0.35 : 0.28);
        }

        if (item.washMesh) {
          (item.washMesh.material as THREE.MeshBasicMaterial).opacity = isSelected
            ? (isDark ? 0.75 : 0.55)
            : isHovered
              ? (isDark ? 0.55 : 0.42)
              : hasAnyClusterActive
                ? (isDark ? 0.16 : 0.12)
                : (isDark ? 0.45 : 0.32);
        }
      }

      starField.rotation.y += 0.00025;

      renderer.render(scene, camera);
    };

    threeContextRef.current = {
      simNodes,
      nodeAssembliesMap,
      homePositions3D,
      linkEntries,
      territorySpritesGroup,
    };

    animate();

    return () => {
      threeContextRef.current = null;
      cancelAnimationFrame(frameId);
      domElem.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      domElem.removeEventListener('dblclick', onDoubleClick);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);

      // Explicitly dispose GPU geometries, materials, and textures per Three.js best practices
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.Line ||
          obj instanceof THREE.Points
        ) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        } else if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });
      washTexture.dispose();
      sharedBeamUnitGeo.dispose();
      envTexture.dispose();
      renderer.dispose();
    };
  }, [
    viewMode,
    theme,
    nodeStructureKey,
    linksStructureKey,
    onSelectNode,
    onClearSelection,
    onMakeFocal,
    handleZoomStep,
    frameNodeAndLinkedCluster,
  ]);

  // ==================== 2D CANVAS GRAPH EFFECT ====================
  useEffect(() => {
    if (viewMode !== '2D') return;
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const homePositions2D = new Map<string, { x: number; y: number }>();
    const simNodes: GraphNode[] = nodes.map((n) => {
      const hx = n.x;
      const hy = n.y;
      homePositions2D.set(n.id, { x: hx, y: hy });
      return {
        ...n,
        x: hx,
        y: hy,
      };
    });
    nodesRef.current = simNodes;
    linksRef.current = links;
    canvas2dContextRef.current = { simNodes, homePositions2D };

    let cachedSelectedId2D: string | null = null;
    let cachedSelectedSub2D: LinkedSubgraphResult | null = null;
    let cachedIsolatedTargets2D = new Map<
      string,
      { x: number; y: number; z: number }
    >();
    let clusterCartoucheBoxes: Array<{ id: string; minX: number; maxX: number; minY: number; maxY: number }> = [];

    let isDragging = false;
    let dragMoved = false;
    let lastX = 0;
    let lastY = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!selectedIdRef.current && !focalItem) {
        const bounds = computeGraphBounds(nodesRef.current, clusters);
        pan2dRef.current.goalZoom = computeResponsive2DZoom(parent.clientWidth, parent.clientHeight, bounds);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const parent = canvas.parentElement;
    const pw = parent?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const ph = parent?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
    const bounds = computeGraphBounds(simNodes, clusters);
    const responsiveZoom = computeResponsive2DZoom(pw, ph, bounds);

    if (!selectedIdRef.current && !focalItem) {
      pan2dRef.current.zoom = responsiveZoom;
      pan2dRef.current.goalZoom = responsiveZoom;
      pan2dRef.current.panX = 0;
      pan2dRef.current.panY = 0;
      pan2dRef.current.goalPanX = 0;
      pan2dRef.current.goalPanY = 0;
    }

    const screenToWorld = (sx: number, sy: number) => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const { panX, panY, zoom } = pan2dRef.current;
      return {
        wx: (sx - cw / 2 - panX) / zoom,
        wy: (sy - ch / 2 - panY) / zoom,
      };
    };

    // Build spatial quadtree for sub-millisecond 2D collision detection and hover
    let quadtree = SpatialQuadtree.fromPoints(
      simNodes.map((n) => ({ x: n.x, y: n.y, data: n }))
    );

    const findNodeAt = (sx: number, sy: number): GraphNode | null => {
      const { wx, wy } = screenToWorld(sx, sy);
      const activeSel = selectedIdRef.current;
      const activeSub = activeSel
        ? computeLinkedSubgraph(activeSel, simNodes, linksRef.current)
        : null;

      const maxHitRadius = 40 / Math.max(0.2, pan2dRef.current.zoom);
      const closest = quadtree.findClosest(wx, wy, maxHitRadius);
      if (closest) {
        const n = closest.point.data;
        if (activeSub?.focusNode && !activeSub.linkedNodeIds.has(n.id)) {
          // If filtered out by active isolated subgraph, search within radius
          const inRadius = quadtree.findInRadius(wx, wy, maxHitRadius);
          for (const cand of inRadius) {
            if (!activeSub.linkedNodeIds.has(cand.data.id)) continue;
            const dx = wx - cand.x;
            const dy = wy - cand.y;
            const hitR = cand.data.radius * 1.6 + 6;
            if (dx * dx + dy * dy <= hitR * hitR) return cand.data;
          }
          return null;
        }
        const hitR = n.radius * 1.6 + 6;
        if (closest.distance <= hitR) {
          return n;
        }
      }
      return null;
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragMoved = false;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
        pan2dRef.current.panX += dx;
        pan2dRef.current.panY += dy;
        pan2dRef.current.goalPanX = pan2dRef.current.panX;
        pan2dRef.current.goalPanY = pan2dRef.current.panY;
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }

      const hit = findNodeAt(sx, sy);
      if (hit) {
        canvas.style.cursor = 'pointer';
        hoveredIdRef.current = hit.id;
        setHoveredNodeId(hit.id);
        setHoveredTooltip({ node: hit, x: sx, y: sy });
      } else {
        const { wx, wy } = screenToWorld(sx, sy);
        const hitCartouche = clusterCartoucheBoxes.find(
          (box) => wx >= box.minX && wx <= box.maxX && wy >= box.minY && wy <= box.maxY
        );
        if (hitCartouche) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'grab';
        }
        if (hoveredIdRef.current) {
          hoveredIdRef.current = null;
          setHoveredNodeId(null);
          setHoveredTooltip(null);
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (dragMoved) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const hit = findNodeAt(sx, sy);
      if (hit) {
        onSelectNode(hit);
        frameNodeAndLinkedCluster(hit.id);
      } else {
        const { wx, wy } = screenToWorld(sx, sy);
        const hitCartouche = clusterCartoucheBoxes.find(
          (box) => wx >= box.minX && wx <= box.maxX && wy >= box.minY && wy <= box.maxY
        );
        if (hitCartouche && onSelectClusterRef.current) {
          const isSelected = graphFiltersRef.current?.activeClusterId === hitCartouche.id;
          onSelectClusterRef.current(isSelected ? null : hitCartouche.id);
        } else {
          if (selectedIdRef.current) {
            onClearSelection?.();
          }
          if (graphFiltersRef.current?.activeClusterId) {
            onSelectClusterRef.current?.(null);
          }
        }
      }
    };

    const onDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hit = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (hit && hit.mediaItem) {
        onMakeFocal(hit.mediaItem.id);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const nextZ = Math.max(
        0.45,
        Math.min(2.6, pan2dRef.current.goalZoom - e.deltaY * 0.0012)
      );
      pan2dRef.current.zoom = nextZ;
      pan2dRef.current.goalZoom = nextZ;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const nodeMap = new Map<string, GraphNode>();
    simNodes.forEach((n) => nodeMap.set(n.id, n));

    let animId = 0;
    let tick = 0;

    const render2D = () => {
      animId = requestAnimationFrame(render2D);
      tick += 0.02;

      if (!isDragging) {
        pan2dRef.current.panX +=
          (pan2dRef.current.goalPanX - pan2dRef.current.panX) * 0.1;
        pan2dRef.current.panY +=
          (pan2dRef.current.goalPanY - pan2dRef.current.panY) * 0.1;
        pan2dRef.current.zoom +=
          (pan2dRef.current.goalZoom - pan2dRef.current.zoom) * 0.1;
      }

      const isDark = theme === 'MOVIE_MAP_DARK';
      const { panX, panY, zoom } = pan2dRef.current;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      ctx.fillStyle = isDark ? '#0A0E17' : '#F6F1E7';
      ctx.fillRect(0, 0, cw, ch);

      ctx.save();
      ctx.translate(cw / 2 + panX, ch / 2 + panY);
      ctx.scale(zoom, zoom);

      // Engraved Concentric Kinship Rings
      const rings = [
        {
          r: 76,
          label: 'Shared Collaborators & Themes',
          color: 'rgba(184, 41, 47, 0.22)',
        },
        {
          r: 132,
          label: 'Connected Films & Series',
          color: 'rgba(35, 75, 110, 0.20)',
        },
        {
          r: 230,
          label: 'Extended Constellation',
          color: 'rgba(90, 82, 75, 0.22)',
        },
      ];

      // Archival Territory Watercolor Density Halos in 2D Galaxy Mode
      if (
        (layoutModeRef.current === 'SEMANTIC_GALAXY' ||
          layoutModeRef.current === 'FORCE_CONSTELLATION') &&
        showTerritoriesRef.current
      ) {
        ctx.save();
        const clusterPoints = new Map<string, Array<{ x: number; y: number }>>();
        for (const n of simNodes) {
          if (n.clusterId) {
            const list = clusterPoints.get(n.clusterId) || [];
            list.push({ x: n.x, y: n.y });
            clusterPoints.set(n.clusterId, list);
          }
        }

        const activeClusterList =
          clusters && clusters.length > 0
            ? clusters
            : Array.from(clusterPoints.keys()).map((id) => ({
              id,
              label: id,
              shortLabel: id,
              color: '#234B6E',
              glowColor: '#3D78A8',
              centroid: { x: 0, y: 0, z: 0 },
              keywords: [],
              genres: [],
              mediaIds: [],
            }));

        clusterCartoucheBoxes = [];
        for (const c of activeClusterList) {
          const pts = clusterPoints.get(c.id);
          if (!pts || pts.length === 0) continue;

          let avgX = 0;
          let avgY = 0;
          for (const p of pts) {
            avgX += p.x;
            avgY += p.y;
          }
          avgX /= pts.length;
          avgY /= pts.length;

          let maxDist = 0;
          for (const p of pts) {
            const d = Math.hypot(p.x - avgX, p.y - avgY);
            if (d > maxDist) maxDist = d;
          }
          const haloRadius = Math.max(75, Math.min(240, maxDist + 45));
          const isSelected = graphFiltersRef.current?.activeClusterId === c.id;

          // Soft watercolor gradient
          const grad = ctx.createRadialGradient(
            avgX,
            avgY,
            12,
            avgX,
            avgY,
            haloRadius
          );
          grad.addColorStop(0, `${c.color}${isSelected ? '35' : '22'}`);
          grad.addColorStop(0.5, `${c.color}${isSelected ? '18' : '0e'}`);
          grad.addColorStop(0.85, `${c.color}${isSelected ? '08' : '03'}`);
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(avgX, avgY, haloRadius, 0, Math.PI * 2);
          ctx.fill();

          // Delicate territory frontier boundary
          ctx.beginPath();
          ctx.arc(avgX, avgY, haloRadius * 0.85, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? `${c.color}65` : `${c.color}28`;
          ctx.lineWidth = isSelected ? 1.6 : 0.9;
          if (!isSelected) {
            ctx.setLineDash([3, 6]);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Celestial Archival Cartouche Nameplate
          ctx.save();
          const labelText = c.shortLabel || c.label;
          const countText = `${pts.length} TITLES`;
          const labelY = avgY - haloRadius * 0.85 - 12;

          ctx.font = '600 12px "Source Sans 3", -apple-system, sans-serif';
          const titleW = ctx.measureText(labelText).width;
          ctx.font = '600 9px "Source Sans 3", monospace';
          const countW = ctx.measureText(countText).width;

          const pillW = titleW + countW + 36;
          const pillH = 24;
          const pillX = avgX - pillW / 2;
          const pillY = labelY - pillH / 2;

          clusterCartoucheBoxes.push({
            id: c.id,
            minX: pillX,
            maxX: pillX + pillW,
            minY: pillY,
            maxY: pillY + pillH,
          });

          // Soft elevation shadow
          ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.60)' : 'rgba(23, 20, 18, 0.08)';
          ctx.shadowBlur = isDark ? 8 : 5;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = isDark ? 3 : 1.5;

          // Vellum card stock
          ctx.fillStyle = isDark
            ? (isSelected ? 'rgba(19, 26, 38, 0.98)' : 'rgba(11, 16, 29, 0.94)')
            : (isSelected ? '#F5EFE6' : 'rgba(251, 248, 242, 0.96)');
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, 12);
          ctx.fill();

          // Double/single hairline border
          ctx.shadowColor = 'transparent';
          ctx.lineWidth = isSelected ? 1.8 : 1.0;
          ctx.strokeStyle = isSelected
            ? c.color
            : (isDark ? 'rgba(255, 255, 255, 0.16)' : '#D5CCB9');
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, 12);
          ctx.stroke();

          // Celestial pip marker
          ctx.beginPath();
          ctx.arc(pillX + 11, labelY, 3, 0, Math.PI * 2);
          ctx.fillStyle = c.color;
          ctx.fill();

          // Label Title
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = '600 12px "Source Sans 3", -apple-system, sans-serif';
          ctx.fillStyle = isDark ? '#F0F4FC' : '#171412';
          ctx.fillText(labelText, pillX + 20, labelY);

          // Tabular count badge
          ctx.textAlign = 'right';
          ctx.font = '600 9px "Source Sans 3", monospace';
          ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.50)' : '#8C8070';
          ctx.fillText(countText, pillX + pillW - 10, labelY + 0.5);

          ctx.restore();
        }
        ctx.restore();
      }

      const activeHover = hoveredIdRef.current;
      const activeSelected = selectedIdRef.current;
      const hasActiveFocus = Boolean(activeSelected || activeHover);

      if (activeSelected !== cachedSelectedId2D) {
        cachedSelectedId2D = activeSelected;
        cachedSelectedSub2D = activeSelected
          ? computeLinkedSubgraph(activeSelected, simNodes, linksRef.current)
          : null;
        cachedIsolatedTargets2D = cachedSelectedSub2D
          ? computeIsolatedLayoutTargets(cachedSelectedSub2D)
          : new Map();
      }

      const selSub = cachedSelectedSub2D;
      const isIsolatedMode = Boolean(selSub && selSub.focusNode);

      // Smoothly transition node positions between isolated subgraph radial layout and full graph home positions
      let movedCount = 0;
      for (const node of simNodes) {
        if (isIsolatedMode) {
          if (selSub?.linkedNodeIds.has(node.id)) {
            const iso = cachedIsolatedTargets2D.get(node.id);
            if (iso) {
              const diffX = iso.x - node.x;
              const diffY = iso.y - node.y;
              if (Math.abs(diffX) > 0.4 || Math.abs(diffY) > 0.4) movedCount++;
              node.x += diffX * 0.14;
              node.y += diffY * 0.14;
            }
          }
        } else {
          const home = homePositions2D.get(node.id);
          if (home) {
            const diffX = home.x - node.x;
            const diffY = home.y - node.y;
            if (Math.abs(diffX) > 0.4 || Math.abs(diffY) > 0.4) movedCount++;
            node.x += diffX * 0.14;
            node.y += diffY * 0.14;
          }
        }
      }
      if (movedCount > 0) {
        quadtree = SpatialQuadtree.fromPoints(
          simNodes.map((n) => ({ x: n.x, y: n.y, data: n }))
        );
      }

      const hovSub =
        activeHover && activeHover !== activeSelected
          ? computeLinkedSubgraph(activeHover, simNodes, linksRef.current)
          : null;

      const highlightedNodeSet = new Set<string>();
      const illuminatedLinkSet = new Set<string>();
      const directLinkSet = new Set<string>();

      if (selSub) {
        for (const id of selSub.linkedNodeIds) highlightedNodeSet.add(id);
        for (const id of selSub.allIlluminatedLinkIds)
          illuminatedLinkSet.add(id);
        for (const id of selSub.directLinkIds) directLinkSet.add(id);
      } else if (hovSub) {
        for (const id of hovSub.linkedNodeIds) highlightedNodeSet.add(id);
        for (const id of hovSub.allIlluminatedLinkIds)
          illuminatedLinkSet.add(id);
        for (const id of hovSub.directLinkIds) directLinkSet.add(id);
      }

      // Draw Links (strictly hide unconnected links when a node is selected)
      for (const link of links) {
        if (isIsolatedMode && !selSub?.allIlluminatedLinkIds.has(link.id)) {
          continue;
        }
        const s = nodeMap.get(link.source);
        const t = nodeMap.get(link.target);
        if (!s || !t) continue;
        const lit = !hasActiveFocus || illuminatedLinkSet.has(link.id);
        const isDirect = directLinkSet.has(link.id);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = link.color;
        const endpointsMatch = (s.isFilterMatch !== false) && (t.isFilterMatch !== false);
        ctx.globalAlpha = !hasActiveFocus
          ? (!endpointsMatch ? (isDark ? 0.04 : 0.05) : (isDark ? 0.20 : 0.18))
          : lit
            ? 0.85
            : 0.03;
        ctx.lineWidth =
          lit && hasActiveFocus ? (isDirect ? 1.6 : 1.2) : 0.75;
        if (lit && hasActiveFocus) {
          ctx.shadowColor = link.color;
          ctx.shadowBlur = 6;
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw Nodes with bespoke category geometric silhouettes (strictly hide unconnected nodes when a node is selected)
      for (const node of simNodes) {
        if (isIsolatedMode && !selSub?.linkedNodeIds.has(node.id)) {
          continue;
        }
        const isSelected = node.id === activeSelected;
        const isHovered = node.id === activeHover;
        const isFilterMatch = node.isFilterMatch !== false;
        const isNodeLinked =
          !hasActiveFocus ||
          isSelected ||
          isHovered ||
          highlightedNodeSet.has(node.id);

        ctx.globalAlpha = !isFilterMatch
          ? (isDark ? 0.30 : 0.44)
          : isNodeLinked
            ? 1
            : (isDark ? 0.18 : 0.26);

        const rScaled =
          node.radius *
          (isHovered
            ? 1.28
            : isSelected
              ? 1.22
              : hasActiveFocus && isNodeLinked
                ? 1.12
                : 1);

        if (node.isFocal) {
          ctx.beginPath();
          ctx.arc(
            node.x,
            node.y,
            node.radius * 1.9 + Math.sin(tick * 1.8) * 2.5,
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = '#B8292F';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 1.45, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(184, 107, 20, 0.55)';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(
            node.x,
            node.y,
            rScaled * 1.58 + Math.sin(tick * 2.4) * 1.5,
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = '#B8292F';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x, node.y, rScaled * 1.32, 0, Math.PI * 2);
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        } else if (hasActiveFocus && isNodeLinked) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, rScaled * 1.38, 0, Math.PI * 2);
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Luminous Bloom Halo in Movie Map Dark Mode
        if (isDark && (isHovered || isSelected || (hasActiveFocus && isNodeLinked))) {
          ctx.save();
          const haloR = rScaled * (isHovered ? 2.6 : isSelected ? 2.2 : 1.7);
          const glowGrad = ctx.createRadialGradient(
            node.x,
            node.y,
            node.radius * 0.4,
            node.x,
            node.y,
            haloR
          );
          glowGrad.addColorStop(0, `${node.glowColor || node.color}55`);
          glowGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Stamped Multi-Ring Archival / Luminous Medallion Plate
        const nodeAccentColor = node.isFocal
          ? isDark
            ? '#FF3366'
            : '#B8292F'
          : node.color;
        const isPrimaryMedia =
          node.type === 'MOVIE' || node.type === 'TV' || node.isFocal;

        // 1. Crisp, Elegant Circular Node Dot (Obsidian Style)
        ctx.beginPath();
        ctx.arc(node.x, node.y, rScaled, 0, Math.PI * 2);
        ctx.fillStyle = nodeAccentColor;
        ctx.fill();

        // 2. Subtle Luminous Halo on Hover, Selection, or Focal
        if (isHovered || isSelected || node.isFocal) {
          ctx.save();
          const haloR = rScaled * (node.isFocal ? 2.8 : isHovered ? 2.4 : 1.9);
          const glowGrad = ctx.createRadialGradient(
            node.x,
            node.y,
            rScaled * 0.3,
            node.x,
            node.y,
            haloR
          );
          glowGrad.addColorStop(0, `${nodeAccentColor}77`);
          glowGrad.addColorStop(0.5, `${nodeAccentColor}22`);
          glowGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 2b. Personal Watched / Interested Concentric Status Ring & Ambient Aura
        if (node.isWatched || node.isInterested) {
          const isW = Boolean(node.isWatched);
          const statusColor = isW
            ? isDark
              ? '#10B981'
              : '#2A6B53'
            : isDark
              ? '#F59E0B'
              : '#B45309';
          const statusGlow = isW
            ? isDark
              ? '#34D399'
              : '#3D9970'
            : isDark
              ? '#FBBF24'
              : '#D97706';

          ctx.save();
          const ringR = rScaled * 1.55 + (isHovered ? 1.5 : 0);
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = statusColor;
          ctx.lineWidth = isW ? 1.8 : 1.5;
          if (!isW) {
            ctx.setLineDash([3, 2]);
          }
          ctx.stroke();

          const auraGrad = ctx.createRadialGradient(
            node.x,
            node.y,
            rScaled * 0.8,
            node.x,
            node.y,
            ringR + 4
          );
          auraGrad.addColorStop(0, `${statusGlow}33`);
          auraGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringR + 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 3. Crisp Border Ring on Focus / Hover / Selection
        if (node.isFocal) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, rScaled + 3.2, 0, Math.PI * 2);
          ctx.strokeStyle = isDark ? '#FF3366' : '#B8292F';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, rScaled + 2.4, 0, Math.PI * 2);
          ctx.strokeStyle = isDark ? '#FFFFFF' : '#171412';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // 4. Subtle center core pip for focal or high rating
        if (node.isFocal || (node.mediaItem && node.mediaItem.imdbRating >= 8.5)) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(1.0, rScaled * 0.35), 0, Math.PI * 2);
          ctx.fillStyle = isDark ? '#FFFFFF' : '#FBF8F2';
          ctx.fill();
        }

        // 5. Clean, Minimal Obsidian-Style Label (No heavy rectangular boxes)
        if (labelModeRef.current !== 'OFF' && isFilterMatch) {
          const shouldShowLabel =
            node.isFocal ||
            isSelected ||
            isHovered ||
            labelModeRef.current === 'ALL' ||
            (zoom > 0.82 && ((node.connectionCount ?? 0) >= 4 || (node.mediaItem && node.mediaItem.imdbRating >= 8.4)));

          if (shouldShowLabel) {
            const labelText =
              node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label;
            ctx.font = `${node.isFocal || isSelected || isHovered ? '600' : '400'
              } 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            ctx.fillStyle = isDark
              ? isHovered || isSelected || node.isFocal
                ? '#FFFFFF'
                : '#94A3B8'
              : isHovered || isSelected || node.isFocal
                ? '#171412'
                : '#52483E';
            ctx.fillText(labelText, node.x, node.y + rScaled + 4);
          }
        }
        ctx.textBaseline = 'alphabetic';
      }

      ctx.restore();
    };

    render2D();

    return () => {
      canvas2dContextRef.current = null;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [
    viewMode,
    theme,
    nodeStructureKey,
    linksStructureKey,
    onSelectNode,
    onClearSelection,
    onMakeFocal,
    frameNodeAndLinkedCluster,
  ]);

  // Ultra-fast in-place updates for colors, layout positions, and links without tearing down the 3D or 2D canvas
  useEffect(() => {
    // 1. Fast in-place updates for 3D Three.js WebGL Scene
    const ctx = threeContextRef.current;
    if (ctx && viewMode === '3D') {
      for (const node of nodes) {
        const assembly = ctx.nodeAssembliesMap.get(node.id);
        if (assembly) {
          for (const mat of assembly.primaryMaterials) {
            mat.color.set(node.color);
          }
          for (const mat of assembly.accentMaterials) {
            if ('color' in mat) (mat as any).color.set(node.glowColor);
          }
          if (assembly.selectionHaloMat) {
            assembly.selectionHaloMat.color.set(node.color);
          }
          if (assembly.outerRingHaloMat) {
            assembly.outerRingHaloMat.color.set(node.glowColor);
          }
          if (assembly.statusRingMat) {
            const isW = Boolean(node.isWatched);
            const isI = Boolean(node.isInterested);
            if (isW || isI) {
              assembly.statusRingMat.opacity = 0.9;
              assembly.statusRingMat.color.set(isW ? '#10B981' : '#F59E0B');
            } else {
              assembly.statusRingMat.opacity = 0;
            }
          }
        }

        // Smoothly transition node home position (physics spring glides them into place)
        const home = ctx.homePositions3D.get(node.id);
        if (home) {
          home.x = node.x;
          home.y = node.y;
          home.z = node.z;
        }

        // Update simNode properties
        const sNode = ctx.simNodes.find((sn) => sn.id === node.id);
        if (sNode) {
          sNode.color = node.color;
          sNode.glowColor = node.glowColor;
          sNode.isFilterMatch = node.isFilterMatch;
        }
      }

      // Update link line colors
      for (const entry of ctx.linkEntries) {
        const liveLink = links.find(
          (l) => l.source === entry.link.source && l.target === entry.link.target
        );
        if (liveLink) {
          entry.material.color.set(liveLink.color);
          entry.beamMaterial.color.set(liveLink.color);
        }
      }
    }

    // 2. Fast in-place updates for 2D Canvas Scene
    const c2d = canvas2dContextRef.current;
    if (c2d && viewMode === '2D') {
      for (const node of nodes) {
        const home = c2d.homePositions2D.get(node.id);
        if (home) {
          home.x = node.x;
          home.y = node.y;
        }
        const sNode = c2d.simNodes.find((sn) => sn.id === node.id);
        if (sNode) {
          sNode.color = node.color;
          sNode.glowColor = node.glowColor;
          sNode.isFilterMatch = node.isFilterMatch;
        }
      }
    }
  }, [nodes, links, colorMode, layoutMode, viewMode]);

  const isDark = theme === 'MOVIE_MAP_DARK';

  return (
    <div
      ref={rootRef}
      className="relative w-full h-full overflow-hidden select-none"
    >
      {/* 3D WebGL Mount Container */}
      {viewMode === '3D' && (
        <div
          ref={containerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          aria-label="Interactive 3D Film & Series Constellation Map"
        />
      )}

      {/* 2D Graph Canvas */}
      {viewMode === '2D' && (
        <canvas
          ref={canvas2dRef}
          className="w-full h-full block cursor-grab active:cursor-grabbing"
          aria-label="Interactive 2D Film & Series Map"
        />
      )}

      {/* Top-Left Curatorial Context Pill */}
      <div className="pointer-events-none absolute top-3 sm:top-4 left-3 sm:left-4 z-10 flex flex-col gap-1.5 max-w-[calc(100vw-1.5rem)]">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs backdrop-blur-md shadow-md sm:shadow-lg ${
              theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#101624]/90 border border-white/10 text-[#F0F4FC]'
                : 'bg-[#FBF8F2]/95 border border-[#C8BEAA] shadow-archival-sm text-[#171412]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                focalItem ? 'bg-[#B8292F]' : 'bg-[#2A6B53]'
              }`}
            />
            <span className="hidden sm:inline text-[#52483E]">
              {focalItem
                ? 'Centered on:'
                : graphScope === 'WATCHED_ONLY'
                  ? 'Watched Graph:'
                  : graphScope === 'INTERESTED_ONLY'
                    ? 'Want to Watch:'
                    : 'Archive:'}
            </span>
            <strong className="font-heading font-bold text-inherit truncate max-w-[170px] sm:max-w-none">
              {focalItem
                ? `${focalItem.title} (${focalItem.year})`
                : `${nodes.filter((n) => n.type === 'MOVIE' || n.type === 'TV').length} Titles`}
            </strong>
            {focalItem && (
              <button
                type="button"
                onClick={onClearFocal}
                className="pointer-events-auto p-0.5 rounded-full hover:bg-black/10 transition-colors ml-0.5 cursor-pointer"
                title="Clear focal title"
              >
                <X className="w-3 h-3 text-[#B8292F]" />
              </button>
            )}
          </div>

          {(focalItem || selectedSubgraph.focusNode) && (
            <button
              type="button"
              onClick={() => {
                if (onResetEverything) {
                  onResetEverything();
                } else {
                  onClearSelection?.();
                  onClearFocal?.();
                }
              }}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] border border-[#8C1D22] shadow-archival-sm text-xs font-semibold transition-colors cursor-pointer"
              title="Reset view and show full graph (Esc)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset (Esc)</span>
            </button>
          )}

          {/* Floating Glassmorphic Curation Filter HUD Bar */}
          {graphFilters && onGraphFiltersChange && (
            <div
              className={`pointer-events-auto inline-flex items-center p-0.5 rounded-lg border backdrop-blur-md shadow-md gap-0.5 ${
                theme === 'MOVIE_MAP_DARK'
                  ? 'bg-[#101624]/90 border-white/10'
                  : 'bg-[#FBF8F2]/95 border-[#C8BEAA] shadow-archival-sm'
              }`}
            >
              {[
                { id: 'ALL' as const, label: 'All', count: mediaNodes.length },
                {
                  id: 'WATCHED' as const,
                  label: 'Watched',
                  count: watchedNodesCount,
                  indicator: 'bg-[#10B981]',
                },
                {
                  id: 'INTERESTED' as const,
                  label: 'Want to Watch',
                  count: interestedNodesCount,
                  indicator: 'bg-[#F59E0B]',
                },
                {
                  id: 'UNWATCHED' as const,
                  label: 'Unwatched',
                  count: unwatchedNodesCount,
                  indicator: 'bg-slate-400',
                },
              ].map((pill) => {
                const active = graphFilters.watchedFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() =>
                      onGraphFiltersChange({
                        ...graphFilters,
                        watchedFilter: pill.id,
                      })
                    }
                    className={`inline-flex items-center gap-1.5 h-7 px-2 sm:px-2.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      active
                        ? pill.id === 'WATCHED'
                          ? theme === 'MOVIE_MAP_DARK'
                            ? 'bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/50 shadow-xs'
                            : 'bg-[#2A6B53] text-[#FBF8F2] shadow-xs'
                          : pill.id === 'INTERESTED'
                            ? theme === 'MOVIE_MAP_DARK'
                              ? 'bg-[#F59E0B]/25 text-[#F59E0B] border border-[#F59E0B]/50 shadow-xs'
                              : 'bg-[#B45309] text-[#FBF8F2] shadow-xs'
                            : pill.id === 'UNWATCHED'
                              ? theme === 'MOVIE_MAP_DARK'
                                ? 'bg-white/15 text-white border border-white/20 shadow-xs'
                                : 'bg-[#52483E] text-[#FBF8F2] shadow-xs'
                              : theme === 'MOVIE_MAP_DARK'
                                ? 'bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/40 shadow-xs'
                                : 'bg-[#171412] text-[#FBF8F2] shadow-xs'
                        : theme === 'MOVIE_MAP_DARK'
                          ? 'text-[#94A3B8] hover:text-[#F0F4FC] hover:bg-white/5 border border-transparent'
                          : 'text-[#52483E] hover:text-[#171412] hover:bg-black/5 border border-transparent'
                    }`}
                    title={`Filter graph: ${pill.label}`}
                  >
                    {pill.indicator && (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pill.indicator}`} />
                    )}
                    <span>{pill.label}</span>
                    <span className="text-[10px] font-tabular opacity-75">
                      {pill.count}
                    </span>
                  </button>
                );
              })}

              {graphFilters.watchedFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() =>
                    onGraphFiltersChange({
                      ...graphFilters,
                      filterBehavior:
                        graphFilters.filterBehavior === 'DIM' ? 'HIDE' : 'DIM',
                    })
                  }
                  className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                    graphFilters.filterBehavior === 'DIM'
                      ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                      : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  }`}
                  title={`Filter mode: ${graphFilters.filterBehavior} non-matching nodes (Click to toggle DIM/HIDE)`}
                >
                  {graphFilters.filterBehavior}
                </button>
              )}
            </div>
          )}
        </div>
      </div>




      {/* Sleek Obsidian-Style Floating Glass Hover Tooltip */}
      {hoveredTooltip && (() => {
        const viewportWidth =
          rootRef.current?.clientWidth ||
          (viewMode === '2D'
            ? canvas2dRef.current?.clientWidth
            : containerRef.current?.clientWidth) ||
          (typeof window !== 'undefined' ? window.innerWidth : 900);
        const viewportHeight =
          rootRef.current?.clientHeight ||
          (viewMode === '2D'
            ? canvas2dRef.current?.clientHeight
            : containerRef.current?.clientHeight) ||
          (typeof window !== 'undefined' ? window.innerHeight : 700);

        return (
          <div
            className={`pointer-events-none absolute z-30 rounded-lg p-2 shadow-2xl transition-opacity duration-150 flex items-center gap-2.5 max-w-[240px] ${isDark
                ? 'bg-[#0E1524]/94 backdrop-blur-md border border-[#1C273C] text-[#F0F4FC]'
                : 'bg-[#FBF8F2]/95 backdrop-blur-md border border-[#D5CCB9] text-[#171412]'
              }`}
            style={{
              left: Math.min(
                viewportWidth - 260,
                Math.max(16, hoveredTooltip.x + 14)
              ),
              top: Math.min(
                viewportHeight - 120,
                Math.max(16, hoveredTooltip.y - 18)
              ),
            }}
          >
            {hoveredTooltip.node.mediaItem ? (
              <>
                {/* Mini Poster Thumbnail */}
                <div className="w-9 h-12 rounded overflow-hidden shrink-0 bg-black/20 border border-white/10 relative">
                  <img
                    src={hoveredTooltip.node.mediaItem.posterUrl}
                    alt={hoveredTooltip.node.mediaItem.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (hoveredTooltip.node.mediaItem) {
                        target.src = getPosterFallbackDataUri(
                          hoveredTooltip.node.mediaItem
                        );
                      }
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs font-heading truncate leading-tight">
                    {hoveredTooltip.node.mediaItem.title}
                  </div>
                  <div className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-[#94A3B8]' : 'text-[#6B5E50]'}`}>
                    {hoveredTooltip.node.mediaItem.year} · {hoveredTooltip.node.mediaItem.directors?.[0]}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] flex-wrap">
                    <span className={`px-1.5 py-0.2 rounded font-semibold font-tabular ${isDark ? 'bg-[#00D2FF]/20 text-[#00D2FF]' : 'bg-[#234B6E]/15 text-[#234B6E]'
                      }`}>
                      ★ {hoveredTooltip.node.mediaItem.imdbRating.toFixed(1)}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded truncate ${isDark ? 'bg-white/10 text-[#94A3B8]' : 'bg-black/5 text-[#52483E]'
                      }`}>
                      {hoveredTooltip.node.mediaItem.primaryGenre}
                    </span>
                    {hoveredTooltip.node.isWatched && (
                      <span className={`px-1.5 py-0.2 rounded font-semibold shrink-0 ${isDark ? 'bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/40' : 'bg-[#2A6B53]/20 text-[#2A6B53] border border-[#2A6B53]/30'
                        }`}>
                        ✓ Watched
                      </span>
                    )}
                    {hoveredTooltip.node.isInterested && !hoveredTooltip.node.isWatched && (
                      <span className={`px-1.5 py-0.2 rounded font-semibold shrink-0 ${isDark ? 'bg-[#F59E0B]/25 text-[#F59E0B] border border-[#F59E0B]/40' : 'bg-[#B45309]/20 text-[#B45309] border border-[#B45309]/30'
                        }`}>
                        ★ Want to Watch
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="min-w-0 p-1">
                <div className="font-semibold text-xs truncate">
                  {hoveredTooltip.node.label}
                </div>
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-[#6B5E50]'}`}>
                  {hoveredTooltip.node.subLabel}
                </div>
              </div>
            )}
          </div>
        );
      })()}



      {/* MOBILE VIEW CONTROLS (Top-Right Action Chip + Secondary Mini-Pills) */}
      <div className="sm:hidden absolute top-3 right-3 z-20 flex items-center gap-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={() => setMobileLensOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-md border transition-all active:scale-95 cursor-pointer ${
            isDark
              ? 'bg-[#0E1524]/90 border-white/15 text-white/90 shadow-black/40'
              : 'bg-[#FBF8F2]/95 border-[#B5A892] shadow-archival text-[#171412]'
          }`}
          title="Open Map View & Color Controls"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span>{layoutMode === 'SEMANTIC_GALAXY' ? 'Galaxy' : 'Cast'}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </div>

      {/* Mobile Swipeable Quick Pills Bar */}
      <div className="sm:hidden absolute top-11 left-3 right-3 z-15 flex items-center gap-1.5 pointer-events-auto overflow-x-auto no-scrollbar py-1">
        {onLayoutModeChange && (
          <button
            type="button"
            onClick={() => onLayoutModeChange(layoutMode === 'SEMANTIC_GALAXY' ? 'FORCE_CONSTELLATION' : 'SEMANTIC_GALAXY')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 border shadow-xs transition-all cursor-pointer ${
              layoutMode === 'SEMANTIC_GALAXY'
                ? 'bg-[#B8292F] text-white border-[#B8292F]'
                : 'bg-[#234B6E] text-white border-[#234B6E]'
            }`}
          >
            {layoutMode === 'SEMANTIC_GALAXY' ? 'Galaxy' : 'Cast'}
          </button>
        )}

        {layoutMode === 'SEMANTIC_GALAXY' && (
          <button
            type="button"
            onClick={() => {
              if (onToggleTerritories) onToggleTerritories();
              else setLocalTerritories((p) => !p);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 border transition-all cursor-pointer flex items-center gap-1 ${
              showTerritories
                ? isDark
                  ? 'bg-[#2A6B53]/40 text-[#8CE8C3] border-[#2A6B53]/60'
                  : 'bg-[#E3EFEA] text-[#1E563F] border-[#B4D4C7]'
                : isDark
                  ? 'bg-white/5 text-white/60 border-white/10'
                  : 'bg-[#EFE8DA] text-[#6B5E50] border-[#D5CCB9]'
            }`}
          >
            <MapIcon className="w-3 h-3 opacity-80" />
            <span>Zones</span>
          </button>
        )}

        {onColorModeChange && (
          <button
            type="button"
            onClick={() => {
              const modes: NodeColorMode[] = [
                'CLUSTER',
                'WATCH_STATUS',
                'GENRE',
                'DECADE',
                'CATEGORY',
              ];
              const idx = modes.indexOf(colorMode || 'CLUSTER');
              onColorModeChange(modes[(idx + 1) % modes.length]);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 border transition-all cursor-pointer flex items-center gap-1 ${
              isDark ? 'bg-[#0E1524]/90 text-white/90 border-white/15' : 'bg-[#FBF8F2] text-[#171412] border-[#C8BEAA]'
            }`}
          >
            <Palette className="w-3 h-3 opacity-70" />
            <span>
              {colorMode === 'CLUSTER'
                ? 'Theme'
                : colorMode === 'WATCH_STATUS'
                  ? 'Curation'
                  : colorMode === 'GENRE'
                    ? 'Genre'
                    : colorMode === 'DECADE'
                      ? 'Era'
                      : 'Format'}
            </span>
          </button>
        )}

        {onLabelModeChange && (
          <button
            type="button"
            onClick={() => {
              const next = labelMode === 'AUTO' ? 'ALL' : labelMode === 'ALL' ? 'OFF' : 'AUTO';
              onLabelModeChange(next);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 border transition-all cursor-pointer flex items-center gap-1 ${
              labelMode === 'OFF'
                ? isDark ? 'bg-white/5 text-white/40 border-white/10' : 'bg-[#EFE8DA] text-[#6B5E50] border-[#D5CCB9]'
                : isDark ? 'bg-white/10 text-white border-white/20' : 'bg-[#FBF8F2] text-[#171412] border-[#C8BEAA]'
            }`}
          >
            <Tag className="w-3 h-3 opacity-70" />
            <span>Titles: {labelMode === 'AUTO' ? 'Auto' : labelMode === 'ALL' ? 'All' : 'Off'}</span>
          </button>
        )}
      </div>

      {/* Mobile View Controls Bottom Sheet Drawer */}
      {mobileLensOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Map View & Color Settings"
          className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end"
        >
          <div
            className="fixed inset-0 bg-[#0A0E17]/70 backdrop-blur-sm"
            onClick={() => setMobileLensOpen(false)}
            aria-hidden="true"
          />

          <div
            className={`relative w-full max-h-[85dvh] rounded-t-2xl border-t p-4 z-10 overflow-y-auto space-y-4 shadow-2xl animate-in slide-in-from-bottom-6 duration-200 ${
              isDark
                ? 'bg-[#0E1524] border-white/15 text-[#F0F4FC]'
                : 'bg-[#FBF8F2] border-[#B5A892] text-[#171412]'
            } pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]`}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                <h2 className="font-heading text-base font-bold">Map View &amp; Projection</h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileLensOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Projection Mode */}
            {onLayoutModeChange && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                  Spatial Layout Projection
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onLayoutModeChange('SEMANTIC_GALAXY')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      layoutMode === 'SEMANTIC_GALAXY'
                        ? 'bg-[#B8292F]/20 border-[#B8292F] ring-1 ring-[#B8292F] text-white'
                        : isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-[#EFE8DA] border-[#D5CCB9] text-[#52483E]'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Semantic Galaxy</span>
                      {layoutMode === 'SEMANTIC_GALAXY' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5">Themes, plots &amp; narrative worlds</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLayoutModeChange('FORCE_CONSTELLATION')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      layoutMode === 'FORCE_CONSTELLATION'
                        ? 'bg-[#234B6E]/20 border-[#234B6E] ring-1 ring-[#234B6E] text-white'
                        : isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-[#EFE8DA] border-[#D5CCB9] text-[#52483E]'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Cast &amp; Crew</span>
                      {layoutMode === 'FORCE_CONSTELLATION' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5">Direct connections by directors &amp; cast</div>
                  </button>
                </div>

                {layoutMode === 'SEMANTIC_GALAXY' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onToggleTerritories) onToggleTerritories();
                      else setLocalTerritories((p) => !p);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold ${
                      showTerritories
                        ? isDark ? 'bg-[#2A6B53]/25 border-[#2A6B53] text-[#8CE8C3]' : 'bg-[#E3EFEA] border-[#B4D4C7] text-[#1E563F]'
                        : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-[#EFE8DA] border-[#D5CCB9] text-[#6B5E50]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapIcon className="w-3.5 h-3.5" />
                      <span>Draw Theme Zone Boundaries</span>
                    </div>
                    <span>{showTerritories ? 'Active' : 'Off'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Color Scheme */}
            {onColorModeChange && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                  Node Color Scheme
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'CLUSTER', label: 'Theme Worlds', desc: 'Story universe' },
                    { id: 'WATCH_STATUS', label: 'Personal Curation', desc: 'Watched vs Want to Watch' },
                    { id: 'GENRE', label: 'Genre', desc: 'Action, Sci-Fi…' },
                    { id: 'DECADE', label: 'Release Era', desc: 'Chronological era' },
                    { id: 'CATEGORY', label: 'Format', desc: 'Film vs TV vs Cast' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onColorModeChange(c.id as NodeColorMode)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        colorMode === c.id
                          ? isDark ? 'bg-white/15 border-white/30 text-white font-bold' : 'bg-[#171412] text-white border-[#171412] font-bold'
                          : isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-[#EFE8DA] border-[#D5CCB9] text-[#52483E]'
                      }`}
                    >
                      <div className="text-xs flex items-center justify-between">
                        <span>{c.label}</span>
                        {colorMode === c.id && <Check className="w-3 h-3 text-cyan-400" />}
                      </div>
                      <div className="text-[10px] opacity-75">{c.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title Display Density */}
            {onLabelModeChange && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                  Title Label Density
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'AUTO', label: 'Auto', desc: 'Adaptive' },
                    { id: 'ALL', label: 'All Titles', desc: 'Show all' },
                    { id: 'OFF', label: 'Off', desc: 'Minimal' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => onLabelModeChange(l.id as LabelDisplayMode)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        labelMode === l.id
                          ? isDark ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold' : 'bg-[#E4F0EA] border-[#B3D4C5] text-[#1E563F] font-bold'
                          : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-[#EFE8DA] border-[#D5CCB9] text-[#6B5E50]'
                      }`}
                    >
                      <div className="text-xs">{l.label}</div>
                      <div className="text-[10px] opacity-75">{l.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Theme Clusters Quick Filter */}
            {clusters && clusters.length > 0 && onSelectCluster && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                    Story Worlds ({clusters.length})
                  </span>
                  {graphFilters?.activeClusterId && (
                    <button
                      type="button"
                      onClick={() => onSelectCluster(null)}
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {clusters.map((c) => {
                    const isSelected = graphFilters?.activeClusterId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectCluster(isSelected ? null : c.id)}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left text-xs transition-all ${
                          isSelected
                            ? isDark ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-bold' : 'bg-[#EFE8DA] border-[#B5A892] font-bold'
                            : isDark ? 'bg-white/5 border-white/5 text-slate-300' : 'bg-[#EFE8DA]/50 border-transparent text-[#52483E]'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="truncate text-[11px]">{c.shortLabel}</span>
                        <span className="text-[10px] font-tabular opacity-60 ml-auto">{c.mediaIds.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileLensOpen(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0A0E17] font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* MOVIE MAP REA: INTERACTIVE CLUSTER TERRITORY LEGEND (Bottom-Left) */}
      {clusters && clusters.length > 0 && (
        <div
          className={`hidden lg:flex absolute bottom-5 left-4 z-20 flex-col gap-1 p-2.5 rounded-xl border max-w-xs text-xs backdrop-blur-md transition-colors ${isDark
              ? 'bg-[#0B101D]/90 border-cyan-500/20 text-slate-200 shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
              : 'bg-[#FBF8F2]/95 border-[#D5CCB9] text-[#171412] shadow-archival'
            }`}
        >
          <div
            className={`flex items-center justify-between gap-3 pb-1 border-b ${isDark ? 'border-white/10' : 'border-[#D5CCB9]'
              }`}
          >
            <span
              className={`font-heading font-bold text-xs tracking-tight ${isDark ? 'text-white' : 'text-[#171412]'
                }`}
            >
              Semantic Galaxy Clusters
            </span>
            {graphFilters?.activeClusterId && onSelectCluster && (
              <button
                type="button"
                onClick={() => onSelectCluster(null)}
                className={`text-[10px] font-semibold hover:underline cursor-pointer ${isDark ? 'text-cyan-400' : 'text-[#B8292F]'
                  }`}
              >
                Reset
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 max-h-36 overflow-y-auto pr-1">
            {clusters.map((c) => {
              const isSelected = graphFilters?.activeClusterId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCluster?.(isSelected ? null : c.id)}
                  className={`text-left flex items-center gap-1.5 py-0.5 px-1.5 rounded transition-all cursor-pointer ${isSelected
                      ? isDark
                        ? 'bg-cyan-500/20 font-bold text-cyan-300 ring-1 ring-cyan-500/40 shadow-[0_0_10px_rgba(0,210,255,0.2)]'
                        : 'bg-[#EFE8DA] font-bold text-[#171412] ring-1 ring-[#D5CCB9]'
                      : isDark
                        ? 'hover:bg-white/10 text-slate-300'
                        : 'hover:bg-[#EFE8DA]/60 text-[#52483E]'
                    }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="truncate text-[10px]">{c.shortLabel}</span>
                  <span
                    className={`text-[10px] font-tabular ml-auto ${isDark ? 'text-slate-400' : 'text-[#8C8070]'
                      }`}
                  >
                    {c.mediaIds.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
