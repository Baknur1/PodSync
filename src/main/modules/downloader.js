import YTDlpWrapModule from 'yt-dlp-wrap';
const YTDlpWrap = YTDlpWrapModule.default || YTDlpWrapModule;
import path from 'path';
import fs from 'fs';
import https from 'https';
import ffmpegPath from 'ffmpeg-static';

let app = null;
try {
  const electron = await import('electron');
  app = electron.app || electron.default?.app;
} catch (_) {}

const userDataDir = (app && typeof app.getPath === 'function')
  ? app.getPath('userData')
  : path.join(process.env.APPDATA || '.', 'podsync');

const ytDlpBinaryPath = path.join(
  userDataDir,
  process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
);

const downloadsDir = path.join(userDataDir, 'downloads');

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

let ytDlpInstance = null;

async function getYtDlp() {
  if (ytDlpInstance) return ytDlpInstance;

  if (!fs.existsSync(ytDlpBinaryPath)) {
    console.log('[downloader] yt-dlp binary not found, downloading latest from GitHub...');
    await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath);
    console.log('[downloader] yt-dlp downloaded to:', ytDlpBinaryPath);
  } else {
    // Check for updates on startup
    try {
      console.log('[downloader] Checking yt-dlp update status (-U)...');
      const tempWrap = new YTDlpWrap(ytDlpBinaryPath);
      await tempWrap.execPromise(['-U']);
    } catch (e) {
      console.warn('[downloader] yt-dlp update check failed (proceeding with existing binary):', e.message);
    }
  }

  ytDlpInstance = new YTDlpWrap(ytDlpBinaryPath);
  return ytDlpInstance;
}

export function checkYtDlpStatus() {
  return fs.existsSync(ytDlpBinaryPath) ? 'ready' : 'not-installed';
}

export async function downloadYtDlp(onProgress) {
  if (fs.existsSync(ytDlpBinaryPath)) {
    console.log('[downloader] yt-dlp already exists at:', ytDlpBinaryPath);
    return true;
  }
  console.log('[downloader] Downloading yt-dlp from GitHub...');
  try {
    await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath, undefined, undefined, (progress) => {
      if (onProgress) onProgress(progress);
    });
    console.log('[downloader] yt-dlp download complete!');
    ytDlpInstance = null;
    return true;
  } catch (error) {
    console.error('[downloader] Failed to download yt-dlp:', error);
    throw error;
  }
}

/**
 * Direct YouTube Web Search Parser with anti-consent-wall cookies.
 */
async function searchYoutubeWeb(query) {
  try {
    const cleanQuery = encodeURIComponent(query.trim());
    const url = `https://www.youtube.com/results?search_query=${cleanQuery}`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        // SOCS and PREF cookies bypass Google/YouTube consent redirects
        'Cookie': 'SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AwGgJlbiACGgYIgLCvpwY; PREF=tz=UTC&hl=en;'
      }
    });

    const html = await res.text();
    
    // Extract ytInitialData
    let data = null;
    const match = html.match(/(?:var\s+ytInitialData|window\["ytInitialData"\]|ytInitialData)\s*=\s*({.+?});/);
    if (match) {
      try {
        data = JSON.parse(match[1]);
      } catch (_) {}
    }

    if (!data) return [];

    const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const results = [];

    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const vr = item.videoRenderer;
        if (vr && vr.videoId) {
          const id = vr.videoId;
          const title = vr.title?.runs?.map(r => r.text).join('') || vr.title?.simpleText || 'Unknown Title';
          const channel = vr.ownerText?.runs?.map(r => r.text).join('') || vr.shortBylineText?.runs?.map(r => r.text).join('') || 'YouTube';
          const durationFormatted = vr.lengthText?.simpleText || '3:30';
          const thumbnail = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
          
          const parts = durationFormatted.split(':').map(Number);
          let durationSec = 180;
          if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
          else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];

          results.push({
            id,
            title,
            channel,
            uploader: channel,
            durationFormatted,
            duration: durationSec,
            thumbnail,
            cover_url: thumbnail,
            url: `https://www.youtube.com/watch?v=${id}`
          });
        }
      }
    }
    return results.slice(0, 20);
  } catch (err) {
    console.warn('[downloader] YouTube Web search error:', err.message);
    return [];
  }
}

/**
 * Public Piped / Invidious API fallback (100% reliable backup).
 */
