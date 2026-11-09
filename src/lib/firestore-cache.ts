import crypto from 'crypto';
import { MediaItem, UserProfile } from './types';

/**
 * Cloud Firestore Free-Tier Optimized Store for SixDegrees
 *
 * Why Bundled Documents?
 * - Firestore Spark Free Tier allows 50,000 document reads/day and 20,000 writes/day.
 * - If 250 movies were stored as 250 individual documents, loading the catalog would burn
 *   250 reads per cold start.
 * - By packing up to 150 MediaItems per bundle document (`sixdegrees_catalog/bundle_0`, `bundle_1`)
 *   and storing OMDb + crawled collaborator state in `sixdegrees_catalog/telemetry`,
 *   hydrating the entire catalog costs only 1-2 Firestore reads total, and saving a batch of
 *   5 newly discovered titles costs only 1-2 Firestore writes!
 */

const FIRESTORE_COLLECTION = 'sixdegrees_catalog';
const ITEMS_PER_BUNDLE = 80;

export interface OmdbCachedEntry {
  imdbRating?: number;
  rottenTomatoes?: number;
  metascore?: number;
  contentRating?: string;
  runtime?: string;
  plot?: string;
  director?: string[];
  writer?: string[];
  actors?: string[];
  genres?: string[];
  poster?: string;
  fetchedAt: number;
}

export interface FirestoreSyncState {
  enabled: boolean;
  projectId: string;
  authMode: 'SERVICE_ACCOUNT' | 'API_KEY' | 'NONE';
  lastSyncedAt: number | null;
  firestoreReadsSession: number;
  firestoreWritesSession: number;
}

let sessionReads = 0;
let sessionWrites = 0;
let lastSyncedTimestamp: number | null = null;

// Cached Google OAuth2 access token when using Service Account credentials
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function getFirestoreConfig(overrideProjectId?: string, overrideApiKey?: string) {
  const projectId =
    (overrideProjectId || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
  const apiKey =
    (overrideApiKey || process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const rawPrivateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : '';

  const hasServiceAccount = Boolean(projectId && clientEmail && privateKey);
  const hasApiKey = Boolean(projectId && apiKey);

  return {
    projectId,
    apiKey,
    clientEmail,
    privateKey,
    enabled: Boolean(projectId && (hasServiceAccount || hasApiKey || projectId)),
    authMode: hasServiceAccount
      ? ('SERVICE_ACCOUNT' as const)
      : hasApiKey
        ? ('API_KEY' as const)
        : projectId
          ? ('API_KEY' as const)
          : ('NONE' as const),
  };
}

export function getFirestoreTelemetry(
  overrideProjectId?: string,
  overrideApiKey?: string
): FirestoreSyncState {
  const cfg = getFirestoreConfig(overrideProjectId, overrideApiKey);
  return {
    enabled: cfg.enabled,
    projectId: cfg.projectId,
    authMode: cfg.authMode,
    lastSyncedAt: lastSyncedTimestamp,
    firestoreReadsSession: sessionReads,
    firestoreWritesSession: sessionWrites,
  };
}

/**
 * Generates a short-lived Google OAuth2 Bearer token from a Firebase Service Account
 * using Node's native `crypto` module (zero external SDK dependencies).
 */
async function getServiceAccountBearerToken(
  clientEmail: string,
  privateKey: string
): Promise<string | null> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
      scope: 'https://www.googleapis.com/auth/datastore',
    };

    const base64Url = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const unsignedToken = `${base64Url(header)}.${base64Url(payload)}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedToken);
    signer.end();
    const signature = signer
      .sign(privateKey, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const assertion = `${unsignedToken}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;

    cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
    return cachedAccessToken.token;
  } catch {
    return null;
  }
}

/**
 * Low-level helper to read a single Firestore document via the official v1 REST API.
 */
