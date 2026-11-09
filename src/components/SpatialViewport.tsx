'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import {
  Compass,
  Eye,
  Navigation,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RefreshCw,
  Film,
  Tv,
  UserCheck,
  Award,
  Music,
  Hash,
  Link2,
} from 'lucide-react';
import {
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
  onSelectCluster?: (clusterId: string | null) => void;
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
  fillStyle?: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  const mainColor = fillStyle || color;
  const vellumCutout = '#FBF8F2';
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
  let coreObject: THREE.Object3D;
  let outerShell: THREE.Object3D | null = null;
  let secondaryRing: THREE.Object3D | null = null;

  if (node.type === 'MOVIE') {
    // ==================== MOVIE: 3D 35MM CINEMA FILM REEL ====================
    const reelGroup = new THREE.Group();

    // Extruded 5-hole film reel body
    const reelGeo = createFilmReelGeometry(r * 1.08);
    const reelMesh = new THREE.Mesh(reelGeo, coreMat);
    reelGroup.add(reelMesh);

    // Inner wound celluloid film pack with warm brass sheen
    const tapeCore = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.86, r * 0.86, r * 0.19, 36),
      metalAccentMat
    );
    tapeCore.rotation.x = Math.PI / 2;
    reelGroup.add(tapeCore);

    // Precision outer metallic reel rim
    const rimTorus = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.1, r * 0.062, 16, 64),
      metalAccentMat
    );
    reelGroup.add(rimTorus);

    // Inner vellum calibration ring around spindle
    const innerCalibRing = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.34, r * 0.028, 12, 36),
      ivoryContrastMat
    );
    innerCalibRing.position.z = r * 0.16;
    reelGroup.add(innerCalibRing);

    // Dual-stepped center spindle hub cap
    const hubCap = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.25, r * 0.25, r * 0.44, 24),
      ivoryContrastMat
    );
    hubCap.rotation.x = Math.PI / 2;
    reelGroup.add(hubCap);

    const spindlePin = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.1, r * 0.1, r * 0.54, 16),
      metalAccentMat
    );
    spindlePin.rotation.x = Math.PI / 2;
    reelGroup.add(spindlePin);

    reelGroup.rotation.x = 0.22;
    reelGroup.rotation.y = -0.25;
    group.add(reelGroup);
    coreObject = reelGroup;
    outerShell = rimTorus;
  } else if (node.type === 'TV') {
    // ==================== TV SERIES: 3D WIDESCREEN BROADCAST MONITOR ====================
    const tvGroup = new THREE.Group();

    // Widescreen 16:9 beveled cabinet body
    const cabinetGeo = createRoundedRectPrismGeometry(
      r * 1.88,
      r * 1.24,
      r * 0.54,
      r * 0.22
    );
    const cabinetMesh = new THREE.Mesh(cabinetGeo, coreMat);
    tvGroup.add(cabinetMesh);

    // Recessed glowing vellum screen shifted slightly left to leave room for side tuner panel
    const screenGeo = createRoundedRectPrismGeometry(
      r * 1.28,
      r * 0.9,
      r * 0.63,
      r * 0.13
    );
    const screenMesh = new THREE.Mesh(screenGeo, ivoryContrastMat);
    screenMesh.position.set(-r * 0.14, 0, 0);
    tvGroup.add(screenMesh);

    // Brass rotary tuner knobs on right side of monitor bezel (front & back)
    const dialGeo = new THREE.CylinderGeometry(
      r * 0.095,
      r * 0.095,
      r * 0.66,
      16
    );
    const upperDial = new THREE.Mesh(dialGeo, metalAccentMat);
    upperDial.rotation.x = Math.PI / 2;
    upperDial.position.set(r * 0.66, r * 0.22, 0);
    tvGroup.add(upperDial);

    const lowerDial = new THREE.Mesh(dialGeo, ivoryContrastMat);
    lowerDial.rotation.x = Math.PI / 2;
    lowerDial.position.set(r * 0.66, -r * 0.16, 0);
    tvGroup.add(lowerDial);

    // Top antenna dipole mount
    const bezelTop = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.12, r * 0.15, r * 0.22, 16),
      metalAccentMat
    );
    bezelTop.position.set(0, r * 0.66, 0);
    tvGroup.add(bezelTop);

    // Twin V-shaped rabbit-ear broadcast antennae on top
    const antennaGroup = new THREE.Group();
    const antStickGeo = new THREE.CylinderGeometry(
      r * 0.032,
      r * 0.032,
      r * 0.78,
      12
    );
    const antTipGeo = new THREE.SphereGeometry(r * 0.075, 12, 12);

    const leftAnt = new THREE.Mesh(antStickGeo, metalAccentMat);
    leftAnt.position.set(-r * 0.28, r * 0.94, 0);
    leftAnt.rotation.z = 0.52;
    antennaGroup.add(leftAnt);

    const leftTip = new THREE.Mesh(antTipGeo, coreMat);
    leftTip.position.set(-r * 0.48, r * 1.26, 0);
    antennaGroup.add(leftTip);

    const rightAnt = new THREE.Mesh(antStickGeo, metalAccentMat);
    rightAnt.position.set(r * 0.28, r * 0.94, 0);
    rightAnt.rotation.z = -0.52;
    antennaGroup.add(rightAnt);

    const rightTip = new THREE.Mesh(antTipGeo, coreMat);
    rightTip.position.set(r * 0.48, r * 1.26, 0);
    antennaGroup.add(rightTip);

    tvGroup.add(antennaGroup);
    secondaryRing = antennaGroup;

    // Minimalist pedestal stand at base
    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.1, r * 0.14, r * 0.26, 16),
      metalAccentMat
    );
    neckMesh.position.set(0, -r * 0.72, 0);
    tvGroup.add(neckMesh);

    const basePlate = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.54, r * 0.6, r * 0.095, 24),
      metalAccentMat
    );
    basePlate.position.set(0, -r * 0.86, 0);
    tvGroup.add(basePlate);

    group.add(tvGroup);
    coreObject = tvGroup;
  } else if (node.type === 'DIRECTOR') {
    // ==================== DIRECTOR / WRITER: 3D DIRECTOR'S CLAPPERBOARD ====================
    const clapperGroup = new THREE.Group();

    const boardW = r * 1.85;
    const boardH = r * 1.15;
    const boardD = r * 0.26;

    // Lower slate board
    const slateGeo = createRoundedRectPrismGeometry(
      boardW,
      boardH,
      boardD,
      r * 0.14
    );
    const slateMesh = new THREE.Mesh(slateGeo, coreMat);
    slateMesh.position.set(0, -r * 0.18, 0);
    clapperGroup.add(slateMesh);

    // Slate horizontal production metadata stripes (front & back)
    const line1 = new THREE.Mesh(
      new THREE.BoxGeometry(boardW * 0.74, r * 0.11, boardD * 1.38),
      ivoryContrastMat
    );
    line1.position.set(0, -r * 0.02, 0);
    clapperGroup.add(line1);

    const line2 = new THREE.Mesh(
      new THREE.BoxGeometry(boardW * 0.52, r * 0.1, boardD * 1.38),
      metalAccentMat
    );
    line2.position.set(-boardW * 0.11, -r * 0.34, 0);
    clapperGroup.add(line2);

    // Lower fixed clap-bar with alternating chevron blocks
    const lowerBar = new THREE.Mesh(
      new THREE.BoxGeometry(boardW, r * 0.22, boardD * 1.15),
      coreMat
    );
    lowerBar.position.set(0, r * 0.42, 0);
    clapperGroup.add(lowerBar);

    for (let s = 0; s < 3; s++) {
      const lowerStripe = new THREE.Mesh(
        new THREE.BoxGeometry(boardW * 0.14, r * 0.225, boardD * 1.34),
        ivoryContrastMat
      );
      lowerStripe.position.set(
        -boardW / 2 + boardW * (0.24 + s * 0.28),
        r * 0.42,
        0
      );
      lowerStripe.rotation.z = 0.25;
      clapperGroup.add(lowerStripe);
    }

    // Hinged upper clap-stick (pivots around left hinge)
    const upperStickPivot = new THREE.Group();
    upperStickPivot.position.set(-boardW / 2, r * 0.54, 0);
    upperStickPivot.rotation.z = 0.34; // Angled open ready to clap!

    const stickBar = new THREE.Mesh(
      new THREE.BoxGeometry(boardW, r * 0.24, boardD * 1.15),
      coreMat
    );
    stickBar.position.set(boardW / 2, r * 0.12, 0);
    upperStickPivot.add(stickBar);

    // 3 high-contrast ivory chevron stripes along the clap-stick
    for (let s = 0; s < 3; s++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(boardW * 0.14, r * 0.25, boardD * 1.36),
        ivoryContrastMat
      );
      stripe.position.set(boardW * (0.24 + s * 0.28), r * 0.12, 0);
      stripe.rotation.z = -0.25;
      upperStickPivot.add(stripe);
    }

    // Brass hinge bolt
    const hingeBolt = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.13, r * 0.13, boardD * 1.55, 16),
      metalAccentMat
    );
    hingeBolt.rotation.x = Math.PI / 2;
    upperStickPivot.add(hingeBolt);

    clapperGroup.add(upperStickPivot);
    outerShell = upperStickPivot;

    group.add(clapperGroup);
    coreObject = clapperGroup;
  } else if (node.type === 'ACTOR') {
    // ==================== ACTOR / CAST: 3D 5-POINTED CINEMA STAR TROPHY ====================
    const actorGroup = new THREE.Group();

    // Beveled 3D 5-Pointed Star
    const starGeo = createFivePointStarGeometry(r * 1.24, r * 0.52, r * 0.32);
    const starMesh = new THREE.Mesh(starGeo, coreMat);
    actorGroup.add(starMesh);

    // Raised metallic center emblem on both faces
    const centerEmblem = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.27, r * 0.27, r * 0.46, 20),
      ivoryContrastMat
    );
    centerEmblem.rotation.x = Math.PI / 2;
    actorGroup.add(centerEmblem);

    // Walk-of-Fame circular marquee frame ring
    const frameRing = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.34, r * 0.058, 16, 64),
      metalAccentMat
    );
    actorGroup.add(frameRing);
    outerShell = frameRing;

    group.add(actorGroup);
    coreObject = actorGroup;
  } else if (node.type === 'TROPE') {
    // ==================== TROPE / THEME: 3D OPEN STORY BOOK / SCREENPLAY TOME ====================
    const bookGroup = new THREE.Group();

    const pageW = r * 1.05;
    const pageH = r * 1.42;
    const coverT = r * 0.12;
    const pageT = r * 0.18;

    // Central bound spine cylinder
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.14, r * 0.14, pageH * 1.04, 16),
      metalAccentMat
    );
    bookGroup.add(spine);

    // Left open wing (hardcover + cream vellum page block + engraved text rules)
    const leftWing = new THREE.Group();
    const leftCover = new THREE.Mesh(
      new THREE.BoxGeometry(pageW, pageH, coverT),
      coreMat
    );
    leftCover.position.set(-pageW / 2, 0, -pageT * 0.45);
    leftWing.add(leftCover);

    const leftPages = new THREE.Mesh(
      new THREE.BoxGeometry(pageW * 0.9, pageH * 0.9, pageT),
      ivoryContrastMat
    );
    leftPages.position.set(-pageW * 0.46, 0, pageT * 0.15);
    leftWing.add(leftPages);

    for (let l = -1; l <= 1; l++) {
      const ruleLine = new THREE.Mesh(
        new THREE.BoxGeometry(pageW * 0.56, r * 0.06, pageT * 1.18),
        coreMat
      );
      ruleLine.position.set(-pageW * 0.48, l * r * 0.28, pageT * 0.15);
      leftWing.add(ruleLine);
    }

    leftWing.rotation.y = 0.38;
    bookGroup.add(leftWing);

    // Right open wing (hardcover + cream vellum page block + engraved text rules)
    const rightWing = new THREE.Group();
    const rightCover = new THREE.Mesh(
      new THREE.BoxGeometry(pageW, pageH, coverT),
      coreMat
    );
    rightCover.position.set(pageW / 2, 0, -pageT * 0.45);
    rightWing.add(rightCover);

    const rightPages = new THREE.Mesh(
      new THREE.BoxGeometry(pageW * 0.9, pageH * 0.9, pageT),
      ivoryContrastMat
    );
    rightPages.position.set(pageW * 0.46, 0, pageT * 0.15);
    rightWing.add(rightPages);

    for (let l = -1; l <= 1; l++) {
      const ruleLine = new THREE.Mesh(
        new THREE.BoxGeometry(pageW * 0.56, r * 0.06, pageT * 1.18),
        coreMat
      );
      ruleLine.position.set(pageW * 0.48, l * r * 0.28, pageT * 0.15);
      rightWing.add(ruleLine);
    }

    rightWing.rotation.y = -0.38;
    bookGroup.add(rightWing);

    // Floating golden bookmark ribbon rising above the spine
    const bookmark = new THREE.Mesh(
      new THREE.BoxGeometry(r * 0.16, r * 0.65, r * 0.06),
      metalAccentMat
    );
    bookmark.position.set(0, r * 0.72, r * 0.22);
    bookmark.rotation.z = -0.15;
    bookGroup.add(bookmark);
    outerShell = bookmark;

    bookGroup.rotation.x = 0.35;
    group.add(bookGroup);
    coreObject = bookGroup;
  } else {
    // ==================== COMPOSER / SCORE: 3D BEAMED MUSICAL EIGHTH NOTE (♫) ====================
    const noteGroup = new THREE.Group();

    const leftX = -r * 0.52;
    const rightX = r * 0.48;
    const bottomY = -r * 0.52;
    const topLeftY = r * 0.62;
    const topRightY = r * 0.86;

    // Left & Right 3D tilted elliptical note heads
    const headGeo = new THREE.SphereGeometry(r * 0.36, 24, 24);
    headGeo.scale(1.25, 0.88, 0.78);

    const leftHead = new THREE.Mesh(headGeo, coreMat);
    leftHead.position.set(leftX, bottomY, 0);
    leftHead.rotation.z = 0.35;
    noteGroup.add(leftHead);

    const rightHead = new THREE.Mesh(headGeo, coreMat);
    rightHead.position.set(rightX, bottomY + r * 0.2, 0);
    rightHead.rotation.z = 0.35;
    noteGroup.add(rightHead);

    // Left & Right vertical note stems
    const stemLen = r * 1.18;
    const stemGeo = new THREE.CylinderGeometry(
      r * 0.085,
      r * 0.085,
      stemLen,
      16
    );

    const leftStem = new THREE.Mesh(stemGeo, metalAccentMat);
    leftStem.position.set(
      leftX + r * 0.28,
      (bottomY + topLeftY) / 2,
      0
    );
    noteGroup.add(leftStem);

    const rightStem = new THREE.Mesh(stemGeo, metalAccentMat);
    rightStem.position.set(
      rightX + r * 0.28,
      (bottomY + r * 0.2 + topRightY) / 2,
      0
    );
    noteGroup.add(rightStem);

    // Top connecting musical double-beam bars
    const beamDx = rightX - leftX;
    const beamDy = topRightY - topLeftY;
    const beamLen = Math.sqrt(beamDx * beamDx + beamDy * beamDy) + r * 0.16;
    const beamAngle = Math.atan2(beamDy, beamDx);
    const beamGeo = new THREE.BoxGeometry(beamLen, r * 0.22, r * 0.2);
    const topBeam = new THREE.Mesh(beamGeo, coreMat);
    topBeam.position.set(
      (leftX + rightX) / 2 + r * 0.28,
      (topLeftY + topRightY) / 2 - r * 0.04,
      0
    );
    topBeam.rotation.z = beamAngle;
    noteGroup.add(topBeam);

    const secondBeam = new THREE.Mesh(
      new THREE.BoxGeometry(beamLen * 0.92, r * 0.13, r * 0.22),
      ivoryContrastMat
    );
    secondBeam.position.set(
      (leftX + rightX) / 2 + r * 0.28,
      (topLeftY + topRightY) / 2 - r * 0.32,
      0
    );
    secondBeam.rotation.z = beamAngle;
    noteGroup.add(secondBeam);

    // Subtle acoustic soundwave ring around the musical note
    const waveRing = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.32, r * 0.04, 16, 64),
      glassShellMat
    );
    waveRing.rotation.x = Math.PI / 3;
    group.add(waveRing);
    outerShell = waveRing;

    group.add(noteGroup);
    coreObject = noteGroup;
  }

  // Primary Media Nodes (MOVIE / TV) receive an equatorial archival brass collet ring with 4 cardinal compass studs
  if ((node.type === 'MOVIE' || node.type === 'TV') && !node.isFocal) {
    const mediaCollet = new THREE.Group();
    const colletRing = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.38, r * 0.028, 14, 64),
      glassShellMat
    );
    mediaCollet.add(colletRing);

    const studGeo = new THREE.SphereGeometry(r * 0.06, 10, 10);
    for (let s = 0; s < 4; s++) {
      const ang = (s * Math.PI) / 2;
      const stud = new THREE.Mesh(studGeo, metalAccentMat);
      stud.position.set(
        Math.cos(ang) * r * 1.38,
        Math.sin(ang) * r * 1.38,
        0
      );
      mediaCollet.add(stud);
    }
    mediaCollet.rotation.x = Math.PI / 2.25;
    group.add(mediaCollet);
  }

  // Selected Focal Title gets an additional centerpiece marquee halo ring
  if (node.isFocal) {
    const focalGimbal = new THREE.Group();
    const gimbalRing = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.75, r * 0.042, 20, 96),
      metalAccentMat
    );
    focalGimbal.add(gimbalRing);

    for (let b = 0; b < 4; b++) {
      const angle = (b * Math.PI) / 2;
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.09, 14, 14),
        coreMat
      );
      bead.position.set(
        Math.cos(angle) * r * 1.75,
        Math.sin(angle) * r * 1.75,
        0
      );
      focalGimbal.add(bead);
    }
    focalGimbal.rotation.x = Math.PI / 2.35;
    group.add(focalGimbal);
    secondaryRing = focalGimbal;
  }

  // Camera-facing selection & linked-node beacon halo rings
  const haloRingGeo = new THREE.RingGeometry(r * 1.46, r * 1.72, 48);
  const selectionHaloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(node.isFocal ? '#B8292F' : node.color),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const selectionHalo = new THREE.Mesh(haloRingGeo, selectionHaloMat);
  group.add(selectionHalo);

  const outerHaloGeo = new THREE.RingGeometry(r * 1.88, r * 2.02, 48);
  const outerRingHaloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#B8292F'),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const outerRingHalo = new THREE.Mesh(outerHaloGeo, outerRingHaloMat);
  group.add(outerRingHalo);

  // Invisible generous raycast hit-sphere so intricate multi-part models are effortless to click & hover
  const hitGeo = new THREE.SphereGeometry(r * 1.52, 16, 16);
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
function createLabelSprite(node: GraphNode): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 680;
  canvas.height = 188;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isMedia = node.type === 'MOVIE' || node.type === 'TV';
    const titleText =
      node.label.length > 26 ? node.label.slice(0, 24) + '…' : node.label;
    const badgeText = node.isFocal
      ? 'CENTERPIECE · SELECTED'
      : isMedia && node.matchScore !== undefined
        ? `${node.matchScore}% Match · ${getEntityRoleLabel(node.type)}`
        : isMedia && node.mediaItem
          ? `${node.mediaItem.year} · IMDb ${node.mediaItem.imdbRating.toFixed(1)}`
          : getEntityRoleLabel(node.type).toUpperCase();

    const pillW = Math.min(636, Math.max(276, titleText.length * 17.5 + 124));
    const pillH = 96;
    const pillX = (canvas.width - pillW) / 2;
    const pillY = 26;
    const pointerTipY = pillY + pillH + 14;
    const centerX = canvas.width / 2;

    const borderColor = node.isFocal
      ? '#B8292F'
      : isMedia
        ? node.color
        : '#B5A892';

    // 1. Subtle offset elevation shadow
    ctx.save();
    ctx.shadowColor = 'rgba(23, 20, 18, 0.18)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;

    // Warm archival vellum card plate with bottom pointer nib
    ctx.fillStyle = node.isFocal
      ? 'rgba(251, 248, 242, 0.99)'
      : 'rgba(251, 248, 242, 0.96)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = node.isFocal ? 3 : 2.2;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 10);
    ctx.fill();
    ctx.restore();
    ctx.stroke();

    // Inner engraved vellum inset rule
    ctx.strokeStyle = 'rgba(213, 204, 185, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX + 4, pillY + 4, pillW - 8, pillH - 8, 7);
    ctx.stroke();

    // Downward pointer pin connecting label plate to 3D sculpture
    ctx.fillStyle = borderColor;
    ctx.beginPath();
    ctx.moveTo(centerX - 8, pillY + pillH);
    ctx.lineTo(centerX + 8, pillY + pillH);
    ctx.lineTo(centerX, pointerTipY);
    ctx.closePath();
    ctx.fill();

    // Left category medallion disc
    const badgeCx = pillX + 38;
    const badgeCy = pillY + pillH / 2;
    ctx.beginPath();
    ctx.arc(badgeCx, badgeCy, 20, 0, Math.PI * 2);
    ctx.fillStyle = node.isFocal
      ? 'rgba(184, 41, 47, 0.12)'
      : 'rgba(239, 232, 218, 0.92)';
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    drawCategoryGlyph2D(
      ctx,
      node.type,
      badgeCx,
      badgeCy,
      10,
      node.isFocal ? '#B8292F' : node.color
    );

    const textCenterX = pillX + 64 + (pillW - 78) / 2;

    // Title in Spectral serif
    ctx.font = `${node.isFocal ? '700 26px' : '700 23px'} "Spectral", Georgia, serif`;
    ctx.fillStyle = '#171412';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, textCenterX, pillY + 35);

    // Subtitle in Source Sans 3 (tabular numerals)
    ctx.font = '700 14.5px "Source Sans 3", -apple-system, sans-serif';
    ctx.fillStyle = node.isFocal
      ? '#B8292F'
      : isMedia && (node.matchScore || 0) >= 75
        ? '#2A6B53'
        : node.color;
    ctx.fillText(badgeText, textCenterX, pillY + 67);
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
  const scale = node.isFocal
    ? 46
    : node.type === 'MOVIE' || node.type === 'TV'
      ? 35
      : 28;
  sprite.scale.set(scale, scale * (188 / 680), 1);
  sprite.position.set(0, node.radius * 1.42 + 7.8, 0);
  return sprite;
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
  layoutMode = 'FORCE_CONSTELLATION',
  onLayoutModeChange,
  colorMode = 'CATEGORY',
  onColorModeChange,
  sizeMode = 'RATING',
  onSizeModeChange,
  labelMode = 'AUTO',
  onLabelModeChange,
  graphFilters,
  onSelectCluster,
}: SpatialViewportProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);

  const [hoveredTooltip, setHoveredTooltip] =
    useState<HoveredTooltipState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isNodeKeyOpen, setIsNodeKeyOpen] = useState(false);

  // Refs for mutable access inside animation loop
  const nodesRef = useRef<GraphNode[]>(nodes);
  const linksRef = useRef<GraphLink[]>(links);
  const forceRef = useRef<ForceSettings>(forceSettings);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedNodeId);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const cameraModeRef = useRef<CameraMode>(cameraMode);

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
      camSphericalRef.current.goalX = 0;
      camSphericalRef.current.goalY = 0;
      camSphericalRef.current.goalZ = 0;
      camSphericalRef.current.goalRadius = 265;
      pan2dRef.current.goalPanX = 0;
      pan2dRef.current.goalPanY = 0;
      pan2dRef.current.goalZoom = 1.05;
    }
  }, [selectedNodeId]);

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
    radius: 265,
    theta: 0.45,
    phi: 1.18,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    goalX: 0,
    goalY: 0,
    goalZ: 0,
    goalRadius: 265,
    flyIndex: 0,
    flyTimer: 0,
  });

  // 2D pan & zoom state ref so clicking/selecting a node smoothly frames its linked cluster in 2D too
  const pan2dRef = useRef({
    panX: 0,
    panY: 0,
    zoom: 1.05,
    goalPanX: 0,
    goalPanY: 0,
    goalZoom: 1.05,
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
      camSphericalRef.current.phi = Math.PI / 2.25;
      camSphericalRef.current.goalX = 0;
      camSphericalRef.current.goalY = 0;
      camSphericalRef.current.goalZ = 0;
      camSphericalRef.current.goalRadius = 260;
      pan2dRef.current.goalPanX = 0;
      pan2dRef.current.goalPanY = 0;
      pan2dRef.current.goalZoom = 1.05;
      onFovChange?.(55);
    }
  }, [resetPitchTrigger, onFovChange]);

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
        75,
        Math.min(520, camSphericalRef.current.goalRadius + delta)
      );
      pan2dRef.current.goalZoom = Math.max(
        0.45,
        Math.min(2.6, pan2dRef.current.goalZoom - delta * 0.004)
      );
      const nextFov = Math.max(
        35,
        Math.min(
          75,
          Math.round(35 + (camSphericalRef.current.goalRadius / 520) * 35)
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

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf6f1e7, 0.0014);

    const camera = new THREE.PerspectiveCamera(55, width / height, 1, 2200);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Procedural Studio Environment Map for modern metallic & clearcoat reflections
    const envTexture = createStudioEnvironment(renderer);
    scene.environment = envTexture;

    // Warm Daylight Gallery Lighting
    const ambientLight = new THREE.AmbientLight(0xfffdf9, 1.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff8eb, 1.85);
    dirLight.position.set(140, 210, 180);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xe4effa, 1.15);
    rimLight.position.set(-160, 120, -160);
    scene.add(rimLight);

    const pointLightWarm = new THREE.PointLight(0xd48324, 1.25, 750);
    pointLightWarm.position.set(120, 140, 160);
    scene.add(pointLightWarm);

    const pointLightPrussian = new THREE.PointLight(0x234b6e, 1.05, 750);
    pointLightPrussian.position.set(-150, -110, -130);
    scene.add(pointLightPrussian);

    // Subtle Archival Pigment Motes
    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const palette = [
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

      const labelSprite = createLabelSprite(node);
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
        renderer.domElement.style.cursor = 'grab';
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
      } else if (selectedIdRef.current) {
        onClearSelection?.();
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
    };
    window.addEventListener('resize', onResize);

    // 3D Force-Directed Layout & Render Loop
    let frameId = 0;
    let clock = 0;
    const nodeIndexMap = new Map<string, GraphNode>();
    const homePositions3D = new Map<
      string,
      { x: number; y: number; z: number }
    >();
    simNodes.forEach((n) => {
      nodeIndexMap.set(n.id, n);
      homePositions3D.set(n.id, { x: n.x, y: n.y, z: n.z });
    });
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

          // Gentle restoring pull toward initial orbital seed position so resetting after isolation restores full layout
          const home = homePositions3D.get(nA.id);
          if (home && !nA.similarity) {
            nA.vx += (home.x - nA.x) * 0.028;
            nA.vy += (home.y - nA.y) * 0.028;
            nA.vz += (home.z - nA.z) * 0.028;
          }

          if ((nA.type === 'MOVIE' || nA.type === 'TV') && nA.similarity) {
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

            if (labelMode === 'OFF') {
              assembly.labelSprite.material.opacity = 0;
            } else if (!isFilterMatch) {
              // Dimmed filtered nodes hide their labels so only matching nodes shine
              assembly.labelSprite.material.opacity = 0;
            } else if (labelMode === 'ALL') {
              assembly.labelSprite.material.opacity = 0.95;
              assembly.labelSprite.scale.set(baseS, baseS * aspect, 1);
            } else if (!hasActiveFocus) {
              const isMediaNode =
                node.type === 'MOVIE' || node.type === 'TV' || node.isFocal;
              const zoomReveal = Math.max(
                0,
                Math.min(1, (255 - camState.radius) / 85)
              );
              const baseOpacity = node.isFocal
                ? 1.0
                : isMediaNode
                  ? 0.94
                  : 0.42 + zoomReveal * 0.52;
              assembly.labelSprite.material.opacity = baseOpacity;
              assembly.labelSprite.scale.set(baseS, baseS * aspect, 1);
            } else if (isNodeSelected || isNodeHovered) {
              assembly.labelSprite.material.opacity = 1.0;
              const s = baseS * 1.18;
              assembly.labelSprite.scale.set(s, s * aspect, 1);
            } else if (isNodeLinked) {
              assembly.labelSprite.material.opacity = 1.0;
              const s = baseS * 1.1;
              assembly.labelSprite.scale.set(s, s * aspect, 1);
            } else {
              assembly.labelSprite.material.opacity = 0.08;
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
              // Non-matching filtered node in Dim mode stays at 12% opacity
              mat.opacity = 0.12;
              mat.emissiveIntensity = 0.01;
            } else if (!hasActiveFocus) {
              mat.opacity = 0.98;
              mat.emissiveIntensity = node.isFocal ? 0.34 : 0.16;
            } else {
              mat.opacity = isNodeLinked ? 1.0 : 0.14;
              mat.emissiveIntensity =
                isNodeSelected || isNodeHovered
                  ? 0.48
                  : isNodeLinked
                    ? 0.36
                    : 0.02;
            }
          }
          for (const accMat of assembly.accentMaterials) {
            if (!isFilterMatch) {
              accMat.opacity = 0.08;
            } else {
              accMat.opacity = !hasActiveFocus ? 0.98 : isNodeLinked ? 1.0 : 0.12;
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
          entry.material.opacity =
            entry.link.kind === 'SIMILARITY_DIRECT' ? 0.5 : 0.26;
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

      starField.rotation.y += 0.00025;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
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
      sharedBeamUnitGeo.dispose();
      envTexture.dispose();
      renderer.dispose();
    };
  }, [
    viewMode,
    nodes,
    links,
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
      const hx = n.x * 1.35;
      const hy = n.y * 1.35;
      homePositions2D.set(n.id, { x: hx, y: hy });
      return {
        ...n,
        x: hx,
        y: hy,
      };
    });
    nodesRef.current = simNodes;
    linksRef.current = links;

    let cachedSelectedId2D: string | null = null;
    let cachedSelectedSub2D: LinkedSubgraphResult | null = null;
    let cachedIsolatedTargets2D = new Map<
      string,
      { x: number; y: number; z: number }
    >();

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
    };
    resize();
    window.addEventListener('resize', resize);

    const screenToWorld = (sx: number, sy: number) => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const { panX, panY, zoom } = pan2dRef.current;
      return {
        wx: (sx - cw / 2 - panX) / zoom,
        wy: (sy - ch / 2 - panY) / zoom,
      };
    };

    const findNodeAt = (sx: number, sy: number): GraphNode | null => {
      const { wx, wy } = screenToWorld(sx, sy);
      const activeSel = selectedIdRef.current;
      const activeSub = activeSel
        ? computeLinkedSubgraph(activeSel, simNodes, linksRef.current)
        : null;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        if (activeSub?.focusNode && !activeSub.linkedNodeIds.has(n.id)) {
          continue;
        }
        const dx = wx - n.x;
        const dy = wy - n.y;
        const hitR = n.radius * 1.6 + 6;
        if (dx * dx + dy * dy <= hitR * hitR) return n;
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
        canvas.style.cursor = 'grab';
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
      const hit = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) {
        onSelectNode(hit);
        frameNodeAndLinkedCluster(hit.id);
      } else if (selectedIdRef.current) {
        onClearSelection?.();
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

      const { panX, panY, zoom } = pan2dRef.current;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      ctx.clearRect(0, 0, cw, ch);

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
      for (const ring of rings) {
        ctx.beginPath();
        ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 10px "Source Sans 3", sans-serif';
        ctx.fillStyle = '#6B5E50';
        ctx.fillText(ring.label, 8, -ring.r + 13);
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
      for (const node of simNodes) {
        if (isIsolatedMode) {
          if (selSub?.linkedNodeIds.has(node.id)) {
            const iso = cachedIsolatedTargets2D.get(node.id);
            if (iso) {
              node.x += (iso.x - node.x) * 0.14;
              node.y += (iso.y - node.y) * 0.14;
            }
          }
        } else {
          const home = homePositions2D.get(node.id);
          if (home) {
            node.x += (home.x - node.x) * 0.14;
            node.y += (home.y - node.y) * 0.14;
          }
        }
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
        ctx.globalAlpha = !hasActiveFocus
          ? link.kind === 'SIMILARITY_DIRECT'
            ? 0.45
            : 0.26
          : lit
            ? 0.96
            : 0.05;
        ctx.lineWidth =
          lit && hasActiveFocus ? (isDirect ? 2.8 : 2.1) : 1.15;
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

        ctx.globalAlpha = !isFilterMatch ? 0.12 : isNodeLinked ? 1 : 0.14;

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

        // Stamped Multi-Ring Archival Medallion Plate
        const nodeAccentColor = node.isFocal ? '#B8292F' : node.color;
        const isPrimaryMedia =
          node.type === 'MOVIE' || node.type === 'TV' || node.isFocal;

        // 1. Directional offset paper shadow + outer pigment bezel ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, rScaled * 1.24, 0, Math.PI * 2);
        ctx.fillStyle = nodeAccentColor;
        ctx.shadowColor = 'rgba(23, 20, 18, 0.22)';
        ctx.shadowBlur =
          isHovered || isSelected || (hasActiveFocus && isNodeLinked) ? 14 : 6;
        ctx.shadowOffsetY = 2.5;
        ctx.fill();
        ctx.restore();

        // 2. Warm museum vellum inner medallion disc
        ctx.beginPath();
        ctx.arc(node.x, node.y, rScaled * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = '#FBF8F2';
        ctx.fill();

        // 3. Subtle inner engraved hairline & cardinal bezel ticks for primary titles
        ctx.beginPath();
        ctx.arc(node.x, node.y, rScaled * 0.9, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(23, 20, 18, 0.12)';
        ctx.lineWidth = 0.9;
        ctx.stroke();

        if (isPrimaryMedia) {
          ctx.save();
          ctx.translate(node.x, node.y);
          ctx.strokeStyle = '#FBF8F2';
          ctx.lineWidth = 1.4;
          for (let t = 0; t < 4; t++) {
            const ang = (t * Math.PI) / 2;
            ctx.beginPath();
            ctx.moveTo(
              Math.cos(ang) * rScaled * 1.06,
              Math.sin(ang) * rScaled * 1.06
            );
            ctx.lineTo(
              Math.cos(ang) * rScaled * 1.22,
              Math.sin(ang) * rScaled * 1.22
            );
            ctx.stroke();
          }
          ctx.restore();
        }

        // 4. Crisp category glyph centered inside the vellum medallion
        drawCategoryGlyph2D(
          ctx,
          node.type,
          node.x,
          node.y,
          rScaled * 0.66,
          nodeAccentColor
        );

        // 5. Engraved Vellum Caption Plate below node so links never slice through text
        if (labelMode === 'OFF' || !isFilterMatch) {
          continue;
        }

        const showMatchSub =
          (node.type === 'MOVIE' || node.type === 'TV') &&
          node.matchScore !== undefined &&
          !node.isFocal;
        const labelTitle =
          node.label.length > 26 ? node.label.slice(0, 24) + '…' : node.label;

        ctx.font = `${
          node.isFocal || isSelected || (hasActiveFocus && isNodeLinked)
            ? '700 12px'
            : '600 11px'
        } "Spectral", Georgia, serif`;
        const textWidth = ctx.measureText(labelTitle).width;
        const pillPadX = 7;
        const pillW = Math.max(54, textWidth + pillPadX * 2);
        const pillH = showMatchSub ? 26 : 16;
        const pillX = node.x - pillW / 2;
        const pillY = node.y + rScaled * 1.28 + 3;

        ctx.save();
        ctx.fillStyle =
          isSelected || isHovered
            ? 'rgba(251, 248, 242, 0.98)'
            : 'rgba(251, 248, 242, 0.92)';
        ctx.strokeStyle =
          isSelected || isHovered || node.isFocal
            ? '#B8292F'
            : isPrimaryMedia
              ? 'rgba(181, 168, 146, 0.9)'
              : 'rgba(213, 204, 185, 0.85)';
        ctx.lineWidth = isSelected || isHovered || node.isFocal ? 1.4 : 1;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#171412';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelTitle, node.x, pillY + 8.5);

        if (showMatchSub) {
          ctx.font = '700 11px "Source Sans 3", sans-serif';
          ctx.fillStyle = (node.matchScore ?? 0) >= 75 ? '#2A6B53' : '#234B6E';
          ctx.fillText(
            `${node.matchScore}% Match`,
            node.x,
            pillY + 20.5
          );
        }
        ctx.textBaseline = 'alphabetic';
      }

      ctx.restore();
    };

    render2D();

    return () => {
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
    nodes,
    links,
    onSelectNode,
    onClearSelection,
    onMakeFocal,
    frameNodeAndLinkedCluster,
    labelMode,
  ]);

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
      <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-1.5 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#FBF8F2]/95 border border-[#C8BEAA] shadow-archival-sm text-xs text-[#171412]">
            <span
              className={`w-2 h-2 rounded-full ${
                focalItem ? 'bg-[#B8292F]' : 'bg-[#2A6B53]'
              }`}
            />
            <span className="text-[#52483E]">
              {focalItem
                ? 'Centered on:'
                : graphScope === 'WATCHED_ONLY'
                  ? `${activeUser ? `${activeUser.displayName}'s` : 'My'} Watched Graph:`
                  : graphScope === 'INTERESTED_ONLY'
                    ? `${activeUser ? `${activeUser.displayName}'s` : 'My'} Interested Graph:`
                    : graphScope === 'WATCHED_AND_INTERESTED'
                      ? `${activeUser ? `${activeUser.displayName}'s` : 'My'} Watched + Interested:`
                      : graphScope === 'WATCHED_PLUS_SUGGESTIONS'
                        ? `${activeUser ? `${activeUser.displayName}'s` : 'My'} Watched + Suggested:`
                        : 'Archive Index:'}
            </span>
            <strong className="font-heading font-bold text-[#171412]">
              {focalItem
                ? `${focalItem.title} (${focalItem.year})`
                : graphScope !== 'FULL_ARCHIVE'
                  ? `${nodes.filter((n) => n.type === 'MOVIE' || n.type === 'TV').length} Personal Titles · ${nodes.filter((n) => n.type !== 'MOVIE' && n.type !== 'TV').length} Shared Bridges`
                  : `All ${nodes.filter((n) => n.type === 'MOVIE' || n.type === 'TV').length} Movies & TV Shows`}
            </strong>
          </div>

          {activeUser && graphScope !== 'FULL_ARCHIVE' && onGraphScopeChange && (
            <div className="pointer-events-auto inline-flex items-center gap-1 p-0.5 rounded bg-[#FBF8F2]/95 border border-[#C8BEAA] shadow-archival-sm">
              <button
                type="button"
                onClick={() => onGraphScopeChange('WATCHED_ONLY')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  graphScope === 'WATCHED_ONLY'
                    ? 'bg-[#2A6B53] text-[#FBF8F2]'
                    : 'text-[#52483E] hover:text-[#171412]'
                }`}
              >
                Watched
              </button>
              <button
                type="button"
                onClick={() => onGraphScopeChange('INTERESTED_ONLY')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  graphScope === 'INTERESTED_ONLY'
                    ? 'bg-[#234B6E] text-[#FBF8F2]'
                    : 'text-[#52483E] hover:text-[#171412]'
                }`}
              >
                Interested
              </button>
              <button
                type="button"
                onClick={() => onGraphScopeChange('WATCHED_AND_INTERESTED')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  graphScope === 'WATCHED_AND_INTERESTED'
                    ? 'bg-[#B8292F] text-[#FBF8F2]'
                    : 'text-[#52483E] hover:text-[#171412]'
                }`}
              >
                Both
              </button>
              <button
                type="button"
                onClick={() => onGraphScopeChange('WATCHED_PLUS_SUGGESTIONS')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  graphScope === 'WATCHED_PLUS_SUGGESTIONS'
                    ? 'bg-[#2A6B53] text-[#FBF8F2]'
                    : 'text-[#52483E] hover:text-[#171412]'
                }`}
              >
                + Suggestions
              </button>
              {onOpenProfileModal && (
                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  className="px-2 py-1 rounded text-[11px] font-semibold text-[#B8292F] hover:bg-[#F5E4E4]/60 transition-colors cursor-pointer"
                >
                  + Manage Lists
                </button>
              )}
              <button
                type="button"
                onClick={() => onGraphScopeChange('FULL_ARCHIVE')}
                className="px-2 py-1 rounded text-[11px] font-semibold text-[#52483E] hover:text-[#171412] transition-colors cursor-pointer"
              >
                Full Archive
              </button>
            </div>
          )}

          {((selectedSubgraph.focusNode &&
            (selectedSubgraph.focusNode.type === 'MOVIE' ||
              selectedSubgraph.focusNode.type === 'TV')) ||
            (focalItem && !selectedSubgraph.focusNode)) && (
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
        </div>
        {!selectedSubgraph.focusNode && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#EFE8DA]/90 border border-[#D5CCB9] text-[11px] text-[#52483E]">
            <span>
              {graphScope !== 'FULL_ARCHIVE'
                ? 'Personal Watched Constellation active · Showing your watched movies & TV shows and their shared directors, cast & themes'
                : 'Click any node to isolate & inspect only its connected nodes · Double-click a title to center the map'}
            </span>
          </div>
        )}
      </div>

      {/* Canonical Isolated-View Surface: Persistent Linked Constellation Panel (Shown for Collaborator & Theme bridge nodes; Film/TV nodes open the Right Monograph Inspector) */}
      {selectedSubgraph.focusNode &&
        selectedSubgraph.focusNode.type !== 'MOVIE' &&
        selectedSubgraph.focusNode.type !== 'TV' && (
        <div
          aria-label="Selected Node Linked Connections"
          className="pointer-events-auto absolute top-14 left-4 z-30 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-9.5rem)] rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival flex flex-col overflow-hidden"
        >
          {/* Header: Selected Node (Heading First — no kicker above h3) & Single Canonical Reset Action */}
          <div className="px-3.5 py-2.5 bg-[#EFE8DA] border-b border-[#D5CCB9] flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 border border-[#C8BEAA] bg-[#FBF8F2] mt-0.5">
                {selectedSubgraph.focusNode.type === 'DIRECTOR' && (
                  <Award className="w-4 h-4 text-[#B8292F]" />
                )}
                {selectedSubgraph.focusNode.type === 'ACTOR' && (
                  <UserCheck className="w-4 h-4 text-[#B86B14]" />
                )}
                {selectedSubgraph.focusNode.type === 'TROPE' && (
                  <Hash className="w-4 h-4 text-[#2A6B53]" />
                )}
                {selectedSubgraph.focusNode.type === 'COMPOSER' && (
                  <Music className="w-4 h-4 text-[#A63A2B]" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-heading text-sm font-bold text-[#171412] truncate">
                  {selectedSubgraph.focusNode.label}
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B8292F]">
                    <Link2 className="w-3 h-3" />
                    <span>Isolated Subgraph</span>
                  </span>
                  <span className="text-[11px] text-[#52483E]">
                    · {getEntityRoleLabel(selectedSubgraph.focusNode.type)}
                  </span>
                </div>
              </div>
            </div>

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
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] text-[11px] font-semibold shadow-archival-sm transition-colors shrink-0 cursor-pointer"
              title="Exit isolated view and restore full graph (Esc)"
              aria-label="Reset isolated view (Escape)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset (Esc)</span>
            </button>
          </div>

          {/* Summary Count Strip */}
          <div className="px-3.5 py-2 bg-[#F6F1E7] border-b border-[#D5CCB9] flex items-center justify-between text-[11px]">
            <span className="font-medium text-[#52483E]">
              {selectedSubgraph.linkedNodeIds.size} nodes shown:
            </span>
            <div className="flex items-center gap-1.5 font-tabular font-semibold">
              <span className="px-1.5 py-0.5 rounded bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7]">
                {selectedSubgraph.linkedMedia.length}{' '}
                {selectedSubgraph.linkedMedia.length === 1 ? 'Title' : 'Titles'}
              </span>
              {selectedSubgraph.linkedEntities.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-[#EFE8DA] text-[#171412] border border-[#C8BEAA]">
                  {selectedSubgraph.linkedEntities.length} Shared{' '}
                  {selectedSubgraph.linkedEntities.length === 1
                    ? 'Credit'
                    : 'Credits'}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable Linked Nodes List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Section 1: Linked Movies & TV Series */}
            <div>
              <h4 className="font-heading text-xs font-bold text-[#171412] mb-1.5">
                Connected Films &amp; Series ({selectedSubgraph.linkedMedia.length})
              </h4>
              {selectedSubgraph.linkedMedia.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedSubgraph.linkedMedia.map(
                    ({ node: mNode, sharedReasons, directScore }) => (
                      <button
                        key={mNode.id}
                        type="button"
                        onClick={() => {
                          onSelectNode(mNode);
                          frameNodeAndLinkedCluster(mNode.id);
                        }}
                        onMouseEnter={() => {
                          hoveredIdRef.current = mNode.id;
                          setHoveredNodeId(mNode.id);
                        }}
                        onMouseLeave={() => {
                          hoveredIdRef.current = null;
                          setHoveredNodeId(null);
                        }}
                        className="w-full text-left p-2 rounded bg-[#FBF8F2] hover:bg-[#EFE8DA] border border-[#D5CCB9] hover:border-[#B8292F] transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {mNode.type === 'MOVIE' ? (
                              <Film className="w-3.5 h-3.5 text-[#234B6E] shrink-0" />
                            ) : (
                              <Tv className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" />
                            )}
                            <span className="font-heading text-xs font-bold text-[#171412] group-hover:text-[#B8292F] truncate">
                              {mNode.label}
                            </span>
                            {mNode.mediaItem && (
                              <span className="text-[11px] font-tabular text-[#6B5E50] shrink-0">
                                ({mNode.mediaItem.year})
                              </span>
                            )}
                          </div>
                          {directScore !== undefined && directScore > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7] text-[11px] font-tabular font-bold shrink-0">
                              {directScore}%
                            </span>
                          )}
                        </div>
                        {sharedReasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sharedReasons.slice(0, 3).map((reason) => (
                              <span
                                key={reason}
                                className="px-1.5 py-0.5 rounded bg-[#EFE8DA] text-[#52483E] text-[11px] font-medium truncate max-w-full"
                              >
                                {reason}
                              </span>
                            ))}
                            {sharedReasons.length > 3 && (
                              <span className="text-[11px] text-[#6B5E50]">
                                +{sharedReasons.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#6B5E50] italic">
                  No directly linked titles above the current threshold.
                </p>
              )}
            </div>

            {/* Section 2: Linked Collaborator & Theme Nodes */}
            {selectedSubgraph.linkedEntities.length > 0 && (
              <div className="pt-2 border-t border-[#D5CCB9]">
                <h4 className="font-heading text-xs font-bold text-[#171412] mb-1.5">
                  Shared Collaborators &amp; Themes (
                  {selectedSubgraph.linkedEntities.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSubgraph.linkedEntities.map(
                    ({ node: eNode, roleLabel, connectedCount }) => (
                      <button
                        key={eNode.id}
                        type="button"
                        onClick={() => {
                          onSelectNode(eNode);
                          frameNodeAndLinkedCluster(eNode.id);
                        }}
                        onMouseEnter={() => {
                          hoveredIdRef.current = eNode.id;
                          setHoveredNodeId(eNode.id);
                        }}
                        onMouseLeave={() => {
                          hoveredIdRef.current = null;
                          setHoveredNodeId(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-[#EFE8DA] hover:bg-[#E5DEC9] border border-[#C8BEAA] hover:border-[#B8292F] transition-colors cursor-pointer"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: eNode.color }}
                        />
                        <span className="font-semibold text-[#171412]">
                          {eNode.label}
                        </span>
                        <span className="text-[11px] text-[#52483E]">
                          · {roleLabel} ({connectedCount})
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top-Center Hover Preview Pill (Strictly for Hover Previews when no node is selected) */}
      {hoveredNodeId && hoveredTooltip && !selectedSubgraph.focusNode ? (
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-[#FBF8F2] border border-[#B5A892] shadow-archival flex items-center gap-2.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-[#B8292F] animate-pulse" />
          <span className="text-[#52483E]">Inspecting threads:</span>
          <strong className="text-[#B8292F] font-semibold">
            {hoveredTooltip.node.label}
          </strong>
          {hoveredTooltip.node.matchScore !== undefined &&
            !hoveredTooltip.node.isFocal && (
              <span className="px-1.5 py-0.5 rounded bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7] font-tabular font-bold">
                {hoveredTooltip.node.matchScore}% Match
              </span>
            )}
        </div>
      ) : null}

      {/* Floating Archival Vellum Cursor Hover Tooltip */}
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
            className="pointer-events-none absolute z-30 w-80 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival p-3.5 transition-opacity duration-150"
            style={{
              left: Math.min(
                viewportWidth - 340,
                Math.max(16, hoveredTooltip.x + 18)
              ),
              top: Math.min(
                viewportHeight - 220,
                Math.max(16, hoveredTooltip.y - 24)
              ),
            }}
          >
            {hoveredTooltip.node.mediaItem ? (
            <div className="flex gap-3">
              {/* Poster Thumbnail */}
              <div className="w-16 h-24 rounded-sm overflow-hidden shrink-0 border border-[#C8BEAA] bg-[#EFE8DA] relative">
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

              <div className="flex-1 min-w-0">
                {/* Title Heading First (no kicker above h4) */}
                <div className="flex items-start justify-between gap-1.5">
                  <h4 className="font-heading text-base font-bold text-[#171412] truncate">
                    {hoveredTooltip.node.mediaItem.title}
                  </h4>

                  {hoveredTooltip.node.isFocal ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6] text-[11px] font-semibold shrink-0">
                      Selected
                    </span>
                  ) : hoveredTooltip.node.matchScore !== undefined ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7] text-[11px] font-tabular font-bold shrink-0">
                      {hoveredTooltip.node.matchScore}%
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-[#EFE8DA] text-[#52483E] border border-[#C8BEAA] text-[11px] font-semibold shrink-0">
                      {hoveredTooltip.node.mediaItem.primaryGenre}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#52483E] mt-0.5 truncate">
                  {hoveredTooltip.node.mediaItem.mediaType === 'MOVIE' ? (
                    <Film className="w-3 h-3 inline mr-1 text-[#234B6E]" />
                  ) : (
                    <Tv className="w-3 h-3 inline mr-1 text-[#6B3A6E]" />
                  )}
                  {hoveredTooltip.node.mediaItem.year} ·{' '}
                  {hoveredTooltip.node.mediaItem.directors[0]}
                </p>

                {/* IMDb & Rotten Tomatoes Scores (no emoji) */}
                <div className="flex items-center gap-2.5 mt-2 text-xs font-tabular text-[#52483E]">
                  <span>
                    IMDb{' '}
                    <strong className="text-[#171412] font-bold">
                      {hoveredTooltip.node.mediaItem.imdbRating.toFixed(1)}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Critics{' '}
                    <strong className="text-[#8C1D22] font-bold">
                      {hoveredTooltip.node.mediaItem.rottenTomatoes}%
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Collaborator / Theme Node Tooltip (Heading first — no kicker above h4) */
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded flex items-center justify-center shrink-0 border border-[#C8BEAA] bg-[#EFE8DA]"
              >
                {hoveredTooltip.node.type === 'DIRECTOR' && (
                  <Award
                    className="w-5 h-5"
                    style={{ color: hoveredTooltip.node.color }}
                  />
                )}
                {hoveredTooltip.node.type === 'ACTOR' && (
                  <UserCheck
                    className="w-5 h-5"
                    style={{ color: hoveredTooltip.node.color }}
                  />
                )}
                {hoveredTooltip.node.type === 'TROPE' && (
                  <Hash
                    className="w-5 h-5"
                    style={{ color: hoveredTooltip.node.color }}
                  />
                )}
                {hoveredTooltip.node.type === 'COMPOSER' && (
                  <Music
                    className="w-5 h-5"
                    style={{ color: hoveredTooltip.node.color }}
                  />
                )}
              </div>
              <div>
                <h4 className="font-heading text-base font-bold text-[#171412]">
                  {hoveredTooltip.node.label}
                </h4>
                <p className="text-xs text-[#52483E] mt-0.5">
                  {hoveredTooltip.node.subLabel}
                </p>
              </div>
            </div>
          )}

          {/* Shared Connection Badges */}
          {hoveredTooltip.node.similarity &&
            hoveredTooltip.node.similarity.sharedConnections.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-[#D5CCB9]">
                <div className="text-[11px] font-medium text-[#52483E] mb-1">
                  {focalItem
                    ? `Shared with ${focalItem.title}:`
                    : 'Shared craft credits:'}
                </div>
                <div className="flex flex-wrap gap-1">
                  {hoveredTooltip.node.similarity.sharedConnections
                    .slice(0, 4)
                    .map((conn) => (
                      <span
                        key={conn.id}
                        className="px-1.5 py-0.5 rounded text-[11px] bg-[#EFE8DA] border border-[#D5CCB9] text-[#171412]"
                      >
                        <strong style={{ color: conn.color }}>
                          {conn.prefix}:
                        </strong>{' '}
                        {conn.value} (+{conn.points})
                      </span>
                    ))}
                </div>
              </div>
            )}
        </div>
      );
      })()}

      {/* Bottom-Left Sleek Category Models Key (Collapsible on md/lg, expanded on xl) */}
      <div className="absolute bottom-5 left-4 z-20 flex flex-col items-start gap-1.5">
        {/* Expanded Panel for sub-xl screens when toggled */}
        {isNodeKeyOpen && (
          <div className="xl:hidden flex flex-col gap-2 p-3 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival text-[11px] text-[#52483E] animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between gap-4 pb-1.5 border-b border-[#D5CCB9]">
              <span className="font-heading font-bold text-[#171412]">
                Constellation Key
              </span>
              <button
                type="button"
                onClick={() => setIsNodeKeyOpen(false)}
                className="text-[#6B5E50] hover:text-[#171412] text-[10px] font-semibold cursor-pointer"
                aria-label="Close constellation key"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#234B6E] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" fill="currentColor" />
                  <circle cx="8" cy="3.8" r="1.25" fill="#FBF8F2" />
                  <circle cx="12" cy="6.7" r="1.25" fill="#FBF8F2" />
                  <circle cx="10.5" cy="11.4" r="1.25" fill="#FBF8F2" />
                  <circle cx="5.5" cy="11.4" r="1.25" fill="#FBF8F2" />
                  <circle cx="4" cy="6.7" r="1.25" fill="#FBF8F2" />
                  <circle cx="8" cy="8" r="1" fill="#FBF8F2" />
                </svg>
                <span>Film Reel (Movie)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M5.2 1.8L7.3 4.2M10.8 1.8L8.7 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <rect x="2" y="4" width="12" height="8.5" rx="2" fill="currentColor" />
                  <rect x="3.6" y="5.4" width="8.8" height="5.7" rx="1" fill="#FBF8F2" />
                  <path d="M5.5 14.2H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span>TV Set (Series)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#B8292F] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="2" y="6.2" width="12" height="8" rx="1.5" fill="currentColor" />
                  <path d="M2.2 5.4L13.5 2.4L14.1 4.6L2.8 7.6Z" fill="currentColor" />
                  <path d="M4.5 9.5H11.5M4.5 11.8H9" stroke="#FBF8F2" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span>Clapperboard (Director)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#B86B14] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <polygon points="8,1.3 9.9,5.6 14.6,6.1 11.1,9.3 12.1,13.9 8,11.5 3.9,13.9 4.9,9.3 1.4,6.1 6.1,5.6" fill="currentColor" />
                </svg>
                <span>Star (Cast)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#2A6B53] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 3.6C6.2 2.4 3.5 2.6 1.8 3.6V12.6C3.5 11.6 6.2 11.4 8 12.6C9.8 11.4 12.5 11.6 14.2 12.6V3.6C12.5 2.6 9.8 2.4 8 3.6Z" fill="currentColor" />
                  <path d="M8 3.8V12.4" stroke="#FBF8F2" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span>Book (Theme)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#A63A2B] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="4.8" cy="12" r="2.2" fill="currentColor" />
                  <circle cx="11.5" cy="10.6" r="2.2" fill="currentColor" />
                  <path d="M6.6 12V3.8L13.3 2.4V10.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Note (Music)</span>
              </span>
            </div>
          </div>
        )}

        {/* Compact Toggle Pill below xl / Full Legend on xl */}
        <div className="flex items-center">
          {/* Sub-xl interactive toggle pill */}
          <button
            type="button"
            onClick={() => setIsNodeKeyOpen((prev) => !prev)}
            className="xl:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FBF8F2] hover:bg-[#EFE8DA] border border-[#B5A892] shadow-archival-sm text-[11px] font-semibold text-[#171412] transition-colors cursor-pointer"
            aria-expanded={isNodeKeyOpen}
            aria-label="Toggle node key legend"
          >
            <span className="w-2 h-2 rounded-full bg-[#B8292F]" />
            <span>Node Key</span>
            <span className="text-[10px] text-[#52483E]">{isNodeKeyOpen ? '▲' : '▼'}</span>
          </button>

          {/* Full static strip on xl+ displays */}
          <div className="hidden xl:flex pointer-events-none items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#FBF8F2] border border-[#B5A892] shadow-archival-sm text-[11px] text-[#52483E]">
            <span className="font-heading font-bold text-[#171412] pr-1.5 border-r border-[#D5CCB9]">
              Node Key
            </span>
            {/* Film Reel */}
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#234B6E]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" fill="currentColor" />
                <circle cx="8" cy="3.8" r="1.25" fill="#FBF8F2" />
                <circle cx="12" cy="6.7" r="1.25" fill="#FBF8F2" />
                <circle cx="10.5" cy="11.4" r="1.25" fill="#FBF8F2" />
                <circle cx="5.5" cy="11.4" r="1.25" fill="#FBF8F2" />
                <circle cx="4" cy="6.7" r="1.25" fill="#FBF8F2" />
                <circle cx="8" cy="8" r="1" fill="#FBF8F2" />
              </svg>
              <span>Film Reel</span>
            </span>
            {/* TV Set */}
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#6B3A6E]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M5.2 1.8L7.3 4.2M10.8 1.8L8.7 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <rect x="2" y="4" width="12" height="8.5" rx="2" fill="currentColor" />
                <rect x="3.6" y="5.4" width="8.8" height="5.7" rx="1" fill="#FBF8F2" />
                <path d="M5.5 14.2H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>TV Set</span>
            </span>
            {/* Director Clapperboard */}
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#B8292F]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="6.2" width="12" height="8" rx="1.5" fill="currentColor" />
                <path d="M2.2 5.4L13.5 2.4L14.1 4.6L2.8 7.6Z" fill="currentColor" />
                <path d="M4.5 9.5H11.5M4.5 11.8H9" stroke="#FBF8F2" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span>Clapperboard</span>
            </span>
            {/* Cast 5-Point Star */}
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#B86B14]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <polygon points="8,1.3 9.9,5.6 14.6,6.1 11.1,9.3 12.1,13.9 8,11.5 3.9,13.9 4.9,9.3 1.4,6.1 6.1,5.6" fill="currentColor" />
              </svg>
              <span>Cast Star</span>
            </span>
            {/* Story Book */}
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#2A6B53]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 3.6C6.2 2.4 3.5 2.6 1.8 3.6V12.6C3.5 11.6 6.2 11.4 8 12.6C9.8 11.4 12.5 11.6 14.2 12.6V3.6C12.5 2.6 9.8 2.4 8 3.6Z" fill="currentColor" />
                <path d="M8 3.8V12.4" stroke="#FBF8F2" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span>Story Book</span>
            </span>
            {/* Score Musical Note */}
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#A63A2B]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="4.8" cy="12" r="2.2" fill="currentColor" />
                <circle cx="11.5" cy="10.6" r="2.2" fill="currentColor" />
                <path d="M6.6 12V3.8L13.3 2.4V10.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Music Note</span>
            </span>
          </div>
        </div>
      </div>

      {/* MOVIE MAP REA: TOP-RIGHT DISPLAY & PROJECTION CONTROLS HUD */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-full bg-[#FBF8F2]/95 border border-[#B5A892] shadow-archival text-xs font-semibold text-[#171412]">
        {/* Layout Toggle: Constellation vs Galaxy */}
        {onLayoutModeChange && (
          <div className="flex items-center gap-0.5 pr-1 border-r border-[#D5CCB9]">
            <button
              type="button"
              onClick={() => onLayoutModeChange('FORCE_CONSTELLATION')}
              className={`px-2 py-1 rounded-full text-[11px] transition-colors cursor-pointer ${
                layoutMode === 'FORCE_CONSTELLATION'
                  ? 'bg-[#234B6E] text-[#FBF8F2]'
                  : 'text-[#52483E] hover:text-[#171412]'
              }`}
            >
              Constellation
            </button>
            <button
              type="button"
              onClick={() => onLayoutModeChange('SEMANTIC_GALAXY')}
              className={`px-2 py-1 rounded-full text-[11px] transition-colors cursor-pointer ${
                layoutMode === 'SEMANTIC_GALAXY'
                  ? 'bg-[#B8292F] text-[#FBF8F2]'
                  : 'text-[#52483E] hover:text-[#171412]'
              }`}
            >
              Galaxy
            </button>
          </div>
        )}

        {/* Color Mode Switcher */}
        {onColorModeChange && (
          <div className="flex items-center gap-0.5 pr-1 border-r border-[#D5CCB9]">
            {(
              [
                { id: 'CLUSTER', label: 'Cluster' },
                { id: 'GENRE', label: 'Genre' },
                { id: 'DECADE', label: 'Decade' },
                { id: 'CATEGORY', label: 'Type' },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onColorModeChange(c.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                  colorMode === c.id
                    ? 'bg-[#EFE8DA] text-[#171412] font-bold border border-[#C8BEAA]'
                    : 'text-[#6B5E50] hover:text-[#171412]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Label Mode Toggle (Auto / All / Off) */}
        {onLabelModeChange && (
          <button
            type="button"
            onClick={() => {
              const next =
                labelMode === 'AUTO'
                  ? 'ALL'
                  : labelMode === 'ALL'
                    ? 'OFF'
                    : 'AUTO';
              onLabelModeChange(next);
            }}
            title="Toggle Labels (or press 'L')"
            className={`px-2 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
              labelMode === 'OFF'
                ? 'bg-[#EFE8DA] text-[#6B5E50] border-[#D5CCB9]'
                : labelMode === 'ALL'
                  ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                  : 'bg-[#FBF8F2] text-[#171412] border-[#C8BEAA]'
            }`}
          >
            L: {labelMode === 'AUTO' ? 'Auto' : labelMode === 'ALL' ? 'All' : 'Off'}
          </button>
        )}
      </div>

      {/* MOVIE MAP REA: INTERACTIVE CLUSTER TERRITORY LEGEND (Bottom-Left) */}
      {clusters && clusters.length > 0 && (
        <div className="hidden lg:flex absolute bottom-5 left-4 z-20 flex-col gap-1 p-2.5 rounded-lg bg-[#FBF8F2]/95 border border-[#B5A892] shadow-archival max-w-xs text-xs">
          <div className="flex items-center justify-between gap-3 pb-1 border-b border-[#D5CCB9]">
            <span className="font-heading font-bold text-[#171412]">
              Semantic Galaxy Clusters
            </span>
            {graphFilters?.activeClusterId && onSelectCluster && (
              <button
                type="button"
                onClick={() => onSelectCluster(null)}
                className="text-[10px] text-[#B8292F] font-semibold hover:underline cursor-pointer"
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
                  className={`text-left flex items-center gap-1.5 py-0.5 px-1 rounded transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#EFE8DA] font-bold text-[#171412]'
                      : 'hover:bg-[#EFE8DA]/60 text-[#52483E]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="truncate text-[10px]">{c.shortLabel}</span>
                  <span className="text-[9px] font-tabular text-[#8C8070] ml-auto">
                    {c.mediaIds.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Center Camera Dock */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#FBF8F2] border border-[#B5A892] shadow-archival">
        <button
          type="button"
          onClick={() => onCameraModeChange('ORBIT')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            cameraMode === 'ORBIT'
              ? 'bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]'
              : 'text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Orbit</span>
        </button>

        <button
          type="button"
          onClick={() => onCameraModeChange('FREE_LOOK')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            cameraMode === 'FREE_LOOK'
              ? 'bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]'
              : 'text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA]'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Pan</span>
        </button>

        <button
          type="button"
          onClick={() => onCameraModeChange('FLY_THROUGH')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            cameraMode === 'FLY_THROUGH'
              ? 'bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]'
              : 'text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA]'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Guided Tour</span>
        </button>

        <div className="h-4 w-px bg-[#D5CCB9] mx-1" />

        <button
          type="button"
          onClick={() => handleZoomStep(-35)}
          title="Zoom In (+)"
          className="p-1.5 rounded-full text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA] transition-colors"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleZoomStep(35)}
          title="Zoom Out (-)"
          className="p-1.5 rounded-full text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA] transition-colors"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-[#D5CCB9] mx-1" />

        <button
          type="button"
          onClick={() => {
            camSphericalRef.current.phi = Math.PI / 2.25;
            camSphericalRef.current.theta = 0.45;
            camSphericalRef.current.goalX = 0;
            camSphericalRef.current.goalY = 0;
            camSphericalRef.current.goalZ = 0;
            camSphericalRef.current.goalRadius = 265;
            pan2dRef.current.goalPanX = 0;
            pan2dRef.current.goalPanY = 0;
            pan2dRef.current.goalZoom = 1.05;
            onCameraModeChange('ORBIT');
            if (onResetEverything) {
              onResetEverything();
            } else {
              onClearSelection?.();
              onClearFocal?.();
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
            selectedSubgraph.focusNode || focalItem
              ? 'bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] shadow-archival-sm'
              : 'text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA]'
          }`}
          title="Reset selection, filters, and camera to show the full graph"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 ${
              selectedSubgraph.focusNode || focalItem
                ? 'text-[#FBF8F2]'
                : 'text-[#8C1D22]'
            }`}
          />
          <span>
            {selectedSubgraph.focusNode || focalItem
              ? 'Reset Everything'
              : 'Reset View'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onAutoRotateChange(!autoRotate)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            autoRotate
              ? 'bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7]'
              : 'text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA]'
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`}
            style={{ animationDuration: '8s' }}
          />
          <span>Gentle Spin</span>
        </button>
      </div>
    </div>
  );
}
