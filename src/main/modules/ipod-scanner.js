import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import { ITunesDBParser } from './itunesdb-parser.js';

/**
 * IPodScanner traverses the iPod's filesystem and iTunesDB to discover existing tracks & playlists.
 */
export class IPodScanner {
  constructor(ipodPath) {
    this.ipodPath = ipodPath;
    this.musicPath = path.join(ipodPath, 'iPod_Control', 'Music');
  }

  /**
   * Scans the iPod playlists directly from iTunesDB.
   */
  async scanPlaylists() {
    // 1. Primary: Parse official iTunesDB on iPod (contains all real synced playlists!)
    try {
      const parser = new ITunesDBParser(this.ipodPath);
      const res = parser.parse();
      if (Array.isArray(res.playlists) && res.playlists.length > 0) {
        return res.playlists.filter(p => p.title !== 'Sync Queue');
      }
    } catch (e) {
      console.warn('[ipod-scanner] iTunesDB playlists parse error:', e);
    }

    // 2. Fallback: podsync-playlists.json
    const playlistsPath = path.join(this.ipodPath, 'iPod_Control', 'iTunes', 'podsync-playlists.json');
    if (fs.existsSync(playlistsPath)) {
      try {
        const content = fs.readFileSync(playlistsPath, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed.filter(p => p.title !== 'Sync Queue');
        }
      } catch (error) {
        console.error('Failed to parse iPod playlists index:', error);
      }
    }
    return [];
  }

  /**
   * Scans all tracks from iTunesDB (with filesystem fallback).
   */
  async scan() {
    // 1. Primary: Parse official iTunesDB on iPod for authentic titles, artists, albums and exact durations!
    try {
      const parser = new ITunesDBParser(this.ipodPath);
      const res = parser.parse();
      if (Array.isArray(res.tracks) && res.tracks.length > 0) {
        return res.tracks;
      }
    } catch (e) {
      console.warn('[ipod-scanner] iTunesDB tracks parse error:', e);
    }

    // 2. Fallback: Raw filesystem scan
    const existingTracks = [];
    if (!fs.existsSync(this.musicPath)) {
      console.warn('[ipod-scanner] iPod Music directory not found at:', this.musicPath);
      return [];
    }

    console.log(`[ipod-scanner] Scanning iPod music at: ${this.musicPath}`);
    
    let folders = [];
    try {
      folders = fs.readdirSync(this.musicPath).filter(f => f.match(/^F\d{2}$/i));
    } catch (e) {
      console.error('[ipod-scanner] Could not read Music directory:', e);
      return [];
    }

    let trackCounter = 1;
    for (const folder of folders) {
      const folderPath = path.join(this.musicPath, folder);
      let files = [];
      try {
        files = fs.readdirSync(folderPath);
      } catch (_) {
        continue;
      }

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        let stats;
        try {
          stats = fs.statSync(filePath);
        } catch (_) {
          continue;
        }
        
        if (stats.isDirectory()) continue;

        const ext = path.extname(file).toLowerCase().replace('.', '');
        if (!['mp3', 'm4a', 'm4b', 'm4p', 'aac', 'wav', 'aiff', 'alac'].includes(ext)) {
          continue;
        }

        try {
          const metadata = await parseFile(filePath);
          
          existingTracks.push({
            id: `ipod_${folder}_${file}_${trackCounter++}`,
            title: metadata.common?.title || path.basename(file, path.extname(file)),
            artist: metadata.common?.artist || 'Unknown Artist',
            album: metadata.common?.album || 'Unknown Album',
            genre: (metadata.common?.genre && metadata.common.genre[0]) || 'Unknown',
            duration: Math.round(metadata.format?.duration || 0),
            bitrate: Math.round((metadata.format?.bitrate || 256000) / 1000),
            path: filePath,
            internalPath: `:iPod_Control:Music:${folder}:${file}`,
            fileSize: stats.size,
            format: ext
          });
        } catch (error) {
          console.warn(`[ipod-scanner] Fallback for ${file}:`, error.message);
          existingTracks.push({
            id: `ipod_${folder}_${file}_${trackCounter++}`,
            title: path.basename(file, path.extname(file)),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            genre: 'Unknown',
            duration: 0,
            bitrate: 256,
            path: filePath,
            internalPath: `:iPod_Control:Music:${folder}:${file}`,
            fileSize: stats.size,
            format: ext
          });
        }
      }
    }

    console.log(`[ipod-scanner] Scan complete. Found ${existingTracks.length} existing tracks on iPod.`);
    return existingTracks;
  }
}
