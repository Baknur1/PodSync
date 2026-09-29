import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

let app = null;
try {
  const electron = await import('electron');
  app = electron.app || electron.default?.app;
} catch (_) {}

const userDataDir = (app && typeof app.getPath === 'function') 
  ? app.getPath('userData') 
  : path.join(process.env.APPDATA || '.', 'podsync');

const outputDir = path.join(userDataDir, 'processed');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Downloads a cover art image from url to a local temporary file.
 */
async function downloadCover(url, trackId) {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const tempDir = (app && typeof app.getPath === 'function') ? app.getPath('temp') : (process.env.TEMP || 'C:\\Windows\\Temp');
    const safeId = String(trackId || Date.now()).replace(/[\\/:*?"<>|]/g, '_');
    const coverPath = path.join(tempDir, `cover-${safeId}.jpg`);
    await fs.promises.writeFile(coverPath, buffer);
    return coverPath;
  } catch (error) {
    console.warn(`[converter] Cover download skipped for track ${trackId}:`, error.message);
    return null;
  }
}

import { normalizeKazakh } from './matching-engine.js';

export { downloadCover };

/**
 * Converts a raw downloaded audio file (WebM / Opus / MP3 / M4A) to high quality AAC M4A
 * with embedded iTunes/iPod metadata tags & artwork using direct child_process.spawn.
 */
export async function convertToAAC(inputPath, trackInfo) {
  const cleanId = String(trackInfo.id || Date.now()).replace(/[\\/:*?"<>|]/g, '_');
  const safeArtist = String(trackInfo.artist || 'Unknown Artist').replace(/[\\/:*?"<>|]/g, '_').trim();
  const safeTitle = String(trackInfo.title || 'Unknown').replace(/[\\/:*?"<>|]/g, '_').trim();
  const safeFilename = `${safeArtist} - ${safeTitle}_${cleanId}.m4a`;
  const outputPath = path.join(outputDir, safeFilename);

  // If already converted and exists on disk with valid size
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000) {
    console.log(`[converter] Output already exists on disk: ${outputPath}`);
    return outputPath;
  }

  // Normalize all Kazakh/Cyrillic characters to standard Windows-1251 basic Cyrillic for iPod font compatibility
  const rawTitle = normalizeKazakh(String(trackInfo.title || 'Unknown'));
  const rawArtist = normalizeKazakh(String(trackInfo.artist || 'Unknown Artist'));
  const rawAlbum = normalizeKazakh(String(trackInfo.album || 'Unknown Album'));
  
  // Extract primary album artist to group collaborations into a single cohesive album in iTunes/iPod
  const primaryArtist = normalizeKazakh(
    trackInfo.album_artist || 
    rawArtist.replace(/\bac\/dc\b/gi, 'AC_DC').split(/[,&+]|\s+\/\s+|\bfeat\.?\b|\bft\.?\b|\band\b|\bwith\b|\bx\b/i)[0]?.replace(/AC_DC/g, 'AC/DC')?.trim() || 
    rawArtist
  );
  const rawGenre = String(trackInfo.genre || '');
  const rawYear = String(trackInfo.year || trackInfo.release_date || '').slice(0, 4);
  const cleanLyrics = trackInfo.lyrics ? normalizeKazakh(String(trackInfo.lyrics)) : '';

  let coverTempPath = null;
  try {
    coverTempPath = await downloadCover(trackInfo.cover_url || trackInfo.coverUrl || trackInfo.cover, cleanId);
  } catch (_) {}

  return new Promise((resolve, reject) => {
    console.log(`[converter] Transcoding & tagging (iPod Master Profile): "${rawArtist} - ${rawTitle}" (Album Artist: "${primaryArtist}") -> ${outputPath}`);

    const baseArgs = [
      '-y',
      '-i', inputPath
    ];

    const metadataArgs = [
      '-metadata', `title=${rawTitle}`,
      '-metadata', `artist=${rawArtist}`,
      '-metadata', `album_artist=${primaryArtist}`,
      '-metadata', `album=${rawAlbum}`,
      '-metadata', 'comment=Synced via PodSync'
    ];

    if (rawGenre) metadataArgs.push('-metadata', `genre=${rawGenre}`);
    if (rawYear) metadataArgs.push('-metadata', `date=${rawYear}`);
    if (cleanLyrics && cleanLyrics.trim().length > 0) {
      metadataArgs.push('-metadata', `lyrics=${cleanLyrics}`);
    }
    
    const trackNum = Number(trackInfo.track_number ?? trackInfo.trackNumber ?? 0);
    const discNum = Number(trackInfo.disc_number ?? trackInfo.discNumber ?? 1);
    const totalTracks = Number(trackInfo.track_count ?? trackInfo.trackCount ?? 0);

    if (trackNum > 0) {
      metadataArgs.push('-metadata', totalTracks > 0 ? `track=${trackNum}/${totalTracks}` : `track=${trackNum}`);
    }
    if (discNum > 0) {
      metadataArgs.push('-metadata', `disc=${discNum}`);
    }

    const bitrate = trackInfo.quality === '320k' ? '320k' : '256k';

    // Pure iPod High-Definition Audio Engine:
    // 1. aresample=44100:async=1:first_pts=0 guarantees jitter-free continuous sample clock and fixes YouTube DASH packet gaps
    // 2. volume=-1.5dB maintains full punch and loudness while providing clean true-peak margin
    // 3. alimiter with fast 5ms attack and 50ms release transparently catches inter-sample peaks without crushing song dynamics or transients
    // 4. -f ipod -brand M4A builds native QuickTime M4A atoms with proper covr metadata atom
    const audioFilter = 'aresample=44100:async=1:first_pts=0,volume=-1.5dB,alimiter=attack=5:release=50:limit=-0.5dB:level=false';

    if (coverTempPath && fs.existsSync(coverTempPath)) {
      baseArgs.push(
        '-i', coverTempPath,
        '-map', '0:a',
        '-map', '1:v',
        '-af', audioFilter,
        '-c:a', 'aac',
        '-b:a', bitrate,
        '-ar', '44100',
        '-ac', '2',
        '-aac_pns', '0',
        '-profile:a', 'aac_low',
        '-c:v', 'mjpeg',
        '-disposition:v:0', 'attached_pic',
        '-f', 'ipod',
        '-brand', 'M4A ',
        '-movflags', '+faststart',
        ...metadataArgs,
        outputPath
      );
    } else {
      baseArgs.push(
        '-vn',
        '-af', audioFilter,
        '-c:a', 'aac',
        '-b:a', bitrate,
        '-ar', '44100',
        '-ac', '2',
        '-aac_pns', '0',
        '-profile:a', 'aac_low',
        '-f', 'ipod',
        '-brand', 'M4A ',
        '-movflags', '+faststart',
        ...metadataArgs,
        outputPath
      );
    }

    const ffmpegProc = spawn(ffmpegPath, baseArgs, {
      windowsHide: true
    });

    let stderrData = '';

    ffmpegProc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    ffmpegProc.on('error', (err) => {
      if (coverTempPath && fs.existsSync(coverTempPath)) {
        try { fs.unlinkSync(coverTempPath); } catch (_) {}
      }
      console.error(`[converter] Process spawn error for "${rawArtist} - ${rawTitle}":`, err.message);
      reject(err);
    });

    ffmpegProc.on('close', (code) => {
      if (coverTempPath && fs.existsSync(coverTempPath)) {
        try { fs.unlinkSync(coverTempPath); } catch (_) {}
      }
      if (fs.existsSync(inputPath)) {
        try { fs.unlinkSync(inputPath); } catch (_) {}
      }

      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        console.log(`[converter] Successfully converted (iPod Master): "${rawArtist} - ${rawTitle}"`);
        resolve(outputPath);
      } else {
        const errMsg = stderrData.split('\n').filter(Boolean).slice(-5).join(' ') || `Process exited with code ${code}`;
        console.error(`[converter] Transcode error for "${rawArtist} - ${rawTitle}":`, errMsg);
        reject(new Error(errMsg));
      }
    });
  });
}

export default { convertToAAC, downloadCover };
