import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let app = null;
try {
  const electron = await import('electron');
  app = electron.app || electron.default?.app;
} catch (_) {}

const dbDir = (app && typeof app.getPath === 'function')
  ? app.getPath('userData')
  : path.join(process.env.APPDATA || '.', 'podsync');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'podsync.db');
const db = new Database(dbPath);

// Enable WAL mode for fast concurrent read and write operations
db.pragma('journal_mode = WAL');

// Initialize SQLite database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    apple_id TEXT,
    title TEXT,
    artist TEXT,
    album TEXT,
    duration INTEGER,
    youtube_id TEXT,
    local_path TEXT,
    status TEXT,
    bitrate TEXT,
    cover_url TEXT,
    lyrics TEXT
  );

  CREATE TABLE IF NOT EXISTS cached_library_songs (
    id TEXT PRIMARY KEY,
    apple_id TEXT,
    title TEXT,
    artist TEXT,
    album TEXT,
    duration INTEGER,
    genre TEXT,
    bitrate TEXT,
    cover_url TEXT,
    date_added TEXT,
    track_number INTEGER,
    disc_number INTEGER,
    lyrics TEXT,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS cached_playlists (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    cover_url TEXT,
    track_count INTEGER,
    tracks_json TEXT,
    last_modified TEXT,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS app_sessions (
    key TEXT PRIMARY KEY,
    data TEXT,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS cached_ipod_tracks (
    id TEXT PRIMARY KEY,
    title TEXT,
    artist TEXT,
    album TEXT,
    duration INTEGER,
    genre TEXT,
    bitrate TEXT,
    path TEXT,
    cover_url TEXT,
    updated_at INTEGER
  );
`);

// Database table schema migrations
try {
  db.exec(`ALTER TABLE tracks ADD COLUMN lyrics TEXT;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE cached_library_songs ADD COLUMN date_added TEXT;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE cached_library_songs ADD COLUMN track_number INTEGER;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE cached_library_songs ADD COLUMN disc_number INTEGER;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE cached_library_songs ADD COLUMN lyrics TEXT;`);
} catch (_) {}

export const getAllTracks = async () => {
  try {
    const stmt = db.prepare('SELECT * FROM tracks');
    return stmt.all();
  } catch (error) {
    console.error('[DB] getAllTracks failed:', error);
    return [];
  }
};

export const getTrackById = async (id) => {
  try {
    const stmt = db.prepare('SELECT * FROM tracks WHERE id = ?');
    return stmt.get(id) || null;
  } catch (error) {
    console.error('[DB] getTrackById failed:', error);
    return null;
  }
};

export const upsertTrack = async (track) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO tracks (id, apple_id, title, artist, album, duration, youtube_id, local_path, status, bitrate, cover_url, lyrics)
      VALUES (@id, @apple_id, @title, @artist, @album, @duration, @youtube_id, @local_path, @status, @bitrate, @cover_url, @lyrics)
      ON CONFLICT(id) DO UPDATE SET
        youtube_id = excluded.youtube_id,
        local_path = excluded.local_path,
        status = excluded.status,
        bitrate = excluded.bitrate,
        cover_url = excluded.cover_url,
        lyrics = excluded.lyrics
    `);
    
    stmt.run({
      id: track.id,
      apple_id: track.apple_id || track.id,
      title: track.title || 'Unknown',
      artist: track.artist || 'Unknown Artist',
      album: track.album || 'Unknown Album',
      duration: track.duration || 0,
      youtube_id: track.youtube_id || '',
      local_path: track.local_path || '',
      status: track.status || 'pending',
      bitrate: track.bitrate || '256 kbps',
      cover_url: track.cover_url || '',
      lyrics: track.lyrics || ''
    });
    return track;
  } catch (error) {
    console.error('[DB] upsertTrack failed:', error);
    return track;
  }
};

// Library caching methods

export const getCachedLibrarySongs = () => {
  try {
    const stmt = db.prepare('SELECT * FROM cached_library_songs ORDER BY rowid ASC');
    return stmt.all();
  } catch (err) {
    console.error('[DB] getCachedLibrarySongs error:', err);
    return [];
  }
};