async function searchYoutubeApiFallback(query) {
  try {
    const cleanQuery = encodeURIComponent(query.trim());
    const instances = [
      `https://api.invidious.io/api/v1/search?q=${cleanQuery}&type=video`,
      `https://inv.nadeko.net/api/v1/search?q=${cleanQuery}&type=video`
    ];

    for (const inst of instances) {
      try {
        const res = await fetch(inst, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(3500) 
        });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          if (items.length > 0) {
            return items.slice(0, 15).map(item => {
              const id = item.url ? item.url.replace('/watch?v=', '') : item.videoId;
              const duration = item.duration || 180;
              const mins = Math.floor(duration / 60);
              const secs = Math.floor(duration % 60);
              return {
                id,
                title: item.title,
                channel: item.uploaderName || item.author || 'YouTube',
                uploader: item.uploaderName || item.author || 'YouTube',
                durationFormatted: `${mins}:${secs < 10 ? '0' : ''}${secs}`,
                duration,
                thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                cover_url: item.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${id}`
              };
            });
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
  return [];
}

/**
 * Main YouTube Search Function (Fast Web -> API Fallback -> yt-dlp).
 */
export async function searchTrack(query) {
  if (!query || !query.trim()) return [];
  console.log(`[downloader] Searching YouTube for: "${query}"`);
  
  // 1. Direct YouTube Web search (fastest, with anti-consent cookies)
  try {
    const webResults = await searchYoutubeWeb(query);
    if (Array.isArray(webResults) && webResults.length > 0) {
      console.log(`[downloader] Web search found ${webResults.length} tracks.`);
      return webResults;
    }
  } catch (e) {
    console.warn('[downloader] Web search failed, trying API fallback:', e.message);
  }

  // 2. Public API Fallback
  try {
    const apiResults = await searchYoutubeApiFallback(query);
    if (Array.isArray(apiResults) && apiResults.length > 0) {
      console.log(`[downloader] API fallback found ${apiResults.length} tracks.`);
      return apiResults;
    }
  } catch (e) {
    console.warn('[downloader] API fallback failed:', e.message);
  }

  // 3. Fallback to yt-dlp
  try {
    const ytDlp = await getYtDlp();
    const stdout = await ytDlp.execPromise([
      `ytsearch10:${query}`,
      '--dump-json',
      '--flat-playlist',
      '--no-warnings',
      '--no-cookies',
      '--no-cookies-from-browser',
      '--no-config',
      '--no-cache-dir',
      '--ffmpeg-location', ffmpegPath,
      '--extractor-args', 'youtube:player_client=ios,android,web'
    ]);

    const lines = stdout.trim().split('\n');
    const items = [];
    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          const id = parsed.id;
          const title = parsed.title;
          const channel = parsed.uploader || parsed.channel || 'YouTube';
          const duration = parsed.duration || 180;
          const mins = Math.floor(duration / 60);
          const secs = Math.floor(duration % 60);
          const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
          const thumbnail = parsed.thumbnails?.[0]?.url || parsed.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

          items.push({
            id,
            title,
            channel,
            uploader: channel,
            durationFormatted,
            duration,
            thumbnail,
            cover_url: thumbnail,
            url: `https://www.youtube.com/watch?v=${id}`
          });
        } catch (_) {}
      }
    }
    console.log(`[downloader] yt-dlp found ${items.length} candidates.`);
    return items;
  } catch (error) {
    console.error('[downloader] yt-dlp search failed:', error.message);
    return [];
  }
}

/**
 * Downloads audio for a matched YouTube video using yt-dlp.
 */
export async function downloadTrack(youtubeId, trackId, onProgress) {
  const cleanId = String(trackId || youtubeId).replace(/[\\/:*?"<>|]/g, '_');
  
  // Check if file is already in downloads directory
  if (fs.existsSync(downloadsDir)) {
    const existing = fs.readdirSync(downloadsDir).find(f => f.startsWith(`${cleanId}.`));
    if (existing) {
      const existingPath = path.join(downloadsDir, existing);
      if (fs.existsSync(existingPath) && fs.statSync(existingPath).size > 10000) {
        console.log(`[downloader] File already in download cache: ${existingPath}`);
        if (onProgress) onProgress(100);
        return existingPath;
      }
    }
  }

  const ytDlp = await getYtDlp();
  const outputPath = path.join(downloadsDir, `${cleanId}.%(ext)s`);

  return new Promise((resolve, reject) => {
    let finalPath = '';
    const args = [
      `https://www.youtube.com/watch?v=${youtubeId}`,
      '-f', 'ba[ext=m4a]/ba/b',
      '-o', outputPath,
      '--ffmpeg-location', ffmpegPath,
      '--no-playlist',
      '--no-warnings',
      '--no-cookies',
      '--no-cookies-from-browser',
      '--no-config',
      '--no-cache-dir',
      '--retries', '5',
      '--fragment-retries', '5',
      '--extractor-args', 'youtube:player_client=ios,android,web'
    ];

    ytDlp
      .exec(args)
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      })
      .on('ytDlpEvent', (eventType, eventData) => {
        if (eventType === 'download' && eventData.includes('Destination:')) {
          const match = eventData.match(/Destination:\s*(.+)/);
          if (match) finalPath = match[1].trim();
        }
        if (eventData.includes('has already been downloaded')) {
          const match = eventData.match(/\[download\]\s*(.+?)\s*has already been downloaded/);
          if (match) finalPath = match[1].trim();
        }
      })
      .on('error', (error) => {
        console.error('[downloader] Download error:', error.message || error);
        reject(error);
      })
      .on('close', () => {
        if (!finalPath || !fs.existsSync(finalPath)) {
          const files = fs.readdirSync(downloadsDir);
          const matched = files.find(f => f.startsWith(`${cleanId}.`));
          if (matched) {
            finalPath = path.join(downloadsDir, matched);
          }
        }
        if (finalPath && fs.existsSync(finalPath)) {
          resolve(finalPath);
        } else {
          reject(new Error(`Downloaded file not found for track: ${trackId}`));
        }
      });
  });
}

