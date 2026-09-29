import dns from 'dns';
import { Agent, setGlobalDispatcher } from 'undici';

// Robust DNS Fallback:
// If local network DNS (university/office/corporate router) fails on Apple Music Akamai CNAMEs,
// automatically fall back to public DNS resolvers (8.8.8.8, 1.1.1.1, 77.88.8.8)
try {
  const customResolver = new dns.promises.Resolver();
  customResolver.setServers(['8.8.8.8', '1.1.1.1', '77.88.8.8']);

  const agent = new Agent({
    connect: {
      lookup: (hostname, opts, cb) => {
        dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
          if (err || !addresses || addresses.length === 0) {
            customResolver.resolve4(hostname)
              .then(addrs => {
                if (addrs && addrs.length > 0) {
                  cb(null, addrs.map(a => ({ address: a, family: 4 })));
                } else {
                  cb(err);
                }
              })
              .catch(() => cb(err));
          } else {
            cb(null, addresses);
          }
        });
      }
    }
  });

  setGlobalDispatcher(agent);
} catch (e) {
  console.warn('[Apple Music] DNS fallback agent setup warning:', e.message);
}

const DEFAULT_WEB_BEARER_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiIsImtpZCI6IldlYlBsYXlLaWQifQ.eyJpc3MiOiJBTVBXZWJQbGF5IiwiaWF0IjoxNzg2NjMyOTI0LCJleHAiOjE3OTI2ODA5MjQsInJvb3RfaHR0cHNfb3JpZ2luIjpbImFwcGxlLmNvbSJdfQ.hBgj61sZf-y7bmuvT-joXAUAcf7TVJ51732xnH5vFkLHOmsQHxVqGMYUuI4h8c0-RX3fRY3moylhLW8fewFJyw';

function getBearerToken() {
    return process.env.APPLE_MUSIC_BEARER_TOKEN || DEFAULT_WEB_BEARER_TOKEN;
}

function getMusicUserToken() {
    return process.env.APPLE_MUSIC_USER_TOKEN || '';
}

/**
 * Helper to fetch all pages from an Apple Music API endpoint.
 */
