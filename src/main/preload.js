const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    scanDevice: () => ipcRenderer.invoke('scan-device'),
    getDeviceStorage: () => ipcRenderer.invoke('get-device-storage'),
    getTracks: () => ipcRenderer.invoke('get-tracks'),
    getIpodTracks: () => ipcRenderer.invoke('get-ipod-tracks'),
    getIpodTrackCount: () => ipcRenderer.invoke('get-ipod-track-count'),
    getIpodPlaylists: () => ipcRenderer.invoke('get-ipod-playlists'),
    getPlaylists: (options) => ipcRenderer.invoke('get-playlists', options),
    getLibrarySongs: (options) => ipcRenderer.invoke('get-library-songs', options),
    refreshLibrary: (force) => ipcRenderer.invoke('refresh-library', force),
    getPlaylistTracks: (playlistId) => ipcRenderer.invoke('get-playlist-tracks', playlistId),
    getTrackPreview: (track) => ipcRenderer.invoke('get-track-preview', track),
    getFullAudioStream: (track) => ipcRenderer.invoke('get-full-track-stream', track),
    getCachedLibrary: () => ipcRenderer.invoke('get-cached-library'),
    getCachedPlaylists: () => ipcRenderer.invoke('get-cached-playlists'),
    getCachedIpodTracks: () => ipcRenderer.invoke('get-cached-ipod-tracks'),
    clearCache: () => ipcRenderer.invoke('clear-cache'),
    deleteTrackCache: (track) => ipcRenderer.invoke('delete-track-cache', track),
    ejectIpod: () => ipcRenderer.invoke('eject-ipod'),
    setDeviceName: (name) => ipcRenderer.invoke('set-device-name', name),
    syncTrack: (track) => ipcRenderer.invoke('sync-track', track),
    syncPlaylist: (newTracks, options) => ipcRenderer.invoke('sync-playlist', newTracks, options),
    openExplorer: () => ipcRenderer.invoke('open-explorer'),
    saveTokens: (tokens) => ipcRenderer.invoke('save-tokens', tokens),
    saveSession: (sessionData) => ipcRenderer.invoke('save-session', sessionData),
    getSession: () => ipcRenderer.invoke('get-session'),
    clearSession: () => ipcRenderer.invoke('clear-session'),
    flushSession: () => ipcRenderer.invoke('flush-session'),
    getTokens: () => ipcRenderer.invoke('get-tokens'),
    checkYtDlpStatus: () => ipcRenderer.invoke('check-ytdlp-status'),
    downloadYtDlp: () => ipcRenderer.invoke('download-ytdlp'),
    searchYoutube: (query) => ipcRenderer.invoke('search-youtube', query),
    loginAppleMusic: () => ipcRenderer.invoke('login-apple-music'),
    logoutAppleMusic: () => ipcRenderer.invoke('logout-apple-music'),
    onDeviceStatus: (callback) => {
        const listener = (event, status) => callback(status);
        ipcRenderer.on('device-status', listener);
        return () => ipcRenderer.removeListener('device-status', listener);
    },
    onTokensUpdated: (callback) => {
        const listener = (event, tokens) => callback(tokens);
        ipcRenderer.on('tokens-updated', listener);
        return () => ipcRenderer.removeListener('tokens-updated', listener);
    },
    onLibraryUpdated: (callback) => {
        const listener = (event, songs) => callback(songs);
        ipcRenderer.on('library-songs-updated', listener);
        return () => ipcRenderer.removeListener('library-songs-updated', listener);
    },
    onPlaylistsUpdated: (callback) => {
        const listener = (event, playlists) => callback(playlists);
        ipcRenderer.on('playlists-updated', listener);
        return () => ipcRenderer.removeListener('playlists-updated', listener);
    },
    onProgress: (trackId, callback) => {
        const listener = (event, progress) => callback(progress);
        ipcRenderer.on(`progress-${trackId}`, listener);
        return () => ipcRenderer.removeListener(`progress-${trackId}`, listener);
    },
    onSyncStatus: (callback) => {
        const listener = (event, status) => callback(status);
        ipcRenderer.on('sync-status', listener);
        return () => ipcRenderer.removeListener('sync-status', listener);
    },
    onYtDlpProgress: (callback) => {
        const listener = (event, progress) => callback(progress);
        ipcRenderer.on('ytdlp-download-progress', listener);
        return () => ipcRenderer.removeListener('ytdlp-download-progress', listener);
    },
    openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
    showItemInFolder: (targetPath) => ipcRenderer.invoke('show-item-in-folder', targetPath),
    getLyrics: (track) => ipcRenderer.invoke('get-lyrics', track),
    selectExportFolder: () => ipcRenderer.invoke('select-export-folder'),
    getDefaultExportFolder: () => ipcRenderer.invoke('get-default-export-folder'),
    startIpodExport: (destinationPath, options) => ipcRenderer.invoke('start-ipod-export', destinationPath, options),
    cancelIpodExport: () => ipcRenderer.invoke('cancel-ipod-export'),
    onExportProgress: (callback) => {
        const listener = (event, progress) => callback(progress);
        ipcRenderer.on('ipod-export-progress', listener);
        return () => ipcRenderer.removeListener('ipod-export-progress', listener);
    }
});