/**
 * Obtains a direct high-quality full-length audio stream URL for any track.
 */
export async function getFullAudioStream(track) {
  if (!track) return null;

  // 1. If we have a direct local file path (or local_path)
  const directPath = track.path || track.local_path;
  if (directPath && fs.existsSync(directPath)) {
    return `media://local?path=${encodeURIComponent(directPath)}`;
  }

  // 2. Check local processedDir for existing converted track by ID or exact artist + title
  try {
    const processedDir = path.join(app.getPath('userData'), 'processed');
    if (fs.existsSync(processedDir)) {
      const files = fs.readdirSync(processedDir);
      const cleanId = String(track.id || '').replace(/[\\/:*?"<>|]/g, '_').toLowerCase();
      const safeArtist = (track.artist || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();
      const safeTitle = (track.title || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();

      const matchedFile = files.find(f => {
        const lower = f.toLowerCase();
        if (cleanId && cleanId.length > 3 && lower.includes(`_${cleanId}.m4a`)) return true;
        if (safeArtist && safeTitle && (lower.startsWith(`${safeArtist} - ${safeTitle}_`) || (lower.includes(safeArtist) && lower.includes(` - ${safeTitle}_`)))) return true;
        return false;
      });

      if (matchedFile) {
        const fullMatchedPath = path.join(processedDir, matchedFile);
        console.log(`[downloader] Found local converted file for "${track.title}": ${fullMatchedPath}`);
        return `media://local?path=${encodeURIComponent(fullMatchedPath)}`;
      }
    }
  } catch (_) {}

  // 3. Check SQLite database by ID or by title & artist
  try {
    const { getTrackById, getAllTracks } = await import('./db.js');
    if (track.id) {
      const cached = await getTrackById(track.id);
      if (cached?.local_path && fs.existsSync(cached.local_path)) {
        console.log(`[downloader] Using local cached full audio for "${track.title}"`);
        return `media://local?path=${encodeURIComponent(cached.local_path)}`;
      }
    }
    const allTracks = await getAllTracks();
    const tTitle = (track.title || '').toLowerCase().trim();
    const tArtist = (track.artist || '').toLowerCase().trim();
    const dbMatch = allTracks.find(t => 
      t.local_path && fs.existsSync(t.local_path) &&
      t.title?.toLowerCase().trim() === tTitle &&
      tArtist && (t.artist?.toLowerCase().trim() === tArtist || t.artist?.toLowerCase().includes(tArtist) || tArtist.includes(t.artist?.toLowerCase().trim()))
    );
    if (dbMatch?.local_path) {
      console.log(`[downloader] Found DB matched local file for "${track.title}": ${dbMatch.local_path}`);
      return `media://local?path=${encodeURIComponent(dbMatch.local_path)}`;
    }
  } catch (_) {}

  // 4. Resolve YouTube ID
  let ytId = track.custom_youtube_id || track.youtube_id;
  if (!ytId && (track.title || track.artist)) {
    try {
      const { findBestMatch } = await import('./matching-engine.js');
      const match = await findBestMatch(track);
      if (match?.id) {
        ytId = match.id;
        track.youtube_id = ytId;
      }
    } catch (_) {}
  }

  // 5. Try yt-dlp direct stream URL extraction (with ios,android,web multi-client)
  try {
    const ytDlp = await getYtDlp();
    const target = ytId 
      ? `https://www.youtube.com/watch?v=${ytId}` 
      : `ytsearch1:${track.title || ''} ${track.artist || ''} audio`.trim();

    const stdout = await ytDlp.execPromise([
      target,
      '-g',
      '-f', 'ba[ext=m4a]/ba/b',
      '--no-warnings',
      '--no-cookies',
      '--no-cookies-from-browser',
      '--no-config',
      '--no-cache-dir',
      '--retries', '3',
      '--ffmpeg-location', ffmpegPath,
      '--extractor-args', 'youtube:player_client=ios,android,web'
    ]);

    const url = stdout.trim().split('\n')[0];
    if (url && url.startsWith('http')) {
      console.log(`[downloader] Resolved full audio stream for "${track.title}" via yt-dlp`);
      return url;
    }
  } catch (err) {
    console.warn('[downloader] getFullAudioStream yt-dlp failed:', err.message);
  }

  return null;
}

export default { searchTrack, downloadTrack, checkYtDlpStatus, downloadYtDlp, getFullAudioStream };