export const saveLibrarySongsCache = (songs) => {
  if (!Array.isArray(songs)) return;
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO cached_library_songs (id, apple_id, title, artist, album, duration, genre, bitrate, cover_url, date_added, track_number, disc_number, lyrics, updated_at)
      VALUES (@id, @apple_id, @title, @artist, @album, @duration, @genre, @bitrate, @cover_url, @date_added, @track_number, @disc_number, @lyrics, @updated_at)
    `);

    const now = Date.now();
    const syncAll = db.transaction((list) => {
      db.prepare('DELETE FROM cached_library_songs').run();
      for (const s of list) {
        insert.run({
          id: s.id,
          apple_id: s.apple_id || s.id,
          title: s.title || 'Unknown',
          artist: s.artist || 'Unknown Artist',
          album: s.album || 'Unknown Album',
          duration: s.duration || 0,
          genre: s.genre || 'Unknown',
          bitrate: s.bitrate || '256 kbps',
          cover_url: s.cover_url || '',
          date_added: s.date_added || s.dateAdded || '',
          track_number: Number(s.track_number ?? s.trackNumber ?? 0),
          disc_number: Number(s.disc_number ?? s.discNumber ?? 1),
          lyrics: s.lyrics || '',
          updated_at: now
        });
      }
    });

    syncAll(songs);
    console.log(`[DB] Synchronized ${songs.length} Apple Music songs in SQLite.`);
  } catch (err) {
    console.error('[DB] saveLibrarySongsCache error:', err);
  }
};

export const getCachedPlaylists = () => {
  try {
    try {
      db.exec('ALTER TABLE cached_playlists ADD COLUMN last_modified TEXT');
    } catch (_) {}

    let rows = [];
    try {
      const stmt = db.prepare('SELECT * FROM cached_playlists ORDER BY title ASC');
      rows = stmt.all();
    } catch (e) {
      console.warn('[DB] Fallback getCachedPlaylists query:', e);
      return [];
    }

    // Sort playlists: favorites first, then by date and title
    rows.sort((a, b) => {
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      const aFav = aTitle.includes('favour') || aTitle.includes('favor') || aTitle.includes('избран') || aTitle.includes('любив');
      const bFav = bTitle.includes('favour') || bTitle.includes('favor') || bTitle.includes('избран') || bTitle.includes('любив');
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      
      const aDate = a.last_modified || a.updated_at || '';
      const bDate = b.last_modified || b.updated_at || '';
      if (aDate && bDate) return bDate > aDate ? 1 : -1;
      return aTitle.localeCompare(bTitle);
    });

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      cover: r.cover_url,
      trackCount: r.track_count,
      lastModifiedDate: r.last_modified || '',
      tracks: r.tracks_json ? JSON.parse(r.tracks_json) : []
    }));
  } catch (err) {
    console.error('[DB] getCachedPlaylists error:', err);
    return [];
  }
};

export const savePlaylistsCache = (playlists) => {
  if (!Array.isArray(playlists)) return;
  try {
    try {
      db.exec('ALTER TABLE cached_playlists ADD COLUMN last_modified TEXT');
    } catch (_) {}

    db.prepare('DELETE FROM cached_playlists').run();

    const insert = db.prepare(`
      INSERT OR REPLACE INTO cached_playlists (id, title, description, cover_url, track_count, last_modified, tracks_json, updated_at)
      VALUES (@id, @title, @description, @cover_url, @track_count, @last_modified, @tracks_json, @updated_at)
    `);

    const now = Date.now();
    const insertMany = db.transaction((list) => {
      for (const pl of list) {
        insert.run({
          id: pl.id,
          title: pl.title || 'Untitled Playlist',
          description: pl.description || '',
          cover_url: pl.cover || '',
          track_count: pl.trackCount || (pl.tracks?.length || 0),
          last_modified: pl.lastModifiedDate || pl.dateAdded || '',
          tracks_json: JSON.stringify(pl.tracks || []),
          updated_at: now
        });
      }
    });

    insertMany(playlists);
    console.log(`[DB] Cached ${playlists.length} playlists in SQLite.`);
  } catch (err) {
    console.error('[DB] savePlaylistsCache error:', err);
  }
};

export const getCachedIpodTracks = () => {
  try {
    const stmt = db.prepare('SELECT * FROM cached_ipod_tracks ORDER BY title ASC');
    return stmt.all();
  } catch (err) {
    console.error('[DB] getCachedIpodTracks error:', err);
    return [];
  }
};

export const saveIpodTracksCache = (tracks) => {
  if (!Array.isArray(tracks)) return;
  try {
    db.prepare('DELETE FROM cached_ipod_tracks').run();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO cached_ipod_tracks (id, title, artist, album, duration, genre, bitrate, path, cover_url, updated_at)
      VALUES (@id, @title, @artist, @album, @duration, @genre, @bitrate, @path, @cover_url, @updated_at)
    `);

    const now = Date.now();
    const insertMany = db.transaction((list) => {
      for (const t of list) {
        insert.run({
          id: t.id || t.path || `${t.title}-${t.artist}`,
          title: t.title || 'Unknown',
          artist: t.artist || 'Unknown Artist',
          album: t.album || 'Unknown Album',
          duration: t.duration || 0,
          genre: t.genre || 'Unknown',
          bitrate: t.bitrate || '256 kbps',
          path: t.path || '',
          cover_url: t.cover_url || '',
          updated_at: now
        });
      }
    });

    insertMany(tracks);
    console.log(`[DB] Cached ${tracks.length} iPod tracks in SQLite.`);
  } catch (err) {
    console.error('[DB] saveIpodTracksCache error:', err);
  }
};