async function readFirestoreDoc(
  docId: string,
  overrideProjectId?: string,
  overrideApiKey?: string
): Promise<Record<string, string> | null> {
  const cfg = getFirestoreConfig(overrideProjectId, overrideApiKey);
  if (!cfg.enabled) return null;

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    cfg.projectId
  )}/databases/(default)/documents/${FIRESTORE_COLLECTION}/${encodeURIComponent(docId)}`;

  const url = cfg.apiKey ? `${baseUrl}?key=${encodeURIComponent(cfg.apiKey)}` : baseUrl;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (cfg.authMode === 'SERVICE_ACCOUNT') {
    const token = await getServiceAccountBearerToken(cfg.clientEmail, cfg.privateKey);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    sessionReads += 1;
    const res = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const doc = await res.json();
    if (!doc?.fields) return null;

    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(doc.fields as Record<string, { stringValue?: string }>)) {
      if (typeof v?.stringValue === 'string') {
        out[k] = v.stringValue;
      }
    }
    lastSyncedTimestamp = Date.now();
    return out;
  } catch {
    return null;
  }
}

/**
 * Low-level helper to upsert a single Firestore document via the official v1 REST API.
 */
async function writeFirestoreDoc(
  docId: string,
  stringFields: Record<string, string>,
  overrideProjectId?: string,
  overrideApiKey?: string
): Promise<boolean> {
  const cfg = getFirestoreConfig(overrideProjectId, overrideApiKey);
  if (!cfg.enabled) return false;

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    cfg.projectId
  )}/databases/(default)/documents/${FIRESTORE_COLLECTION}/${encodeURIComponent(docId)}`;

  const url = cfg.apiKey ? `${baseUrl}?key=${encodeURIComponent(cfg.apiKey)}` : baseUrl;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (cfg.authMode === 'SERVICE_ACCOUNT') {
    const token = await getServiceAccountBearerToken(cfg.clientEmail, cfg.privateKey);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const fields: Record<string, { stringValue: string }> = {};
  for (const [k, v] of Object.entries(stringFields)) {
    fields[k] = { stringValue: v };
  }

  try {
    sessionWrites += 1;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields }),
    });
    if (res.ok) {
      lastSyncedTimestamp = Date.now();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Hydrates the entire cached catalog + OMDb ratings + crawled collaborators from Cloud Firestore
 * using at most 2–3 document reads total.
 */
export async function loadCatalogFromFirestore(
  overrideProjectId?: string,
  overrideApiKey?: string
): Promise<{
  items: Record<string, MediaItem>;
  omdbByImdb: Record<string, OmdbCachedEntry>;
  crawledCollaborators: string[];
  omdbCallsToday: number;
  tmdbCallsToday: number;
  dayKey: string;
} | null> {
  const cfg = getFirestoreConfig(overrideProjectId, overrideApiKey);
  if (!cfg.enabled) return null;

  try {
    // 1. Read telemetry & index doc (1 read)
    const metaFields = await readFirestoreDoc(
      'telemetry',
      overrideProjectId,
      overrideApiKey
    );
    if (!metaFields) return null;

    const bundleCount = Math.min(
      10,
      Math.max(1, parseInt(metaFields.bundleCount || '1', 10))
    );
    const omdbByImdb: Record<string, OmdbCachedEntry> = metaFields.omdbJson
      ? JSON.parse(metaFields.omdbJson)
      : {};
    const crawledCollaborators: string[] = metaFields.crawledCollaboratorsJson
      ? JSON.parse(metaFields.crawledCollaboratorsJson)
      : [];

    // 2. Read catalog bundles in parallel (typically 1-2 reads total for 120-240 titles)
    const bundleIndices = Array.from({ length: bundleCount }, (_, i) => i);
    const bundleDocs = await Promise.all(
      bundleIndices.map((idx) =>
        readFirestoreDoc(`bundle_${idx}`, overrideProjectId, overrideApiKey)
      )
    );

    const items: Record<string, MediaItem> = {};
    for (const bDoc of bundleDocs) {
      if (!bDoc?.itemsJson) continue;
      try {
        const parsed = JSON.parse(bDoc.itemsJson) as MediaItem[];
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item?.id) {
              items[item.id] = item;
            }
          }
        }
      } catch {
        // Ignore malformed bundle
      }
    }

    return {
      items,
      omdbByImdb,
      crawledCollaborators,
      omdbCallsToday: parseInt(metaFields.omdbCallsToday || '0', 10) || 0,
      tmdbCallsToday: parseInt(metaFields.tmdbCallsToday || '0', 10) || 0,
      dayKey: metaFields.dayKey || '',
    };
  } catch {
    return null;
  }
}

/**
 * Persists the expanded catalog + OMDb ratings + crawled collaborators to Cloud Firestore
 * in sharded bundle documents so we stay well below Firestore's 1 MiB document size limit
 * and 20,000 daily writes free tier limit.
 */
