import { getTrackById, upsertTrack } from '../db.js';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { normalizeKazakh } from './matching-engine.js';

let app = null;
try {
  const electron = await import('electron');
  app = electron.app || electron.default?.app;
} catch (_) {}

/**
 * Formats raw lyrics to strictly preserve stanza breaks, verse/chorus structure,
 * clean timecodes, and normalize Kazakh/Cyrillic letters for iPod & iTunes compatibility.
 */
export function formatLyrics(rawLyrics) {
  if (!rawLyrics || typeof rawLyrics !== 'string') return '';

  // 1. Remove timecode brackets if present: e.g. [00:12.34], [01:23], [00:12.345]
  let text = rawLyrics.replace(/^\s*\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*/gm, '');

  // 2. Remove stray colons at start of lines (e.g. ": text")
  text = text.replace(/^[ \t]*:[ \t]*/gm, '');

  // 3. Normalize Kazakh specific characters into standard Windows-1251 basic Cyrillic for iPod font compatibility
  text = normalizeKazakh(text);

  // 4. Normalize newlines to standard \n first
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Trim individual lines
  const lines = text.split('\n').map(l => l.trim());

  // 4. Collapse 3+ consecutive empty lines into a single blank line between stanzas
  const cleanedLines = [];
  let prevEmpty = false;
  for (const line of lines) {
    if (line === '') {
      if (!prevEmpty && cleanedLines.length > 0) {
        cleanedLines.push('');
        prevEmpty = true;
      }
    } else {
      cleanedLines.push(line);
      prevEmpty = false;
    }
  }

  // 5. Trim leading and trailing empty lines
  while (cleanedLines.length > 0 && cleanedLines[0] === '') cleanedLines.shift();
  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === '') cleanedLines.pop();

  // 6. Join with standard CRLF (\r\n) for native Windows, iTunes COM & iPod OS rendering
  return cleanedLines.join('\r\n');
}

/**
 * Normalizes text for strict metadata matching (removes feats, remasters, punctuation, etc.)
 */
export function normalizeStr(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s*\((feat\.|ft\.|with|при\s+уч\.|prod\.\s+by|produced\s+by)[^)]*\)/gi, '')
    .replace(/\s*\[(feat\.|ft\.|with|при\s+уч\.|prod\.\s+by|produced\s+by)[^\]]*\]/gi, '')
    .replace(/\s*(feat\.|ft\.|при\s+уч\.).*$/gi, '')
    .replace(/\s*\((remastered|remaster|deluxe|bonus\s+track|explicit|single\s+version|album\s+version|live|acoustic|radio\s+edit|disco\s+version|disco\s+ver\.|official\s+audio|official\s+video|visualizer)[^)]*\)/gi, '')
    .replace(/\s*\[(remastered|remaster|deluxe|bonus\s+track|explicit|single\s+version|album\s+version|live|acoustic|radio\s+edit|disco\s+version|disco\s+ver\.|official\s+audio|official\s+video|visualizer)[^\]]*\]/gi, '')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035'`´ʼ«»"“”]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strict check if candidate artist matches target artist
 */
export function isArtistMatch(itemArtist, targetArtist) {
  if (!itemArtist || !targetArtist) return false;
  const n1 = normalizeStr(itemArtist);
  const n2 = normalizeStr(targetArtist);
  if (n1 === n2) return true;
  
  // Direct primary artist check (before comma, &, feat, with, x, +)
  const p1 = n1.split(/[,&/+]|\band\b|\bwith\b|\bx\b/)[0].trim();
  const p2 = n2.split(/[,&/+]|\band\b|\bwith\b|\bx\b/)[0].trim();
  if (p1 === p2) return true;
  if (p1.length > 2 && p2.length > 2 && (p1.includes(p2) || p2.includes(p1))) return true;
  
  // Word token overlap check
  const tokens1 = n1.split(' ').filter(w => w.length > 1);
  const tokens2 = n2.split(' ').filter(w => w.length > 1);
  const common = tokens1.filter(t => tokens2.includes(t));
  return common.length > 0;
}

/**
 * Strict check if candidate title matches target title
 */
export function isTitleMatch(itemTitle, targetTitle) {
  if (!itemTitle || !targetTitle) return false;
  const n1 = normalizeStr(itemTitle);
  const n2 = normalizeStr(targetTitle);
  if (n1 === n2) return true;
  if (n1.replace(/\s/g, '') === n2.replace(/\s/g, '')) return true;
  
  if (n1.length > 3 && n2.length > 3) {
    if (n1.startsWith(n2) || n2.startsWith(n1)) return true;
  }
  
  return false;
}

/**
 * Fetches lyrics from LRCLIB using resilient queries with STRICT artist/title validation.
 */
