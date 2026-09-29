import fs from 'fs';
import path from 'path';
import { app, session } from 'electron';
import { saveSession as saveDbSession, getSession as getDbSession, deleteSession as deleteDbSession } from '../db.js';

const SESSION_KEY = 'current_app_session';

const getSessionFilePath = () => {
  const baseDir = (app && typeof app.getPath === 'function')
    ? app.getPath('userData')
    : path.join(process.env.APPDATA || '.', 'podsync');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return {
    main: path.join(baseDir, 'session_store.json'),
    backup: path.join(baseDir, 'session_store.bak.json'),
    temp: path.join(baseDir, 'session_store.tmp.json')
  };
};

/**
 * Safely writes JSON atomically (write to temp file, then rename)
 */
const safeWriteJsonAtomic = (filePath, backupPath, tempPath, data) => {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    // 1. Write temp
    fs.writeFileSync(tempPath, jsonStr, 'utf-8');
    // 2. If main exists, keep backup
    if (fs.existsSync(filePath)) {
      try {
        fs.copyFileSync(filePath, backupPath);
      } catch (_) {}
    }
    // 3. Atomic rename
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error('[SessionManager] safeWriteJsonAtomic error:', err);
    return false;
  }
};

/**
 * Safely reads JSON with backup fallback
 */
const safeReadJsonWithBackup = (filePath, backupPath) => {
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (raw && raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[SessionManager] Corrupt main session file, attempting backup restore...', e.message);
    }
  }

  if (fs.existsSync(backupPath)) {
    try {
      const raw = fs.readFileSync(backupPath, 'utf-8');
      if (raw && raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[SessionManager] Backup session file failed to parse:', e.message);
    }
  }
  return null;
};

/**
 * Flushes Chromium session cookies to disk immediately
 */
export const flushCookiesToDisk = async () => {
  try {
    const ses = session.fromPartition('persist:apple_music_auth');
    if (ses && ses.cookies && typeof ses.cookies.flushStore === 'function') {
      await ses.cookies.flushStore();
      console.log('[SessionManager] Auth cookies flushed to disk successfully.');
    }
  } catch (e) {
    console.error('[SessionManager] Failed to flush cookies:', e.message);
  }
};

/**
 * Persists session state (tokens, queue, UI state) both to SQLite and atomic JSON
 */
export const persistSession = async (sessionData) => {
  if (!sessionData || typeof sessionData !== 'object') return false;

  const payload = {
    ...sessionData,
    lastSaved: Date.now()
  };

  // 1. Save to SQLite
  await saveDbSession(SESSION_KEY, payload);

  // 2. Save to Atomic JSON file with backup
  const paths = getSessionFilePath();
  safeWriteJsonAtomic(paths.main, paths.backup, paths.temp, payload);

  // 3. Flush cookies asynchronously
  flushCookiesToDisk().catch(() => {});

  return true;
};

/**
 * Retrieves the saved session, checking SQLite first, then atomic JSON fallback
 */
export const retrieveSession = async () => {
  // 1. Try SQLite
  const dbData = await getDbSession(SESSION_KEY);
  if (dbData && typeof dbData === 'object' && Object.keys(dbData).length > 0) {
    return dbData;
  }

  // 2. Fallback to file store
  const paths = getSessionFilePath();
  const fileData = safeReadJsonWithBackup(paths.main, paths.backup);
  if (fileData) {
    // Re-seed DB with file data
    await saveDbSession(SESSION_KEY, fileData);
    return fileData;
  }

  return null;
};

/**
 * Clears session on explicit user sign out
 */
export const clearPersistedSession = async () => {
  await deleteDbSession(SESSION_KEY);
  const paths = getSessionFilePath();
  try {
    if (fs.existsSync(paths.main)) fs.unlinkSync(paths.main);
    if (fs.existsSync(paths.backup)) fs.unlinkSync(paths.backup);
    if (fs.existsSync(paths.temp)) fs.unlinkSync(paths.temp);
  } catch (_) {}
  return true;
};
