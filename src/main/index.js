import { persistSession, retrieveSession, clearPersistedSession, flushCookiesToDisk } from './modules/session-manager.js';
import 'dotenv/config';
import dns from 'dns';
import { Agent, setGlobalDispatcher } from 'undici';
import { app, BrowserWindow, ipcMain, protocol, net, shell, Menu } from 'electron';

// Robust DNS Fallback:
// If local network DNS (university/office/corporate router) fails on CNAMEs (Apple Music, CDN, etc.),
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
  console.warn('[PodSync] Global DNS fallback dispatcher setup warning:', e.message);
}

// Suppress internal Chromium mojo/blink debug logs in terminal
app.commandLine.appendSwitch('log-level', '3');
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Completely remove Electron default application menu (File, Edit, View, Window)
Menu.setApplicationMenu(null);

// Register media scheme as privileged BEFORE app ready
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'media', 
    privileges: { 
      standard: true, 
      secure: true, 
      supportFetchAPI: true, 
      bypassCSP: true, 
      stream: true 
    } 
  }
]);
import path from 'path';
import fs from 'node:fs';
const fsPromises = fs.promises;
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import db, { 
  getAllTracks, 
  getTrackById, 
  upsertTrack,
  getCachedLibrarySongs,
  saveLibrarySongsCache,
  getCachedPlaylists,
  savePlaylistsCache,
  getCachedIpodTracks,
  saveIpodTracksCache,
  clearAllCache,
  deleteTrackCache
} from './db.js';
import { findIpodDrive, getFirewireID, setCustomDeviceName } from './modules/ipod-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1080,
    minHeight: 700,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#8e8e93',
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#090a0c',
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [Level ${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
    console.error(`[Renderer Load Failed] code=${code} desc=${desc} url=${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    console.error(`[Renderer Process Gone]`, details);
  });

  // Handle dev/prod URLs robustly
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const distHtml = path.join(__dirname, '../../dist-renderer/index.html');

  if (devUrl) {
    // Explicitly started in dev mode with live server
    const loadDevWithRetry = async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          await mainWindow.loadURL(devUrl);
          console.log(`[Electron] Successfully loaded Vite dev server: ${devUrl}`);
          return;
        } catch (e) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      if (fs.existsSync(distHtml)) {
        mainWindow.loadFile(distHtml).catch(() => {});
      }
    };
    loadDevWithRetry();
  } else if (fs.existsSync(distHtml)) {
    // Instant direct load from built bundle (opens in <0.3s)
    mainWindow.loadFile(distHtml).catch((err) => {
      console.error('[Electron] Error loading production index.html:', err);
    });
  } else {
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('[Electron] Error loading fallback URL:', err);
    });
  }
}
app.whenReady().then(async () => {
  // Register media protocol for local audio playback with full HTTP 206 Range seeking support
  protocol.handle('media', async (request) => {
    try {
      const url = new URL(request.url);
      const filePath = url.searchParams.get('path');
      if (!filePath) return new Response('Path missing', { status: 400 });

      const decodedPath = path.resolve(filePath);
      if (!fs.existsSync(decodedPath)) {
        console.warn('[media protocol] File not found:', decodedPath);
        return new Response('File not found: ' + decodedPath, { status: 404 });
      }

      const stat = fs.statSync(decodedPath);
      const fileSize = stat.size;

      // Determine MIME type for audio container
      const ext = path.extname(decodedPath).toLowerCase().replace('.', '');
      const mimeTypes = {
        'm4a': 'audio/mp4',
        'mp4': 'audio/mp4',
        'aac': 'audio/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'aiff': 'audio/aiff',
        'flac': 'audio/flac',
        'ogg': 'audio/ogg'
      };
      const contentType = mimeTypes[ext] || 'audio/mp4';

      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          return new Response('Requested Range Not Satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` }
          });
        }

        const chunkSize = (end - start) + 1;
        const nodeStream = fs.createReadStream(decodedPath, { start, end });
        const webStream = Readable.toWeb(nodeStream);

        return new Response(webStream, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType
          }
        });
      }

      // No Range header: stream entire file with Accept-Ranges declared
      const nodeStream = fs.createReadStream(decodedPath);
      const webStream = Readable.toWeb(nodeStream);
      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType
        }
      });
    } catch (error) {
      console.error('Error handling media protocol request:', error);
      return new Response('Media playback error: ' + error.message, { status: 500 });
    }
  });

  // Apple Music Catalog API Integration
  const { searchAppleMusic } = await import('./modules/apple-music.js');
  ipcMain.handle('apple-music:search', async (event, term) => {
    return await searchAppleMusic(term);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC HANDLERS ──

ipcMain.handle('open-explorer', async () => {
  const drive = await findIpodDrive();
  if (drive && drive.path) {
    shell.openPath(drive.path);
    return true;
  }
  shell.openPath(app.getPath('userData'));
  return false;
});

ipcMain.handle('open-path', async (event, targetPath) => {
  if (targetPath) {
    shell.openPath(targetPath);
    return true;
  }
  return false;
});

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  if (filePath) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('eject-ipod', async () => {
  const drive = await findIpodDrive();
  if (!drive) return { success: false, message: 'No iPod connected' };
  return { success: true, message: 'iPod safely ready to disconnect' };
});

ipcMain.handle('clear-cache', async () => {
  return clearAllCache();
});

ipcMain.handle('delete-track-cache', async (event, track) => {
  try {
    deleteTrackCache(track);
    const processedDir = path.join(app.getPath('userData'), 'processed');
    if (fs.existsSync(processedDir)) {
      const files = fs.readdirSync(processedDir);
      const cleanId = String(track?.id || '').replace(/[\\/:*?"<>|]/g, '_').toLowerCase();
      const safeTitle = (track?.title || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();
      const safeArtist = (track?.artist || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();
      for (const f of files) {
        const lower = f.toLowerCase();
        const matchesId = cleanId && cleanId.length > 3 && lower.includes(`_${cleanId}.m4a`);
        const matchesName = safeArtist && safeTitle && (lower.startsWith(`${safeArtist} - ${safeTitle}_`) || (lower.includes(safeArtist) && lower.includes(` - ${safeTitle}_`)));
        if (matchesId || matchesName) {
          try {
            fs.unlinkSync(path.join(processedDir, f));
            console.log(`[delete-track-cache] Deleted disk file: ${f}`);
          } catch (_) {}
        }
      }
    }
    return { success: true };
  } catch (err) {
    console.error('[delete-track-cache] error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-cached-library', async () => {
  return getCachedLibrarySongs();
});

ipcMain.handle('get-cached-playlists', async () => {
  return getCachedPlaylists();
});

ipcMain.handle('get-cached-ipod-tracks', async () => {
  return getCachedIpodTracks();
});

ipcMain.handle('login-apple-music', async () => {
  return new Promise((resolve) => {
    let capturedBearer = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiIsImtpZCI6IldlYlBsYXlLaWQifQ.eyJpc3MiOiJBTVBXZWJQbGF5IiwiaWF0IjoxNzg2NjMyOTI0LCJleHAiOjE3OTI2ODA5MjQsInJvb3RfaHR0cHNfb3JpZ2luIjpbImFwcGxlLmNvbSJdfQ.hBgj61sZf-y7bmuvT-joXAUAcf7TVJ51732xnH5vFkLHOmsQHxVqGMYUuI4h8c0-RX3fRY3moylhLW8fewFJyw';
    let capturedUserToken = '';
    let isSaved = false;
    let pollInterval = null;

    const authWin = new BrowserWindow({
      width: 960,
      height: 720,
      parent: mainWindow,
      modal: true,
      title: 'Sign in to Apple Music',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:apple_music_auth'
      }
    });

    authWin.setMenuBarVisibility(false);

    const checkAndSave = async () => {
      if (capturedBearer && capturedUserToken && !isSaved) {
        isSaved = true;
        if (pollInterval) clearInterval(pollInterval);
        
        process.env.APPLE_MUSIC_BEARER_TOKEN = capturedBearer;
        process.env.APPLE_MUSIC_USER_TOKEN = capturedUserToken;
        
        try {
          const envPath = path.join(app.getAppPath(), '.env');
          const envContent = `APPLE_MUSIC_BEARER_TOKEN="${capturedBearer}"\nAPPLE_MUSIC_USER_TOKEN="${capturedUserToken}"\n`;
          await fsPromises.writeFile(envPath, envContent, 'utf-8');
          console.log('[Apple Music] Automatically captured & saved fresh tokens to .env!');
        } catch (e) {
          console.error('[Apple Music] Failed to write .env:', e);
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tokens-updated', {
            bearerToken: capturedBearer,
            userToken: capturedUserToken
          });
        }

        setTimeout(async () => {
          if (!authWin.isDestroyed()) {
            authWin.close();
          }
          await persistSession({ bearerToken: capturedBearer, userToken: capturedUserToken });
          await flushCookiesToDisk();
          resolve({ success: true, bearerToken: capturedBearer, userToken: capturedUserToken });
        }, 1200);
      }
    };

    const checkCookies = async () => {
      try {
        const cookies = await authWin.webContents.session.cookies.get({});
        for (const c of cookies) {
          if (c.name === 'media-user-token' || c.name === 'music-user-token') {
            if (c.value && c.value.length > 20) {
              capturedUserToken = c.value;
              await checkAndSave();
              return;
            }
          }
        }
      } catch (_) {}
    };

    authWin.webContents.session.webRequest.onSendHeaders({ urls: ['*://*/*'] }, (details) => {
      try {
        const headers = details.requestHeaders || {};
        for (const [key, val] of Object.entries(headers)) {
          const lower = key.toLowerCase();
          if (lower === 'authorization' && typeof val === 'string' && val.startsWith('Bearer ')) {
            const token = val.replace(/^Bearer\s+/i, '').trim();
            if (token.length > 50) {
              capturedBearer = token;
            }
          }
          if ((lower === 'music-user-token' || lower === 'media-user-token') && typeof val === 'string' && val.length > 20) {
            capturedUserToken = val;
          }
        }
        checkAndSave();
      } catch (_) {}
    });

    authWin.webContents.on('did-finish-load', checkCookies);
    authWin.webContents.on('did-navigate', checkCookies);

    // Poll cookies every 1 second while window is open
    pollInterval = setInterval(checkCookies, 1000);

    authWin.on('closed', () => {
      if (pollInterval) clearInterval(pollInterval);
      if (!isSaved) {
        resolve({ success: false, reason: 'cancelled' });
      }
    });

    authWin.loadURL('https://music.apple.com');
  });
});

ipcMain.handle('logout-apple-music', async () => {
  process.env.APPLE_MUSIC_USER_TOKEN = '';
  try {
    const envPath = path.join(app.getAppPath(), '.env');
    let envContent = '';
    if (process.env.APPLE_MUSIC_BEARER_TOKEN) {
      envContent = `APPLE_MUSIC_BEARER_TOKEN="${process.env.APPLE_MUSIC_BEARER_TOKEN}"\nAPPLE_MUSIC_USER_TOKEN=""\n`;
    }
    await fsPromises.writeFile(envPath, envContent, 'utf-8');
    console.log('[Apple Music] User token cleared from .env');
  } catch (e) {
    console.error('Failed to clear .env tokens:', e);
  }

  try {
    const ses = session.fromPartition('persist:apple_music_auth');
    if (ses) {
      await ses.clearStorageData();
    }
  } catch (e) {
    console.error('Failed to clear session cookies:', e);
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tokens-updated', {
      bearerToken: process.env.APPLE_MUSIC_BEARER_TOKEN || '',
      userToken: ''
    });
  }

  return { success: true };
});


ipcMain.handle('save-session', async (event, sessionData) => {
  try {
    if (sessionData.bearerToken) process.env.APPLE_MUSIC_BEARER_TOKEN = sessionData.bearerToken;
    if (sessionData.userToken) process.env.APPLE_MUSIC_USER_TOKEN = sessionData.userToken;
    await persistSession(sessionData);
    return { success: true };
  } catch (err) {
    console.error('save-session error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-session', async () => {
  try {
    const saved = await retrieveSession();
    return saved || {};
  } catch (err) {
    console.error('get-session error:', err);
    return {};
  }
});

ipcMain.handle('clear-session', async () => {
  try {
    await clearPersistedSession();
    return { success: true };
  } catch (err) {
    console.error('clear-session error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('flush-session', async () => {
  await flushCookiesToDisk();
  return { success: true };
});

ipcMain.handle('save-tokens', async (event, { bearerToken, userToken }) => {
  process.env.APPLE_MUSIC_BEARER_TOKEN = bearerToken;
  process.env.APPLE_MUSIC_USER_TOKEN = userToken;
  console.log('[Apple Music] Tokens updated dynamically in process.env!');
  
  // Write to c:\Projects\PodSync\.env dynamically so they are saved
  try {
    const envPath = path.join(app.getAppPath(), '.env');
    const envContent = `APPLE_MUSIC_BEARER_TOKEN="${bearerToken}"\nAPPLE_MUSIC_USER_TOKEN="${userToken}"\n`;
    await fsPromises.writeFile(envPath, envContent, 'utf-8');
    console.log('[Apple Music] Tokens saved to .env successfully!');
  } catch (error) {
    console.error('Failed to write .env file:', error);
  }
  
  return true;
});

ipcMain.handle('get-tokens', async () => {
  return {
    bearerToken: process.env.APPLE_MUSIC_BEARER_TOKEN || '',
    userToken: process.env.APPLE_MUSIC_USER_TOKEN || ''
  };
});

// Active device polling watcher to notify renderer of connect / disconnect events
let lastDeviceConnected = null;
let isPollingDevice = false;
setInterval(async () => {
  if (!mainWindow || mainWindow.isDestroyed() || isPollingDevice) return;
  isPollingDevice = true;
  try {
    const drive = await findIpodDrive();
    const isConnected = !!drive;
    if (isConnected !== lastDeviceConnected) {
      lastDeviceConnected = isConnected;
      const payload = isConnected 
        ? { 
            connected: true, 
            model: drive.model || drive.description || 'iPod nano (4th generation)', 
            modelId: drive.modelId || 'nano4',
            modelNum: drive.modelNum || '',
            firmware: drive.firmware || 'v1.1.3',
            path: drive.path, 
            firewireId: getFirewireID(drive.path),
            serialNumber: drive.serialNumber,
            serialInfo: drive.serialInfo,
            customName: drive.customName,
            fileSystem: drive.fileSystem,
            busType: drive.busType
          }
        : { connected: false };
      mainWindow.webContents.send('device-status', payload);
    }
  } catch (_) {}
  finally {
    isPollingDevice = false;
  }
}, 3500);

ipcMain.handle('scan-device', async () => {
  const drive = await findIpodDrive();
  if (drive) {
    const firewireId = getFirewireID(drive.path);
    lastDeviceConnected = true;
    return { 
      connected: true, 
      model: drive.model || drive.description || 'iPod nano (4th generation)', 
      modelId: drive.modelId || 'nano4',
      modelNum: drive.modelNum || 'MB754',
      firmware: drive.firmware || 'v1.0.4',
      path: drive.path, 
      firewireId,
      serialNumber: drive.serialNumber || 'YM8414QA2ME',
      serialInfo: drive.serialInfo || null,
      customName: drive.customName || 'iPod Baknur',
      fileSystem: drive.fileSystem || 'FAT32 (Windows)',
      busType: drive.busType || 'USB'
    };
  }
  lastDeviceConnected = false;
  return { connected: false };
});

ipcMain.handle('set-device-name', async (event, newName) => {
  if (!newName || typeof newName !== 'string') return { success: false, message: 'Invalid name' };
  const drive = await findIpodDrive();
  if (!drive) return { success: false, message: 'iPod not connected' };
  const ok = setCustomDeviceName(drive.controlPath, newName);
  return { success: ok, name: newName };
});

ipcMain.handle('get-device-storage', async () => {
  const drive = await findIpodDrive();
  if (!drive) {
    return { total: 0, free: 0, used: 0, audioBytes: 0, artworkBytes: 0, databaseBytes: 0, otherBytes: 0, percent: 0 };
  }
  
  try {
    const stats = await fsPromises.statfs(drive.path);
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bfree;
    const used = Math.max(0, total - free);

    // 1. Audio files in iPod_Control/Music
    let audioBytes = 0;
    try {
      const musicPath = path.join(drive.path, 'iPod_Control', 'Music');
      if (fs.existsSync(musicPath)) {
        const folders = fs.readdirSync(musicPath).filter(f => f.match(/^F\d{2}$/i));
        for (const folder of folders) {
          const folderPath = path.join(musicPath, folder);
          const files = fs.readdirSync(folderPath);
          for (const f of files) {
            try {
              const fileStat = fs.statSync(path.join(folderPath, f));
              if (!fileStat.isDirectory()) audioBytes += fileStat.size;
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    // 2. Artwork database in iPod_Control/Artwork
    let artworkBytes = 0;
    try {
      const artworkPath = path.join(drive.path, 'iPod_Control', 'Artwork');
      if (fs.existsSync(artworkPath)) {
        const artFiles = fs.readdirSync(artworkPath);
        for (const f of artFiles) {
          try {
            const st = fs.statSync(path.join(artworkPath, f));
            if (!st.isDirectory()) artworkBytes += st.size;
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 3. iTunesDB & indexes in iPod_Control/iTunes
    let databaseBytes = 0;
    try {
      const itunesPath = path.join(drive.path, 'iPod_Control', 'iTunes');
      if (fs.existsSync(itunesPath)) {
        const dbFiles = fs.readdirSync(itunesPath);
        for (const f of dbFiles) {
          try {
            const st = fs.statSync(path.join(itunesPath, f));
            if (!st.isDirectory()) databaseBytes += st.size;
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 4. Other user files / flash disk usage
    const otherBytes = Math.max(0, used - audioBytes - artworkBytes - databaseBytes);

    return {
      total,
      free,
      used,
      audioBytes,
      artworkBytes,
      databaseBytes,
      otherBytes,
      percent: total > 0 ? Math.round((used / total) * 100) : 0
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return { total: 0, free: 0, used: 0, audioBytes: 0, artworkBytes: 0, databaseBytes: 0, otherBytes: 0, percent: 0 };
  }
});

ipcMain.handle('get-tracks', async () => {
  return getAllTracks();
});

ipcMain.handle('get-playlists', async (event, options = {}) => {
  const forceFresh = typeof options === 'boolean' ? options : !!options?.forceFresh;
  const cached = getCachedPlaylists();

  if (forceFresh || !cached || cached.length === 0) {
    try {
      const { fetchUserPlaylists } = await import('./modules/apple-music.js');
      const fresh = await fetchUserPlaylists();
      if (Array.isArray(fresh)) {
        savePlaylistsCache(fresh);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('playlists-updated', fresh);
        }
        return fresh;
      }
    } catch (e) {
      console.warn('[Apple Music] Fresh playlists fetch error:', e.message);
    }
    return cached || [];
  }

  // 2. Fetch fresh from Apple Music in background
  import('./modules/apple-music.js').then(async ({ fetchUserPlaylists }) => {
    try {
      const fresh = await fetchUserPlaylists();
      if (Array.isArray(fresh)) {
        savePlaylistsCache(fresh);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('playlists-updated', fresh);
        }
      }
    } catch (e) {
      console.warn('[Apple Music] Background playlists fetch failed:', e.message);
    }
  }).catch(() => {});

  return cached;
});

ipcMain.handle('get-library-songs', async (event, options = {}) => {
  const forceFresh = typeof options === 'boolean' ? options : !!options?.forceFresh;
  const cached = getCachedLibrarySongs();

  if (forceFresh || !cached || cached.length === 0) {
    try {
      const { fetchUserLibrarySongs } = await import('./modules/apple-music.js');
      const fresh = await fetchUserLibrarySongs();
      if (Array.isArray(fresh)) {
        saveLibrarySongsCache(fresh);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library-songs-updated', fresh);
        }
        return fresh;
      }
    } catch (e) {
      console.warn('[Apple Music] Fresh songs fetch error:', e.message);
    }
    return cached || [];
  }

  // 2. Fetch fresh from Apple Music in background
  import('./modules/apple-music.js').then(async ({ fetchUserLibrarySongs }) => {
    try {
      const fresh = await fetchUserLibrarySongs();
      if (Array.isArray(fresh)) {
        saveLibrarySongsCache(fresh);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library-songs-updated', fresh);
        }
      }
    } catch (e) {
      console.warn('[Apple Music] Background songs fetch failed:', e.message);
    }
  }).catch(() => {});

  return cached;
});

ipcMain.handle('refresh-library', async (event, force = true) => {
  try {
    const { fetchUserPlaylists, fetchUserLibrarySongs } = await import('./modules/apple-music.js');
    const [playlistsRes, songsRes] = await Promise.allSettled([
      fetchUserPlaylists(),
      fetchUserLibrarySongs()
    ]);

    const playlists = playlistsRes.status === 'fulfilled' && Array.isArray(playlistsRes.value) ? playlistsRes.value : [];
    const songs = songsRes.status === 'fulfilled' && Array.isArray(songsRes.value) ? songsRes.value : [];

    if (playlistsRes.status === 'fulfilled' && Array.isArray(playlistsRes.value)) {
      savePlaylistsCache(playlists);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('playlists-updated', playlists);
      }
    }
    if (songsRes.status === 'fulfilled' && Array.isArray(songsRes.value)) {
      saveLibrarySongsCache(songs);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('library-songs-updated', songs);
      }
    }

    return { playlists, songs };
  } catch (err) {
    console.error('[Apple Music] refresh-library error:', err);
    return { playlists: getCachedPlaylists(), songs: getCachedLibrarySongs() };
  }
});

ipcMain.handle('get-playlist-tracks', async (event, playlistId) => {
  const { fetchPlaylistTracks } = await import('./modules/apple-music.js');
  return await fetchPlaylistTracks(playlistId);
});

ipcMain.handle('get-track-preview', async (event, track) => {
  const { getTrackPreviewUrl } = await import('./modules/apple-music.js');
  return await getTrackPreviewUrl(track);
});

ipcMain.handle('get-full-track-stream', async (event, track) => {
  const { getFullAudioStream } = await import('./modules/downloader.js');
  return await getFullAudioStream(track);
});

ipcMain.handle('get-ipod-tracks', async () => {
  const drive = await findIpodDrive();
  if (!drive) return getCachedIpodTracks();
  
  const { IPodScanner } = await import('./modules/ipod-scanner.js');
  const scanner = new IPodScanner(drive.path);
  const tracks = await scanner.scan();
  if (Array.isArray(tracks) && tracks.length > 0) {
    saveIpodTracksCache(tracks);
  }
  return tracks;
});

// Fast track count: just counts files in Fxx dirs WITHOUT parsing metadata
ipcMain.handle('get-ipod-track-count', async () => {
  const drive = await findIpodDrive();
  if (!drive) return 0;
  
  try {
    const musicPath = path.join(drive.path, 'iPod_Control', 'Music');
    if (!fs.existsSync(musicPath)) return 0;
    
    let count = 0;
    const folders = fs.readdirSync(musicPath).filter(f => f.match(/^F\d{2}$/));
    for (const folder of folders) {
      const folderPath = path.join(musicPath, folder);
      const files = fs.readdirSync(folderPath);
      count += files.filter(f => {
        try { return !fs.statSync(path.join(folderPath, f)).isDirectory(); } catch (_) { return false; }
      }).length;
    }
    return count;
  } catch (error) {
    console.error('Failed to count iPod tracks:', error);
    return 0;
  }
});

// Search YouTube for track candidates
ipcMain.handle('search-youtube', async (event, query) => {
  const { searchTrack } = await import('./modules/downloader.js');
  return await searchTrack(query);
});

// yt-dlp binary status check
ipcMain.handle('check-ytdlp-status', async () => {
  const { checkYtDlpStatus } = await import('./modules/downloader.js');
  return checkYtDlpStatus();
});

// Download yt-dlp binary from GitHub with progress events
ipcMain.handle('download-ytdlp', async () => {
  const { downloadYtDlp } = await import('./modules/downloader.js');
  try {
    await downloadYtDlp((progress) => {
      mainWindow.webContents.send('ytdlp-download-progress', progress);
    });
    mainWindow.webContents.send('ytdlp-download-progress', 100);
    return { success: true };
  } catch (error) {
    console.error('Failed to download yt-dlp:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-playlist', async (event, tracks, options) => {
  const opts = typeof options === 'string' ? { mode: options } : (options || {});
  
  // Exclusively sync via iTunes library auto-ingestion & automation
  const { performITunesSync } = await import('./modules/itunes-sync.js');
  return performITunesSync(tracks, opts, (progress) => {
    mainWindow.webContents.send('sync-status', progress);
  });
});

ipcMain.handle('get-ipod-playlists', async () => {
  const drive = await findIpodDrive();
  if (!drive) return [];
  
  const { IPodScanner } = await import('./modules/ipod-scanner.js');
  const scanner = new IPodScanner(drive.path);
  return await scanner.scanPlaylists();
});

// iPod Backup & Export Service Handlers
ipcMain.handle('select-export-folder', async () => {
  const { selectExportDestination } = await import('./modules/ipod-export.js');
  return await selectExportDestination(mainWindow);
});

ipcMain.handle('get-default-export-folder', async () => {
  const { getDefaultExportFolder } = await import('./modules/ipod-export.js');
  return getDefaultExportFolder();
});

ipcMain.handle('start-ipod-export', async (event, destinationPath, options) => {
  const drive = await findIpodDrive();
  if (!drive) {
    return { success: false, error: 'iPod not connected' };
  }
  const { exportIpodTracks } = await import('./modules/ipod-export.js');
  return await exportIpodTracks(drive.path, destinationPath, options, (progress) => {
    mainWindow.webContents.send('ipod-export-progress', progress);
  });
});

ipcMain.handle('cancel-ipod-export', async () => {
  const { cancelExport } = await import('./modules/ipod-export.js');
  cancelExport();
  return { success: true };
});

ipcMain.handle('sync-track', async (event, track) => {
  try {
    // 0. Cache check: Check database & local processed disk files first!
    const isForceRefresh = Boolean(track.force_refresh || track.re_download || track.force);

    if (isForceRefresh) {
      console.log(`[sync-track] Force re-download requested for: "${track.title}" - wiping old cache`);
      deleteTrackCache(track);
      const processedDir = path.join(app.getPath('userData'), 'processed');
      if (fs.existsSync(processedDir)) {
        try {
          const files = fs.readdirSync(processedDir);
          const cleanId = String(track.id || '').replace(/[\\/:*?"<>|]/g, '_').toLowerCase();
          const safeTitle = (track.title || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();
          const safeArtist = (track.artist || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();
          for (const f of files) {
            const lower = f.toLowerCase();
            const matchesId = cleanId && cleanId.length > 3 && lower.includes(`_${cleanId}.m4a`);
            const matchesName = safeArtist && safeTitle && (lower.startsWith(`${safeArtist} - ${safeTitle}_`) || (lower.includes(safeArtist) && lower.includes(` - ${safeTitle}_`)));
            if (matchesId || matchesName) {
              try { fs.unlinkSync(path.join(processedDir, f)); } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }

    if (!track.custom_youtube_id && !isForceRefresh) {
      const cached = await getTrackById(track.id);
      if (cached && cached.status === 'converted' && cached.local_path) {
        try {
          await fsPromises.access(cached.local_path);
          const baseName = path.basename(cached.local_path).toLowerCase();
          const cleanId = String(track.id || '').replace(/[\\/:*?"<>|]/g, '_').toLowerCase();
          const safeArtist = (track.artist || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();
          const safeTitle = (track.title || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();
          
          const matchesId = cleanId && cleanId.length > 3 && baseName.includes(`_${cleanId}.m4a`);
          const matchesName = safeArtist && safeTitle && (baseName.startsWith(`${safeArtist} - ${safeTitle}_`) || (baseName.includes(safeArtist) && baseName.includes(` - ${safeTitle}_`)));
          
          if (matchesId || matchesName) {
            console.log(`[sync-track] Cache HIT (DB) for: "${track.title}" by ${track.artist}`);
            let finalLyrics = cached.lyrics || track.lyrics || '';
            if (!finalLyrics) {
              try {
                const { getTrackLyrics } = await import('./modules/lyrics-service.js');
                finalLyrics = await getTrackLyrics(track);
                if (finalLyrics) {
                  upsertTrack({ ...track, local_path: cached.local_path, status: 'converted', lyrics: finalLyrics });
                }
              } catch (_) {}
            }
            return { success: true, cached: true, ...track, local_path: cached.local_path, path: cached.local_path, lyrics: finalLyrics || '' };
          } else {
            console.warn(`[sync-track] Discarding invalid DB cache entry for "${track.title}" pointing to mismatch file: ${cached.local_path}`);
            deleteTrackCache(track);
          }
        } catch (_) {}
      }

      // Check on disk in processed directory by unique ID or exact artist + title
      try {
        const processedDir = path.join(app.getPath('userData'), 'processed');
        if (fs.existsSync(processedDir)) {
          const files = fs.readdirSync(processedDir);
          const cleanId = String(track.id || '').replace(/[\\/:*?"<>|]/g, '_').toLowerCase();
          const safeTitle = (track.title || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();
          const safeArtist = (track.artist || '').toLowerCase().replace(/[\\/:*?"<>|]/g, '_').trim();
          const matched = files.find(f => {
            const lower = f.toLowerCase();
            if (cleanId && cleanId.length > 3 && lower.includes(`_${cleanId}.m4a`)) return true;
            if (safeArtist && safeTitle && (lower.startsWith(`${safeArtist} - ${safeTitle}_`) || (lower.includes(safeArtist) && lower.includes(` - ${safeTitle}_`)))) return true;
            return false;
          });
          if (matched) {
            const fullP = path.join(processedDir, matched);
            console.log(`[sync-track] Cache HIT (Disk file) for: "${track.title}" -> ${fullP}`);
            let finalLyrics = track.lyrics || '';
            if (!finalLyrics) {
              try {
                const { getTrackLyrics } = await import('./modules/lyrics-service.js');
                finalLyrics = await getTrackLyrics(track);
              } catch (_) {}
            }
            upsertTrack({ ...track, local_path: fullP, status: 'converted', lyrics: finalLyrics || '' });
            return { success: true, cached: true, ...track, local_path: fullP, path: fullP, lyrics: finalLyrics || '' };
          }
        }
      } catch (_) {}
    } else {
      console.log(`[sync-track] Cache BYPASS: User selected custom YouTube ID (${track.custom_youtube_id})`);
    }

    // Dynamically import helpers to avoid startup dependencies
    const { findCandidateList, findBestMatch } = await import('./modules/matching-engine.js');
    const { downloadTrack } = await import('./modules/downloader.js');
    const { convertToAAC } = await import('./modules/converter.js');
    const { getTrackLyrics } = await import('./modules/lyrics-service.js');

    // Fetch lyrics if not already provided
    if (!track.lyrics) {
      try {
        const fetchedLyrics = await getTrackLyrics(track);
        if (fetchedLyrics) {
          track.lyrics = fetchedLyrics;
        }
      } catch (lyrErr) {
        console.warn(`[sync-track] Lyrics fetch error for "${track.title}":`, lyrErr.message);
      }
    }

    console.log(`[sync-track] Starting sync for track: "${track.title}" by ${track.artist}`);

    mainWindow.webContents.send(`progress-${track.id}`, { percent: 0, stage: 'matching' });

    let candidates = [];
    if (track.custom_youtube_id) {
      candidates = [{ id: track.custom_youtube_id, title: track.title, score: 100 }];
    } else {
      candidates = await findCandidateList(track);
    }

    if (!candidates || candidates.length === 0) {
      throw new Error(`No YouTube matches found for "${track.title}"`);
    }

    // Attempt candidates in rank order (auto-fallback if one candidate fails)
    let lastError = null;
    for (let cIdx = 0; cIdx < Math.min(candidates.length, 3); cIdx++) {
      const match = candidates[cIdx];
      try {
        console.log(`[sync-track] Attempting candidate #${cIdx + 1}: "${match.title}" (ID: ${match.id})`);
        mainWindow.webContents.send(`progress-${track.id}`, { percent: 5, stage: 'downloading', candidate: match.title });

        // 1. Download
        const downloadPath = await downloadTrack(match.id, track.id, (progress) => {
          const p = typeof progress === 'number' ? progress : (progress?.percent || 0);
          mainWindow.webContents.send(`progress-${track.id}`, { 
            percent: Math.min(95, Math.round(p)), 
            stage: p >= 100 ? 'converting' : 'downloading' 
          });
        });

        // 2. Convert & embed tags (including lyrics)
        mainWindow.webContents.send(`progress-${track.id}`, { percent: 96, stage: 'converting' });
        const finalPath = await convertToAAC(downloadPath, track);
        console.log(`[sync-track] Successfully converted and tagged: ${finalPath}`);
        mainWindow.webContents.send(`progress-${track.id}`, { percent: 100, stage: 'completed' });

        // 3. Update DB
        upsertTrack({ ...track, youtube_id: match.id, local_path: finalPath, status: 'converted', lyrics: track.lyrics || '' });
        
        return { success: true, cached: false, ...track, youtube_id: match.id, local_path: finalPath, path: finalPath, lyrics: track.lyrics || '' };
      } catch (candErr) {
        lastError = candErr;
        console.warn(`[sync-track] Candidate #${cIdx + 1} (${match.id}) failed: ${candErr.message}. Trying next candidate...`);
      }
    }

    throw lastError || new Error(`Failed to download "${track.title}" across all top candidates.`);
  } catch (error) {
    console.error('[sync-track] Sync error:', error.message || error);
    mainWindow.webContents.send(`progress-${track.id}`, { percent: 0, stage: 'error', error: error.message });
    return { success: false, error: error.message || String(error) };
  }
});

ipcMain.handle('get-lyrics', async (event, track) => {
  try {
    const { getTrackLyrics } = await import('./modules/lyrics-service.js');
    return await getTrackLyrics(track);
  } catch (err) {
    console.error('[IPC] get-lyrics error:', err);
    return '';
  }
});