export async function saveCatalogToFirestore(
  payload: {
    dayKey: string;
    omdbCallsToday: number;
    tmdbCallsToday: number;
    items: Record<string, MediaItem>;
    omdbByImdb: Record<string, OmdbCachedEntry>;
    crawledCollaborators: string[];
  },
  overrideProjectId?: string,
  overrideApiKey?: string
): Promise<boolean> {
  const cfg = getFirestoreConfig(overrideProjectId, overrideApiKey);
  if (!cfg.enabled) return false;

  try {
    const allItems = Object.values(payload.items);
    const bundleCount = Math.max(
      1,
      Math.ceil(allItems.length / ITEMS_PER_BUNDLE)
    );

    // Write bundles (1 write per 120 titles)
    for (let i = 0; i < bundleCount; i++) {
      const slice = allItems.slice(
        i * ITEMS_PER_BUNDLE,
        (i + 1) * ITEMS_PER_BUNDLE
      );
      await writeFirestoreDoc(
        `bundle_${i}`,
        {
          bundleIndex: String(i),
          count: String(slice.length),
          updatedAt: new Date().toISOString(),
          itemsJson: JSON.stringify(slice),
        },
        overrideProjectId,
        overrideApiKey
      );
    }

    // Keep the most recent 400 OMDb entries in telemetry doc to stay well under 1MB
    const omdbEntries = Object.entries(payload.omdbByImdb)
      .sort((a, b) => (b[1].fetchedAt || 0) - (a[1].fetchedAt || 0))
      .slice(0, 400);
    const trimmedOmdb = Object.fromEntries(omdbEntries);

    const ok = await writeFirestoreDoc(
      'telemetry',
      {
        dayKey: payload.dayKey,
        omdbCallsToday: String(payload.omdbCallsToday),
        tmdbCallsToday: String(payload.tmdbCallsToday),
        bundleCount: String(bundleCount),
        totalCachedTitles: String(allItems.length),
        updatedAt: new Date().toISOString(),
        omdbJson: JSON.stringify(trimmedOmdb),
        crawledCollaboratorsJson: JSON.stringify(
          payload.crawledCollaborators.slice(0, 500)
        ),
      },
      overrideProjectId,
      overrideApiKey
    );

    return ok;
  } catch {
    return false;
  }
}

export interface StoredUserRecord {
  profile: UserProfile;
  passwordHash?: string;
}

/**
 * Loads a single UserProfile (and optional salted passwordHash) from Cloud Firestore
 * (`sixdegrees_catalog/user_<handle>`) using 1 document read.
 */
export async function loadUserRecordFromFirestore(
  handle: string,
  overrideProjectId?: string,
  overrideApiKey?: string
): Promise<StoredUserRecord | null> {
  const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleanHandle) return null;

  const doc = await readFirestoreDoc(
    `user_${cleanHandle}`,
    overrideProjectId,
    overrideApiKey
  );
  if (!doc?.profileJson) return null;

  try {
    const parsed = JSON.parse(doc.profileJson) as UserProfile;
    if (!parsed?.id || !parsed?.handle) return null;
    const normalized: UserProfile = {
      ...parsed,
      watchedIds: Array.isArray(parsed.watchedIds) ? parsed.watchedIds : [],
      watchedCustomItems: Array.isArray(parsed.watchedCustomItems)
        ? parsed.watchedCustomItems
        : [],
      interestedIds: Array.isArray(parsed.interestedIds)
        ? parsed.interestedIds
        : [],
      interestedCustomItems: Array.isArray(parsed.interestedCustomItems)
        ? parsed.interestedCustomItems
        : [],
      hasPinOrPassword: Boolean(doc.passwordHash || parsed.hasPinOrPassword),
    };
    return {
      profile: normalized,
      passwordHash: doc.passwordHash || undefined,
    };
  } catch {
    return null;
  }
}

export async function loadUserFromFirestore(
  handle: string,
  overrideProjectId?: string,
  overrideApiKey?: string
): Promise<UserProfile | null> {
  const rec = await loadUserRecordFromFirestore(
    handle,
    overrideProjectId,
    overrideApiKey
  );
  return rec ? rec.profile : null;
}

/**
 * Persists a single UserProfile (including watchedIds, interestedIds, custom items, and optional salted passwordHash)
 * to Cloud Firestore (`sixdegrees_catalog/user_<handle>`) using 1 document write.
 */
export async function saveUserToFirestore(
  profile: UserProfile,
  overrideProjectId?: string,
  overrideApiKey?: string,
  passwordHash?: string
): Promise<boolean> {
  const cleanHandle = profile.handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  if (!cleanHandle) return false;

  const fields: Record<string, string> = {
    handle: cleanHandle,
    displayName: profile.displayName,
    email: profile.email || '',
    authMode: profile.authMode || 'HANDLE_ONLY',
    watchedCount: String(profile.watchedIds?.length || 0),
    interestedCount: String(profile.interestedIds?.length || 0),
    updatedAt: profile.updatedAt || new Date().toISOString(),
    profileJson: JSON.stringify(profile),
  };
  if (passwordHash) {
    fields.passwordHash = passwordHash;
  }

  return writeFirestoreDoc(
    `user_${cleanHandle}`,
    fields,
    overrideProjectId,
    overrideApiKey
  );
}


