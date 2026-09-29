import fs from 'fs';
import path from 'path';
import { app, dialog } from 'electron';
import { IPodScanner } from './ipod-scanner.js';

let isExportCancelled = false;

function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'Unknown';
  // Strip characters forbidden in Windows files/directories: < > : " / \ | ? * and control chars
  let cleaned = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  // Strip trailing dots or spaces which Windows forbids
  cleaned = cleaned.replace(/[. ]+$/, '');
  return cleaned || 'Unknown';
}

export function getDefaultExportFolder() {
  const baseMusic = app.getPath('music') || app.getPath('documents') || app.getPath('home');
  return path.join(baseMusic, 'iPod Music Export');
}

export async function selectExportDestination(mainWindow) {
  const defaultPath = getDefaultExportFolder();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Destination Folder for iPod Export',
    defaultPath,
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}

export function cancelExport() {
  isExportCancelled = true;
}

export async function exportIpodTracks(ipodDrivePath, destinationPath, optionsOrProgress, maybeOnProgress) {
  isExportCancelled = false;
  
  let options = {};
  let onProgress = null;
  if (typeof optionsOrProgress === 'function') {
    onProgress = optionsOrProgress;
  } else if (optionsOrProgress && typeof optionsOrProgress === 'object') {
    options = optionsOrProgress;
    onProgress = maybeOnProgress;
  }

  const { structure = 'artist_album', selectedTrackIds = null, skipExisting = true } = options;

  if (!ipodDrivePath || !fs.existsSync(ipodDrivePath)) {
    throw new Error('iPod device path not found or not connected');
  }
  if (!destinationPath) {
    throw new Error('Destination path is not specified');
  }

  // Ensure destination folder exists
  fs.mkdirSync(destinationPath, { recursive: true });

  // Scan tracks from iPod
  const scanner = new IPodScanner(ipodDrivePath);
  let tracks = await scanner.scan();

  if (!tracks || tracks.length === 0) {
    return { success: false, total: 0, exported: 0, reason: 'No tracks found on iPod' };
  }

  // Filter if selective export requested
  if (Array.isArray(selectedTrackIds) && selectedTrackIds.length > 0) {
    const idSet = new Set(selectedTrackIds.map(String));
    tracks = tracks.filter(t => idSet.has(String(t.id)) || idSet.has(String(t.path)));
  }

  const total = tracks.length;
  let exported = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    if (isExportCancelled) {
      break;
    }

    const track = tracks[i];
    const srcPath = track.path;

    if (!srcPath || !fs.existsSync(srcPath)) {
      skipped++;
      continue;
    }

    const artist = sanitizeFilename(track.artist || 'Unknown Artist');
    const album = sanitizeFilename(track.album || 'Unknown Album');
    const title = sanitizeFilename(track.title || path.basename(srcPath, path.extname(srcPath)));
    const ext = path.extname(srcPath).toLowerCase() || (track.format ? `.${track.format}` : '.m4a');
    
    const trackNoStr = track.trackNumber || track.track_number;
    const prefix = trackNoStr ? `${String(trackNoStr).padStart(2, '0')} - ` : '';

    let targetDir = destinationPath;
    let filename = `${prefix}${title}${ext}`;

    if (structure === 'artist_album') {
      targetDir = path.join(destinationPath, artist, album);
      filename = `${prefix}${title}${ext}`;
    } else if (structure === 'artist_title') {
      targetDir = path.join(destinationPath, artist);
      filename = `${artist} - ${title}${ext}`;
    } else if (structure === 'flat') {
      targetDir = destinationPath;
      filename = `${artist} - ${album} - ${prefix}${title}${ext}`;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    const destPath = path.join(targetDir, filename);

    // Skip existing file if requested and matches size
    if (skipExisting && fs.existsSync(destPath)) {
      try {
        const srcStat = fs.statSync(srcPath);
        const destStat = fs.statSync(destPath);
        if (srcStat.size === destStat.size && srcStat.size > 0) {
          exported++;
          if (onProgress) {
            const percent = Math.round(((i + 1) / total) * 100);
            onProgress({
              current: i + 1,
              total,
              percent,
              currentTrack: {
                title: track.title,
                artist: track.artist,
                album: track.album
              },
              destPath
            });
          }
          continue;
        }
      } catch (_) {}
    }

    try {
      fs.copyFileSync(srcPath, destPath);
      exported++;
    } catch (err) {
      console.warn(`[ipod-export] Failed to copy track ${srcPath} -> ${destPath}:`, err);
      skipped++;
    }

    if (onProgress) {
      const percent = Math.round(((i + 1) / total) * 100);
      onProgress({
        current: i + 1,
        total,
        percent,
        currentTrack: {
          title: track.title,
          artist: track.artist,
          album: track.album
        },
        destPath
      });
    }
  }

  return {
    success: !isExportCancelled,
    cancelled: isExportCancelled,
    total,
    exported,
    skipped,
    destinationPath
  };
}