export const deleteTrackCache = (track) => {
  try {
    if (!track) return false;
    if (typeof track === 'string') {
      db.prepare('DELETE FROM tracks WHERE id = ? OR title LIKE ?').run(track, `%${track}%`);
    } else {
      if (track.id) {
        db.prepare('DELETE FROM tracks WHERE id = ?').run(track.id);
      }
      if (track.title) {
        const stmt = db.prepare('DELETE FROM tracks WHERE title LIKE ?');
        stmt.run(`%${track.title}%`);
      }
    }
    console.log(`[DB] Cleared track cache for:`, track);
    return true;
  } catch (err) {
    console.error('[DB] deleteTrackCache error:', err);
    return false;
  }
};

export const clearAllCache = (clearTracks = false) => {
  try {
    db.prepare('DELETE FROM cached_library_songs').run();
    db.prepare('DELETE FROM cached_playlists').run();
    db.prepare('DELETE FROM cached_ipod_tracks').run();
    if (clearTracks) {
      db.prepare('DELETE FROM tracks').run();
    }
    console.log('[DB] Cache tables cleared successfully.');
    return true;
  } catch (err) {
    console.error('[DB] clearAllCache error:', err);
    return false;
  }
};

export default db;

export const saveSession = async (key, data) => {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO app_sessions (key, data, updated_at)
      VALUES (?, ?, ?)
    `);
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    stmt.run(key, jsonStr, Date.now());
    return true;
  } catch (error) {
    console.error('[DB] saveSession failed:', error);
    return false;
  }
};

export const getSession = async (key) => {
  try {
    const stmt = db.prepare('SELECT data FROM app_sessions WHERE key = ?');
    const row = stmt.get(key);
    if (!row || !row.data) return null;
    try {
      return JSON.parse(row.data);
    } catch {
      return row.data;
    }
  } catch (error) {
    console.error('[DB] getSession failed:', error);
    return null;
  }
};

export const deleteSession = async (key) => {
  try {
    const stmt = db.prepare('DELETE FROM app_sessions WHERE key = ?');
    stmt.run(key);
    return true;
  } catch (error) {
    console.error('[DB] deleteSession failed:', error);
    return false;
  }
};
