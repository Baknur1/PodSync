import fs from 'fs';
import path from 'path';

/**
 * ITunesDBParser - Robust binary parser for Apple iPod iTunesDB.
 * Extracts authentic tracks, metadata (Title, Artist, Album, Duration, Path),
 * and Playlists directly from the iPod iTunesDB binary format.
 */
export class ITunesDBParser {
  constructor(ipodPath) {
    this.ipodPath = ipodPath;
    this.dbPath = path.join(ipodPath, 'iPod_Control', 'iTunes', 'iTunesDB');
  }

  /**
   * Reads and parses iTunesDB into tracks and playlists.
   * @returns {{ tracks: Array, playlists: Array }}
   */
  parse() {
    if (!fs.existsSync(this.dbPath)) {
      console.warn(`[itunesdb-parser] iTunesDB not found at: ${this.dbPath}`);
      return { tracks: [], playlists: [] };
    }

    try {
      const buffer = fs.readFileSync(this.dbPath);
      if (buffer.length < 100) {
        return { tracks: [], playlists: [] };
      }

      // Check for 'mhbd' header
      const magic = buffer.toString('ascii', 0, 4);
      if (magic !== 'mhbd') {
        console.warn(`[itunesdb-parser] Invalid iTunesDB header: ${magic}`);
        return { tracks: [], playlists: [] };
      }

      const tracksMap = new Map(); // trackId -> track object
      const tracksList = [];
      const playlistsList = [];

      let offset = 0;
      const mhbdHeaderSize = buffer.readUInt32LE(4);
      offset = mhbdHeaderSize;

      // Traverse root chunks (mhsd)
      while (offset < buffer.length - 8) {
        const chunkType = buffer.toString('ascii', offset, offset + 4);
        if (chunkType !== 'mhsd') {
          break;
        }

        const mhsdHeaderSize = buffer.readUInt32LE(offset + 4);
        const mhsdTotalSize = buffer.readUInt32LE(offset + 8);
        const datasetType = buffer.readUInt32LE(offset + 12); // 1 = Tracks, 2 = Playlists

        const datasetStart = offset + mhsdHeaderSize;
        const datasetEnd = offset + mhsdTotalSize;

        if (datasetType === 1) {
          // Track list dataset (mhlt)
          this.parseTrackDataset(buffer, datasetStart, datasetEnd, tracksMap, tracksList);
        } else if (datasetType === 2) {
          // Playlist dataset (mhlp)
          this.parsePlaylistDataset(buffer, datasetStart, datasetEnd, tracksMap, playlistsList);
        }

        offset += mhsdTotalSize;
        if (mhsdTotalSize <= 0) break;
      }

      console.log(`[itunesdb-parser] Successfully parsed ${tracksList.length} tracks and ${playlistsList.length} playlists from iTunesDB.`);
      return { tracks: tracksList, playlists: playlistsList };
    } catch (error) {
      console.error('[itunesdb-parser] Error parsing iTunesDB:', error);
      return { tracks: [], playlists: [] };
    }
  }

  parseTrackDataset(buffer, start, end, tracksMap, tracksList) {
    if (start >= end) return;
    const mhltMagic = buffer.toString('ascii', start, start + 4);
    if (mhltMagic !== 'mhlt') return;

    const mhltHeaderSize = buffer.readUInt32LE(start + 4);
    const numTracks = buffer.readUInt32LE(start + 8);

    let offset = start + mhltHeaderSize;
    let trackIndex = 0;

    while (offset < end && trackIndex < numTracks) {
      const mhitMagic = buffer.toString('ascii', offset, offset + 4);
      if (mhitMagic !== 'mhit') break;

      const mhitHeaderSize = buffer.readUInt32LE(offset + 4);
      const mhitTotalSize = buffer.readUInt32LE(offset + 8);
      const numMhods = buffer.readUInt32LE(offset + 12);
      const trackId = buffer.readUInt32LE(offset + 16);

      // Duration is in milliseconds at offset 40 in mhit
      let durationMs = 0;
      if (mhitHeaderSize >= 44) {
        durationMs = buffer.readUInt32LE(offset + 40);
      }
      let bitrate = 256;
      if (mhitHeaderSize >= 60) {
        bitrate = buffer.readUInt32LE(offset + 56) || 256;
      }

      const mhods = this.parseMhods(buffer, offset + mhitHeaderSize, offset + mhitTotalSize, numMhods);

      // Resolve internal path (mhod type 2): e.g. ":iPod_Control:Music:F05:ZDJS.m4a"
      let internalPath = mhods[2] || '';
      let localDiskPath = '';

      if (internalPath) {
        const pathParts = internalPath.split(':').filter(Boolean);
        localDiskPath = path.join(this.ipodPath, ...pathParts);
      }

      // If file doesn't exist on disk, check case-insensitive or direct match
      if (localDiskPath && !fs.existsSync(localDiskPath)) {
        // Fallback search in iPod_Control/Music
        const baseName = path.basename(localDiskPath);
        const folderName = path.basename(path.dirname(localDiskPath));
        const altPath = path.join(this.ipodPath, 'iPod_Control', 'Music', folderName, baseName);
        if (fs.existsSync(altPath)) {
          localDiskPath = altPath;
        }
      }

      const rawExt = localDiskPath ? path.extname(localDiskPath).replace('.', '').toLowerCase() : 'm4a';

      const track = {
        id: `ipod_db_${trackId}`,
        trackId: trackId,
        title: mhods[1] || (localDiskPath ? path.basename(localDiskPath) : `Track ${trackIndex + 1}`),
        artist: mhods[4] || 'Unknown Artist',
        album: mhods[3] || 'Unknown Album',
        genre: mhods[5] || 'Unknown Genre',
        duration: Math.round(durationMs / 1000) || 0,
        bitrate: bitrate || 256,
        path: localDiskPath,
        internalPath: internalPath,
        format: rawExt
      };

      tracksMap.set(trackId, track);
      tracksList.push(track);

      trackIndex++;
      offset += mhitTotalSize;
      if (mhitTotalSize <= 0) break;
    }
  }

