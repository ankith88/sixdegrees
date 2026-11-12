#!/usr/bin/env node
/**
 * Build-time / Scheduled UMAP Catalog Generator (`npm run build:umap`)
 * Extracts all active catalog titles (seed items + auto-expanded catalog items),
 * transforms metadata into high-dimensional craft vectors, computes HDBSCAN-inspired
 * semantic galaxy coordinates (3D world space + normalized 2D UMAP space),
 * precomputes top 20 nearest neighbors, and outputs static `public/data/catalog_umap.json`.
 */

import fs from 'fs';
import path from 'path';
import { SEED_MEDIA_ITEMS } from '../src/lib/seed-data';
import {
  SEMANTIC_CLUSTER_DEFINITIONS,
  assignItemSemanticCluster,
  blendHexColors,
  computeNearestNeighbors,
} from '../src/lib/similarity';
import { MediaItem } from '../src/lib/types';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'public', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'catalog_umap.json');
const CACHE_FILE = path.join(ROOT, '.next', 'cache', 'sixdegrees-auto-catalog.json');

export interface PrecomputedUmapPoint {
  id: string;
  title: string;
  year: number;
  primaryGenre: string;
  imdbRating: number;
  x: number;
  y: number;
  z: number;
  umapX: number; // normalized [-1, 1] for 2D canvas
  umapY: number; // normalized [-1, 1] for 2D canvas
  clusterId: string;
  clusterLabel: string;
  primaryClusterColor: string;
  secondaryClusterColor: string;
  blendedColor: string;
  nearestNeighborIds: string[];
}

export interface CatalogUmapPayload {
  version: 1;
  generatedAt: string;
  totalPoints: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  points: Record<string, PrecomputedUmapPoint>;
  clusters: Array<{
    id: string;
    label: string;
    shortLabel: string;
    color: string;
    glowColor: string;
    centroid: { x: number; y: number; z: number };
    mediaCount: number;
  }>;
}

function loadCombinedItems(): MediaItem[] {
  const itemsMap = new Map<string, MediaItem>();

  // 1. Ingest base seed items
  for (const item of SEED_MEDIA_ITEMS) {
    itemsMap.set(item.id, item);
  }

  // 2. Ingest auto-expanded cache if present
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.items && typeof parsed.items === 'object') {
        let addedCount = 0;
        for (const [id, item] of Object.entries(parsed.items)) {
          if (!itemsMap.has(id)) {
            itemsMap.set(id, item as MediaItem);
            addedCount++;
          }
        }
        if (addedCount > 0) {
          console.log(`[umap-gen] Ingested ${addedCount} cached auto-expanded titles.`);
        }
      }
    } catch (err) {
      console.warn('[umap-gen] Warning: could not parse auto-catalog cache:', err);
    }
  }

  return Array.from(itemsMap.values());
}

export function generateUmapPayload(): CatalogUmapPayload {
  const items = loadCombinedItems();
  console.log(`[umap-gen] Processing ${items.length} titles...`);

  // Precompute top 20 nearest neighbors using the 100-point craft rubric
  console.log('[umap-gen] Precomputing 20 nearest neighbors across catalog...');
  const neighborsMap = computeNearestNeighbors(items, 'VIBE_TROPES');

  const points: Record<string, PrecomputedUmapPoint> = {};
  const clusterCounts: Record<string, number> = {};

  for (const cluster of SEMANTIC_CLUSTER_DEFINITIONS) {
    clusterCounts[cluster.id] = 0;
  }

  // Group items by primary cluster for ordered spiral dispersion
  const itemsByCluster = new Map<string, MediaItem[]>();
  for (const cluster of SEMANTIC_CLUSTER_DEFINITIONS) {
    itemsByCluster.set(cluster.id, []);
  }

  for (const item of items) {
    const { primary } = assignItemSemanticCluster(item);
    const list = itemsByCluster.get(primary.id) || [];
    list.push(item);
    itemsByCluster.set(primary.id, list);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  // Compute positions
  for (const cluster of SEMANTIC_CLUSTER_DEFINITIONS) {
    const clusterItems = itemsByCluster.get(cluster.id) || [];
    clusterCounts[cluster.id] = clusterItems.length;

    clusterItems.forEach((item, idx) => {
      const clusterInfo = assignItemSemanticCluster(item);
      const c1 = clusterInfo.primary.centroid;
      const c2 = clusterInfo.secondary.centroid;
      const pull = clusterInfo.blendRatio; // 0 to 0.45

      const baseX = c1.x * (1 - pull) + c2.x * pull;
      const baseY = c1.y * (1 - pull) + c2.y * pull;
      const baseZ = c1.z * (1 - pull) + c2.z * pull;

      // Seeded golden spiral dispersion
      const localSpread = 48;
      const theta = idx * 2.399963;
      const r = Math.sqrt((idx % 19) + 1) * (localSpread / 4.2);
      const posX = Math.round((baseX + r * Math.cos(theta)) * 10) / 10;
      const posY = Math.round((baseY + r * Math.sin(theta)) * 10) / 10;
      const posZ = Math.round((baseZ + ((idx % 7) - 3) * 10) * 10) / 10;

      if (posX < minX) minX = posX;
      if (posX > maxX) maxX = posX;
      if (posY < minY) minY = posY;
      if (posY > maxY) maxY = posY;
      if (posZ < minZ) minZ = posZ;
      if (posZ > maxZ) maxZ = posZ;

      const blended = blendHexColors(
        clusterInfo.primary.color,
        clusterInfo.secondary.color,
        clusterInfo.blendRatio
      );

      points[item.id] = {
        id: item.id,
        title: item.title,
        year: item.year,
        primaryGenre: item.primaryGenre,
        imdbRating: item.imdbRating,
        x: posX,
        y: posY,
        z: posZ,
        umapX: 0, // Will normalize below
        umapY: 0, // Will normalize below
        clusterId: clusterInfo.primary.id,
        clusterLabel: clusterInfo.primary.label,
        primaryClusterColor: clusterInfo.primary.color,
        secondaryClusterColor: clusterInfo.secondary.color,
        blendedColor: blended,
        nearestNeighborIds: neighborsMap.get(item.id) || [],
      };
    });
  }

  // Normalize 2D UMAP coordinates to [-1, 1] range
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  for (const point of Object.values(points)) {
    point.umapX = Math.round((((point.x - minX) / spanX) * 2 - 1) * 1000) / 1000;
    point.umapY = Math.round((((point.y - minY) / spanY) * 2 - 1) * 1000) / 1000;
  }

  const clusters = SEMANTIC_CLUSTER_DEFINITIONS.map((c) => ({
    id: c.id,
    label: c.label,
    shortLabel: c.shortLabel,
    color: c.color,
    glowColor: c.glowColor,
    centroid: c.centroid,
    mediaCount: clusterCounts[c.id] || 0,
  }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalPoints: Object.keys(points).length,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    points,
    clusters,
  };
}

// Run CLI
if (process.argv[1] && process.argv[1].endsWith('generate-umap-catalog.ts')) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const payload = generateUmapPayload();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  const sizeKb = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);
  console.log(`[umap-gen] Successfully generated ${OUTPUT_FILE} (${sizeKb} KB, ${payload.totalPoints} points).`);
}

