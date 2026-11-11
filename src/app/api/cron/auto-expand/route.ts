import { NextRequest, NextResponse } from 'next/server';
import { GET as liveMediaGet } from '@/app/api/live-media/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled Cron Endpoint (`/api/cron/auto-expand`)
 * Automatically crawls uncrawled collaborators from the SixDegrees graph using
 * TMDB + OMDb (strictly within the 750/day free-tier safety ceiling) and persists
 * all newly discovered Movies & TV Shows to Cloud Firestore (`sixdegrees_catalog`).
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const rounds = Math.min(
    5,
    Math.max(1, parseInt(searchParams.get('rounds') || '3', 10))
  );
  const batchSize = Math.min(
    8,
    Math.max(1, parseInt(searchParams.get('batchSize') || '5', 10))
  );

  const crawledCollaborators: string[] = [];
  const addedTitles: Array<{
    id: string;
    title: string;
    year: number;
    mediaType: string;
    imdbRating: number;
  }> = [];
  let latestQuota = null;
  let latestFirestore = null;

  for (let i = 0; i < rounds; i++) {
    const expandUrl = new URL('/api/live-media', origin);
    expandUrl.searchParams.set('action', 'auto-expand');
    expandUrl.searchParams.set('collaborator', '__AUTO__');
    expandUrl.searchParams.set('batchSize', String(batchSize));

    const subReq = new NextRequest(expandUrl.toString(), {
      headers: req.headers,
    });
    const res = await liveMediaGet(subReq);
    if (!res.ok) break;

    const data = await res.json();
    if (data.collaborator) {
      crawledCollaborators.push(data.collaborator);
    }
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        addedTitles.push({
          id: item.id,
          title: item.title,
          year: item.year,
          mediaType: item.mediaType,
          imdbRating: item.imdbRating,
        });
      }
    }
    if (data.quota) latestQuota = data.quota;
    if (data.firestore) latestFirestore = data.firestore;
  }

  return NextResponse.json({
    ok: true,
    scheduledAt: new Date().toISOString(),
    roundsExecuted: rounds,
    crawledCollaborators,
    addedCount: addedTitles.length,
    addedTitles,
    quota: latestQuota,
    firestore: latestFirestore,
  });
}