  parsePlaylistDataset(buffer, start, end, tracksMap, playlistsList) {
    if (start >= end) return;
    const mhlpMagic = buffer.toString('ascii', start, start + 4);
    if (mhlpMagic !== 'mhlp') return;

    const mhlpHeaderSize = buffer.readUInt32LE(start + 4);
    const numPlaylists = buffer.readUInt32LE(start + 8);

    let offset = start + mhlpHeaderSize;
    let plIndex = 0;

    while (offset < end && plIndex < numPlaylists) {
      const mhypMagic = buffer.toString('ascii', offset, offset + 4);
      if (mhypMagic !== 'mhyp') break;

      const mhypHeaderSize = buffer.readUInt32LE(offset + 4);
      const mhypTotalSize = buffer.readUInt32LE(offset + 8);
      const isMaster = buffer.readUInt32LE(offset + 20); // 1 = Master iPod Library, 0 = Playlist

      let plName = '';
      const playlistTracks = [];

      // Parse playlist mhods and mhip (playlist items)
      let innerOffset = offset + mhypHeaderSize;
      const innerEnd = offset + mhypTotalSize;

      while (innerOffset < innerEnd) {
        const chunkType = buffer.toString('ascii', innerOffset, innerOffset + 4);
        if (chunkType === 'mhod') {
          const m = this.parseSingleMhod(buffer, innerOffset, innerEnd);
          if (m) {
            if (m.type === 1) {
              plName = m.str;
            }
            innerOffset += m.totalSize;
            continue;
          }
        } else if (chunkType === 'mhip') {
          const mhipTotalSize = buffer.readUInt32LE(innerOffset + 8);
          // Track ID at offset 24 in mhip
          if (mhipTotalSize >= 28) {
            const trackId = buffer.readUInt32LE(innerOffset + 24);
            const trackObj = tracksMap.get(trackId);
            if (trackObj) {
              playlistTracks.push(trackObj);
            }
          }
          innerOffset += mhipTotalSize;
          if (mhipTotalSize <= 0) break;
          continue;
        }
        innerOffset += 4;
      }

      if (!isMaster && plName) {
        playlistsList.push({
          id: `ipod_pl_${plIndex}`,
          title: plName,
          trackCount: playlistTracks.length,
          tracks: playlistTracks,
          isIpodPlaylist: true
        });
      }

      plIndex++;
      offset += mhypTotalSize;
      if (mhypTotalSize <= 0) break;
    }
  }

  parseSingleMhod(buffer, offset, maxEnd) {
    if (offset + 24 > maxEnd || offset + 24 > buffer.length) return null;
    const magic = buffer.toString('ascii', offset, offset + 4);
    if (magic !== 'mhod') return null;

    const headerSize = buffer.readUInt32LE(offset + 4);
    const totalSize = buffer.readUInt32LE(offset + 8);
    const type = buffer.readUInt32LE(offset + 12);

    if (totalSize < 40 || totalSize <= 0 || offset + totalSize > buffer.length) {
      return { type, totalSize: Math.max(headerSize, 24), str: '' };
    }

    const encoding = buffer.readUInt32LE(offset + 24);
    const strLen = buffer.readUInt32LE(offset + 28);

    let str = '';
    if (strLen > 0 && offset + 40 + strLen <= buffer.length) {
      if (encoding === 2) {
        str = buffer.toString('utf8', offset + 40, offset + 40 + strLen);
      } else {
        str = buffer.toString('utf16le', offset + 40, offset + 40 + strLen);
      }
      str = str.replace(/\0/g, '').trim();
    }

    return { type, totalSize, str };
  }

  parseMhods(buffer, start, end, count) {
    const result = {};
    let offset = start;
    let parsedCount = 0;

    while (offset < end && parsedCount < count) {
      const m = this.parseSingleMhod(buffer, offset, end);
      if (!m) break;

      if (m.str) {
        result[m.type] = m.str;
      }

      parsedCount++;
      offset += m.totalSize;
      if (m.totalSize <= 0) break;
    }

    return result;
  }
}
