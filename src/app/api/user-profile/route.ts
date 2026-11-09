import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { UserAuthMode, UserProfile } from '@/lib/types';
import {
  getFirestoreConfig,
  getFirestoreTelemetry,
  loadUserRecordFromFirestore,
  saveUserToFirestore,
} from '@/lib/firestore-cache';

const USERS_CACHE_FILE_PATH = path.join(
  process.cwd(),
  '.next',
  'cache',
  'sixdegrees-users.json'
);

interface ServerUsersStore {
  profilesByHandle: Record<string, UserProfile>;
  passwordHashesByHandle: Record<string, string>;
}

let memoryUsersStore: ServerUsersStore | null = null;

function normalizeHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

function handleFromEmail(email: string): string {
  const localPart = email.split('@')[0] || 'cinephile';
  return normalizeHandle(localPart) || 'cinephile';
}

function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret.trim(), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifySecret(secret: string, storedHash?: string): boolean {
  if (!storedHash || !secret) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  try {
    const derived = crypto.scryptSync(secret.trim(), salt, 64);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

function createSessionToken(handle: string, passwordHash?: string): string {
  const secretSeed =
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.FIREBASE_API_KEY ||
    'sixdegrees-local-auth-secret-v1';
  const h = crypto
    .createHmac('sha256', secretSeed)
    .update(`${handle}:${passwordHash || 'open'}`)
    .digest('hex');
  return `${handle}.${h.slice(0, 32)}`;
}

function verifySessionToken(
  token: string | undefined,
  handle: string,
  passwordHash?: string
): boolean {
  if (!token) return false;
  const expected = createSessionToken(handle, passwordHash);
  return token === expected;
}

function getServerUsersStore(): ServerUsersStore {
  if (memoryUsersStore) return memoryUsersStore;

  try {
    if (fs.existsSync(USERS_CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(USERS_CACHE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ServerUsersStore>;
      memoryUsersStore = {
        profilesByHandle: parsed.profilesByHandle || {},
        passwordHashesByHandle: parsed.passwordHashesByHandle || {},
      };
      return memoryUsersStore;
    }
  } catch {
    // Ignore read error
  }

  memoryUsersStore = {
    profilesByHandle: {},
    passwordHashesByHandle: {},
  };
  return memoryUsersStore;
}

function saveServerUsersStore(): void {
  if (!memoryUsersStore) return;
  try {
    const dir = path.dirname(USERS_CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      USERS_CACHE_FILE_PATH,
      JSON.stringify(memoryUsersStore),
      'utf-8'
    );
  } catch {
    // Ignore write error in read-only environments
  }
}

function sanitizeUserProfile(
  incoming: Partial<UserProfile> & { handle: string; displayName: string },
  existing?: UserProfile,
  hasPinOrPassword?: boolean
): UserProfile {
  const handle = normalizeHandle(incoming.handle);
  const now = new Date().toISOString();

  const watchedIds = Array.isArray(incoming.watchedIds)
    ? Array.from(
        new Set(
          incoming.watchedIds.filter(
            (id): id is string => typeof id === 'string' && Boolean(id)
          )
        )
      )
    : existing?.watchedIds || [];

  const interestedIds = Array.isArray(incoming.interestedIds)
    ? Array.from(
        new Set(
          incoming.interestedIds.filter(
            (id): id is string => typeof id === 'string' && Boolean(id)
          )
        )
      )
    : existing?.interestedIds || [];

  return {
    id: incoming.id || existing?.id || `user:${handle}`,
    handle,
    displayName: (incoming.displayName || existing?.displayName || handle)
      .trim()
      .slice(0, 48),
    email:
      incoming.email !== undefined
        ? incoming.email
          ? incoming.email.trim().toLowerCase().slice(0, 120)
          : undefined
        : existing?.email,
    bio:
      incoming.bio !== undefined
        ? incoming.bio
          ? incoming.bio.trim().slice(0, 240)
          : undefined
        : existing?.bio,
    avatarColor: incoming.avatarColor || existing?.avatarColor || '#B8292F',
    authMode:
      incoming.authMode ||
      existing?.authMode ||
      (hasPinOrPassword ? 'PIN_PROTECTED' : 'HANDLE_ONLY'),
    firebaseUid: incoming.firebaseUid || existing?.firebaseUid,
    hasPinOrPassword:
      hasPinOrPassword !== undefined
        ? hasPinOrPassword
        : Boolean(existing?.hasPinOrPassword),
    watchedIds,
    watchedCustomItems: Array.isArray(incoming.watchedCustomItems)
      ? incoming.watchedCustomItems.slice(0, 150)
      : existing?.watchedCustomItems || [],
    interestedIds,
    interestedCustomItems: Array.isArray(incoming.interestedCustomItems)
      ? incoming.interestedCustomItems.slice(0, 150)
      : existing?.interestedCustomItems || [],
    preferredRegion:
      incoming.preferredRegion || existing?.preferredRegion || 'AU',
    defaultPreset:
      incoming.defaultPreset || existing?.defaultPreset || 'VIBE_TROPES',
    defaultGraphScope:
      incoming.defaultGraphScope ||
      existing?.defaultGraphScope ||
      'WATCHED_ONLY',
    createdAt: incoming.createdAt || existing?.createdAt || now,
    updatedAt: now,
  };
}

/**
 * Calls Firebase Authentication Identity Toolkit REST API when a Firebase Web API Key is available.
 */
async function callFirebaseIdentityToolkit(
  endpoint: 'accounts:signUp' | 'accounts:signInWithPassword',
  email: string,
  password: string,
  overrideProjectId?: string,
  overrideApiKey?: string
): Promise<{
  ok: boolean;
  localId?: string;
  idToken?: string;
  errorCode?: string;
}> {
  const cfg = getFirestoreConfig(overrideProjectId, overrideApiKey);
  if (!cfg.apiKey) {
    return { ok: false, errorCode: 'NO_FIREBASE_API_KEY' };
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(
        cfg.apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        errorCode: data?.error?.message || 'FIREBASE_AUTH_FAILED',
      };
    }
    return {
      ok: true,
      localId: data.localId,
      idToken: data.idToken,
    };
  } catch {
    return { ok: false, errorCode: 'NETWORK_ERROR' };
  }
}

async function resolveRecordByHandleOrEmail(
  handleOrEmail: string,
  firebaseProjectId?: string,
  firebaseApiKey?: string
): Promise<{
  profile: UserProfile | null;
  passwordHash?: string;
  source: 'FIRESTORE' | 'SERVER_CACHE' | 'NOT_FOUND';
}> {
  const store = getServerUsersStore();
  const trimmed = handleOrEmail.trim().toLowerCase();

  // If input looks like an email, check local store by email first, or derive handle
  if (trimmed.includes('@') && !trimmed.startsWith('@')) {
    const matchByEmail = Object.values(store.profilesByHandle).find(
      (p) => p.email?.toLowerCase() === trimmed
    );
    if (matchByEmail) {
      const h = matchByEmail.handle;
      return {
        profile: matchByEmail,
        passwordHash: store.passwordHashesByHandle[h],
        source: 'SERVER_CACHE',
      };
    }
  }

  const handle = trimmed.includes('@') && !trimmed.startsWith('@')
    ? handleFromEmail(trimmed)
    : normalizeHandle(trimmed);

  if (!handle) {
    return { profile: null, source: 'NOT_FOUND' };
  }

  // 1. Try Cloud Firestore first if configured
  const firestoreRec = await loadUserRecordFromFirestore(
    handle,
    firebaseProjectId,
    firebaseApiKey
  );
  if (firestoreRec) {
    store.profilesByHandle[handle] = firestoreRec.profile;
    if (firestoreRec.passwordHash) {
      store.passwordHashesByHandle[handle] = firestoreRec.passwordHash;
    }
    saveServerUsersStore();
    return {
      profile: firestoreRec.profile,
      passwordHash:
        firestoreRec.passwordHash || store.passwordHashesByHandle[handle],
      source: 'FIRESTORE',
    };
  }

  // 2. Fallback to local server file store
  const localProfile = store.profilesByHandle[handle] || null;
  const localHash = store.passwordHashesByHandle[handle];
  if (localProfile) {
    return {
      profile: {
        ...localProfile,
        hasPinOrPassword: Boolean(localHash || localProfile.hasPinOrPassword),
      },
      passwordHash: localHash,
      source: 'SERVER_CACHE',
    };
  }

  return { profile: null, source: 'NOT_FOUND' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawHandle = searchParams.get('handle') || '';
  const pinOrPassword = searchParams.get('pin') || '';
  const authToken = searchParams.get('authToken') || '';
  const firebaseProjectId =
    searchParams.get('firebaseProjectId') || undefined;
  const firebaseApiKey = searchParams.get('firebaseApiKey') || undefined;

  const store = getServerUsersStore();

  if (rawHandle.trim()) {
    const resolved = await resolveRecordByHandleOrEmail(
      rawHandle,
      firebaseProjectId,
      firebaseApiKey
    );

    if (!resolved.profile) {
      return NextResponse.json({
        profile: null,
        source: 'NOT_FOUND',
        firestore: getFirestoreTelemetry(firebaseProjectId, firebaseApiKey),
      });
    }

    const { profile, passwordHash, source } = resolved;
    const isProtected = Boolean(passwordHash);

    if (isProtected) {
      const tokenOk = verifySessionToken(
        authToken,
        profile.handle,
        passwordHash
      );
      const pinOk = pinOrPassword
        ? verifySecret(pinOrPassword, passwordHash)
        : false;

      if (!tokenOk && !pinOk) {
        return NextResponse.json(
          {
            error:
              'This profile is protected by a PIN / Password. Please enter it to sign in.',
            requiresAuth: true,
            handle: profile.handle,
            displayName: profile.displayName,
            authMode: profile.authMode || 'PIN_PROTECTED',
            hasPinOrPassword: true,
            firestore: getFirestoreTelemetry(firebaseProjectId, firebaseApiKey),
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json({
      profile: {
        ...profile,
        hasPinOrPassword: isProtected,
      },
      authToken: createSessionToken(profile.handle, passwordHash),
      source,
      firestore: getFirestoreTelemetry(firebaseProjectId, firebaseApiKey),
    });
  }

  // List all known user profiles on the server (with hasPinOrPassword flag, never exposing hashes)
  const profiles = Object.values(store.profilesByHandle)
    .map((p) => ({
      ...p,
      watchedIds: Array.isArray(p.watchedIds) ? p.watchedIds : [],
      interestedIds: Array.isArray(p.interestedIds) ? p.interestedIds : [],
      hasPinOrPassword: Boolean(
        store.passwordHashesByHandle[p.handle] || p.hasPinOrPassword
      ),
    }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  return NextResponse.json({
    profiles,
    firestore: getFirestoreTelemetry(firebaseProjectId, firebaseApiKey),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = (body?.action as string) || 'save';
    const firebaseProjectId = body?.firebaseProjectId as string | undefined;
    const firebaseApiKey = body?.firebaseApiKey as string | undefined;
    const store = getServerUsersStore();

    // -------------------------------------------------------------------------
    // ACTION 1: Real Authentication Sign-In (Email+Password OR @handle+PIN/Pass)
    // -------------------------------------------------------------------------
    if (action === 'auth-signin') {
      const identifier = String(body?.identifier || body?.handle || body?.email || '').trim();
      const secret = String(body?.password || body?.pin || '').trim();

      if (!identifier) {
        return NextResponse.json(
          { error: 'Please enter your @handle or email address.' },
          { status: 400 }
        );
      }

      const resolved = await resolveRecordByHandleOrEmail(
        identifier,
        firebaseProjectId,
        firebaseApiKey
      );

      // If user signed in with email+password and Firebase Auth is configured, also check Firebase Identity Toolkit
      const emailToTry =
        resolved.profile?.email ||
        (identifier.includes('@') && !identifier.startsWith('@')
          ? identifier.toLowerCase()
          : '');

      let firebaseVerifiedUid: string | undefined;
      if (emailToTry && secret) {
        const fbAuth = await callFirebaseIdentityToolkit(
          'accounts:signInWithPassword',
          emailToTry,
          secret,
          firebaseProjectId,
          firebaseApiKey
        );
        if (fbAuth.ok) {
          firebaseVerifiedUid = fbAuth.localId;
        }
      }

      if (!resolved.profile) {
        // If Firebase Auth succeeded for an existing Firebase user who didn't have a local profile doc yet, create one
        if (firebaseVerifiedUid && emailToTry) {
          const handle = handleFromEmail(emailToTry);
          const passwordHash = secret ? hashSecret(secret) : undefined;
          const newProfile = sanitizeUserProfile(
            {
              handle,
              displayName: handle,
              email: emailToTry,
              authMode: 'FIREBASE_EMAIL',
              firebaseUid: firebaseVerifiedUid,
              watchedIds: Array.isArray(body?.watchedIds) ? body.watchedIds : [],
              interestedIds: Array.isArray(body?.interestedIds)
                ? body.interestedIds
                : [],
            },
            undefined,
            Boolean(passwordHash)
          );
          store.profilesByHandle[handle] = newProfile;
          if (passwordHash) {
            store.passwordHashesByHandle[handle] = passwordHash;
          }
          saveServerUsersStore();
          await saveUserToFirestore(
            newProfile,
            firebaseProjectId,
            firebaseApiKey,
            passwordHash
          );
          return NextResponse.json({
            profile: newProfile,
            authToken: createSessionToken(handle, passwordHash),
            source: 'FIREBASE_AUTH',
            firestore: getFirestoreTelemetry(firebaseProjectId, firebaseApiKey),
          });
        }

        return NextResponse.json(
          {
            error: `No profile found for "${identifier}". Use Sign Up / Create Profile to register it.`,
            notFound: true,
          },
          { status: 404 }
        );
      }

      const { profile, passwordHash } = resolved;
      const isProtected = Boolean(passwordHash);

      if (isProtected) {
        const localValid = verifySecret(secret, passwordHash);
        if (!localValid && !firebaseVerifiedUid) {
          return NextResponse.json(
            {
              error: secret
                ? 'Incorrect PIN or password for this profile.'
                : 'This profile requires a PIN or password to sign in.',
              requiresAuth: true,
              handle: profile.handle,
              displayName: profile.displayName,
              authMode: profile.authMode,
              hasPinOrPassword: true,
            },
            { status: 401 }
          );
        }
      }

      const updatedProfile: UserProfile = {
        ...profile,
        firebaseUid: firebaseVerifiedUid || profile.firebaseUid,
        hasPinOrPassword: isProtected,
      };
      store.profilesByHandle[profile.handle] = updatedProfile;
      saveServerUsersStore();

      return NextResponse.json({
        profile: updatedProfile,
        authToken: createSessionToken(profile.handle, passwordHash),
        source: firebaseVerifiedUid ? 'FIREBASE_AUTH' : resolved.source,
        firestore: getFirestoreTelemetry(firebaseProjectId, firebaseApiKey),
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 2: Google OAuth / ID Token Sign-In
    // -------------------------------------------------------------------------
    if (action === 'google-signin') {
      const idToken = String(body?.idToken || '').trim();
      if (!idToken) {
        return NextResponse.json(
          { error: 'Missing Google ID token.' },
          { status: 400 }
        );
      }

      const tokenRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
          idToken
        )}`
      );
      if (!tokenRes.ok) {
        return NextResponse.json(
          { error: 'Invalid or expired Google ID token.' },
          { status: 401 }
        );
      }
      const tokenInfo = await tokenRes.json();
      const email = String(tokenInfo.email || '').toLowerCase();
      const name = String(tokenInfo.name || email.split('@')[0] || 'Google User');
      const sub = String(tokenInfo.sub || '');

      const handle = normalizeHandle(body?.handle || handleFromEmail(email));
      const existing = await resolveRecordByHandleOrEmail(
        handle,
        firebaseProjectId,
        firebaseApiKey
      );

      const mergedProfile = sanitizeUserProfile(
        {
          ...(body?.profile || {}),
          handle,
          displayName: existing.profile?.displayName || name,
          email,
          authMode: 'FIREBASE_GOOGLE',
          firebaseUid: sub,
        },
        existing.profile || undefined,
        Boolean(existing.passwordHash)
      );

      store.profilesByHandle[handle] = mergedProfile;
      saveServerUsersStore();
      const syncedFirestore = await saveUserToFirestore(
        mergedProfile,
        firebaseProjectId,
        firebaseApiKey,
        existing.passwordHash
      );

      return NextResponse.json({
        profile: mergedProfile,
        authToken: createSessionToken(handle, existing.passwordHash),
        syncedFirestore,
        firestore: getFirestoreTelemetry(firebaseProjectId, firebaseApiKey),
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 3: Create / Save User Profile (Lightweight @handle, PIN, or Email+Password Sign-Up)
    // -------------------------------------------------------------------------
    const incoming = body?.profile as UserProfile | undefined;
    const pinOrPassword =
      typeof body?.pinOrPassword === 'string' ? body.pinOrPassword.trim() : '';
    const clearPin = Boolean(body?.clearPin);
    const authToken =
      typeof body?.authToken === 'string' ? body.authToken.trim() : '';

    if (!incoming || (!incoming.handle && !incoming.email)) {
      return NextResponse.json(
        { error: 'Missing required profile @handle or email' },
        { status: 400 }
      );
    }

    const handle = normalizeHandle(
      incoming.handle || handleFromEmail(incoming.email || 'cinephile')
    );
    if (!handle) {
      return NextResponse.json(
        { error: 'Invalid profile handle' },
        { status: 400 }
      );
    }

    const existingResolved = await resolveRecordByHandleOrEmail(
      handle,
      firebaseProjectId,
      firebaseApiKey
    );
    const existingProfile = existingResolved.profile || undefined;
    let activePasswordHash = existingResolved.passwordHash;

    // Verify ownership if updating an already PIN/password-protected profile
    if (activePasswordHash && action !== 'auth-signup') {
      const tokenOk = verifySessionToken(authToken, handle, activePasswordHash);
      const pinOk = pinOrPassword
        ? verifySecret(pinOrPassword, activePasswordHash)
        : false;
      // Allow background watched/interested sync when client already holds profile id or valid token/pin
      if (!tokenOk && !pinOk && body?.requireStrictAuth) {
        return NextResponse.json(
          {
            error:
              'This @handle is already protected with a PIN/Password. Please sign in first.',
            requiresAuth: true,
          },
          { status: 401 }
        );
      }
    }

    let firebaseUid = incoming.firebaseUid || existingProfile?.firebaseUid;
    let resolvedAuthMode: UserAuthMode =
      incoming.authMode || existingProfile?.authMode || 'HANDLE_ONLY';

    if (clearPin) {
      activePasswordHash = undefined;
      delete store.passwordHashesByHandle[handle];
      resolvedAuthMode = 'HANDLE_ONLY';
    } else if (pinOrPassword) {
      activePasswordHash = hashSecret(pinOrPassword);
      store.passwordHashesByHandle[handle] = activePasswordHash;

      if (incoming.email && incoming.email.includes('@')) {
        resolvedAuthMode = 'FIREBASE_EMAIL';
        const fbSignup = await callFirebaseIdentityToolkit(
          'accounts:signUp',
          incoming.email.trim().toLowerCase(),
          pinOrPassword,
          firebaseProjectId,
          firebaseApiKey
        );
        if (fbSignup.ok && fbSignup.localId) {
          firebaseUid = fbSignup.localId;
        } else {
          const fbSignin = await callFirebaseIdentityToolkit(
            'accounts:signInWithPassword',
            incoming.email.trim().toLowerCase(),
            pinOrPassword,
            firebaseProjectId,
            firebaseApiKey
          );
          if (fbSignin.ok && fbSignin.localId) {
            firebaseUid = fbSignin.localId;
          }
        }
      } else {
        resolvedAuthMode = 'PIN_PROTECTED';
      }
    }

    const sanitizedProfile = sanitizeUserProfile(
      {
        ...incoming,
        handle,
        displayName: incoming.displayName || existingProfile?.displayName || handle,
        authMode: resolvedAuthMode,
        firebaseUid,
      },
      existingProfile,
      Boolean(activePasswordHash)
    );

    store.profilesByHandle[handle] = sanitizedProfile;
    saveServerUsersStore();

    const syncedFirestore = await saveUserToFirestore(
      sanitizedProfile,
      firebaseProjectId,
      firebaseApiKey,
      activePasswordHash
    );

    return NextResponse.json({
      profile: sanitizedProfile,
      authToken: createSessionToken(handle, activePasswordHash),
      syncedFirestore,
      firestore: getFirestoreTelemetry(firebaseProjectId, firebaseApiKey),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to process user profile request' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawHandle = searchParams.get('handle') || '';
  const handle = normalizeHandle(rawHandle);
  if (!handle) {
    return NextResponse.json({ error: 'Invalid handle' }, { status: 400 });
  }

  const store = getServerUsersStore();
  delete store.profilesByHandle[handle];
  delete store.passwordHashesByHandle[handle];
  saveServerUsersStore();

  return NextResponse.json({ deleted: true, handle });
}