async function fetchAllPages(url) {
    const bearer = getBearerToken();
    const userToken = getMusicUserToken();

    if (!userToken) {
        // User is not signed in yet. Silently return empty data without errors.
        return [];
    }

    let allData = [];
    let currentUrl = url;
    let pagesFetched = 0;
    const visitedUrls = new Set();

    while (currentUrl && pagesFetched < 200 && !visitedUrls.has(currentUrl)) {
        visitedUrls.add(currentUrl);
        pagesFetched++;

        try {
            const response = await fetch(currentUrl, {
                headers: {
                    'Authorization': `Bearer ${bearer}`,
                    'Music-User-Token': userToken,
                    'Origin': 'https://music.apple.com',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                cache: 'no-store'
            });

            if (response.status === 401) {
                console.warn('[Apple Music] 401 Unauthorized: Developer or User token has expired. Please refresh tokens in Settings.');
                return allData;
            }

            if (!response.ok) {
                console.warn(`[Apple Music] API response ${response.status}: ${response.statusText}`);
                return allData;
            }

            const data = await response.json();
            const items = data.data || [];
            allData = allData.concat(items);
            
            if (data.next) {
                const nextUrlObj = new URL(`https://api.music.apple.com${data.next}`);
                if (!nextUrlObj.searchParams.has('limit')) {
                    nextUrlObj.searchParams.set('limit', '100');
                }
                if (!nextUrlObj.searchParams.has('include')) {
                    nextUrlObj.searchParams.set('include', 'catalog');
                }
                currentUrl = nextUrlObj.toString();
            } else {
                currentUrl = null;
            }
        } catch (fetchErr) {
            console.warn('[Apple Music] Network request failed:', fetchErr.message);
            break;
        }
    }

    return allData;
}

/**
 * Helper to get exact total track count for a playlist with minimal overhead.
 */
async function getPlaylistTotalTrackCount(playlistId) {
    const bearer = getBearerToken();
    const userToken = getMusicUserToken();
    if (!userToken) return 0;

    try {
        const res = await fetch(`https://api.music.apple.com/v1/me/library/playlists/${playlistId}/tracks?limit=1`, {
            headers: {
                'Authorization': `Bearer ${bearer}`,
                'Music-User-Token': userToken,
                'Origin': 'https://music.apple.com'
            }
        });
        if (res.ok) {
            const data = await res.json();
            return data.meta?.total || data.data?.length || 0;
        }
    } catch (_) {}
    return 0;
}

/**
 * Fetches the user's personal library playlists from Apple Music.
 */
export async function fetchUserPlaylists() {
  try {
    console.log('[Apple Music] Fetching personal library playlists...');
    const baseUrl = 'https://api.music.apple.com/v1/me/library/playlists?limit=100';
    const playlists = await fetchAllPages(baseUrl);

    // Transform library playlists into our UI structure and resolve exact track counts
    const transformedPlaylists = await Promise.all(playlists.map(async (pl) => {
      const relTracks = pl.relationships?.tracks?.data || [];
      let trackCount = pl.relationships?.tracks?.meta?.total || relTracks.length || pl.attributes?.trackCount || 0;
      
      // If count is still 0, query metadata endpoint
      if (trackCount === 0) {
        trackCount = await getPlaylistTotalTrackCount(pl.id);
      }

      // Check max track date added inside playlist
      let maxTrackDate = 0;
      for (const t of relTracks) {
        if (t.attributes?.dateAdded) {
          const td = new Date(t.attributes.dateAdded).getTime();
          if (td > maxTrackDate) maxTrackDate = td;
        }
      }

      const parsedTracks = relTracks.map(track => ({
        id: track.id,
        apple_id: track.attributes?.playParams?.id || track.id,
        title: track.attributes?.name || 'Untitled',
        artist: track.attributes?.artistName || 'Unknown Artist',
        album: track.attributes?.albumName || pl.attributes?.name || 'Unknown Album',
        duration: Math.floor((track.attributes?.durationInMillis || 0) / 1000),
        cover_url: track.attributes?.artwork?.url 
          ? track.attributes.artwork.url.replace('{w}', '600').replace('{h}', '600')
          : (pl.attributes?.artwork?.url ? pl.attributes.artwork.url.replace('{w}', '600').replace('{h}', '600') : 'https://images.unsplash.com/photo-1514525253361-b83f859b73c0'),
        preview_url: track.attributes?.previews?.[0]?.url || track.relationships?.catalog?.data?.[0]?.attributes?.previews?.[0]?.url || ''
      }));

      const plModifiedTime = pl.attributes?.lastModifiedDate ? new Date(pl.attributes.lastModifiedDate).getTime() : 0;
      const plAddedTime = pl.attributes?.dateAdded ? new Date(pl.attributes.dateAdded).getTime() : 0;
      const effectiveModifiedTime = Math.max(plModifiedTime, plAddedTime, maxTrackDate);
      const lastModifiedIso = effectiveModifiedTime > 0 ? new Date(effectiveModifiedTime).toISOString() : '';

      return {
        id: pl.id,
        title: pl.attributes?.name || 'Untitled Playlist',
        description: pl.attributes?.description?.standard || '',
        cover: pl.attributes?.artwork?.url 
                ? pl.attributes.artwork.url.replace('{w}', '600').replace('{h}', '600') 
                : (parsedTracks[0]?.cover_url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745'),
        trackCount: trackCount || parsedTracks.length,
        lastModifiedDate: lastModifiedIso,
        lastModifiedTimestamp: effectiveModifiedTime,
        dateAdded: pl.attributes?.dateAdded || '',
        tracks: parsedTracks
      };
    }));

    // Sort: Favorites ALWAYS first (#1), rest sorted strictly by recently modified date descending!
    const isFavorites = (p) => {
      const name = (p.title || '').toLowerCase();
      return name.includes('favour') || name.includes('favor') || name.includes('избран') || name.includes('любив') || name.includes('starred');
    };

    transformedPlaylists.sort((a, b) => {
      const favA = isFavorites(a);
      const favB = isFavorites(b);
      if (favA && !favB) return -1;
      if (!favA && favB) return 1;

      const timeA = a.lastModifiedTimestamp || (a.lastModifiedDate ? new Date(a.lastModifiedDate).getTime() : (a.dateAdded ? new Date(a.dateAdded).getTime() : 0));
      const timeB = b.lastModifiedTimestamp || (b.lastModifiedDate ? new Date(b.lastModifiedDate).getTime() : (b.dateAdded ? new Date(b.dateAdded).getTime() : 0));
      if (timeA !== timeB) return timeB - timeA;

      return (a.title || '').localeCompare(b.title || '');
    });

    return transformedPlaylists;
  } catch (error) {
    console.error('[Apple Music] Fetch Playlists Error:', error);
    return [];
  }
}

/**
 * Fetches tracks for a specific library playlist.
 */
export async function fetchPlaylistTracks(playlistId) {
    try {
        console.log(`[Apple Music] Fetching tracks for library playlist: ${playlistId}`);
        const baseUrl = `https://api.music.apple.com/v1/me/library/playlists/${playlistId}/tracks?include=catalog&limit=100`;
        const tracks = await fetchAllPages(baseUrl);
    
        return tracks.map(track => ({
          id: track.id,
          apple_id: track.attributes?.playParams?.id || track.id,
          title: track.attributes?.name || 'Untitled',
          artist: track.attributes?.artistName || 'Unknown Artist',
          album: track.attributes?.albumName || 'Unknown Album',
          genre: (track.attributes?.genreNames && track.attributes.genreNames.length > 0) ? track.attributes.genreNames[0] : 'Unknown',
          duration: Math.floor((track.attributes?.durationInMillis || 0) / 1000),
          cover_url: track.attributes?.artwork?.url 
                        ? track.attributes.artwork.url.replace('{w}', '600').replace('{h}', '600')
                        : 'https://images.unsplash.com/photo-1514525253361-b83f859b73c0',
          preview_url: track.attributes?.previews?.[0]?.url || track.relationships?.catalog?.data?.[0]?.attributes?.previews?.[0]?.url || '',
          track_number: track.attributes?.trackNumber || track.relationships?.catalog?.data?.[0]?.attributes?.trackNumber || 0,
          disc_number: track.attributes?.discNumber || track.relationships?.catalog?.data?.[0]?.attributes?.discNumber || 1
        }));
    } catch (error) {
        console.error('[Apple Music] Fetch Tracks Error:', error);
        return [];
    }
}

/**
 * Fetches all songs from the user's personal library.
 */
export async function fetchUserLibrarySongs() {
    try {
        console.log('[Apple Music] Fetching all library songs...');
        const baseUrl = 'https://api.music.apple.com/v1/me/library/songs?include=catalog&limit=100';
        const tracks = await fetchAllPages(baseUrl);
    
        return tracks.map(track => ({
          id: track.id,
          apple_id: track.attributes?.playParams?.id || track.id,
          title: track.attributes?.name || 'Untitled',
          artist: track.attributes?.artistName || 'Unknown Artist',
          album: track.attributes?.albumName || 'Unknown Album',
          genre: (track.attributes?.genreNames && track.attributes.genreNames.length > 0) ? track.attributes.genreNames[0] : 'Unknown',
          duration: Math.floor((track.attributes?.durationInMillis || 0) / 1000),
          cover_url: track.attributes?.artwork?.url 
                        ? track.attributes.artwork.url.replace('{w}', '600').replace('{h}', '600')
                        : 'https://images.unsplash.com/photo-1514525253361-b83f859b73c0',
          preview_url: track.attributes?.previews?.[0]?.url || track.relationships?.catalog?.data?.[0]?.attributes?.previews?.[0]?.url || '',
          date_added: track.attributes?.dateAdded || '',
          release_date: track.attributes?.releaseDate || '',
          track_number: track.attributes?.trackNumber || track.relationships?.catalog?.data?.[0]?.attributes?.trackNumber || 0,
          disc_number: track.attributes?.discNumber || track.relationships?.catalog?.data?.[0]?.attributes?.discNumber || 1
        }));
    } catch (error) {
        console.error('[Apple Music] Fetch Library Songs Error:', error);
        return [];
    }
}

/**
 * Obtains an instant 30-second audio preview stream URL for any track.
 */
export async function getTrackPreviewUrl(track) {
    if (!track) return null;
    if (track.preview_url) return track.preview_url;

    // 1. Try public iTunes Search API (fast, instant 30s audio stream)
    try {
        const query = encodeURIComponent(`${track.title || ''} ${track.artist || ''}`.trim());
        const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`);
        if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0 && data.results[0].previewUrl) {
                return data.results[0].previewUrl;
            }
        }
    } catch (e) {
        console.warn('[Apple Music] iTunes Search preview error:', e.message);
    }

    // 2. Try catalog lookup if apple_id is available
    if (track.apple_id) {
        try {
            const bearer = getBearerToken();
            const res = await fetch(`https://api.music.apple.com/v1/catalog/us/songs/${track.apple_id}`, {
                headers: { 'Authorization': `Bearer ${bearer}`, 'Origin': 'https://music.apple.com' }
            });
            if (res.ok) {
                const data = await res.json();
                const previewUrl = data.data?.[0]?.attributes?.previews?.[0]?.url;
                if (previewUrl) return previewUrl;
            }
        } catch (_) {}
    }

    return null;
}

export default {
    fetchUserPlaylists,
    fetchPlaylistTracks,
    fetchUserLibrarySongs,
    getTrackPreviewUrl
};