async function fetchFromLrclib(artist, title, album, duration) {
  const cleanTitle = normalizeStr(title);
  const cleanArtist = normalizeStr(artist);
  const primaryArtist = cleanArtist.split(/[,&/+]|\band\b|\bwith\b|\bx\b/)[0].trim() || cleanArtist;

  let fallbackLyrics = null;

  // 1. Direct GET endpoints with exact query parameters
  const getEndpoints = [
    `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
    `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`,
    `https://lrclib.net/api/get?artist_name=${encodeURIComponent(primaryArtist)}&track_name=${encodeURIComponent(cleanTitle)}`
  ];

  if (album) {
    getEndpoints.push(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}&album_name=${encodeURIComponent(normalizeStr(album))}`);
  }

  for (const url of getEndpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PodSync/1.0 (https://github.com/Baknur1/PodSync)' },
        signal: AbortSignal.timeout(3500)
      });

      if (res.ok) {
        const data = await res.json();
        // STRICT VALIDATION: reject if artist or title do not match
        if (isArtistMatch(data.artistName, artist) && isTitleMatch(data.trackName, title)) {
          const plain = data.plainLyrics || '';
          const raw = plain || data.syncedLyrics || '';
          if (raw && raw.trim().length > 20) {
            if (plain && (plain.includes('\n\n') || plain.includes('\r\n\r\n'))) {
              return formatLyrics(plain);
            }
            if (!fallbackLyrics) {
              fallbackLyrics = formatLyrics(raw);
            }
          }
        }
      }
    } catch (_) {}
  }

  // 2. Search catalog fallback with STRICT artist & title verification
  const searchQueries = [
    `${artist} ${cleanTitle}`,
    `${primaryArtist} ${cleanTitle}`,
    `${cleanArtist} ${cleanTitle}`
  ];

  for (const q of searchQueries) {
    if (!q || q.length < 2) continue;
    try {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'PodSync/1.0 (https://github.com/Baknur1/PodSync)' },
        signal: AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          // 1st pass: Look for matching artist + title that HAS stanzas
          for (const item of list) {
            if (isArtistMatch(item.artistName, artist) && isTitleMatch(item.trackName, title)) {
              const plain = item.plainLyrics || '';
              if (plain && (plain.includes('\n\n') || plain.includes('\r\n\r\n')) && plain.trim().length > 20) {
                return formatLyrics(plain);
              }
            }
          }
          // 2nd pass: Look for matching artist + title without stanzas
          if (!fallbackLyrics) {
            for (const item of list) {
              if (isArtistMatch(item.artistName, artist) && isTitleMatch(item.trackName, title)) {
                const raw = item.plainLyrics || item.syncedLyrics;
                if (raw && raw.trim().length > 20) {
                  fallbackLyrics = formatLyrics(raw);
                  break;
                }
              }
            }
          }
        }
      }
    } catch (_) {}
  }

  return fallbackLyrics || null;
}

/**
 * Main function to fetch lyrics for a track with strict validation and SQLite caching.
 */
export async function getTrackLyrics(trackInfo) {
  if (!trackInfo) return '';
  const title = trackInfo.title || trackInfo.name || '';
  const artist = trackInfo.artist || trackInfo.artistName || '';
  const album = trackInfo.album || trackInfo.albumName || '';
  const duration = Number(trackInfo.duration || 0);

  if (!title) return '';

  // 1. Check if lyrics already in trackInfo object
  if (trackInfo.lyrics && typeof trackInfo.lyrics === 'string' && trackInfo.lyrics.trim().length > 10) {
    return formatLyrics(trackInfo.lyrics);
  }

  // 2. Check local database cache
  if (trackInfo.id) {
    try {
      const cached = await getTrackById(trackInfo.id);
      if (cached && cached.lyrics && cached.lyrics.trim().length > 10) {
        return formatLyrics(cached.lyrics);
      }
    } catch (_) {}
  }

  // 3. Fetch from LRCLIB with strict verification
  try {
    const lyrics = await fetchFromLrclib(artist, title, album, duration);
    if (lyrics && lyrics.length > 10) {
      console.log(`[lyrics-service] Successfully resolved verified lyrics for: "${artist} - ${title}" (${lyrics.split('\r\n').length} lines)`);
      if (trackInfo.id) {
        try {
          upsertTrack({ ...trackInfo, lyrics });
        } catch (_) {}
      }
      return lyrics;
    }
  } catch (err) {
    console.warn(`[lyrics-service] Lyrics fetch error for "${artist} - ${title}":`, err.message);
  }

  return '';
}

/**
 * Embeds lyrics directly into an existing AAC M4A audio file on disk via FFmpeg copy stream.
 */
export async function embedLyricsIntoFile(filePath, lyrics) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  return new Promise((resolve) => {
    const tempDir = (app && typeof app.getPath === 'function') ? app.getPath('temp') : (process.env.TEMP || 'C:\\Windows\\Temp');
    const tempOut = path.join(tempDir, `podsync-tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.m4a`);
    const proc = spawn(ffmpegPath, [
      '-y',
      '-i', filePath,
      '-c', 'copy',
      '-metadata', `lyrics=${lyrics || ''}`,
      tempOut
    ], { windowsHide: true });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(tempOut) && fs.statSync(tempOut).size > 5000) {
        try {
          fs.copyFileSync(tempOut, filePath);
          fs.unlinkSync(tempOut);
          resolve(true);
        } catch (_) {
          resolve(false);
        }
      } else {
        try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch (_) {}
        resolve(false);
      }
    });
    proc.on('error', () => resolve(false));
  });
}

export default { formatLyrics, normalizeStr, isArtistMatch, isTitleMatch, getTrackLyrics, embedLyricsIntoFile };
