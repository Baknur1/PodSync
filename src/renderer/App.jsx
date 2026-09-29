import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Music,
  ListMusic,
  FolderSync,
  Search,
  Settings,
  Settings as SettingsIcon,
  HardDrive,
  Layers,
  Sparkles,
  Plus,
  Check,
  Trash2,
  RefreshCw,
  ExternalLink,
  Disc,
  Sliders,
  X,
  Minimize2,
  Maximize2,
  CheckCircle2,
  Folder,
  FolderDown,
  FolderOpen,
  UploadCloud,
  Usb,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Download,
  Loader2,
  AlertCircle,
  Zap,
  Star,
  MoreHorizontal,
  Volume1,
  Heart,
  User,
  LogIn,
  LogOut,
  Globe,
  Copy,
  Edit3,
  Cpu,
  Factory,
  Calendar,
  ShieldCheck,
  Mic2,
  Quote,
  FileText,
  Info,
  CheckSquare,
  Square,
  Settings2,
  ArrowRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from './i18n';

// Helper formatting and normalization functions
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const formatTotalDuration = (tracks, lang = 'en') => {
  if (!Array.isArray(tracks) || tracks.length === 0) return '';
  let totalSecs = 0;
  for (const t of tracks) {
    if (!t) continue;
    let sec = 0;
    if (typeof t.duration === 'number' && !isNaN(t.duration)) {
      sec = t.duration;
    } else if (typeof t.durationInMillis === 'number' && !isNaN(t.durationInMillis)) {
      sec = t.durationInMillis / 1000;
    } else if (typeof t.duration === 'string') {
      if (t.duration.includes(':')) {
        const parts = t.duration.split(':');
        sec = parseInt(parts[0], 10) * 60 + parseInt(parts[1] || 0, 10);
      } else {
        sec = parseFloat(t.duration) || 0;
      }
    }
    totalSecs += sec;
  }

  if (totalSecs <= 0) return '';

  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);

  const isRu = lang === 'ru';
  if (hours > 0) {
    if (isRu) return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`;
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  }
  return isRu ? `${Math.max(1, mins)} мин` : `${Math.max(1, mins)} min`;
};

const getSongCount = (count, lang = 'en') => {
  if (lang === 'ru') {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return `${count} песен`;
    if (n1 > 1 && n1 < 5) return `${count} песни`;
    if (n1 === 1) return `${count} песня`;
    return `${count} песен`;
  }
  return count === 1 ? '1 song' : `${count} songs`;
};

const getTrackCount = (count, lang = 'en') => {
  if (lang === 'ru') {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return `${count} треков`;
    if (n1 > 1 && n1 < 5) return `${count} трека`;
    if (n1 === 1) return `${count} трек`;
    return `${count} треков`;
  }
  return count === 1 ? '1 track' : `${count} tracks`;
};

const getPlaylistCount = (count, lang = 'en') => {
  if (lang === 'ru') {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return `${count} плейлистов`;
    if (n1 > 1 && n1 < 5) return `${count} плейлиста`;
    if (n1 === 1) return `${count} плейлист`;
    return `${count} плейлистов`;
  }
  return count === 1 ? '1 playlist' : `${count} playlists`;
};

const getAlbumCount = (count, lang = 'en') => {
  if (lang === 'ru') {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return `${count} альбомов`;
    if (n1 > 1 && n1 < 5) return `${count} альбома`;
    if (n1 === 1) return `${count} альбом`;
    return `${count} альбомов`;
  }
  return count === 1 ? '1 album' : `${count} albums`;
};

const formatBytes = (bytes) => {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

const normalizeTrackStr = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFKD')
    .replace(/ё/g, 'е')
    .replace(/ә/g, 'а')
    .replace(/і/g, 'и')
    .replace(/ң/g, 'н')
    .replace(/ғ/g, 'г')
    .replace(/ү/g, 'у')
    .replace(/ұ/g, 'у')
    .replace(/қ/g, 'к')
    .replace(/ө/g, 'о')
    .replace(/һ/g, 'х')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035'`´ʼ]/g, '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015−]/g, ' ')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"«»?<>|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanTrackString = (str) => {
  if (!str) return '';
  let s = str.toLowerCase().normalize('NFKD');
  s = s
    .replace(/\s*\((feat\.|ft\.|with|при\s+уч\.|prod\.\s+by|produced\s+by)[^)]*\)/gi, '')
    .replace(/\s*\[(feat\.|ft\.|with|при\s+уч\.|prod\.\s+by|produced\s+by)[^\\]]*\]/gi, '')
    .replace(/\s*(feat\.|ft\.|при\s+уч\.).*$/gi, '')
    .replace(/\s*\((remastered|remaster|deluxe|bonus\s+track|explicit|single\s+version|album\s+version|live|acoustic|radio\s+edit|official\s+audio|official\s+video|visualizer|instrumental)[^)]*\)/gi, '')
    .replace(/\s*\[(remastered|remaster|deluxe|bonus\s+track|explicit|single\s+version|album\s+version|live|acoustic|radio\s+edit|official\s+audio|official\s+video|visualizer|instrumental)[^\\]]*\]/gi, '')
    .replace(/ё/g, 'е')
    .replace(/ә/g, 'а')
    .replace(/і/g, 'и')
    .replace(/ң/g, 'н')
    .replace(/ғ/g, 'г')
    .replace(/ү/g, 'у')
    .replace(/ұ/g, 'у')
    .replace(/қ/g, 'к')
    .replace(/ө/g, 'о')
    .replace(/һ/g, 'х')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035'`´ʼ]/g, '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015−]/g, ' ')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"«»?<>|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
};

const getPrimaryArtist = (artistStr) => {
  if (!artistStr) return '';
  const cleaned = cleanTrackString(artistStr);
  const first = cleaned.split(/(?:\s*[,&/x+]\s*|\s+(?:feat|ft|with|при\s+уч)\b)/i)[0];
  return (first || '').trim();
};

const YoutubeIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export default function App() {
  const { t, i18n } = useTranslation();

  // Navigation and active tab state
  const [activeTab, setActiveTab] = useState('apple-songs');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const selectedPlaylistRef = useRef(null);
  useEffect(() => {
    selectedPlaylistRef.current = selectedPlaylist;
  }, [selectedPlaylist]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedIpodPlaylist, setSelectedIpodPlaylist] = useState(null);
  const [albumSearchQuery, setAlbumSearchQuery] = useState('');
  const [albumSortBy, setAlbumSortBy] = useState('recent');
  const [renderedAlbumLimit, setRenderedAlbumLimit] = useState(60);
  const [playlistTracksMap, setPlaylistTracksMap] = useState({});
  const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);
  const [isLoadingIpodTracks, setIsLoadingIpodTracks] = useState(false);
  const [isRefreshingLibrary, setIsRefreshingLibrary] = useState(false);
  const [showAllSidebarPlaylists, setShowAllSidebarPlaylists] = useState(false);

  // Core media library state
  const [librarySongs, setLibrarySongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [ipodTracks, setIpodTracks] = useState([]);
  const [ipodPlaylists, setIpodPlaylists] = useState([]);
  const [syncQueue, setSyncQueue] = useState([]);

  // iPod device and storage state
  const [deviceInfo, setDeviceInfo] = useState({ connected: false, model: 'iPod' });
  const [storageInfo, setStorageInfo] = useState({
    total: 0,
    free: 0,
    used: 0,
    audioBytes: 0,
    artworkBytes: 0,
    databaseBytes: 0,
    otherBytes: 0,
    percent: 0
  });
  const [ipodTrackCount, setIpodTrackCount] = useState(0);
  const [isEditingDeviceName, setIsEditingDeviceName] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [isSavingDeviceName, setIsSavingDeviceName] = useState(false);
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [selectedSyncPlaylistIds, setSelectedSyncPlaylistIds] = useState(new Set());
  const [isClearingCache, setIsClearingCache] = useState(false);

  const displayDeviceName = useMemo(() => {
    if (!deviceInfo.connected) return 'iPod';
    if (deviceInfo.customName) return deviceInfo.customName;
    const m = (deviceInfo.model || '').toLowerCase();
    if (m.includes('nano (4') || m.includes('nano 4') || m.includes('nano (4-го')) {
      return t('ipodNano4Gen', 'iPod nano (4th generation)');
    }
    if (m.includes('classic')) {
      return t('ipodClassic', 'iPod Classic');
    }
    if (!deviceInfo.model || /USB Device|Apple iPod USB|Disk Device/i.test(deviceInfo.model) || deviceInfo.model.trim() === 'Apple iPod') {
      return t('ipodNano4Gen', 'iPod nano (4th generation)');
    }
    return deviceInfo.model;
  }, [deviceInfo, t]);

  const modelDisplaySubtitle = useMemo(() => {
    if (!deviceInfo.connected) return '';
    const m = (deviceInfo.model || '').toLowerCase();
    if (m.includes('nano (4') || m.includes('nano 4') || m.includes('nano (4-го')) {
      return t('ipodNano4Gen', 'iPod nano (4th generation)');
    }
    if (m.includes('classic')) {
      return t('ipodClassic', 'iPod Classic');
    }
    return deviceInfo.model || 'Apple iPod';
  }, [deviceInfo, t]);

  // Song search and multi-selection state
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [selectedTracks, setSelectedTracks] = useState(new Set());

  // Audio playback state
  const audioRef = useRef(null);
  const currentTrackRef = useRef(null);
  const playbackRequestIdRef = useRef(0);
  const isScrubbingRef = useRef(false);
  const lastTimeUpdateRef = useRef(0);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBufferingTrack, setIsBufferingTrack] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const isShuffleRef = useRef(false);
  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);
  const [isRepeat, setIsRepeat] = useState(false);
  const isRepeatRef = useRef(false);
  useEffect(() => {
    isRepeatRef.current = isRepeat;
  }, [isRepeat]);
  const [playMode, setPlayMode] = useState('full'); // '30s' | 'full'
  const playModeRef = useRef('full');
  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  // Playback queue and history
  const [playbackQueue, setPlaybackQueue] = useState([]);
  const playbackQueueRef = useRef([]);
  useEffect(() => {
    playbackQueueRef.current = playbackQueue;
  }, [playbackQueue]);
  const playHistoryRef = useRef([]);

  // Lyrics viewer state
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [lyricsTrack, setLyricsTrack] = useState(null);
  const [lyricsText, setLyricsText] = useState('');
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const [autoFetchLyrics, setAutoFetchLyrics] = useState(() => {
    return localStorage.getItem('podsync_auto_lyrics') !== 'false';
  });

  const loadLyricsForTrack = useCallback(async (track) => {
    if (!track) {
      setLyricsText('');
      setLyricsTrack(null);
      return;
    }
    setLyricsTrack(track);
    setIsLoadingLyrics(true);
    try {
      if (window.electron?.getLyrics) {
        const fetched = await window.electron.getLyrics(track);
        setLyricsText(fetched || '');
      } else {
        setLyricsText('');
      }
    } catch (err) {
      console.warn('[lyrics] Load error:', err);
      setLyricsText('');
    } finally {
      setIsLoadingLyrics(false);
    }
  }, []);

  const openLyrics = useCallback((track = currentTrack) => {
    if (!track) return;
    setIsLyricsOpen(true);
    loadLyricsForTrack(track);
  }, [currentTrack, loadLyricsForTrack]);

  // Auto-fetch lyrics when track changes and viewer is open
  useEffect(() => {
    if (isLyricsOpen && currentTrack && currentTrack.id !== lyricsTrack?.id) {
      loadLyricsForTrack(currentTrack);
    }
  }, [currentTrack, isLyricsOpen, lyricsTrack?.id, loadLyricsForTrack]);

  // Sync configuration and execution state
  const [syncMode, setSyncMode] = useState('additive');
  const [syncTactic, setSyncTactic] = useState('direct');
  const [syncDestination, setSyncDestination] = useState('playlist');
  const [targetPlaylistName, setTargetPlaylistName] = useState('PodSync Queue');
  const [audioQuality, setAudioQuality] = useState('256k');
  const [syncConcurrency, setSyncConcurrency] = useState(8);
  const [editingPlaylistName, setEditingPlaylistName] = useState(null);
  const [tempPlaylistName, setTempPlaylistName] = useState('');
  const [collapsedQueueGroups, setCollapsedQueueGroups] = useState(() => new Set());
  const [queueActiveFilter, setQueueActiveFilter] = useState('all');

  const toggleGroupCollapse = useCallback((groupName) => {
    setCollapsedQueueGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  const toggleAllGroupsCollapse = useCallback((allGroupKeys) => {
    setCollapsedQueueGroups(prev => {
      const areAllCollapsed = allGroupKeys.length > 0 && allGroupKeys.every(k => prev.has(k));
      if (areAllCollapsed) {
        return new Set();
      } else {
        return new Set(allGroupKeys);
      }
    });
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncPhase, setSyncPhase] = useState('idle');
  const [syncStatusText, setSyncStatusText] = useState('');
  const [syncErrorMsg, setSyncErrorMsg] = useState('');
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [isSyncMinimized, setIsSyncMinimized] = useState(false);
  const [syncStep, setSyncStep] = useState(1);
  const [syncStats, setSyncStats] = useState({ total: 0, cached: 0, downloaded: 0, failed: 0, destination: '' });
  const [syncTrackStates, setSyncTrackStates] = useState({});
  const syncCancelledRef = useRef(false);

  // Downloads popover state and click-outside handler
  const [isDownloadsPopoverOpen, setIsDownloadsPopoverOpen] = useState(false);
  const downloadsPopoverRef = useRef(null);
  const downloadsButtonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        downloadsPopoverRef.current &&
        !downloadsPopoverRef.current.contains(e.target) &&
        downloadsButtonRef.current &&
        !downloadsButtonRef.current.contains(e.target)
      ) {
        setIsDownloadsPopoverOpen(false);
      }
    };
    if (isDownloadsPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDownloadsPopoverOpen]);

  // Auto-open downloads popover on sync start
  useEffect(() => {
    if (isSyncing) {
      setIsDownloadsPopoverOpen(true);
    }
  }, [isSyncing]);

  // iPod storage capacity bar hover tooltip
  const [hoveredCapacitySegment, setHoveredCapacitySegment] = useState(null);
  const capacityBarRef = useRef(null);

  const handleCapacityHover = (e, title, value) => {
    if (!capacityBarRef.current) return;
    const rect = capacityBarRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const clampedX = Math.max(50, Math.min(rawX, rect.width - 50));
    setHoveredCapacitySegment({ title, value, x: clampedX });
  };

  const cancelSync = () => {
    syncCancelledRef.current = true;
    setSyncStatusText('Cancelling synchronization...');
  };

  // YouTube search state
  const [ytQuery, setYtQuery] = useState('');
  const [ytResults, setYtResults] = useState([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [ytSearchError, setYtSearchError] = useState('');

  // Apple Music authorization state
  const [isLoggingInApple, setIsLoggingInApple] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [userToken, setUserToken] = useState('');
  const [isApiConnected, setIsApiConnected] = useState(false);

  // Virtualization render limits for smooth scrolling
  const [renderedSongLimit, setRenderedSongLimit] = useState(80);
  const [dbConvertedTracks, setDbConvertedTracks] = useState([]);

  const fetchIpodTracks = useCallback(async () => {
    if (!window.electron?.getIpodTracks) return;
    setIsLoadingIpodTracks(true);
    try {
      const [tracks, pls] = await Promise.all([
        window.electron.getIpodTracks(),
        window.electron.getIpodPlaylists ? window.electron.getIpodPlaylists() : Promise.resolve([])
      ]);
      if (Array.isArray(tracks) && tracks.length > 0) {
        setIpodTracks(tracks);
        setIpodTrackCount(tracks.length);
      }
      if (Array.isArray(pls)) {
        setIpodPlaylists(pls);
      }
    } catch (e) {
      console.warn('[PodSync] iPod track scan error:', e);
    } finally {
      setIsLoadingIpodTracks(false);
    }
  }, []);

  // iPod reverse export state and handlers
  const [exportDestinationFolder, setExportDestinationFolder] = useState('');
  const [isExportingIpod, setIsExportingIpod] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, percent: 0, currentTrack: null, destPath: '' });
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState('');
  const [exportStructure, setExportStructure] = useState('artist_album');
  const [exportSkipExisting, setExportSkipExisting] = useState(true);
  const [exportMode, setExportMode] = useState('all'); // 'all' | 'playlists' | 'selected'
  const [selectedExportTrackIds, setSelectedExportTrackIds] = useState(new Set());
  const [exportSearchQuery, setExportSearchQuery] = useState('');
  const [selectedExportPlaylist, setSelectedExportPlaylist] = useState(null);

  useEffect(() => {
    if (window.electron?.getDefaultExportFolder) {
      window.electron.getDefaultExportFolder().then(folder => {
        if (folder) setExportDestinationFolder(folder);
      }).catch(() => { });
    }

    if (window.electron?.onExportProgress) {
      const unsub = window.electron.onExportProgress((progress) => {
        setExportProgress(progress);
      });
      return () => unsub?.();
    }
  }, []);

  const handleSelectExportFolder = async () => {
    if (!window.electron?.selectExportFolder) return;
    try {
      const selected = await window.electron.selectExportFolder();
      if (selected) {
        setExportDestinationFolder(selected);
      }
    } catch (err) {
      console.error('Folder selection error:', err);
    }
  };

  const handleStartIpodExport = async (overrideTracks = null) => {
    if (!exportDestinationFolder) return;

    let tracksToExport = ipodTracks;
    let selectedTrackIds = null;

    if (overrideTracks && Array.isArray(overrideTracks)) {
      tracksToExport = overrideTracks;
      selectedTrackIds = overrideTracks.map(t => t.id || t.path);
    } else if (exportMode === 'playlists' && selectedExportPlaylist) {
      const plTracks = selectedExportPlaylist.tracks || ipodTracks.filter(t => (t.playlists || []).includes(selectedExportPlaylist.name || selectedExportPlaylist.title));
      tracksToExport = plTracks.length > 0 ? plTracks : ipodTracks;
      selectedTrackIds = tracksToExport.map(t => t.id || t.path);
    } else if (exportMode === 'selected') {
      if (selectedExportTrackIds.size === 0) return;
      selectedTrackIds = Array.from(selectedExportTrackIds);
      tracksToExport = ipodTracks.filter(t => selectedExportTrackIds.has(t.id || t.path));
    }

    const totalCount = tracksToExport.length || ipodTrackCount || 0;
    if (totalCount === 0) return;

    setIsExportingIpod(true);
    setExportResult(null);
    setExportError('');
    setExportProgress({ current: 0, total: totalCount, percent: 0, currentTrack: null, destPath: '' });

    try {
      const options = {
        structure: exportStructure,
        skipExisting: exportSkipExisting,
        selectedTrackIds
      };
      const res = await window.electron.startIpodExport(exportDestinationFolder, options);
      if (res && res.success) {
        setExportResult(res);
      } else if (res && res.error) {
        setExportError(res.error);
      }
    } catch (err) {
      setExportError(err.message || 'Export failed');
    } finally {
      setIsExportingIpod(false);
    }
  };

  const handleCancelIpodExport = async () => {
    if (window.electron?.cancelIpodExport) {
      await window.electron.cancelIpodExport();
    }
    setIsExportingIpod(false);
  };

  const selectIpodPlaylist = (pl) => {
    setSelectedIpodPlaylist(pl);
    setActiveTab('ipod-playlists');
  };

  // iPod library track lookup indexes
  const { ipodTrackKeySet, ipodTitleSet, ipodArtistTitleSet } = useMemo(() => {
    const keySet = new Set();
    const titleSet = new Set();
    const artistTitleSet = new Set();

    for (const t of ipodTracks) {
      if (!t) continue;
      const title = cleanTrackString(t.title || t.name);
      const rawTitle = normalizeTrackStr(t.title || t.name);
      const artist = cleanTrackString(t.artist || t.artistName);
      const rawArtist = normalizeTrackStr(t.artist || t.artistName);
      const primArtist = getPrimaryArtist(t.artist || t.artistName);

      if (title) {
        titleSet.add(title);
        titleSet.add(rawTitle);
        if (artist) {
          keySet.add(`${title}::${artist}`);
          keySet.add(`${rawTitle}::${rawArtist}`);
          keySet.add(`${title}::${rawArtist}`);
          keySet.add(`${rawTitle}::${artist}`);
        }
        if (primArtist) {
          artistTitleSet.add(`${title}::${primArtist}`);
          artistTitleSet.add(`${rawTitle}::${primArtist}`);
        }
      }
    }
    return { ipodTrackKeySet: keySet, ipodTitleSet: titleSet, ipodArtistTitleSet: artistTitleSet };
  }, [ipodTracks]);

  const isTrackOnIpod = useCallback((track) => {
    if (!track) return false;
    const title = cleanTrackString(track.name || track.title);
    const rawTitle = normalizeTrackStr(track.name || track.title);
    const artist = cleanTrackString(track.artistName || track.artist);
    const rawArtist = normalizeTrackStr(track.artistName || track.artist);
    const primArtist = getPrimaryArtist(track.artistName || track.artist);

    if (!title && !rawTitle) return false;

    // 1. Direct match with full artist
    if (artist && (
      ipodTrackKeySet.has(`${title}::${artist}`) ||
      ipodTrackKeySet.has(`${rawTitle}::${rawArtist}`) ||
      ipodTrackKeySet.has(`${title}::${rawArtist}`) ||
      ipodTrackKeySet.has(`${rawTitle}::${artist}`)
    )) {
      return true;
    }

    // 2. Primary artist match (handles multi-artist collabs & featuring variations)
    if (primArtist && (
      ipodArtistTitleSet.has(`${title}::${primArtist}`) ||
      ipodArtistTitleSet.has(`${rawTitle}::${primArtist}`)
    )) {
      return true;
    }

    // 3. Clean title match (for unique tracks)
    if (title && title.length > 2 && ipodTitleSet.has(title)) {
      return true;
    }
    if (rawTitle && rawTitle.length > 2 && ipodTitleSet.has(rawTitle)) {
      return true;
    }

    return false;
  }, [ipodTrackKeySet, ipodTitleSet, ipodArtistTitleSet]);

  const unsyncedLibrarySongs = useMemo(() => {
    return librarySongs.filter(t => !isTrackOnIpod(t));
  }, [librarySongs, isTrackOnIpod]);

  const fetchedPlaylistIdsRef = useRef(new Set());

  // Gently load missing playlist tracks sequentially ONLY when viewing the iPod summary tab
  useEffect(() => {
    if (activeTab !== 'ipod-summary') return;
    if (!Array.isArray(playlists) || playlists.length === 0 || !window.electron?.getPlaylistTracks) return;

    let isMounted = true;
    const missing = playlists.filter(p => !playlistTracksMap[p.id] && !fetchedPlaylistIdsRef.current.has(p.id));
    if (missing.length === 0) return;

    let idx = 0;
    const fetchNext = async () => {
      if (!isMounted || idx >= missing.length) return;
      const pl = missing[idx++];
      fetchedPlaylistIdsRef.current.add(pl.id);
      try {
        const tracks = await window.electron.getPlaylistTracks(pl.id);
        if (isMounted && Array.isArray(tracks)) {
          setPlaylistTracksMap(prev => ({ ...prev, [pl.id]: tracks }));
        }
      } catch (_) { }
      if (isMounted && idx < missing.length) {
        setTimeout(fetchNext, 600);
      }
    };

    fetchNext();

    return () => { isMounted = false; };
  }, [activeTab, playlists, playlistTracksMap]);

  const smartPlaylistsDiff = useMemo(() => {
    return playlists.map(p => {
      const pTracks = playlistTracksMap[p.id] || (Array.isArray(p.tracks) && p.tracks.length > 0 ? p.tracks : []);
      const isLoaded = pTracks.length > 0;

      let unsyncedCount = 0;
      if (isLoaded) {
        unsyncedCount = pTracks.filter(t => !isTrackOnIpod(t)).length;
      }

      return {
        id: p.id,
        name: p.name || p.title,
        trackCount: p.trackCount || pTracks.length || 0,
        unsyncedCount: isLoaded ? unsyncedCount : 0,
        isLoaded
      };
    });
  }, [playlists, playlistTracksMap, isTrackOnIpod]);

  const handleSaveDeviceName = async () => {
    const nameToSave = (deviceNameInput || '').trim();
    if (!nameToSave) return;
    setIsSavingDeviceName(true);
    try {
      if (window.electron?.setDeviceName) {
        const res = await window.electron.setDeviceName(nameToSave);
        if (res?.success) {
          setDeviceInfo(prev => ({ ...prev, customName: nameToSave }));
        }
      }
      setIsEditingDeviceName(false);
    } catch (e) {
      console.error('Failed to set device name:', e);
    } finally {
      setIsSavingDeviceName(false);
    }
  };

  const handleCopySerial = (sn) => {
    if (!sn) return;
    navigator.clipboard.writeText(sn);
    setCopiedSerial(true);
    setTimeout(() => setCopiedSerial(false), 2000);
  };

  const handleSelectAllPlaylists = () => {
    const next = new Set(['all-library']);
    playlists.forEach(p => next.add(p.id));
    setSelectedSyncPlaylistIds(next);
  };

  const handleSelectNewOnly = () => {
    const next = new Set();
    if (unsyncedLibrarySongs.length > 0) next.add('all-library');
    playlists.forEach(p => {
      const pTracks = playlistTracksMap[p.id] || [];
      if (pTracks.length > 0 && pTracks.some(t => !isTrackOnIpod(t))) {
        next.add(p.id);
      } else if (!pTracks.length && (p.trackCount || 0) > 0) {
        next.add(p.id);
      }
    });
    setSelectedSyncPlaylistIds(next);
  };

  const handleDeselectAllPlaylists = () => {
    setSelectedSyncPlaylistIds(new Set());
  };

  const handleStartSmartSync = async () => {
    const tracksToSyncMap = new Map();

    if (selectedSyncPlaylistIds.has('all-library')) {
      unsyncedLibrarySongs.forEach(t => {
        const key = `${t.id || t.name}_${t.artistName}`;
        tracksToSyncMap.set(key, { ...t, quality: audioQuality });
      });
    }

    for (const pId of selectedSyncPlaylistIds) {
      if (pId === 'all-library') continue;
      let pTracks = playlistTracksMap[pId];
      if (!pTracks || pTracks.length === 0) {
        if (window.electron?.getPlaylistTracks) {
          try {
            pTracks = await window.electron.getPlaylistTracks(pId);
            if (Array.isArray(pTracks)) {
              setPlaylistTracksMap(prev => ({ ...prev, [pId]: pTracks }));
            }
          } catch (_) { }
        }
      }
      if (Array.isArray(pTracks)) {
        pTracks.filter(t => !isTrackOnIpod(t)).forEach(t => {
          const key = `${t.id || t.name}_${t.artistName}`;
          tracksToSyncMap.set(key, { ...t, quality: audioQuality });
        });
      }
    }

    const trackList = Array.from(tracksToSyncMap.values());
    if (trackList.length === 0) {
      alert(t('allSelectedSynced', 'All selected playlists are already synced!'));
      return;
    }

    setSyncQueue(trackList);
    setActiveTab('queue');
  };

  // Initial data loading and iPod polling lifecycle
  useEffect(() => {
    const bootstrap = async () => {
      if (!window.electron) return;

      // 1. Instantly read SQLite cached data (0ms delay)
      try {
        const [cachedSongs, cachedPls, cachedIpod, tokens] = await Promise.all([
          window.electron.getCachedLibrary ? window.electron.getCachedLibrary() : Promise.resolve([]),
          window.electron.getCachedPlaylists ? window.electron.getCachedPlaylists() : Promise.resolve([]),
          window.electron.getCachedIpodTracks ? window.electron.getCachedIpodTracks() : Promise.resolve([]),
          window.electron.getTokens ? window.electron.getTokens() : Promise.resolve({ bearerToken: '', userToken: '' })
        ]);

        if (Array.isArray(cachedSongs) && cachedSongs.length > 0) {
          setLibrarySongs(cachedSongs);
        }
        if (Array.isArray(cachedPls) && cachedPls.length > 0) {
          setPlaylists(cachedPls);
          const initialMap = {};
          cachedPls.forEach(p => {
            if (Array.isArray(p.tracks) && p.tracks.length > 0) {
              initialMap[p.id] = p.tracks;
            }
          });
          if (Object.keys(initialMap).length > 0) {
            setPlaylistTracksMap(prev => ({ ...initialMap, ...prev }));
          }
        }
        if (Array.isArray(cachedIpod) && cachedIpod.length > 0) {
          setIpodTracks(cachedIpod);
          setIpodTrackCount(cachedIpod.length);
        }

        if (tokens.bearerToken) setDevToken(tokens.bearerToken);
        if (tokens.userToken) {
          setUserToken(tokens.userToken);
          setIsApiConnected(true);
        }
      } catch (err) {
        console.warn('[PodSync] Instant cache load error:', err);
      }

      // 2. Fetch fresh device & library data
      fetchFreshData();
    };

    bootstrap();

    // Also fetch DB tracks immediately
    if (window.electron?.getTracks) {
      window.electron.getTracks().then(t => {
        if (Array.isArray(t)) setDbConvertedTracks(t);
      }).catch(() => { });
    }

    // Listen for device connect / disconnect events from main process
    let unsubDevice = () => { };
    if (window.electron?.onDeviceStatus) {
      unsubDevice = window.electron.onDeviceStatus((status) => {
        if (status && status.connected) {
          setDeviceInfo(status);
          fetchFreshData();
        } else {
          setDeviceInfo({ connected: false, model: 'iPod' });
          setStorageInfo({ total: 0, free: 0, used: 0, audioBytes: 0, otherBytes: 0, percent: 0 });
          setIpodTrackCount(0);
          setIpodTracks([]);
        }
      });
    }

    // Active polling fallback every 12 seconds
    const pollInterval = setInterval(() => {
      if (window.electron?.scanDevice) {
        window.electron.scanDevice().then(dev => {
          if (dev && dev.connected) {
            setDeviceInfo(prev => (prev.connected === dev.connected && prev.model === dev.model && prev.customName === dev.customName ? prev : dev));
            window.electron.getDeviceStorage().then(st => {
              if (st) {
                setStorageInfo(prev => {
                  if (prev.used === st.used && prev.free === st.free && prev.total === st.total) return prev;
                  return st;
                });
              }
            });
            window.electron.getIpodTrackCount().then(cnt => {
              if (cnt != null) setIpodTrackCount(prev => (prev === cnt ? prev : cnt));
            });
          } else {
            setDeviceInfo(prev => (prev.connected ? { connected: false, model: 'iPod' } : prev));
            setStorageInfo(prev => (prev.total === 0 ? prev : { total: 0, free: 0, used: 0, audioBytes: 0, otherBytes: 0, percent: 0 }));
            setIpodTrackCount(prev => (prev === 0 ? prev : 0));
          }
        }).catch(() => { });
      }
    }, 12000);

    // Listen for background library & playlist updates
    let unsubLib = () => { };
    if (window.electron?.onLibraryUpdated) {
      unsubLib = window.electron.onLibraryUpdated((songs) => {
        if (Array.isArray(songs)) setLibrarySongs(songs);
      });
    }
    let unsubPls = () => { };
    if (window.electron?.onPlaylistsUpdated) {
      unsubPls = window.electron.onPlaylistsUpdated((pls) => {
        if (Array.isArray(pls)) {
          setPlaylists(pls);
          const cur = selectedPlaylistRef.current;
          if (cur) {
            const matching = pls.find(p => p.id === cur.id);
            if (matching) {
              setSelectedPlaylist(matching);
              if (window.electron?.getPlaylistTracks) {
                window.electron.getPlaylistTracks(matching.id).then(tr => {
                  if (Array.isArray(tr)) setPlaylistTracksMap(prev => ({ ...prev, [matching.id]: tr }));
                }).catch(() => { });
              }
            }
          }
        }
      });
    }

    return () => {
      unsubDevice();
      unsubLib();
      unsubPls();
      clearInterval(pollInterval);
    };
  }, []);

  const areItemsEqual = (a, b) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    if (a.length === 0) return true;
    for (let i = 0; i < a.length; i++) {
      if (a[i]?.id !== b[i]?.id) return false;
      if (a[i]?.trackCount !== b[i]?.trackCount) return false;
    }
    return true;
  };

  const fetchFreshData = async (forceFresh = false, silent = false) => {
    if (!window.electron) return;
    if (!silent) setIsRefreshingLibrary(true);
    try {
      const curSelectedPl = selectedPlaylistRef.current;
      const [device, storage, trackCount, freshPlaylists, freshSongs, ipodTracksRes, ipodPls, curPlTracks] = await Promise.allSettled([
        window.electron.scanDevice(),
        window.electron.getDeviceStorage(),
        window.electron.getIpodTrackCount ? window.electron.getIpodTrackCount() : Promise.resolve(0),
        window.electron.getPlaylists({ forceFresh }),
        window.electron.getLibrarySongs({ forceFresh }),
        window.electron.getIpodTracks ? window.electron.getIpodTracks() : Promise.resolve([]),
        window.electron.getIpodPlaylists ? window.electron.getIpodPlaylists() : Promise.resolve([]),
        (curSelectedPl && window.electron.getPlaylistTracks) ? window.electron.getPlaylistTracks(curSelectedPl.id) : Promise.resolve(null)
      ]);

      if (device.status === 'fulfilled' && device.value) {
        setDeviceInfo(prev => (prev.connected === device.value.connected && prev.model === device.value.model ? prev : device.value));
        if (!device.value.connected) {
          setStorageInfo({ total: 0, free: 0, used: 0, audioBytes: 0, otherBytes: 0, percent: 0 });
          setIpodTrackCount(0);
          setIpodTracks([]);
        }
      }
      if (storage.status === 'fulfilled' && storage.value && device.value?.connected) {
        setStorageInfo(prev => (prev.used === storage.value.used && prev.free === storage.value.free ? prev : storage.value));
      }
      if (trackCount.status === 'fulfilled' && trackCount.value != null && device.value?.connected) {
        setIpodTrackCount(prev => (prev === trackCount.value ? prev : trackCount.value));
      }
      if (freshPlaylists.status === 'fulfilled' && Array.isArray(freshPlaylists.value)) {
        setPlaylists(prev => (forceFresh ? freshPlaylists.value : (areItemsEqual(prev, freshPlaylists.value) ? prev : freshPlaylists.value)));
        if (curSelectedPl) {
          const matching = freshPlaylists.value.find(p => p.id === curSelectedPl.id);
          if (matching) {
            setSelectedPlaylist(prev => (prev?.id === matching.id && prev?.trackCount === matching.trackCount ? prev : matching));
          }
        }
      }
      if (freshSongs.status === 'fulfilled' && Array.isArray(freshSongs.value)) {
        setLibrarySongs(prev => (forceFresh ? freshSongs.value : (areItemsEqual(prev, freshSongs.value) ? prev : freshSongs.value)));
      }
      if (curPlTracks.status === 'fulfilled' && Array.isArray(curPlTracks.value) && curSelectedPl) {
        setPlaylistTracksMap(prev => {
          const existing = prev[curSelectedPl.id];
          if (!forceFresh && areItemsEqual(existing, curPlTracks.value)) return prev;
          return { ...prev, [curSelectedPl.id]: curPlTracks.value };
        });
      }
      if (window.electron?.getTracks) {
        window.electron.getTracks().then(t => {
          if (Array.isArray(t)) setDbConvertedTracks(prev => (forceFresh ? t : (areItemsEqual(prev, t) ? prev : t)));
        }).catch(() => { });
      }
      if (ipodTracksRes.status === 'fulfilled' && Array.isArray(ipodTracksRes.value) && device.value?.connected) {
        setIpodTracks(prev => (forceFresh ? ipodTracksRes.value : (areItemsEqual(prev, ipodTracksRes.value) ? prev : ipodTracksRes.value)));
        if (ipodTracksRes.value.length > 0) {
          setIpodTrackCount(prev => (prev === ipodTracksRes.value.length ? prev : ipodTracksRes.value.length));
        }
      }
      if (ipodPls.status === 'fulfilled' && Array.isArray(ipodPls.value) && device.value?.connected) {
        setIpodPlaylists(prev => (forceFresh ? ipodPls.value : (areItemsEqual(prev, ipodPls.value) ? prev : ipodPls.value)));
      }
    } catch (e) {
      console.warn('[PodSync] Background fetch error:', e);
    } finally {
      if (!silent) setIsRefreshingLibrary(false);
    }
  };

  // Playlist selection and track fetching
  const selectPlaylist = async (playlist, forceFresh = false) => {
    if (!playlist) return;
    setSelectedPlaylist(playlist);
    selectedPlaylistRef.current = playlist;
    setActiveTab('apple-songs');

    const cachedTracks = playlistTracksMap[playlist.id];
    const expectedCount = playlist.trackCount || playlist.tracks?.length || 0;

    // Fast instant UI: If we already have tracks cached and count matches, show immediately
    if (!forceFresh && Array.isArray(cachedTracks) && cachedTracks.length > 0 && (expectedCount === 0 || cachedTracks.length >= expectedCount)) {
      return;
    }

    // If playlist already has parsed tracks attached and not yet in map
    if (!forceFresh && Array.isArray(playlist.tracks) && playlist.tracks.length > 0 && !cachedTracks) {
      setPlaylistTracksMap(prev => ({ ...prev, [playlist.id]: playlist.tracks }));
    }

    // Fetch fresh tracks on-demand from Apple Music API
    if (window.electron?.getPlaylistTracks) {
      if (!cachedTracks || cachedTracks.length === 0) {
        setIsLoadingPlaylistTracks(true);
      }
      try {
        const tracks = await window.electron.getPlaylistTracks(playlist.id);
        if (Array.isArray(tracks)) {
          setPlaylistTracksMap(prev => ({ ...prev, [playlist.id]: tracks }));
        }
      } catch (err) {
        console.warn('Failed to fetch playlist tracks:', err);
      } finally {
        setIsLoadingPlaylistTracks(false);
      }
    }
  };

  // Computed song lists filtered by active search
  const currentSongList = useMemo(() => {
    if (selectedPlaylist) {
      return playlistTracksMap[selectedPlaylist.id] || selectedPlaylist.tracks || [];
    }
    return librarySongs;
  }, [selectedPlaylist, playlistTracksMap, librarySongs]);

  const filteredLibrarySongs = useMemo(() => {
    if (!songSearchQuery.trim()) return currentSongList;
    const q = songSearchQuery.toLowerCase();
    return currentSongList.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q) ||
      (s.album || '').toLowerCase().includes(q)
    );
  }, [currentSongList, songSearchQuery]);

  const currentIpodSongList = useMemo(() => {
    if (selectedIpodPlaylist) {
      return selectedIpodPlaylist.tracks || [];
    }
    return ipodTracks;
  }, [selectedIpodPlaylist, ipodTracks]);

  const filteredIpodTracks = useMemo(() => {
    if (!songSearchQuery.trim()) return currentIpodSongList;
    const q = songSearchQuery.toLowerCase();
    return currentIpodSongList.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q) ||
      (s.album || '').toLowerCase().includes(q)
    );
  }, [currentIpodSongList, songSearchQuery]);

  const getActiveViewList = useCallback(() => {
    if (activeTab === 'queue') {
      return syncQueue;
    }
    if (activeTab === 'ipod-playlists' && selectedIpodPlaylist) {
      return (filteredIpodTracks && filteredIpodTracks.length > 0) ? filteredIpodTracks : (selectedIpodPlaylist.tracks || []);
    }
    if (activeTab === 'ipod-songs') {
      return (filteredIpodTracks && filteredIpodTracks.length > 0) ? filteredIpodTracks : ipodTracks;
    }
    if (activeTab === 'apple-playlists' && selectedPlaylist) {
      return (filteredLibrarySongs && filteredLibrarySongs.length > 0) ? filteredLibrarySongs : (playlistTracksMap[selectedPlaylist.id] || selectedPlaylist.tracks || []);
    }
    if (activeTab === 'apple-songs' && selectedPlaylist) {
      return (filteredLibrarySongs && filteredLibrarySongs.length > 0) ? filteredLibrarySongs : (playlistTracksMap[selectedPlaylist.id] || selectedPlaylist.tracks || []);
    }
    if (activeTab === 'apple-albums' && selectedAlbum) {
      return selectedAlbum.tracks || [];
    }
    return (filteredLibrarySongs && filteredLibrarySongs.length > 0) ? filteredLibrarySongs : librarySongs;
  }, [activeTab, syncQueue, selectedIpodPlaylist, filteredIpodTracks, selectedPlaylist, filteredLibrarySongs, playlistTracksMap, selectedAlbum, ipodTracks, librarySongs]);

  const sortedPlaylists = useMemo(() => {
    const isFavorites = (p) => {
      const name = (p.title || '').toLowerCase();
      return name.includes('favour') || name.includes('favor') || name.includes('избран') || name.includes('любив') || name.includes('starred');
    };

    const getModifiedTime = (p) => {
      if (p.lastModifiedTimestamp && p.lastModifiedTimestamp > 0) return p.lastModifiedTimestamp;
      if (p.lastModifiedDate) {
        const t = new Date(p.lastModifiedDate).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (p.dateAdded) {
        const t = new Date(p.dateAdded).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      return 0;
    };

    return [...playlists].sort((a, b) => {
      const favA = isFavorites(a);
      const favB = isFavorites(b);
      if (favA && !favB) return -1;
      if (!favA && favB) return 1;

      const timeA = getModifiedTime(a);
      const timeB = getModifiedTime(b);
      if (timeA !== timeB) return timeB - timeA;

      const countA = a.trackCount || a.tracks?.length || 0;
      const countB = b.trackCount || b.tracks?.length || 0;
      if (countA !== countB) return countB - countA;

      return (a.title || '').localeCompare(b.title || '');
    });
  }, [playlists]);

  const sortedIpodPlaylists = useMemo(() => {
    return [...ipodPlaylists].sort((a, b) => {
      const isFav = (title) => {
        const name = (title || '').toLowerCase();
        return name.includes('favour') || name.includes('favor') || name.includes('избран') || name.includes('любив');
      };
      const favA = isFav(a.title);
      const favB = isFav(b.title);
      if (favA && !favB) return -1;
      if (!favA && favB) return 1;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [ipodPlaylists]);

  const getPlaylistCover = useCallback((pl) => {
    if (!pl) return null;
    if (pl.cover) return pl.cover;
    if (pl.cover_url) return pl.cover_url;
    // 1. Try to find matched playlist in Apple Music playlists by title
    const cleanPlTitle = normalizeTrackStr(pl.title);
    const matchPl = playlists.find(p => p.title && normalizeTrackStr(p.title) === cleanPlTitle);
    if (matchPl?.cover) return matchPl.cover;
    // 2. Try to get cover from tracks in this playlist
    if (Array.isArray(pl.tracks)) {
      for (const t of pl.tracks) {
        if (t?.cover_url) return t.cover_url;
        if (t?.cover) return t.cover;
        const cleanTTitle = normalizeTrackStr(t?.title);
        const matchedSong = librarySongs.find(s => s.title && normalizeTrackStr(s.title) === cleanTTitle);
        if (matchedSong?.cover_url) return matchedSong.cover_url;
      }
    }
    // 3. Try to get cover from ipodTracks matching this playlist
    const matchingIpodTrack = ipodTracks.find(t => {
      const pName = t.playlist || t.playlist_name || t.playlistTitle;
      return pName && normalizeTrackStr(pName) === cleanPlTitle && t.cover_url;
    });
    if (matchingIpodTrack?.cover_url) return matchingIpodTrack.cover_url;

    return null;
  }, [playlists, librarySongs, ipodTracks]);

  // Group library songs by album and sort tracklists
  const albums = useMemo(() => {
    if (!Array.isArray(librarySongs) || librarySongs.length === 0) return [];

    const albumMap = new Map();

    for (let idx = 0; idx < librarySongs.length; idx++) {
      const track = librarySongs[idx];
      if (!track) continue;
      const rawAlbum = (track.album || '').trim();
      const rawArtist = (track.artist || '').trim();

      const albumTitle = rawAlbum || 'Singles';

      // Primary artist determination (e.g. "M'Dee & Batyr" -> "M'Dee")
      const primaryArtist = track.album_artist ||
        rawArtist.split(/[,&/+]|\bfeat\.?\b|\bft\.?\b|\band\b|\bwith\b|\bx\b/i)[0]?.trim() ||
        rawArtist || 'Unknown Artist';

      const normAlbum = normalizeTrackStr(albumTitle);
      const normArtist = normalizeTrackStr(primaryArtist);

      // Combined unique key: normalized album name + normalized primary artist
      const key = `${normAlbum}:::${normArtist}`;

      const trackAddedTime = track.date_added ? new Date(track.date_added).getTime() :
        (track.dateAdded ? new Date(track.dateAdded).getTime() : 0);

      if (!albumMap.has(key)) {
        albumMap.set(key, {
          id: key,
          title: albumTitle,
          artist: primaryArtist,
          cover: track.cover_url || track.cover || '',
          year: track.year || track.release_date || track.releaseDate || '',
          firstIndex: idx,
          latestAddedTime: trackAddedTime,
          tracks: []
        });
      }

      const albumObj = albumMap.get(key);
      if (!albumObj.cover && (track.cover_url || track.cover)) {
        albumObj.cover = track.cover_url || track.cover;
      }
      if (!albumObj.year && (track.year || track.release_date || track.releaseDate)) {
        albumObj.year = track.year || track.release_date || track.releaseDate;
      }
      if (trackAddedTime > albumObj.latestAddedTime) {
        albumObj.latestAddedTime = trackAddedTime;
      }
      if (idx < albumObj.firstIndex) {
        albumObj.firstIndex = idx;
      }
      albumObj.tracks.push(track);
    }

    const list = Array.from(albumMap.values()).map(a => {
      // Sort tracks in official album tracklist sequence (Disc > Track Number > Original order)
      const sortedTracks = [...a.tracks].sort((t1, t2) => {
        const disc1 = Number(t1.disc_number || t1.discNumber || 1);
        const disc2 = Number(t2.disc_number || t2.discNumber || 1);
        if (disc1 !== disc2) return disc1 - disc2;

        const num1 = Number(t1.track_number || t1.trackNumber || 0);
        const num2 = Number(t2.track_number || t2.trackNumber || 0);
        if (num1 > 0 && num2 > 0 && num1 !== num2) return num1 - num2;
        if (num1 > 0 && num2 === 0) return -1;
        if (num2 > 0 && num1 === 0) return 1;

        return (t1.title || '').localeCompare(t2.title || '');
      });

      return {
        ...a,
        tracks: sortedTracks,
        trackCount: sortedTracks.length,
        duration: sortedTracks.reduce((sum, t) => sum + (Number(t.duration) || 0), 0)
      };
    });

    return list;
  }, [librarySongs]);

  const filteredAlbums = useMemo(() => {
    let result = albums;
    if (albumSearchQuery.trim()) {
      const q = albumSearchQuery.toLowerCase().trim();
      result = result.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.artist || '').toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (albumSortBy === 'recent') {
        if (b.latestAddedTime && a.latestAddedTime && b.latestAddedTime !== a.latestAddedTime) {
          return b.latestAddedTime - a.latestAddedTime;
        }
        return a.firstIndex - b.firstIndex;
      } else if (albumSortBy === 'artist') {
        const artDiff = (a.artist || '').localeCompare(b.artist || '');
        if (artDiff !== 0) return artDiff;
        return (a.title || '').localeCompare(b.title || '');
      } else if (albumSortBy === 'count') {
        return b.trackCount - a.trackCount;
      }
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [albums, albumSearchQuery, albumSortBy]);

  // Track artwork resolver and memory cache
  const [trackCovers, setTrackCovers] = useState({});
  const trackCoversRef = useRef({});

  const getTrackCover = useCallback((track) => {
    if (!track) return null;
    const trackId = track.id || track.path || `${track.title}-${track.artist}`;

    // 1. Direct cover properties
    if (track.cover_url) return track.cover_url;
    if (track.cover) return track.cover;
    if (track.thumbnail) return track.thumbnail;
    if (track.artwork) return track.artwork;

    // 2. In-memory cache
    if (trackCoversRef.current[trackId]) {
      return trackCoversRef.current[trackId];
    }

    // 3. Match against librarySongs
    const cleanTitle = (track.title || '').trim().toLowerCase();
    const cleanArtist = (track.artist || '').trim().toLowerCase();
    if (cleanTitle) {
      const match = librarySongs.find(s => {
        const sTitle = (s.title || '').trim().toLowerCase();
        const sArtist = (s.artist || '').trim().toLowerCase();
        if (s.id && track.id && s.id === track.id) return true;
        if (sTitle === cleanTitle && (!cleanArtist || !sArtist || sArtist.includes(cleanArtist) || cleanArtist.includes(sArtist))) return true;
        return false;
      });
      if (match?.cover || match?.cover_url || match?.artwork) {
        const found = match.cover || match.cover_url || match.artwork;
        trackCoversRef.current[trackId] = found;
        return found;
      }
    }

    // 4. Match against playlist tracks in playlistTracksMap
    for (const pTracks of Object.values(playlistTracksMap)) {
      if (Array.isArray(pTracks)) {
        const match = pTracks.find(s => {
          const sTitle = (s.title || '').trim().toLowerCase();
          const sArtist = (s.artist || '').trim().toLowerCase();
          return sTitle === cleanTitle && (!cleanArtist || !sArtist || sArtist.includes(cleanArtist) || cleanArtist.includes(sArtist));
        });
        if (match?.cover || match?.cover_url || match?.artwork) {
          const found = match.cover || match.cover_url || match.artwork;
          trackCoversRef.current[trackId] = found;
          return found;
        }
      }
    }

    // 5. Match against album cover if album title matches
    const cleanAlbum = (track.album || '').trim().toLowerCase();
    if (cleanAlbum && cleanAlbum !== 'singles') {
      const matchAlbum = albums.find(a => (a.title || '').trim().toLowerCase() === cleanAlbum);
      if (matchAlbum?.cover) {
        trackCoversRef.current[trackId] = matchAlbum.cover;
        return matchAlbum.cover;
      }
    }

    // 6. Match against playlist cover if in a selected playlist
    if (selectedPlaylist?.cover) return selectedPlaylist.cover;
    if (selectedIpodPlaylist) {
      const plCover = getPlaylistCover(selectedIpodPlaylist);
      if (plCover) return plCover;
    }

    return null;
  }, [librarySongs, playlistTracksMap, albums, selectedPlaylist, selectedIpodPlaylist, getPlaylistCover]);

  // Background artwork resolver for current playing track (iTunes API high-res)
  useEffect(() => {
    if (!currentTrack || !currentTrack.title) return;
    const directCover = getTrackCover(currentTrack);
    if (!directCover) {
      const trackId = currentTrack.id || currentTrack.path || `${currentTrack.title}-${currentTrack.artist}`;
      const q = encodeURIComponent(`${currentTrack.title} ${currentTrack.artist || ''}`.trim());
      fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`, { signal: AbortSignal.timeout(3000) })
        .then(res => res.json())
        .then(data => {
          if (data.results?.[0]?.artworkUrl100) {
            const highRes = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
            trackCoversRef.current[trackId] = highRes;
            setTrackCovers(prev => ({ ...prev, [trackId]: highRes }));
            setCurrentTrack(prev => (prev && (prev.id === currentTrack.id || prev.path === currentTrack.path || prev.title === currentTrack.title)) ? { ...prev, cover_url: highRes } : prev);
          }
        })
        .catch(() => { });
    }
  }, [currentTrack, getTrackCover]);

  const streamCacheRef = useRef(new Map());

  // Helper to resolve full-length stream URL for any track
  // Helper to resolve full-length stream URL for any track via Electron main process (No CORS errors)
  const resolveAudioStream = useCallback(async (track) => {
    if (!track) return null;
    const directPath = track.path || track.local_path;
    if (directPath) return `media://local?path=${encodeURIComponent(directPath)}`;
    if (track.full_stream_url) return track.full_stream_url;
    if (track.id && streamCacheRef.current.has(track.id)) return streamCacheRef.current.get(track.id);

    const cacheKey = `${track.title || ''}-${track.artist || ''}`.toLowerCase().trim();
    if (streamCacheRef.current.has(cacheKey)) return streamCacheRef.current.get(cacheKey);

    let fullStreamUrl = null;
    if (window.electron?.getFullAudioStream) {
      try {
        fullStreamUrl = await window.electron.getFullAudioStream(track);
      } catch (_) { }
    }

    if (fullStreamUrl) {
      track.full_stream_url = fullStreamUrl;
      if (track.id) streamCacheRef.current.set(track.id, fullStreamUrl);
      streamCacheRef.current.set(cacheKey, fullStreamUrl);
    }
    return fullStreamUrl;
  }, []);

  // Pre-resolve next track in background for 0ms switching
  const prefetchAdjacentTracks = useCallback((track) => {
    let list = playbackQueueRef.current;
    if (!list || list.length === 0) {
      list = getActiveViewList();
    }
    if (!list || list.length === 0) return;
    const currentIndex = list.findIndex(t => t.id === track?.id);
    if (currentIndex === -1) return;

    const nextTrack = isShuffleRef.current
      ? list[Math.floor(Math.random() * list.length)]
      : list[(currentIndex + 1) % list.length];

    if (nextTrack && !nextTrack.path && !nextTrack.full_stream_url && !streamCacheRef.current.has(nextTrack.id)) {
      setTimeout(() => {
        resolveAudioStream(nextTrack).catch(() => { });
      }, 300);
    }
  }, [getActiveViewList, resolveAudioStream]);

  // Audio player controls and queue management
  const playTrack = async (track, explicitQueue = null) => {
    if (!track) return;

    // Set or preserve active playback queue
    if (explicitQueue && Array.isArray(explicitQueue) && explicitQueue.length > 0) {
      setPlaybackQueue(explicitQueue);
      playbackQueueRef.current = explicitQueue;
    } else if (!playbackQueueRef.current || playbackQueueRef.current.length === 0 || !playbackQueueRef.current.some(t => t.id === track.id)) {
      const fallbackList = getActiveViewList();
      if (fallbackList && fallbackList.length > 0) {
        setPlaybackQueue(fallbackList);
        playbackQueueRef.current = fallbackList;
      }
    }

    // Toggle pause/play if clicking the same track
    if (currentTrackRef.current?.id === track.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play().catch(() => { });
        setIsPlaying(true);
      }
      return;
    }

    // Add previous track to history
    if (currentTrackRef.current) {
      playHistoryRef.current.push(currentTrackRef.current);
      if (playHistoryRef.current.length > 50) playHistoryRef.current.shift();
    }

    // 1. Instantly stop previous track audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const currentReqId = ++playbackRequestIdRef.current;
    setCurrentTrack(track);
    currentTrackRef.current = track;
    setIsPlaying(true);
    setCurrentTime(0);
    setIsBufferingTrack(false);

    if (!audioRef.current) return;

    // 2. Direct local file on disk or iPod (0ms instant playback)
    const localPath = track.path || track.local_path;
    if (localPath) {
      audioRef.current.src = `media://local?path=${encodeURIComponent(localPath)}`;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
      return;
    }

    // If 30s Fast Preview mode is chosen
    if (playModeRef.current === '30s') {
      let previewUrl = track.preview_url;
      if (!previewUrl) {
        try {
          const q = encodeURIComponent(`${track.title || ''} ${track.artist || ''}`.trim());
          const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`, { signal: AbortSignal.timeout(1200) });
          if (res.ok) {
            const data = await res.json();
            if (data.results?.[0]?.previewUrl) {
              previewUrl = data.results[0].previewUrl;
              track.preview_url = previewUrl;
            }
          }
        } catch (_) { }
      }

      if (previewUrl && playbackRequestIdRef.current === currentReqId) {
        audioRef.current.src = previewUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => { });
        setIsBufferingTrack(false);
      } else {
        // If no 30s preview found, fallback to resolving stream
        resolveAudioStream(track).then((fullUrl) => {
          if (playbackRequestIdRef.current !== currentReqId) return;
          if (fullUrl && audioRef.current) {
            audioRef.current.src = fullUrl;
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => { });
          }
        });
      }
      return;
    }

    // 3. Full Song Mode: Cached full-length audio stream in memory (0ms instant playback)
    const cachedStream = track.full_stream_url || streamCacheRef.current.get(track.id);
    if (cachedStream) {
      audioRef.current.src = cachedStream;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
      prefetchAdjacentTracks(track);
      return;
    }

    // 4. Resolve Full Audio Stream directly without interrupting mid-playback with preview switch
    setIsBufferingTrack(true);
    resolveAudioStream(track).then((fullUrl) => {
      if (playbackRequestIdRef.current !== currentReqId) return;
      setIsBufferingTrack(false);
      if (fullUrl && audioRef.current) {
        audioRef.current.src = fullUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => setIsPlaying(false));
        prefetchAdjacentTracks(track);
      } else {
        // Fallback to 30s preview only if full stream is completely unreachable
        if (track.preview_url && audioRef.current) {
          audioRef.current.src = track.preview_url;
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => setIsPlaying(false));
        }
      }
    }).catch(() => {
      if (playbackRequestIdRef.current === currentReqId) {
        setIsBufferingTrack(false);
      }
    });
  };

  const togglePlayPause = () => {
    if (!currentTrack) {
      let list = playbackQueueRef.current;
      if (!list || list.length === 0) {
        list = getActiveViewList();
      }
      if (list && list.length > 0) {
        if (isShuffleRef.current) {
          const randIdx = Math.floor(Math.random() * list.length);
          playTrack(list[randIdx], list);
        } else {
          playTrack(list[0], list);
        }
      }
      return;
    }
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play().catch(() => { });
      setIsPlaying(true);
    }
  };

  const handleNextTrack = () => {
    let list = playbackQueueRef.current;
    if (!list || list.length === 0) {
      list = getActiveViewList();
    }
    if (!list || list.length === 0) return;

    if (list.length === 1) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => { });
      }
      return;
    }

    if (isShuffleRef.current) {
      const candidates = list.filter(t => t.id !== currentTrackRef.current?.id);
      const nextTrack = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : list[0];
      playTrack(nextTrack, list);
    } else {
      const currentIndex = list.findIndex(t => t.id === currentTrackRef.current?.id);
      const nextIndex = (currentIndex + 1) % list.length;
      playTrack(list[nextIndex], list);
    }
  };

  const handlePrevTrack = () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    let list = playbackQueueRef.current;
    if (!list || list.length === 0) {
      list = getActiveViewList();
    }
    if (!list || list.length === 0) return;

    if (isShuffleRef.current) {
      if (playHistoryRef.current.length > 0) {
        const prevTrack = playHistoryRef.current.pop();
        playTrack(prevTrack, list);
        return;
      }
      const candidates = list.filter(t => t.id !== currentTrackRef.current?.id);
      const prevTrack = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : list[0];
      playTrack(prevTrack, list);
    } else {
      const currentIndex = list.findIndex(t => t.id === currentTrackRef.current?.id);
      const prevIndex = (currentIndex - 1 + list.length) % list.length;
      playTrack(list[prevIndex], list);
    }
  };

  const handleScrubberChange = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
  };

  const handleScrubberCommit = (e) => {
    const newTime = parseFloat(e.target.value);
    isScrubbingRef.current = false;
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.volume = volume || 0.8;
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
    }
  };

  // Sync status detection and track selection management
  const syncedTracksKeySet = useMemo(() => {
    const set = new Set();
    if (Array.isArray(dbConvertedTracks)) {
      for (const t of dbConvertedTracks) {
        if (t && (!t.status || t.status === 'converted')) {
          if (t.id) set.add(t.id);
          const ct = normalizeTrackStr(t.title);
          const ca = normalizeTrackStr(t.artist);
          if (ct) {
            set.add(ct);
            if (ca) set.add(`${ct}:::${ca}`);
          }
        }
      }
    }
    if (Array.isArray(ipodTracks)) {
      for (const t of ipodTracks) {
        if (t) {
          if (t.id) set.add(t.id);
          const ct = normalizeTrackStr(t.title);
          const ca = normalizeTrackStr(t.artist);
          if (ct) {
            set.add(ct);
            if (ca) set.add(`${ct}:::${ca}`);
          }
        }
      }
    }
    return set;
  }, [dbConvertedTracks, ipodTracks]);

  const checkIsSynced = useCallback((track, playlistContext = null) => {
    if (!track) return false;

    // If checking in the context of a specific playlist:
    if (playlistContext && playlistContext.title) {
      const cleanTargetTitle = normalizeTrackStr(playlistContext.title);
      const ipodPl = ipodPlaylists.find(p => normalizeTrackStr(p.title) === cleanTargetTitle);
      // If the playlist does not exist on iPod at all, track is not synced into this playlist
      if (!ipodPl) return false;

      // If the playlist exists on iPod, check if this specific track is inside that iPod playlist
      const ct = normalizeTrackStr(track.title);
      const ca = normalizeTrackStr(track.artist);

      const inIpodPl = (ipodPl.tracks || []).some(t => {
        if (t.id && track.id && t.id === track.id) return true;
        const it = normalizeTrackStr(t.title);
        const ia = normalizeTrackStr(t.artist);
        if (it === ct) {
          if (!ca || !ia || ia.includes(ca) || ca.includes(ia) || ia.replace(/\s+/g, '') === ca.replace(/\s+/g, '')) return true;
        }
        if (ct && it && (it.startsWith(ct) || ct.startsWith(it))) {
          if (!ca || !ia || ia.includes(ca) || ca.includes(ia)) return true;
        }
        return false;
      });
      return inIpodPl;
    }

    // Global check (audio file exists on iPod disk or in local library)
    if (track.path || track.local_path) return true;
    if (track.id && syncedTracksKeySet.has(track.id)) return true;
    const ct = normalizeTrackStr(track.title);
    const ca = normalizeTrackStr(track.artist);
    return syncedTracksKeySet.has(`${ct}:::${ca}`) || syncedTracksKeySet.has(ct);
  }, [ipodPlaylists, syncedTracksKeySet]);

  const syncQueueIds = useMemo(() => new Set(syncQueue.map(q => q.id)), [syncQueue]);

  const addToQueue = (track) => {
    if (!track) return;
    setSyncQueue(prev => {
      const exists = prev.some(q => q.id === track.id);
      if (exists) {
        return prev.filter(q => q.id !== track.id);
      } else {
        return [...prev, { ...track, quality: audioQuality, targetPlaylists: [] }];
      }
    });
  };

  const addSelectedToQueue = () => {
    const toAdd = currentSongList.filter(s => selectedTracks.has(s.id));
    const targetPl = selectedPlaylist?.title || null;
    const targetAlbum = selectedAlbum?.title || null;
    const target = targetPl || targetAlbum || null;

    setSyncQueue(prev => {
      let updated = [...prev];
      toAdd.forEach(s => {
        const idx = updated.findIndex(q => q.id === s.id);
        if (idx !== -1) {
          if (target) {
            const currentList = Array.isArray(updated[idx].targetPlaylists) ? updated[idx].targetPlaylists : [];
            if (!currentList.includes(target)) {
              updated[idx] = { ...updated[idx], targetPlaylists: [...currentList, target] };
            }
          }
        } else {
          updated.push({
            ...s,
            quality: audioQuality,
            targetPlaylists: target ? [target] : []
          });
        }
      });
      return updated;
    });

    setSelectedTracks(new Set());
    setActiveTab('queue');
  };

  const syncWholePlaylist = async (playlist, onlyNew = false) => {
    if (!playlist) return;
    let tracks = playlistTracksMap[playlist.id] || playlist.tracks || [];

    // If tracks are missing or incomplete compared to total track count, fetch full list
    if (tracks.length === 0 || (playlist.trackCount && tracks.length < playlist.trackCount)) {
      if (window.electron?.getPlaylistTracks) {
        try {
          const fresh = await window.electron.getPlaylistTracks(playlist.id);
          if (Array.isArray(fresh) && fresh.length > 0) {
            tracks = fresh;
            setPlaylistTracksMap(prev => ({ ...prev, [playlist.id]: fresh }));
          }
        } catch (e) {
          console.warn('[PodSync] Failed to fetch complete playlist tracks:', e);
        }
      }
    }

    if (tracks.length === 0) {
      alert(t('noTracksToSync', 'No tracks to sync in this playlist.'));
      return;
    }

    const candidateTracks = onlyNew ? tracks.filter(t => !checkIsSynced(t, playlist)) : tracks;
    if (onlyNew && candidateTracks.length === 0) {
      alert(t('allTracksAlreadySynced', 'All tracks from this playlist are already synced to iPod!'));
      return;
    }

    setSyncQueue(prev => {
      let updated = [...prev];
      candidateTracks.forEach(t => {
        const idx = updated.findIndex(q => q.id === t.id);
        if (idx !== -1) {
          const currentList = Array.isArray(updated[idx].targetPlaylists) ? updated[idx].targetPlaylists : [];
          if (!currentList.includes(playlist.title)) {
            updated[idx] = { ...updated[idx], targetPlaylists: [...currentList, playlist.title] };
          }
        } else {
          updated.push({
            ...t,
            quality: audioQuality,
            targetPlaylists: [playlist.title]
          });
        }
      });
      return updated;
    });

    setSyncMode(onlyNew ? 'additive' : 'replace');
    setActiveTab('queue');
  };

  const syncWholeAlbum = async (album, onlyNew = false) => {
    if (!album || !album.tracks || album.tracks.length === 0) {
      alert(t('noAlbumTracksToSync', 'No tracks to sync in this album.'));
      return;
    }

    const candidateTracks = onlyNew ? album.tracks.filter(t => !checkIsSynced(t)) : album.tracks;
    if (onlyNew && candidateTracks.length === 0) {
      alert(t('allAlbumTracksAlreadySynced', 'All tracks from this album are already synced!'));
      return;
    }

    setSyncQueue(prev => {
      let updated = [...prev];
      candidateTracks.forEach(t => {
        const idx = updated.findIndex(q => q.id === t.id);
        if (idx !== -1) {
          const currentList = Array.isArray(updated[idx].targetPlaylists) ? updated[idx].targetPlaylists : [];
          if (!currentList.includes(album.title)) {
            updated[idx] = { ...updated[idx], targetPlaylists: [...currentList, album.title] };
          }
        } else {
          updated.push({
            ...t,
            quality: audioQuality,
            targetPlaylists: [album.title]
          });
        }
      });
      return updated;
    });

    setSyncMode(onlyNew ? 'additive' : 'replace');
    setActiveTab('queue');
  };

  const removeTrackFromPlaylistGroup = (trackId, playlistName) => {
    setSyncQueue(prev => {
      return prev.map(t => {
        if (t.id !== trackId) return t;
        if (!playlistName) return null; // remove single track completely
        const curList = Array.isArray(t.targetPlaylists) ? t.targetPlaylists : [];
        const nextList = curList.filter(p => p !== playlistName);
        if (nextList.length === 0) return null; // removed from its only playlist
        return { ...t, targetPlaylists: nextList };
      }).filter(Boolean);
    });
  };

  const removePlaylistGroupFromQueue = (playlistName) => {
    setSyncQueue(prev => {
      return prev.map(t => {
        const curList = Array.isArray(t.targetPlaylists) ? t.targetPlaylists : [];
        const nextList = curList.filter(p => p !== playlistName);
        if (nextList.length === 0) return null;
        return { ...t, targetPlaylists: nextList };
      }).filter(Boolean);
    });
  };

  const renamePlaylistGroupInQueue = (oldName, newName) => {
    const clean = (newName || '').trim();
    if (!clean || clean === oldName) {
      setEditingPlaylistName(null);
      setTempPlaylistName('');
      return;
    }
    setSyncQueue(prev => {
      return prev.map(t => {
        const curList = Array.isArray(t.targetPlaylists) ? t.targetPlaylists : [];
        if (!curList.includes(oldName)) return t;
        const nextList = Array.from(new Set(curList.map(p => p === oldName ? clean : p)));
        return { ...t, targetPlaylists: nextList };
      });
    });
    setEditingPlaylistName(null);
    setTempPlaylistName('');
  };

  const toggleTrackSelection = (id) => {
    setSelectedTracks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = (filteredList) => {
    if (filteredList.length === 0) return;
    const allSelected = filteredList.every(t => selectedTracks.has(t.id));
    if (allSelected) {
      setSelectedTracks(new Set());
    } else {
      setSelectedTracks(new Set(filteredList.map(t => t.id)));
    }
  };

  // iPod synchronization workflow
  const startSyncPipeline = async () => {
    if (syncQueue.length === 0) {
      alert('Sync Queue is empty. Add songs from Apple Music or YouTube Search first.');
      return;
    }

    if (!deviceInfo.connected) {
      alert('No iPod connected! Please connect your iPod to continue.');
      return;
    }

    syncCancelledRef.current = false;
    setIsSyncing(true);
    setIsSyncMinimized(false);
    setSyncPhase('downloading');
    setSyncProgress(0);
    setSyncStatusText(t('syncInit', 'Initializing queue...'));
    setSyncErrorMsg('');
    setSyncStep(1);

    const initialTrackStates = {};
    syncQueue.forEach((item) => {
      initialTrackStates[item.id] = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        artworkUrl: item.artworkUrl || item.artwork?.url,
        status: 'pending',
        percent: 0
      };
    });
    setSyncTrackStates(initialTrackStates);
    setSyncStats({
      total: syncQueue.length,
      cached: 0,
      downloaded: 0,
      failed: 0,
      destination: targetPlaylistName || 'PodSync Queue'
    });

    try {
      const total = syncQueue.length;
      const processedTracks = [];
      let skippedCount = 0;

      const CONCURRENCY = syncConcurrency || 8;
      let nextIndex = 0;
      let completedCount = 0;
      const activeProgressMap = new Map();
      const activeTitles = new Set();
      let lastProgressFlush = 0;
      let progressTimer = null;

      const updateProgressDisplay = () => {
        let activeSum = 0;
        for (const p of activeProgressMap.values()) {
          activeSum += p;
        }
        const overall = Math.min(80, Math.round(((completedCount * 100 + activeSum) / (total * 100)) * 75));
        setSyncProgress(overall);

        const titlesList = Array.from(activeTitles).slice(0, 2).join(', ');
        const extraCount = activeTitles.size > 2 ? ` (+${activeTitles.size - 2})` : '';
        const threadCount = Math.min(CONCURRENCY, Math.max(1, activeTitles.size));
        const threadWord = i18n.language === 'ru' ? ((threadCount % 10 >= 2 && threadCount % 10 <= 4 && (threadCount < 10 || threadCount > 20)) ? 'потока' : 'потоков') : (threadCount === 1 ? 'stream' : 'streams');
        setSyncStatusText(`[${completedCount}/${total}] ${t('downloading', 'Downloading')} (${threadCount} ${threadWord}): ${titlesList}${extraCount}`);
      };

      const scheduleProgressUpdate = (itemId, pct) => {
        activeProgressMap.set(itemId, pct);
        const now = performance.now();
        if (now - lastProgressFlush > 60) {
          lastProgressFlush = now;
          updateProgressDisplay();
          setSyncTrackStates(prev => {
            if (!prev[itemId] || prev[itemId].percent === pct) return prev;
            return {
              ...prev,
              [itemId]: { ...prev[itemId], percent: pct }
            };
          });
        } else if (!progressTimer) {
          progressTimer = setTimeout(() => {
            progressTimer = null;
            lastProgressFlush = performance.now();
            updateProgressDisplay();
            setSyncTrackStates(prev => {
              if (!prev[itemId] || prev[itemId].percent === pct) return prev;
              return {
                ...prev,
                [itemId]: { ...prev[itemId], percent: pct }
              };
            });
          }, 60);
        }
      };

      const worker = async () => {
        while (nextIndex < total) {
          if (syncCancelledRef.current) break;
          const index = nextIndex++;
          const item = syncQueue[index];
          if (!item) break;

          setSyncStep(2);
          setSyncTrackStates(prev => ({
            ...prev,
            [item.id]: { ...(prev[item.id] || {}), status: 'downloading', percent: 0 }
          }));

          activeTitles.add(item.title);
          activeProgressMap.set(item.id, 0);
          updateProgressDisplay();

          let removeProgListener = () => { };
          if (window.electron?.onProgress) {
            removeProgListener = window.electron.onProgress(item.id, (p) => {
              const pct = Math.round(p.percent || 0);
              scheduleProgressUpdate(item.id, pct);
            });
          }

          try {
            const res = await window.electron.syncTrack(item);
            if (res && res.success) {
              processedTracks.push({
                ...item,
                ...res,
                local_path: res.path || res.local_path,
                path: res.path || res.local_path
              });

              if (res.cached) {
                setSyncTrackStates(prev => ({
                  ...prev,
                  [item.id]: { ...(prev[item.id] || {}), status: 'cached', percent: 100 }
                }));
                setSyncStats(s => ({ ...s, cached: s.cached + 1 }));
              } else {
                setSyncTrackStates(prev => ({
                  ...prev,
                  [item.id]: { ...(prev[item.id] || {}), status: 'completed', percent: 100 }
                }));
                setSyncStats(s => ({ ...s, downloaded: s.downloaded + 1 }));
              }
            } else {
              skippedCount++;
              setSyncTrackStates(prev => ({
                ...prev,
                [item.id]: { ...(prev[item.id] || {}), status: 'error', percent: 0 }
              }));
              setSyncStats(s => ({ ...s, failed: s.failed + 1 }));
              console.warn(`[Sync] Skipped track: "${item.title}" - ${res?.error || 'Match/Download error'}`);
            }
          } catch (itemErr) {
            skippedCount++;
            setSyncTrackStates(prev => ({
              ...prev,
              [item.id]: { ...(prev[item.id] || {}), status: 'error', percent: 0 }
            }));
            setSyncStats(s => ({ ...s, failed: s.failed + 1 }));
            console.warn(`[Sync] Error downloading "${item.title}":`, itemErr);
          } finally {
            removeProgListener();
            activeTitles.delete(item.title);
            activeProgressMap.delete(item.id);
            completedCount++;
            updateProgressDisplay();
          }
        }
      };

      // Launch 4 concurrent workers in parallel
      const workers = [];
      for (let w = 0; w < Math.min(CONCURRENCY, total); w++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      if (syncCancelledRef.current) {
        setIsSyncing(false);
        setSyncPhase('idle');
        return;
      }

      if (processedTracks.length === 0) {
        throw new Error('None of the tracks could be converted. Please check your internet connection.');
      }

      setSyncStep(3);
      setSyncPhase('transferring');
      setSyncStatusText(t('syncImporting', 'Importing {{count}} tracks into iTunes library...', { count: processedTracks.length }));
      setSyncProgress(85);

      let removeStatusListener = () => { };
      if (window.electron?.onSyncStatus) {
        removeStatusListener = window.electron.onSyncStatus((s) => {
          if (s.status) setSyncStatusText(s.status);
          if (s.progress) setSyncProgress(s.progress);
          if (s.status && s.status.toLowerCase().includes('ipod')) {
            setSyncStep(4);
          }
        });
      }

      // Sort processed tracks in exact album tracklist sequence (Disc -> Track Number -> Original Queue Order)
      const sortedProcessed = [...processedTracks].sort((a, b) => {
        const discA = Number(a.disc_number || a.discNumber || 1);
        const discB = Number(b.disc_number || b.discNumber || 1);
        if (discA !== discB) return discA - discB;

        const numA = Number(a.track_number || a.trackNumber || 0);
        const numB = Number(b.track_number || b.trackNumber || 0);
        if (numA > 0 && numB > 0 && numA !== numB) return numA - numB;
        if (numA > 0 && numB === 0) return -1;
        if (numB > 0 && numA === 0) return 1;

        const idxA = syncQueue.findIndex(q => q.id === a.id);
        const idxB = syncQueue.findIndex(q => q.id === b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;

        return 0;
      });

      const syncResult = await window.electron.syncPlaylist(sortedProcessed, {
        mode: syncMode,
        tactic: syncTactic,
        createPlaylist: syncDestination === 'playlist',
        playlistName: targetPlaylistName || 'PodSync Queue'
      });

      removeStatusListener();

      if (syncResult?.success) {
        setLastSyncResult(syncResult);
        setSyncPhase('completed');
        setSyncStep(4);
        setSyncProgress(100);
        setSyncStatusText(skippedCount > 0
          ? t('syncCompletedWithErrors', 'Sync finished! ({{added}} added, {{skipped}} skipped)', { added: processedTracks.length, skipped: skippedCount })
          : t('syncCompletedMsg', 'All {{count}} tracks successfully synced to iTunes & iPod!', { count: processedTracks.length })
        );
        setSyncQueue([]);
        fetchFreshData();
      } else {
        throw new Error(syncResult?.error || 'Unknown error during iPod write.');
      }
    } catch (err) {
      setSyncPhase('error');
      setSyncErrorMsg(err.message || 'Error occurred during sync pipeline.');
    }
  };

  // YouTube search and audio stream extraction
  const performYoutubeSearch = async (e) => {
    if (e) e.preventDefault();
    if (!ytQuery.trim()) return;
    setIsSearchingYt(true);
    setYtSearchError('');
    try {
      let results = [];
      if (window.electron?.searchYoutube) {
        try {
          results = await window.electron.searchYoutube(ytQuery.trim());
        } catch (_) { }
      }

      // Fallback if electron returned empty
      if (!Array.isArray(results) || results.length === 0) {
        const cleanQuery = encodeURIComponent(ytQuery.trim());
        const instances = [
          `https://pipedapi.kavin.rocks/search?q=${cleanQuery}&filter=videos`,
          `https://api.invidious.io/api/v1/search?q=${cleanQuery}&type=video`
        ];
        for (const inst of instances) {
          try {
            const res = await fetch(inst, { signal: AbortSignal.timeout(3500) });
            if (res.ok) {
              const data = await res.json();
              const items = Array.isArray(data) ? data : (data.items || []);
              if (items.length > 0) {
                results = items.slice(0, 15).map(item => {
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
                break;
              }
            }
          } catch (_) { }
        }
      }

      if (Array.isArray(results) && results.length > 0) {
        setYtResults(results);
      } else {
        setYtResults([]);
        setYtSearchError('No results found for this search term.');
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      setYtSearchError('Failed to search YouTube. Please check network connection.');
    } finally {
      setIsSearchingYt(false);
    }
  };


  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white font-sans antialiased overflow-hidden select-none">

      {/* Hidden Audio Element for Previews */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (!audioRef.current || isScrubbingRef.current) return;
          const now = Date.now();
          if (now - lastTimeUpdateRef.current > 250) {
            lastTimeUpdateRef.current = now;
            setCurrentTime(audioRef.current.currentTime);
            if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
              setDuration(audioRef.current.duration);
            }
          }
        }}
        onDurationChange={() => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={handleNextTrack}
      />

      {/* Top control bar and LCD display */}
      <header className="h-[56px] bg-[#18181a] border-b border-white/[0.04] pl-7 pr-4 flex items-center justify-between app-drag-region select-none relative z-30 shrink-0">

        {/* Playback controls and volume slider */}
        <div className="flex items-center gap-5 app-no-drag shrink-0">

          {/* Track navigation and play/pause buttons */}
          <div className="flex items-center gap-1.5">
            {/* Previous track */}
            <button
              onClick={handlePrevTrack}
              title={t('prevTrack', 'Previous track')}
              className="p-1 text-[#A0A0A5] hover:text-white transition-all duration-100 cursor-pointer active:scale-90 flex items-center justify-center"
            >
              <svg className="w-[26px] h-[26px] fill-current" viewBox="0 0 24 24">
                <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
              </svg>
            </button>

            {/* Play and pause */}
            <button
              onClick={togglePlayPause}
              title={isPlaying ? t('pause', 'Pause') : t('play', 'Play')}
              className="p-1 text-white hover:text-[#FA2D48] transition-all duration-100 cursor-pointer active:scale-90 flex items-center justify-center"
            >
              {isPlaying ? (
                <svg className="w-[28px] h-[28px] fill-current text-white" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-[28px] h-[28px] fill-current ml-0.5 text-white" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Next track */}
            <button
              onClick={handleNextTrack}
              title={t('nextTrack', 'Next track')}
              className="p-1 text-[#A0A0A5] hover:text-white transition-all duration-100 cursor-pointer active:scale-90 flex items-center justify-center"
            >
              <svg className="w-[26px] h-[26px] fill-current" viewBox="0 0 24 24">
                <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
              </svg>
            </button>
          </div>

          {/* Volume slider */}
          <div className="flex items-center pl-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              style={{
                background: `linear-gradient(to right, #7A7A80 ${(isMuted ? 0 : volume) * 100}%, #333336 ${(isMuted ? 0 : volume) * 100}%)`
              }}
              className="w-20 h-[4px] rounded-full itunes-volume-slider cursor-pointer"
            />
          </div>
        </div>

        {/* Central LCD playback screen */}
        <div className="app-no-drag flex-1 max-w-[580px] mx-4 self-stretch h-full flex items-stretch">
          <div className="w-full h-full bg-[#151517] border-x border-white/[0.08] border-y-0 shadow-[inset_0_1px_4px_rgba(0,0,0,0.7)] flex flex-col justify-between overflow-hidden relative select-none rounded-none">
            {currentTrack ? (
              <>
                <div className="flex-1 flex items-center h-[calc(100%-3px)] min-w-0">
                  {/* Track artwork */}
                  <div className="h-full aspect-square rounded-none bg-black/80 border-r border-white/[0.06] shrink-0 relative flex items-center justify-center overflow-hidden">
                    {(() => {
                      const cover = getTrackCover(currentTrack) || currentTrack.cover_url || currentTrack.cover || currentTrack.thumbnail;
                      return cover ? (
                        <img src={cover} className="w-full h-full object-cover rounded-none" alt="Art" />
                      ) : (
                        <Music className="w-4 h-4 text-[#8E8E93]" />
                      );
                    })()}
                    {isBufferingTrack && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <RefreshCw className="w-3.5 h-3.5 text-white/80 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Shuffle toggle and elapsed time */}
                  <div className="w-[44px] h-full flex flex-col items-center justify-between py-1.5 shrink-0">
                    <button
                      onClick={() => setIsShuffle(!isShuffle)}
                      title={t('shuffle', 'Shuffle')}
                      className={`transition-colors cursor-pointer ${isShuffle ? 'text-[#FA2D48] opacity-100 font-bold' : 'text-[#8E8E93] opacity-60 hover:opacity-100 hover:text-white'}`}
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono tabular-nums text-[#8E8E93] leading-none">
                      {formatTime(currentTime)}
                    </span>
                  </div>

                  {/* Track title and artist metadata */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center text-center px-2">
                    <span className="font-semibold text-[12.5px] text-white truncate leading-tight">
                      {currentTrack.title}
                    </span>
                    <span className="text-[11px] font-normal text-[#8E8E93] truncate leading-tight mt-0.5">
                      {currentTrack.artist}{currentTrack.album ? ` — ${currentTrack.album}` : ''}
                    </span>
                  </div>

                  {/* Repeat toggle and remaining time */}
                  <div className="w-[44px] h-full flex flex-col items-center justify-between py-1.5 shrink-0">
                    <button
                      onClick={() => setIsRepeat(!isRepeat)}
                      title={t('repeat', 'Repeat')}
                      className={`transition-colors cursor-pointer ${isRepeat ? 'text-[#FA2D48] opacity-100 font-bold' : 'text-[#8E8E93] opacity-60 hover:opacity-100 hover:text-white'}`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono tabular-nums text-[#8E8E93] leading-none">
                      -{formatTime(Math.max(0, (duration || currentTrack.duration || 0) - currentTime))}
                    </span>
                  </div>
                </div>

                {/* Seek scrubber bar */}
                <div className="w-full h-[3px] bg-[#2a2a2d] relative cursor-pointer group shrink-0">
                  <input
                    type="range"
                    min="0"
                    max={duration || currentTrack.duration || 100}
                    value={currentTime}
                    onPointerDown={() => { isScrubbingRef.current = true; }}
                    onChange={handleScrubberChange}
                    onPointerUp={handleScrubberCommit}
                    style={{
                      background: `linear-gradient(to right, #6E6E73 ${((duration || currentTrack.duration || 100) > 0
                          ? Math.min(100, Math.max(0, (currentTime / (duration || currentTrack.duration || 100)) * 100))
                          : 0)
                        }%, #2a2a2d ${((duration || currentTrack.duration || 100) > 0
                          ? Math.min(100, Math.max(0, (currentTime / (duration || currentTrack.duration || 100)) * 100))
                          : 0)
                        }%)`
                    }}
                    className="w-full h-[3px] appearance-none absolute inset-0 itunes-scrubber cursor-pointer"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center w-full h-full gap-2 text-[#8E8E93]">
                <Music className="w-4 h-4 text-[#8E8E93]/60" />
                <span className="text-[11.5px] font-medium text-[#8E8E93]/70">PodSync Library</span>
              </div>
            )}
          </div>
        </div>

        {/* Playback mode switches, lyrics, and sync popup */}
        <div className="flex items-center gap-3 app-no-drag shrink-0">

          {/* 30s preview vs full stream toggle */}
          <div className="flex items-center bg-white/[0.06] p-0.5 rounded-[6px] border border-white/[0.06] select-none">
            <button
              onClick={() => {
                setPlayMode('30s');
                playModeRef.current = '30s';
              }}
              title="30s Fast Preview"
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded-[4px] transition-all cursor-pointer ${playMode === '30s'
                  ? 'bg-[#FA2D48] text-white shadow-sm font-semibold'
                  : 'text-[#8E8E93] hover:text-white'
                }`}
            >
              30s
            </button>
            <button
              onClick={() => {
                setPlayMode('full');
                playModeRef.current = 'full';
                if (currentTrack && isPlaying && !currentTrack.path && !currentTrack.full_stream_url) {
                  setIsBufferingTrack(true);
                  resolveAudioStream(currentTrack).then((fullUrl) => {
                    if (fullUrl && audioRef.current && currentTrackRef.current?.id === currentTrack.id) {
                      setIsBufferingTrack(false);
                      const curPos = audioRef.current.currentTime || 0;
                      audioRef.current.src = fullUrl;
                      audioRef.current.currentTime = curPos;
                      audioRef.current.play().catch(() => { });
                    }
                  }).catch(() => setIsBufferingTrack(false));
                }
              }}
              title="Full Song Stream"
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded-[4px] transition-all cursor-pointer ${playMode === 'full'
                  ? 'bg-[#FA2D48] text-white shadow-sm font-semibold'
                  : 'text-[#8E8E93] hover:text-white'
                }`}
            >
              Full
            </button>
          </div>

          {/* Lyrics modal trigger */}
          <button
            disabled={!currentTrack}
            onClick={() => {
              if (isLyricsOpen) {
                setIsLyricsOpen(false);
              } else if (currentTrack) {
                openLyrics(currentTrack);
              }
            }}
            title={isLyricsOpen ? t('hideLyrics', 'Hide Lyrics') : t('showLyrics', 'Show Lyrics')}
            className={`w-8 h-8 rounded-[8px] flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isLyricsOpen
                ? 'bg-[#FA2D48] text-white shadow-sm ring-1 ring-[#FA2D48]/40'
                : 'hover:bg-white/[0.06] text-[#8E8E93] hover:text-white'
              }`}
          >
            <Mic2 className="w-4 h-4" />
          </button>

          {/* Downloads and sync trigger button */}
          <div className="relative">
            <button
              ref={downloadsButtonRef}
              onClick={() => setIsDownloadsPopoverOpen(!isDownloadsPopoverOpen)}
              title={isSyncing ? `${t('syncing', 'Syncing')} ${syncProgress}%` : t('downloadsAndSync', 'Downloads & Sync')}
              className={`relative w-8 h-8 rounded-[8px] flex items-center justify-center transition-all cursor-pointer ${isSyncing
                  ? 'bg-transparent border-0 text-white'
                  : isDownloadsPopoverOpen
                    ? 'bg-white/[0.14] text-white border border-white/20'
                    : syncQueue.length > 0
                      ? 'bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white'
                      : 'hover:bg-white/[0.06] text-[#8E8E93] hover:text-white'
                }`}
            >
              {isSyncing ? (
                <>
                  {/* Radial sync progress ring */}
                  <svg className="w-7 h-7 -rotate-90 absolute inset-0 m-auto pointer-events-none">
                    <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" fill="none" />
                    <circle
                      cx="14"
                      cy="14"
                      r="11"
                      stroke="#FA2D48"
                      strokeWidth="2.5"
                      strokeDasharray={69.1}
                      strokeDashoffset={69.1 - (69.1 * Math.min(100, Math.max(0, syncProgress))) / 100}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-150"
                    />
                  </svg>
                  <Download className="w-3.5 h-3.5 text-white" />
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {syncQueue.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#FA2D48] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-sm animate-pulse">
                      {syncQueue.length}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Downloads and sync popover panel */}
            {isDownloadsPopoverOpen && (
              <div
                ref={downloadsPopoverRef}
                className="absolute top-10 right-0 w-[360px] bg-[#1c1c1f]/95 backdrop-blur-2xl border border-white/[0.12] rounded-[14px] shadow-[0_16px_40px_rgba(0,0,0,0.8)] z-50 overflow-hidden select-none text-left"
              >
                {/* Popover header */}
                <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#FA2D48]" />
                    <span className="font-semibold text-[13px] text-white tracking-tight">{t('downloadsAndSync', 'Downloads & Sync')}</span>
                  </div>
                  <button
                    onClick={() => setIsDownloadsPopoverOpen(false)}
                    className="p-1 rounded-[4px] text-[#8E8E93] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Popover body */}
                {isSyncing ? (
                  /* Active sync in progress */
                  <div className="space-y-0">
                    {/* Overall sync progress */}
                    <div className="p-3.5 border-b border-white/[0.06] space-y-2.5 bg-black/20">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-medium text-white truncate max-w-[240px]">
                          {syncStatusText}
                        </span>
                        <span className="text-[14px] font-mono font-bold text-[#FA2D48] shrink-0">
                          {syncProgress}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${syncProgress}%` }}
                          className="h-full bg-[#FA2D48] transition-all duration-100"
                        />
                      </div>

                      {/* Track counters and stats */}
                      <div className="flex items-center justify-between text-[10.5px] text-[#8E8E93] pt-0.5">
                        <span>{t('total', 'Total')}: <strong className="text-white font-mono">{syncStats.total}</strong></span>
                        <span>{t('cached', 'Cached')}: <strong className="text-white font-mono">{syncStats.cached}</strong></span>
                        <span>{t('downloaded', 'Downloaded')}: <strong className="text-white font-mono">{syncStats.downloaded}</strong></span>
                        <span>{t('errors', 'Errors')}: <strong className="text-white font-mono">{syncStats.failed}</strong></span>
                      </div>
                    </div>

                    {/* Active downloading tracks list */}
                    <div className="max-h-56 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                      {Object.values(syncTrackStates).length === 0 ? (
                        <p className="text-center py-4 text-xs text-[#8E8E93]">{t('preparingFiles', 'Preparing files...')}</p>
                      ) : (
                        Object.values(syncTrackStates).map((tr, idx) => (
                          <div
                            key={tr.id ? `${tr.id}-${idx}` : idx}
                            className="p-2 rounded-[8px] bg-white/[0.03] border border-white/[0.05] text-[11.5px] space-y-1.5 hover:bg-white/[0.05] transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {tr.artworkUrl ? (
                                  <img src={tr.artworkUrl} alt="" className="w-7 h-7 rounded-[4px] object-cover shrink-0 bg-white/5" />
                                ) : (
                                  <div className="w-7 h-7 rounded-[4px] bg-[#27272A] flex items-center justify-center shrink-0 text-[#8E8E93]">
                                    <Music className="w-3.5 h-3.5" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="font-semibold text-white block truncate text-[11.5px] leading-tight">
                                    {tr.title}
                                  </span>
                                  <span className="text-[10px] text-[#8E8E93] truncate block">
                                    {tr.artist}
                                  </span>
                                </div>
                              </div>

                              {/* Track sync badge status */}
                              <div className="shrink-0">
                                {tr.status === 'pending' && (
                                  <span className="text-[9.5px] font-medium text-[#71717A] bg-[#27272A] px-2 py-0.5 rounded">
                                    {t('inQueue', 'In Queue')}
                                  </span>
                                )}
                                {tr.status === 'downloading' && (
                                  <span className="text-[9.5px] font-mono text-[#FA2D48] font-semibold bg-[#FA2D48]/10 border border-[#FA2D48]/20 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Download className="w-2.5 h-2.5" />
                                    <span>{tr.percent}%</span>
                                  </span>
                                )}
                                {tr.status === 'converting' && (
                                  <span className="text-[9.5px] font-medium text-[#E4E4E7] bg-[#27272A] border border-[#38383A] px-2 py-0.5 rounded flex items-center gap-1">
                                    <Loader2 className="w-2.5 h-2.5 animate-spin text-[#8E8E93]" />
                                    <span>AAC</span>
                                  </span>
                                )}
                                {tr.status === 'cached' && (
                                  <span className="text-[9.5px] font-medium text-[#30D158] bg-[#30D158]/10 border border-[#30D158]/20 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Zap className="w-2.5 h-2.5 fill-current" />
                                    <span>{t('cached', 'Cached')}</span>
                                  </span>
                                )}
                                {tr.status === 'completed' && (
                                  <span className="text-[9.5px] font-medium text-[#30D158] bg-[#30D158]/10 border border-[#30D158]/20 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                                    <span>{t('ready', 'Ready')}</span>
                                  </span>
                                )}
                                {tr.status === 'error' && (
                                  <span className="text-[9.5px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    <span>{t('skipped', 'Skipped')}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Individual track progress */}
                            {tr.status === 'downloading' && (
                              <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${tr.percent}%` }}
                                  className="h-full bg-[#FA2D48] transition-[width] duration-75 ease-out"
                                />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Popover footer controls */}
                    <div className="p-3 border-t border-white/[0.06] bg-black/20 flex items-center justify-between">
                      {syncPhase === 'completed' ? (
                        <>
                          <span className="text-[11.5px] font-semibold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{t('done', 'Done!')}</span>
                          </span>
                          <button
                            onClick={() => {
                              setIsSyncing(false);
                              setIsDownloadsPopoverOpen(false);
                            }}
                            className="btn-apple-red px-3 py-1 rounded-[6px] text-[11px] font-bold cursor-pointer"
                          >
                            {t('close', 'Close')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={cancelSync}
                            className="text-[11.5px] text-red-400 hover:text-red-300 transition-colors cursor-pointer font-medium"
                          >
                            {t('cancel', 'Cancel')}
                          </button>
                          <button
                            onClick={() => {
                              setIsDownloadsPopoverOpen(false);
                              setActiveTab('queue');
                            }}
                            className="text-[11.5px] text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                          >
                            {t('viewFullQueue', 'View full queue →')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : syncQueue.length > 0 ? (
                  /* Queue ready for synchronization */
                  <div className="p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-semibold text-white">{t('inQueueForIpod', 'In queue for iPod:')}</span>
                      <span className="text-[11px] font-mono font-bold bg-[#FA2D48]/10 text-[#FA2D48] border border-[#FA2D48]/20 px-2 py-0.5 rounded-full">
                        {getTrackCount(syncQueue.length, i18n.language)}
                      </span>
                    </div>

                    {/* Queued tracks preview */}
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                      {syncQueue.slice(0, 4).map((t, idx) => (
                        <div key={t.id ? `${t.id}-${idx}` : idx} className="p-2 rounded-[6px] bg-white/[0.03] border border-white/[0.05] flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-white block truncate text-[11.5px]">{t.title}</span>
                            <span className="text-[10px] text-[#8E8E93] truncate block">{t.artist}</span>
                          </div>
                          <span className="text-[10px] text-[#8E8E93] font-mono shrink-0">{formatTime(t.duration)}</span>
                        </div>
                      ))}
                      {syncQueue.length > 4 && (
                        <p className="text-[10.5px] text-[#8E8E93] text-center pt-0.5">+{syncQueue.length - 4} {t('moreTracksSuffix', 'more tracks...')}</p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setIsDownloadsPopoverOpen(false);
                        startSyncPipeline();
                      }}
                      className="btn-apple-red w-full py-2 rounded-[8px] text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t('syncToIpod', 'Sync to iPod')}</span>
                    </button>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <button
                        onClick={() => setSyncQueue([])}
                        className="text-[#8E8E93] hover:text-red-400 transition-colors cursor-pointer"
                      >
                        {t('clearQueue', 'Clear Queue')}
                      </button>
                      <button
                        onClick={() => {
                          setIsDownloadsPopoverOpen(false);
                          setActiveTab('queue');
                        }}
                        className="text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                      >
                        {t('viewFullQueue', 'View full queue →')}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Empty queue empty state */
                  <div className="p-8 text-center space-y-2">
                    <Download className="w-8 h-8 text-[#8E8E93]/40 mx-auto mb-1" />
                    <h4 className="font-semibold text-white text-[13px]">{t('noActiveDownloads', 'No active downloads')}</h4>
                    <p className="text-[11.5px] text-[#8E8E93] max-w-[240px] mx-auto leading-relaxed">
                      {t('noActiveDownloadsDesc', "Add songs or albums with the '+' button for fast synchronization with iPod.")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Window controls spacing */}
          <div className="w-[140px] shrink-0" />
        </div>
      </header>

      {/* Main container with sidebar and content area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar navigation panel */}
        <aside className="w-[315px] bg-[#151517] border-r border-white/[0.04] flex flex-col shrink-0 p-3.5 overflow-y-auto select-none">
          <div className="space-y-4 pb-4">

            {/* Search input and library refresh button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={songSearchQuery || albumSearchQuery}
                  onChange={(e) => {
                    setSongSearchQuery(e.target.value);
                    setAlbumSearchQuery(e.target.value);
                  }}
                  placeholder={t('searchPlaceholder', 'Search songs, albums, artists...')}
                  className="w-full bg-[#222225] border border-white/[0.06] rounded-[8px] pl-9 pr-7 py-2 text-[13.5px] text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#FA2D48]/70 transition-colors"
                />
                {(songSearchQuery || albumSearchQuery) && (
                  <button
                    onClick={() => {
                      setSongSearchQuery('');
                      setAlbumSearchQuery('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => fetchFreshData(true, false)}
                title={t('refreshLibrary', 'Refresh Library')}
                className="p-2 text-[#8E8E93] hover:text-white hover:bg-white/[0.06] rounded-[8px] transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshingLibrary ? 'animate-spin text-[#FA2D48]' : ''}`} />
              </button>
            </div>

            {/* Sync queue sidebar button */}
            <button
              onClick={() => { setSelectedIpodPlaylist(null); setActiveTab('queue'); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'queue'
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                }`}
            >
              <div className="flex items-center truncate">
                <FolderSync className={`w-4.5 h-4.5 mr-3 shrink-0 ${activeTab === 'queue' ? 'text-[#FA2D48]' : 'text-[#8E8E93]'}`} />
                <span className="whitespace-nowrap truncate">{t('syncQueue', 'Sync Queue')}</span>
              </div>
              {syncQueue.length > 0 && (
                <span className="bg-[#FA2D48] text-white px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm shrink-0 ml-1.5">
                  {syncQueue.length}
                </span>
              )}
            </button>

            {/* Section: Devices */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[12.5px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  {t('devices', 'DEVICES')}
                </span>
              </div>

              {/* iPod device item */}
              <button
                onClick={() => { setSelectedIpodPlaylist(null); setActiveTab('ipod-summary'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'ipod-summary'
                    ? 'text-white font-semibold bg-white/[0.06]'
                    : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center truncate">
                  <HardDrive className={`w-4.5 h-4.5 mr-3 shrink-0 ${activeTab === 'ipod-summary' ? 'text-[#FA2D48]' : 'text-[#8E8E93]'}`} />
                  <span className="truncate">{displayDeviceName}</span>
                </div>
              </button>

              {/* Songs on iPod item */}
              <button
                onClick={() => {
                  setSelectedIpodPlaylist(null);
                  setActiveTab('ipod-songs');
                  if (deviceInfo.connected && ipodTracks.length === 0) {
                    fetchIpodTracks();
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'ipod-songs' && !selectedIpodPlaylist
                    ? 'text-white font-semibold bg-white/[0.06]'
                    : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center">
                  <Disc className={`w-4.5 h-4.5 mr-3 ${activeTab === 'ipod-songs' && !selectedIpodPlaylist ? 'text-[#FA2D48]' : 'text-[#8E8E93]'}`} />
                  <span>{t('songs', 'Songs')}</span>
                </div>
                <span className="text-[12px] font-mono tabular-nums opacity-60">
                  {deviceInfo.connected ? (ipodTrackCount || ipodTracks.length) : '0'}
                </span>
              </button>

              {/* Playlists on iPod item */}
              <button
                onClick={() => {
                  setSelectedIpodPlaylist(null);
                  setActiveTab('ipod-playlists');
                  if (deviceInfo.connected && ipodPlaylists.length === 0) {
                    fetchIpodTracks();
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'ipod-playlists' || (activeTab === 'ipod-songs' && selectedIpodPlaylist)
                    ? 'text-white font-semibold bg-white/[0.06]'
                    : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center">
                  <ListMusic className={`w-4.5 h-4.5 mr-3 ${(activeTab === 'ipod-playlists' || (activeTab === 'ipod-songs' && selectedIpodPlaylist)) ? 'text-[#FA2D48]' : 'text-[#8E8E93]'}`} />
                  <span>{t('ipodPlaylists', 'iPod Playlists')}</span>
                </div>
                <span className="text-[12px] font-mono tabular-nums opacity-60">
                  {deviceInfo.connected ? ipodPlaylists.length : '0'}
                </span>
              </button>
            </div>

            {/* Section: Library */}
            <div className="space-y-0.5">
              <span className="text-[12.5px] font-semibold uppercase tracking-wider text-[#8E8E93] px-3 py-1.5 block">
                {t('library', 'LIBRARY')}
              </span>

              {/* Library songs item */}
              <button
                onClick={() => { setActiveTab('apple-songs'); setSelectedPlaylist(null); setSelectedAlbum(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'apple-songs' && !selectedPlaylist
                    ? 'text-white font-semibold bg-white/[0.06]'
                    : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center">
                  <Music className={`w-4.5 h-4.5 mr-3 ${activeTab === 'apple-songs' && !selectedPlaylist ? 'text-[#FA2D48]' : 'text-[#8E8E93]'}`} />
                  <span>{t('songs', 'Songs')}</span>
                </div>
                <span className="text-[12px] font-mono tabular-nums opacity-60">{librarySongs.length}</span>
              </button>

              {/* Library albums item */}
              <button
                onClick={() => { setActiveTab('apple-albums'); setSelectedAlbum(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'apple-albums'
                    ? 'text-white font-semibold bg-white/[0.06]'
                    : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center">
                  <Disc className={`w-4.5 h-4.5 mr-3 ${activeTab === 'apple-albums' ? 'text-[#FA2D48]' : 'text-[#8E8E93]'}`} />
                  <span>{t('albums', 'Albums')}</span>
                </div>
                <span className="text-[12px] font-mono tabular-nums opacity-60">{albums.length}</span>
              </button>
            </div>

            {/* Section: Playlists */}
            <div className="space-y-0.5">
              <span className="text-[12.5px] font-semibold uppercase tracking-wider text-[#8E8E93] px-3 py-1.5 block">
                {t('playlists', 'PLAYLISTS')}
              </span>

              {/* All playlists item */}
              <button
                onClick={() => { setActiveTab('apple-playlists'); setSelectedPlaylist(null); setSelectedAlbum(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'apple-playlists'
                    ? 'text-white font-semibold bg-white/[0.06]'
                    : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center">
                  <ListMusic className={`w-4.5 h-4.5 mr-3 ${activeTab === 'apple-playlists' ? 'text-[#FA2D48]' : 'text-[#8E8E93]'}`} />
                  <span>{t('allPlaylists', 'All Playlists')}</span>
                </div>
                <span className="text-[12px] font-mono tabular-nums opacity-60">{playlists.length}</span>
              </button>

              {/* User playlists sidebar list */}
              {(showAllSidebarPlaylists ? playlists : playlists.slice(0, 10)).map((pl, idx) => {
                const isSelected = activeTab === 'apple-songs' && selectedPlaylist?.id === pl.id;
                return (
                  <button
                    key={pl.id ? `${pl.id}-${idx}` : idx}
                    onClick={() => selectPlaylist(pl)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[8px] text-[14.5px] font-medium transition-colors cursor-pointer ${isSelected
                        ? 'text-white font-semibold bg-white/[0.06]'
                        : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <img
                        src={pl.cover || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100'}
                        className="w-5 h-5 rounded-[4px] object-cover shrink-0 border border-white/10"
                        alt=""
                      />
                      <span className="truncate">{pl.title}</span>
                    </div>
                  </button>
                );
              })}

              {/* Expand or collapse playlists list */}
              {playlists.length > 10 && (
                <button
                  onClick={() => setShowAllSidebarPlaylists(prev => !prev)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-[8px] text-[13.5px] font-medium text-[#8E8E93] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <span>{showAllSidebarPlaylists ? t('collapse', 'Collapse') : t('showMore', 'Show more')}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAllSidebarPlaylists ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Section: Services and tools */}
            <div className="space-y-0.5">
              <span className="text-[12.5px] font-semibold uppercase tracking-wider text-[#8E8E93] px-3 py-1.5 block">
                {t('services', 'SERVICES')}
              </span>

              {/* YouTube importer item */}
              <button
                onClick={() => { setSelectedPlaylist(null); setSelectedAlbum(null); setSelectedIpodPlaylist(null); setActiveTab('youtube-search'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'youtube-search'
                    ? 'text-white font-semibold bg-white/[0.06]'
                    : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center">
                  <YoutubeIcon className="w-4.5 h-4.5 mr-3 text-red-500" />
                  <span>{t('importFromYouTube', 'Import from YouTube')}</span>
                </div>
              </button>

              {/* iPod export and backup item */}
              <button
                onClick={() => {
                  setSelectedPlaylist(null);
                  setSelectedAlbum(null);
                  setSelectedIpodPlaylist(null);
                  setActiveTab('ipod-export');
                  if (deviceInfo.connected && ipodTracks.length === 0) {
                    fetchIpodTracks();
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'ipod-export'
                    ? 'text-white font-semibold bg-white/[0.06]'
                    : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center">
                  <FolderDown className={`w-4.5 h-4.5 mr-3 ${activeTab === 'ipod-export' ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`} />
                  <span>{t('ipodBackupExport', 'iPod Backup & Export')}</span>
                </div>
              </button>

              {/* Settings item */}
              <button
                onClick={() => { setSelectedPlaylist(null); setSelectedAlbum(null); setSelectedIpodPlaylist(null); setActiveTab('settings'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[15px] font-medium transition-colors cursor-pointer ${activeTab === 'settings'
                    ? 'text-white font-semibold bg-white/[0.06]'
                    : 'text-[#AEAEB2] hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                <div className="flex items-center">
                  <Settings className={`w-4.5 h-4.5 mr-3 ${activeTab === 'settings' ? 'text-[#FA2D48]' : 'text-[#8E8E93]'}`} />
                  <span>{t('settings', 'Settings')}</span>
                </div>
              </button>
            </div>
          </div>
        </aside>

        {/* Main content container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <main className={`flex-1 bg-[#18181a] relative ${activeTab === 'ipod-summary' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>

            {/* Apple Music Songs and Playlist Detail View */}
            {activeTab === 'apple-songs' && (
              <div className="space-y-4 animate-fade-in pb-12">
                {selectedPlaylist ? (
                  <div className="space-y-6">
                    {/* Back to Playlists Button */}
                    <div className="px-7 pt-6 pb-0">
                      <button
                        onClick={() => {
                          setSelectedPlaylist(null);
                          setActiveTab('apple-playlists');
                        }}
                        className="flex items-center gap-1 text-[12px] font-medium text-[#FA2D48] hover:underline cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>{t('backToPlaylists', 'Back to playlists')}</span>
                      </button>
                    </div>

                    {/* Playlist Hero Info Card */}
                    <div className="px-7 flex items-end gap-6">
                      <img
                        src={selectedPlaylist.cover || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600'}
                        className="w-48 h-48 rounded-[10px] apple-cover-shadow object-cover border border-white/10 shrink-0"
                        alt="Cover"
                      />
                      <div className="space-y-2.5 flex-1 min-w-0 pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#FA2D48]">{t('playlistBadge', 'Playlist')}</span>
                        <h1 className="text-[32px] font-bold tracking-tight text-white truncate">{selectedPlaylist.title}</h1>
                        <p className="text-[#8E8E93] text-[13px] flex items-center gap-1.5 flex-wrap">
                          <span>{getSongCount(filteredLibrarySongs.length, i18n.language)}</span>
                          {(() => {
                            const durStr = formatTotalDuration(filteredLibrarySongs, i18n.language);
                            return durStr ? <span>• {durStr}</span> : null;
                          })()}
                          {selectedPlaylist.description && !selectedPlaylist.description.includes('Your personal Apple Music playlist') && selectedPlaylist.description !== 'Recently Updated' && selectedPlaylist.description !== 'Обновлено недавно'
                            ? <span>• {selectedPlaylist.description}</span>
                            : null}
                        </p>

                        <div className="flex items-center gap-3 pt-2 flex-wrap">
                          <button
                            onClick={() => {
                              if (filteredLibrarySongs.length > 0) playTrack(filteredLibrarySongs[0], filteredLibrarySongs);
                            }}
                            className="btn-apple-red py-2 px-5 rounded-full text-[12px] font-bold flex items-center gap-2 cursor-pointer shadow-md"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{t('playAll', 'Play')}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (filteredLibrarySongs.length > 0) {
                                setIsShuffle(true);
                                isShuffleRef.current = true;
                                const randIdx = Math.floor(Math.random() * filteredLibrarySongs.length);
                                playTrack(filteredLibrarySongs[randIdx], filteredLibrarySongs);
                              }
                            }}
                            className="btn-apple-pill-glass py-2 px-5 rounded-full text-[12px] font-semibold flex items-center gap-2 cursor-pointer"
                          >
                            <Shuffle className="w-3.5 h-3.5 text-[#FA2D48]" />
                            <span>{t('shuffleAll', 'Shuffle')}</span>
                          </button>

                          {(() => {
                            const unsyncedCount = filteredLibrarySongs.filter(t => !checkIsSynced(t, selectedPlaylist)).length;
                            return (
                              <>
                                {unsyncedCount > 0 && unsyncedCount < filteredLibrarySongs.length && (
                                  <button
                                    onClick={() => syncWholePlaylist(selectedPlaylist, true)}
                                    className="bg-[#FA2D48]/15 hover:bg-[#FA2D48]/25 text-[#FA2D48] border border-[#FA2D48]/30 py-2 px-4 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>{t('syncNew', 'Sync New')} ({unsyncedCount})</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => syncWholePlaylist(selectedPlaylist, false)}
                                  className="btn-apple-pill-glass py-2 px-4 rounded-full text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5 text-[#FA2D48]" />
                                  <span>{t('syncToIpod', 'Sync to iPod')} ({filteredLibrarySongs.length})</span>
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-7 pt-6 pb-2 flex items-center justify-between">
                    <div>
                      <h1 className="text-[28px] font-bold tracking-tight text-white">{t('songs', 'Songs')}</h1>
                      <p className="text-[#8E8E93] text-[12px] font-normal mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{getSongCount(filteredLibrarySongs.length, i18n.language)}</span>
                        {(() => {
                          const durStr = formatTotalDuration(filteredLibrarySongs, i18n.language);
                          return durStr ? <span>• {durStr}</span> : null;
                        })()}
                        <span>• {t('appleMusicLibrary', 'Apple Music Library')}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Library songs search field */}
                      <div className="relative w-64">
                        <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={songSearchQuery}
                          onChange={(e) => setSongSearchQuery(e.target.value)}
                          placeholder={t('searchSongsPlaceholder', 'Search songs or artists...')}
                          className="w-full pl-8 pr-7 py-1.5 rounded-[6px] bg-[#222225] border border-white/[0.06] text-[12px] text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#FA2D48]/70"
                        />
                        {songSearchQuery && (
                          <button onClick={() => setSongSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-white">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Apple Music songs table */}
                {isLoadingPlaylistTracks ? (
                  <div className="py-24 text-center space-y-3">
                    <RefreshCw className="w-6 h-6 text-[#FA2D48] animate-spin mx-auto mb-2" />
                    <p className="font-semibold text-[13px] text-white">{t('loadingTracks', 'Loading tracks...')}</p>
                  </div>
                ) : filteredLibrarySongs.length === 0 ? (
                  <div className="py-24 text-center space-y-3">
                    <Music className="w-8 h-8 text-[#8E8E93]/60 mx-auto stroke-[1.75]" />
                    <p className="font-semibold text-[14px] text-white">
                      {selectedPlaylist ? t('noSongsInPlaylist', 'No songs in this playlist yet') : t('libraryEmpty', 'Library is empty')}
                    </p>
                  </div>
                ) : (
                  <div className="w-full select-none">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-left text-[14px] border-collapse">
                        <thead className="sticky top-0 z-10 bg-[#18181a] text-[#8E8E93] font-semibold text-[12px] select-none border-b border-white/[0.08]">
                          <tr>
                            <th className="w-10 pl-7 pr-2 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={filteredLibrarySongs.length > 0 && filteredLibrarySongs.every(t => selectedTracks.has(t.id))}
                                onChange={() => selectAllFiltered(filteredLibrarySongs)}
                                className="apple-checkbox"
                              />
                            </th>
                            <th className="w-8 px-1 py-3 text-center">#</th>
                            <th className="px-3 py-3">{t('tableTitle', 'Title')}</th>
                            <th className="px-3 py-3">{t('tableArtist', 'Artist')}</th>
                            <th className="px-3 py-3">{t('tableAlbum', 'Album')}</th>
                            <th className="px-3 py-3">{t('tableGenre', 'Genre')}</th>
                            <th className="px-3 py-3 text-center">{t('tableTime', 'Time')}</th>
                            <th className="w-16 pr-7 px-3 py-3 text-center">{t('tableQueue', 'Queue')}</th>
                          </tr>
                        </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {filteredLibrarySongs.slice(0, renderedSongLimit).map((track, idx) => {
                          const isSynced = checkIsSynced(track, selectedPlaylist);
                          const isSelected = selectedTracks.has(track.id);
                          const isThisPlaying = currentTrack?.id === track.id && isPlaying;
                          const isInQueue = syncQueueIds.has(track.id);
                          const trackGenre = track.genre && track.genre !== 'Unknown' ? track.genre : '—';

                          return (
                            <tr
                              key={track.id ? `${track.id}-${idx}` : idx}
                              onDoubleClick={() => playTrack(track, filteredLibrarySongs)}
                              className={`group transition-colors ${isThisPlaying
                                  ? 'bg-[#FA2D48]/15 text-white'
                                  : isSelected
                                    ? 'bg-white/[0.1]'
                                    : (idx % 2 === 1 ? 'bg-white/[0.035]' : 'bg-transparent')
                                } hover:bg-white/[0.08]`}
                            >
                              {/* Track selection checkbox */}
                              <td className="pl-7 pr-2 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTrackSelection(track.id)}
                                  className="apple-checkbox"
                                />
                              </td>

                              {/* Track number and play button */}
                              <td className="px-1 py-2.5 text-center text-[#8E8E93] font-mono text-[12px] tabular-nums">
                                <button
                                  onClick={() => playTrack(track, filteredLibrarySongs)}
                                  className="w-5 h-5 mx-auto flex items-center justify-center rounded hover:text-[#FA2D48] transition-colors cursor-pointer"
                                >
                                  {isThisPlaying ? (
                                    <Pause className="w-3.5 h-3.5 fill-current text-[#FA2D48]" />
                                  ) : (
                                    <span className="group-hover:hidden">{idx + 1}</span>
                                  )}
                                  {!isThisPlaying && <Play className="w-3.5 h-3.5 fill-current hidden group-hover:block text-[#FA2D48]" />}
                                </button>
                              </td>

                              {/* Track title and artwork */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="relative shrink-0">
                                    <img
                                      src={getTrackCover(track) || 'https://images.unsplash.com/photo-1514525253361-b83f859b73c0?w=100'}
                                      className="w-[36px] h-[36px] rounded-[5px] object-cover border border-white/10 shadow-sm"
                                      loading="lazy"
                                      alt=""
                                    />
                                    {isSynced && (
                                      <div
                                        title={selectedPlaylist ? t('inThisPlaylistOnIpod', 'In this playlist on iPod') : t('syncedWithIpod', 'Synced with iPod')}
                                        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#18181a] rounded-full flex items-center justify-center shadow-sm"
                                      >
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#30D158] flex items-center justify-center text-black">
                                          <Check className="w-2 h-2 stroke-[3]" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <span className={`font-semibold text-[15px] truncate block ${isThisPlaying ? 'text-[#FA2D48]' : 'text-white'}`}>
                                    {track.title}
                                  </span>
                                </div>
                              </td>

                              {/* Artist */}
                              <td className="px-3 py-2.5 text-[#8E8E93] text-[14px] font-medium truncate max-w-[180px] group-hover:text-[#A1A1A6]">
                                {track.artist}
                              </td>

                              {/* Album */}
                              <td className="px-3 py-2.5 text-[#8E8E93] text-[14px] truncate max-w-[200px]">
                                {track.album}
                              </td>

                              {/* Genre */}
                              <td className="px-3 py-2.5 text-[#8E8E93] text-[13.5px] truncate max-w-[140px]">
                                {trackGenre}
                              </td>

                              {/* Duration */}
                              <td className="px-3 py-2.5 text-center text-[#8E8E93] font-mono text-[13px] tabular-nums">
                                {formatTime(track.duration)}
                              </td>

                              {/* Lyrics and queue buttons */}
                              <td className="pr-7 px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openLyrics(track);
                                    }}
                                    title={t('viewLyrics', 'View lyrics')}
                                    className="p-1.5 rounded-full text-[#8E8E93] hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                  >
                                    <Mic2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => addToQueue(track)}
                                    title={isInQueue ? t('inQueueClickToRemove', 'In queue (Click to remove)') : t('addToSyncQueue', 'Add to sync queue')}
                                    className={`p-1.5 rounded-full transition-all cursor-pointer ${isInQueue
                                        ? 'bg-[#FA2D48] text-white shadow-sm'
                                        : isSynced
                                          ? 'bg-[#30D158]/15 text-[#30D158] hover:bg-[#FA2D48] hover:text-white'
                                          : 'bg-white/10 hover:bg-[#FA2D48] hover:text-white text-[#8E8E93]'
                                      }`}
                                  >
                                    {isInQueue ? (
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                    ) : (
                                      <Plus className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination and load more */}
                  {filteredLibrarySongs.length > renderedSongLimit && (
                    <div className="py-4 text-center">
                      <button
                        onClick={() => setRenderedSongLimit(prev => prev + 80)}
                        className="text-[14px] font-semibold text-[#FA2D48] hover:underline cursor-pointer"
                      >
                        {t('showMore', 'Show more')}
                      </button>
                    </div>
                  )}
                </div>
              )}


        </div>
          )}

        {/* Apple Music albums tab */}
        {activeTab === 'apple-albums' && (
          <div className="p-7 space-y-6 animate-fade-in">
            {selectedAlbum ? (
              /* Selected album detail view */
              <div className="space-y-8">
                {/* Back to albums button */}
                <button
                  onClick={() => setSelectedAlbum(null)}
                  className="flex items-center gap-1 text-[12px] font-medium text-[#FA2D48] hover:underline cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t('backToAlbums', 'Back to albums')}</span>
                </button>

                {/* Album hero header */}
                <div className="flex items-start gap-8">
                  <img
                    src={selectedAlbum.cover || 'https://images.unsplash.com/photo-1514525253361-b83f859b73c0?w=600'}
                    className="w-56 h-56 rounded-[10px] apple-cover-shadow object-cover border border-white/10 shrink-0 bg-[#222225]"
                    alt="Album Cover"
                  />
                  <div className="space-y-2 flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-[28px] font-bold tracking-tight text-white">{selectedAlbum.title}</h1>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/80">E</span>
                    </div>

                    {/* Album artist */}
                    <p className="text-[#FA2D48] text-[16px] font-semibold hover:underline cursor-pointer">
                      {selectedAlbum.artist}
                    </p>

                    {/* Album metadata */}
                    <p className="text-[#8E8E93] text-[12px]">
                      {selectedAlbum.genre || 'Rock'} • {selectedAlbum.year || '1973'} • Dolby Atmos • Hi-Res Lossless • Apple Digital Master
                    </p>

                    {/* Album description */}
                    <p className="text-[#8E8E93]/80 text-[12px] max-w-2xl line-clamp-2 pt-1 leading-relaxed">
                      {selectedAlbum.title} — an iconic album release. Seamless transitions and rich sound dynamic throughout the record.
                    </p>

                    {/* Album play and sync actions */}
                    <div className="flex items-center gap-3 pt-3 flex-wrap">
                      <button
                        onClick={() => {
                          if (selectedAlbum.tracks.length > 0) playTrack(selectedAlbum.tracks[0], selectedAlbum.tracks);
                        }}
                        className="btn-apple-red py-2 px-5 rounded-full text-[12px] font-bold flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{t('playAll', 'Play')}</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectedAlbum.tracks.length > 0) {
                            setIsShuffle(true);
                            isShuffleRef.current = true;
                            const randIdx = Math.floor(Math.random() * selectedAlbum.tracks.length);
                            playTrack(selectedAlbum.tracks[randIdx], selectedAlbum.tracks);
                          }
                        }}
                        className="btn-apple-pill-glass py-2 px-5 rounded-full text-[12px] font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-[#FA2D48]" />
                        <span>{t('shuffleAll', 'Shuffle')}</span>
                      </button>

                      {(() => {
                        const unsyncedCount = selectedAlbum.tracks.filter(t => !checkIsSynced(t)).length;
                        return (
                          <>
                            {unsyncedCount > 0 && unsyncedCount < selectedAlbum.tracks.length && (
                              <button
                                onClick={() => syncWholeAlbum(selectedAlbum, true)}
                                className="bg-[#FA2D48]/15 hover:bg-[#FA2D48]/25 text-[#FA2D48] border border-[#FA2D48]/30 py-2 px-4 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{t('syncNew', 'Sync New')} ({unsyncedCount})</span>
                              </button>
                            )}
                            <button
                              onClick={() => syncWholeAlbum(selectedAlbum, false)}
                              className="btn-apple-pill-glass py-2 px-4 rounded-full text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#FA2D48]" />
                              <span>{t('syncToIpod', 'Sync to iPod')} ({selectedAlbum.trackCount})</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Album tracklist table */}
                <div className="pt-2">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <tbody>
                      {selectedAlbum.tracks.map((track, idx) => {
                        const isSynced = checkIsSynced(track);
                        const isThisPlaying = currentTrack?.id === track.id && isPlaying;
                        const isInQueue = syncQueueIds.has(track.id);

                        return (
                          <tr
                            key={track.id ? `${track.id}-${idx}` : idx}
                            onDoubleClick={() => playTrack(track, selectedAlbum.tracks)}
                            className={`group transition-colors ${isThisPlaying
                                ? 'bg-[#FA2D48]/15 text-white'
                                : (idx % 2 === 1 ? 'bg-white/[0.035]' : 'bg-transparent')
                              } hover:bg-white/[0.08]`}
                          >
                            {/* Track number and play button */}
                            <td className="w-8 px-2 py-2.5 text-center text-[#8E8E93] font-mono text-[11px] tabular-nums">
                              <button
                                onClick={() => playTrack(track, selectedAlbum.tracks)}
                                className="w-5 h-5 mx-auto flex items-center justify-center rounded hover:text-[#FA2D48] transition-colors cursor-pointer"
                              >
                                {isThisPlaying ? (
                                  <Pause className="w-3.5 h-3.5 fill-current text-[#FA2D48]" />
                                ) : (
                                  <span className="group-hover:hidden">{track.track_number || track.trackNumber || (idx + 1)}</span>
                                )}
                                {!isThisPlaying && <Play className="w-3.5 h-3.5 fill-current hidden group-hover:block text-[#FA2D48]" />}
                              </button>
                            </td>

                            {/* Track title */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-between gap-3 min-w-0">
                                <span className={`font-medium text-[13px] truncate block ${isThisPlaying ? 'text-[#FA2D48]' : 'text-white'}`}>
                                  {track.title}
                                </span>
                                {isSynced && (
                                  <div
                                    title={t('syncedWithIpod', 'Synced with iPod')}
                                    className="w-4 h-4 rounded-full bg-[#30D158] flex items-center justify-center text-black shrink-0 ml-auto shadow-sm"
                                  >
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Duration */}
                            <td className="px-3 py-2.5 text-right text-[#8E8E93] font-mono text-[11px] tabular-nums">
                              {formatTime(track.duration)}
                            </td>

                            {/* Add track to sync queue */}
                            <td className="w-10 px-3 py-2.5 text-right">
                              <button
                                onClick={() => addToQueue(track)}
                                title={isInQueue ? t('inQueue', 'In Queue') : t('addToSyncQueue', 'Add to sync queue')}
                                className={`p-1.5 rounded-full transition-all cursor-pointer ${isInQueue
                                    ? 'bg-[#FA2D48] text-white shadow-sm'
                                    : 'bg-white/10 hover:bg-[#FA2D48] hover:text-white text-[#8E8E93]'
                                  }`}
                              >
                                {isInQueue ? (
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                ) : (
                                  <Plus className="w-3 h-3" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Album summary and copyright */}
                  <div className="pt-6 text-[12px] text-[#8E8E93]">
                    <p>{getTrackCount(selectedAlbum.trackCount, i18n.language)}, {formatTime(selectedAlbum.duration)}</p>
                    <p className="text-[11px] text-[#8E8E93]/60 pt-1">℗ {selectedAlbum.year || '2023'} {selectedAlbum.artist}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* All albums grid view */
              <div className="space-y-6">
                {/* Header: search and sort controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
                  <div>
                    <h1 className="text-[26px] font-bold tracking-tight text-white">{t('albums', 'Albums')}</h1>
                    <p className="text-[#8E8E93] text-[12px] font-normal mt-0.5">
                      {getAlbumCount(filteredAlbums.length, i18n.language)} • {getSongCount(librarySongs.length, i18n.language)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Albums search field */}
                    <div className="relative w-56">
                      <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={albumSearchQuery}
                        onChange={(e) => setAlbumSearchQuery(e.target.value)}
                        placeholder={t('searchAlbumsPlaceholder', 'Search albums...')}
                        className="w-full bg-[#222225] border border-white/[0.06] rounded-[6px] pl-8 pr-6 py-1.5 text-[12px] text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#FA2D48]/70"
                      />
                      {albumSearchQuery && (
                        <button onClick={() => setAlbumSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Albums sort selector */}
                    <select
                      value={albumSortBy}
                      onChange={(e) => setAlbumSortBy(e.target.value)}
                      className="bg-[#222225] border border-white/[0.06] rounded-[6px] px-3 py-1.5 text-[12px] text-[#8E8E93] hover:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="recent">{t('sortRecentlyAdded', 'Recently Added')}</option>
                      <option value="title">{t('sortTitle', 'By Title')}</option>
                      <option value="artist">{t('sortArtist', 'By Artist')}</option>
                      <option value="count">{t('sortTrackCount', 'By Track Count')}</option>
                    </select>
                  </div>
                </div>

                {filteredAlbums.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <Disc className="w-10 h-10 text-[#8E8E93]/40 mx-auto" />
                    <h3 className="font-semibold text-white text-sm">{t('noAlbumsFound', 'No albums found')}</h3>
                    <p className="text-[#8E8E93] text-xs max-w-sm mx-auto">
                      {albumSearchQuery ? t('noAlbumsMatchQuery', 'No albums found matching your search.') : t('signInToLoadAlbums', 'Sign in to Apple Music to load your albums.')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {filteredAlbums.slice(0, renderedAlbumLimit).map((album, idx) => (
                        <div
                          key={album.id ? `${album.id}-${idx}` : idx}
                          onClick={() => setSelectedAlbum(album)}
                          className="group cursor-pointer flex flex-col space-y-2 select-none"
                        >
                          <div className="aspect-square relative rounded-[8px] overflow-hidden bg-[#222225] border border-white/[0.06] apple-card-shadow">
                            <img
                              src={album.cover || 'https://images.unsplash.com/photo-1514525253361-b83f859b73c0?w=600'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                              alt={album.title}
                            />

                            {/* Hover quick action overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (album.tracks.length > 0) playTrack(album.tracks[0], album.tracks);
                                }}
                                title={t('playAlbum', 'Play Album')}
                                className="w-10 h-10 rounded-full bg-[#FA2D48] text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                              >
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  syncWholeAlbum(album, false);
                                }}
                                title={t('syncToIpod', 'Sync to iPod')}
                                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center shadow-lg border border-white/20 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="absolute bottom-2 left-2 pointer-events-none">
                              <span className="text-[11px] bg-black/80 px-2 py-0.5 rounded backdrop-blur font-mono font-medium text-white/95">
                                {getTrackCount(album.trackCount, i18n.language)}
                              </span>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <h4 className="font-semibold text-[15px] text-white truncate group-hover:text-[#FA2D48] transition-colors tracking-tight" title={album.title}>
                              {album.title}
                            </h4>
                            <p className="text-[13.5px] text-[#8E8E93] truncate mt-0.5" title={album.artist}>
                              {album.artist}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Albums grid pagination */}
                    {filteredAlbums.length > renderedAlbumLimit && (
                      <div className="p-4 text-center">
                        <button
                          onClick={() => setRenderedAlbumLimit(prev => prev + 60)}
                          className="btn-apple-pill-glass py-2 px-6 rounded-full text-[12px] font-semibold cursor-pointer"
                        >
                          {t('showMore', 'Show more')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Apple Music playlists grid tab */}
        {activeTab === 'apple-playlists' && (
          <div className="space-y-4 animate-fade-in pb-12">
            <div className="px-7 pt-6 pb-2 flex items-center justify-between">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight text-white">{t('playlists', 'Playlists')}</h1>
                <p className="text-[#8E8E93] text-[12px] font-normal mt-0.5">
                  {getPlaylistCount(playlists.length, i18n.language)} {t('inAppleMusicLibrary', 'in your Apple Music library')}
                </p>
              </div>
            </div>

            {playlists.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <ListMusic className="w-10 h-10 text-[#8E8E93]/40 mx-auto" />
                <h3 className="font-semibold text-white text-sm">{t('noPlaylistsFound', 'No playlists found')}</h3>
                <p className="text-[#8E8E93] text-xs max-w-sm mx-auto">
                  {t('noPlaylistsFoundDesc', 'Sign in with your Apple ID in Settings to load your cloud playlists.')}
                </p>
              </div>
            ) : (
              <div className="px-7 pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {sortedPlaylists.map((pl, idx) => {
                  const actualTrackCount = pl.trackCount || (playlistTracksMap[pl.id]?.length) || (pl.tracks?.length) || 0;
                  return (
                    <div
                      key={pl.id ? `${pl.id}-${idx}` : idx}
                      onClick={() => selectPlaylist(pl)}
                      className="group cursor-pointer flex flex-col space-y-2 select-none"
                    >
                      <div className="aspect-square relative rounded-[8px] overflow-hidden bg-[#222225] border border-white/[0.06] apple-card-shadow">
                        <img
                          src={pl.cover || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          alt={pl.title}
                        />
                        <div className="absolute bottom-2 left-2">
                          <span className="text-[9.5px] bg-black/75 px-1.5 py-0.5 rounded backdrop-blur font-mono text-white/90">
                            {getTrackCount(actualTrackCount, i18n.language)}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-[15px] text-white truncate group-hover:text-[#FA2D48] transition-colors tracking-tight">{pl.title}</h4>
                        {pl.description && !pl.description.includes('Your personal Apple Music playlist') && pl.description !== 'Apple Music Playlist' && pl.description !== 'Плейлист Apple Music' && (
                          <p className="text-[13px] text-[#8E8E93] truncate mt-0.5">{pl.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* YouTube search and import tab */}
        {activeTab === 'youtube-search' && (
          <div className="p-8 space-y-6 animate-fade-in max-w-6xl mx-auto">
            <div className="pb-3">
              <h1 className="text-[28px] font-bold tracking-tight text-white">YouTube Import</h1>
              <p className="text-[#8E8E93] text-[12px] font-normal mt-0.5">
                Search live tracks, rare singles, and remixes to sync directly to your iPod
              </p>
            </div>

            {/* YouTube search form */}
            <form onSubmit={performYoutubeSearch} className="flex gap-2">
              <input
                type="text"
                value={ytQuery}
                onChange={(e) => setYtQuery(e.target.value)}
                placeholder="Song name, artist, remix, live version..."
                className="flex-1 px-3.5 py-2 rounded-[8px] bg-[#1C1C1E] border border-[#38383A] text-[13px] text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#FA243C]"
              />
              <button
                type="submit"
                disabled={isSearchingYt}
                className="btn-apple-red px-5 rounded-[8px] text-[12px] font-semibold cursor-pointer disabled:opacity-50"
              >
                {isSearchingYt ? 'Searching...' : 'Search'}
              </button>
            </form>

            {ytSearchError && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-[6px] border border-red-500/20">{ytSearchError}</p>
            )}

            {/* YouTube search results list */}
            <div className="space-y-2">
              {ytResults.map((cand, idx) => {
                const ytTrack = {
                  id: cand.id,
                  title: cand.title,
                  artist: cand.channel || 'YouTube',
                  album: 'YouTube Stream',
                  duration: cand.duration || 180,
                  youtube_id: cand.id,
                  cover_url: cand.thumbnail,
                  is_full: true,
                  bitrate: '256 kbps'
                };
                const isThisPlaying = currentTrack?.id === cand.id && isPlaying;

                return (
                  <div
                    key={cand.id ? `${cand.id}-${idx}` : idx}
                    onDoubleClick={() => playTrack(ytTrack)}
                    className={`bg-[#1C1C1E] border ${isThisPlaying ? 'border-[#FA243C]/60 bg-white/[0.04]' : 'border-[#38383A]'} p-2.5 rounded-[8px] flex items-center justify-between gap-3 hover:border-[#8E8E93]/50 transition-all select-none group`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      {/* YouTube track thumbnail preview */}
                      <div
                        onClick={() => playTrack(ytTrack)}
                        className="w-10 h-10 rounded-[6px] overflow-hidden shrink-0 border border-[#38383A] relative cursor-pointer group/thumb bg-black"
                      >
                        <img src={cand.thumbnail} className="w-full h-full object-cover" alt="Thumb" />
                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-thumb:opacity-100'}`}>
                          {isThisPlaying ? (
                            <div className="flex items-end gap-[1.5px] h-3">
                              <div className="eq-bar" />
                              <div className="eq-bar" />
                              <div className="eq-bar" />
                            </div>
                          ) : (
                            <Play className="w-4 h-4 text-white fill-current" />
                          )}
                        </div>
                      </div>

                      <div className="truncate">
                        <h4 className="font-semibold text-[12.5px] text-white truncate group-hover:text-white transition-colors">{cand.title}</h4>
                        <p className="text-[11px] text-[#8E8E93] font-mono mt-0.5">{cand.channel} • {cand.durationFormatted}</p>
                      </div>
                    </div>

                    {/* Play and add to queue buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => playTrack(ytTrack)}
                        title={isThisPlaying ? 'Pause' : 'Play full track'}
                        className={`py-1 px-3 rounded-full text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 transition-colors ${isThisPlaying
                            ? 'bg-[#FA243C] text-white shadow-md'
                            : 'bg-[#2C2C2E] hover:bg-white/10 text-white border border-[#38383A]'
                          }`}
                      >
                        {isThisPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Play</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => addToQueue(ytTrack)}
                        className={`py-1 px-3 rounded-full text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 transition-all ${syncQueueIds.has(cand.id)
                            ? 'bg-[#FA243C] text-white shadow-md'
                            : 'bg-[#2C2C2E] hover:bg-white/10 text-[#8E8E93] hover:text-white border border-[#38383A]'
                          }`}
                      >
                        {syncQueueIds.has(cand.id) ? (
                          <>
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>In Queue</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Add to Queue</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* iPod export and backup tab */}
        {activeTab === 'ipod-export' && (() => {
          const filteredExportTracks = exportSearchQuery.trim()
            ? ipodTracks.filter(t =>
                (t.title && t.title.toLowerCase().includes(exportSearchQuery.toLowerCase())) ||
                (t.artist && t.artist.toLowerCase().includes(exportSearchQuery.toLowerCase())) ||
                (t.album && t.album.toLowerCase().includes(exportSearchQuery.toLowerCase()))
              )
            : ipodTracks;

          const filteredExportPlaylists = exportSearchQuery.trim()
            ? ipodPlaylists.filter(p =>
                (p.title && p.title.toLowerCase().includes(exportSearchQuery.toLowerCase())) ||
                (p.name && p.name.toLowerCase().includes(exportSearchQuery.toLowerCase()))
              )
            : ipodPlaylists;

          const isSelectionActive = selectedExportTrackIds.size > 0;
          const effectiveExportCount = isSelectionActive
            ? selectedExportTrackIds.size
            : filteredExportTracks.length;

          const toggleSelectAll = () => {
            if (selectedExportTrackIds.size === filteredExportTracks.length && filteredExportTracks.length > 0) {
              setSelectedExportTrackIds(new Set());
            } else {
              setSelectedExportTrackIds(new Set(filteredExportTracks.map(t => t.id || t.path)));
            }
          };

          const toggleTrackSelection = (trackKey) => {
            setSelectedExportTrackIds(prev => {
              const next = new Set(prev);
              if (next.has(trackKey)) {
                next.delete(trackKey);
              } else {
                next.add(trackKey);
              }
              return next;
            });
          };

          return (
            <div className="space-y-4 animate-fade-in pb-12">
              {/* iPod export header */}
              <div className="px-7 pt-6 pb-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-[28px] font-bold tracking-tight text-white">{t('ipodBackupExport', 'Экспорт музыки с iPod')}</h1>
                  <p className="text-[#8E8E93] text-[12px] font-normal mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {deviceInfo.connected ? (
                      <>
                        <span>
                          {exportMode === 'playlists'
                            ? getPlaylistCount(filteredExportPlaylists.length, i18n.language)
                            : getSongCount(filteredExportTracks.length, i18n.language)}
                        </span>
                        {isSelectionActive && exportMode === 'all' && (
                          <>
                            <span>•</span>
                            <span className="text-[#007AFF] font-medium">
                              Выбрано: {selectedExportTrackIds.size}
                            </span>
                            <button
                              onClick={() => setSelectedExportTrackIds(new Set())}
                              className="text-[#8E8E93] hover:text-white underline text-[11px] cursor-pointer"
                            >
                              (сбросить)
                            </button>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono text-white/80 truncate max-w-sm" title={exportDestinationFolder}>
                          {exportDestinationFolder ? `Папка: ${exportDestinationFolder}` : 'iPod Music Export'}
                        </span>
                      </>
                    ) : (
                      <span>{t('connectIpodToExport', 'Подключите iPod, чтобы выгрузить музыку на этот компьютер')}</span>
                    )}
                  </p>
                </div>

                {/* Action controls: search, mode toggle, folder picker, export button */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Export search input */}
                  {deviceInfo.connected && (
                    <div className="relative w-56">
                      <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={exportSearchQuery}
                        onChange={(e) => setExportSearchQuery(e.target.value)}
                        placeholder={exportMode === 'playlists' ? t('searchPlaylistsPlaceholder', 'Поиск плейлистов...') : t('searchSongsPlaceholder', 'Поиск треков...')}
                        className="w-full pl-8 pr-7 py-1.5 rounded-[6px] bg-[#222225] border border-white/[0.06] text-[12px] text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#007AFF]"
                      />
                      {exportSearchQuery && (
                        <button onClick={() => setExportSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Export mode toggle: all songs vs playlists */}
                  {deviceInfo.connected && ipodPlaylists.length > 0 && (
                    <div className="flex items-center bg-[#222225] p-0.5 rounded-full border border-white/[0.06]">
                      <button
                        onClick={() => { setExportMode('all'); setSelectedExportPlaylist(null); }}
                        className={`px-3 py-1 rounded-full text-[11.5px] font-medium transition-all cursor-pointer ${
                          exportMode === 'all'
                            ? 'bg-[#007AFF] text-white shadow-sm'
                            : 'text-[#8E8E93] hover:text-white'
                        }`}
                      >
                        {t('songs', 'Песни')} ({ipodTracks.length})
                      </button>
                      <button
                        onClick={() => setExportMode('playlists')}
                        className={`px-3 py-1 rounded-full text-[11.5px] font-medium transition-all cursor-pointer ${
                          exportMode === 'playlists'
                            ? 'bg-[#007AFF] text-white shadow-sm'
                            : 'text-[#8E8E93] hover:text-white'
                        }`}
                      >
                        {t('playlists', 'Плейлисты')} ({ipodPlaylists.length})
                      </button>
                    </div>
                  )}

                  {/* Target export destination folder */}
                  <button
                    onClick={handleSelectExportFolder}
                    className="btn-apple-pill-glass py-1.5 px-3.5 rounded-full text-[12px] text-[#8E8E93] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                    title={exportDestinationFolder || t('selectFolder', 'Выбрать папку')}
                  >
                    <Folder className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span>{t('changeFolder', 'Папка')}</span>
                  </button>

                  {exportDestinationFolder && (
                    <button
                      onClick={() => window.electron?.openPath(exportDestinationFolder)}
                      title={t('openInExplorer', 'Открыть в Проводнике')}
                      className="btn-apple-pill-glass p-1.5 rounded-full text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Start and cancel export buttons */}
                  {deviceInfo.connected && (
                    isExportingIpod ? (
                      <button
                        onClick={handleCancelIpodExport}
                        className="py-1.5 px-4 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-[12px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{t('cancelExport', 'Отменить')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (isSelectionActive) {
                            handleStartIpodExport(filteredExportTracks.filter(t => selectedExportTrackIds.has(t.id || t.path)));
                          } else {
                            handleStartIpodExport(filteredExportTracks);
                          }
                        }}
                        disabled={effectiveExportCount === 0}
                        className="btn-apple-red py-1.5 px-4 rounded-full text-[12px] font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        <FolderDown className="w-3.5 h-3.5" />
                        <span>
                          {isSelectionActive
                            ? `Экспортировать выбранные (${selectedExportTrackIds.size})`
                            : `${t('startExport', 'Экспортировать на ПК')} (${filteredExportTracks.length})`}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Reverse export progress indicator */}
              {isExportingIpod && (
                <div className="mx-7 p-4 rounded-[12px] bg-[#1a1a1d] border border-blue-500/30 apple-card-shadow space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <div className="flex items-center gap-2 text-white font-medium">
                      <Loader2 className="w-4 h-4 text-[#007AFF] animate-spin" />
                      <span>{t('exportingTitle', 'Выгрузка треков с iPod...')}</span>
                      {exportProgress.currentTrack && (
                        <span className="text-[#8E8E93] truncate font-normal hidden sm:inline">
                          — {exportProgress.currentTrack.artist} - {exportProgress.currentTrack.title}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-[#007AFF]">{exportProgress.percent}% ({exportProgress.current}/{exportProgress.total})</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/[0.08]">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-150"
                      style={{ width: `${exportProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Export success banner */}
              {exportResult && !isExportingIpod && (
                <div className="mx-7 p-3.5 rounded-[12px] bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2.5 text-[12.5px] text-white">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {t('exportCompleteTitle', 'Выгрузка завершена!')} Экспортировано <strong>{exportResult.exported}</strong> из {exportResult.total} треков
                      {exportResult.skipped > 0 && <span className="text-[#8E8E93] ml-1.5">({exportResult.skipped} пропущено)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => window.electron?.openPath(exportResult.destinationPath || exportDestinationFolder)}
                      className="px-3 py-1 rounded-[6px] bg-emerald-500 hover:bg-emerald-600 text-white text-[11.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{t('openInExplorer', 'Открыть папку')}</span>
                    </button>
                    <button
                      onClick={() => setExportResult(null)}
                      className="p-1 text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Export error banner */}
              {exportError && (
                <div className="mx-7 p-3 rounded-[10px] bg-red-500/10 border border-red-500/25 text-red-400 text-[12.5px] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{exportError}</span>
                  </div>
                  <button onClick={() => setExportError('')} className="text-red-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Export content view */}
              {!deviceInfo.connected ? (
                <div className="py-24 text-center space-y-3">
                  <Usb className="w-8 h-8 text-[#FA2D48] mx-auto stroke-[1.75]" />
                  <div className="space-y-1">
                    <h3 className="font-semibold text-[15px] text-white">{t('ipodNotConnected', 'iPod Not Connected')}</h3>
                    <p className="text-[12.5px] text-[#8E8E93] max-w-md mx-auto leading-relaxed">
                      {t('ipodNotConnectedDesc', 'Connect your iPod Classic, Nano, or Mini using a 30-pin USB cable. PodSync will automatically detect the device and load storage info.')}
                    </p>
                  </div>
                </div>
              ) : exportMode === 'playlists' ? (
                /* iPod playlists export grid */
                filteredExportPlaylists.length === 0 ? (
                  <div className="py-24 text-center space-y-3">
                    <ListMusic className="w-8 h-8 text-[#8E8E93]/60 mx-auto stroke-[1.75]" />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-[15px] text-white">{t('noPlaylistsFound', 'No playlists found')}</h3>
                      <p className="text-[12.5px] text-[#8E8E93] max-w-md mx-auto leading-relaxed">
                        {exportSearchQuery ? t('noAlbumsMatchQuery', 'No playlists found matching your search.') : t('noPlaylistsOnIpod', 'No playlists on iPod')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-7 pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {filteredExportPlaylists.map((pl, idx) => {
                      const coverUrl = getPlaylistCover(pl);
                      const actualTrackCount = pl.trackCount || pl.tracks?.length || 0;
                      return (
                        <div
                          key={pl.id ? `${pl.id}-${idx}` : idx}
                          className="group cursor-pointer flex flex-col space-y-2 select-none"
                        >
                          <div className="aspect-square relative rounded-[8px] overflow-hidden bg-[#222225] border border-white/[0.06] apple-card-shadow">
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                alt={pl.title}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-[#2a2a2e] to-[#161618] flex items-center justify-center">
                                <ListMusic className="w-10 h-10 text-[#8E8E93] group-hover:text-[#007AFF] transition-colors" />
                              </div>
                            )}
                            <div className="absolute bottom-2 left-2">
                              <span className="text-[9.5px] bg-black/75 px-1.5 py-0.5 rounded backdrop-blur font-mono text-white/90">
                                {getTrackCount(actualTrackCount, i18n.language)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-[14.5px] text-white truncate group-hover:text-[#007AFF] transition-colors tracking-tight">{pl.title || pl.name}</h4>
                              <p className="text-[12px] text-[#8E8E93] truncate">{t('ipodPlaylists', 'iPod Playlist')}</p>
                            </div>
                            <button
                              onClick={() => handleStartIpodExport(pl.tracks)}
                              title="Экспортировать этот плейлист"
                              className="p-1.5 rounded-[6px] bg-[#007AFF]/20 hover:bg-[#007AFF] text-[#007AFF] hover:text-white transition-all cursor-pointer shrink-0"
                            >
                              <FolderDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : filteredExportTracks.length === 0 ? (
                <div className="py-24 text-center space-y-3">
                  <Disc className="w-8 h-8 text-[#8E8E93]/60 mx-auto stroke-[1.75]" />
                  <div className="space-y-1">
                    <h3 className="font-semibold text-[15px] text-white">{t('noTracksFoundOnIpod', 'No tracks found on iPod')}</h3>
                    <p className="text-[12.5px] text-[#8E8E93] max-w-md mx-auto leading-relaxed">
                      {exportSearchQuery ? t('noAlbumsMatchQuery', 'No tracks found matching your search.') : t('scanOrSyncDesc', "Click 'Scan iPod' or sync tracks from Apple Music.")}
                    </p>
                  </div>
                </div>
              ) : (
                /* iPod songs export table */
                <div className="w-full overflow-x-auto select-none">
                  <table className="w-full text-left text-[14px] border-collapse">
                    <thead className="sticky top-0 bg-[#18181a] z-10 text-[#8E8E93] text-[12px] font-semibold border-b border-white/[0.08]">
                      <tr>
                        <th className="w-10 pl-7 pr-1 py-3 text-center">
                          <div
                            onClick={toggleSelectAll}
                            className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                              selectedExportTrackIds.size > 0 && selectedExportTrackIds.size === filteredExportTracks.length
                                ? 'bg-[#007AFF] border-[#007AFF] text-white'
                                : selectedExportTrackIds.size > 0
                                  ? 'bg-[#007AFF]/30 border-[#007AFF] text-white'
                                  : 'border-white/20 bg-black/20 hover:border-white/40'
                            }`}
                            title={selectedExportTrackIds.size === filteredExportTracks.length ? 'Снять выбор со всех' : 'Выбрать все'}
                          >
                            {selectedExportTrackIds.size > 0 && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </th>
                        <th className="w-10 px-1 py-3 text-center">#</th>
                        <th className="px-3 py-3">{t('tableTitle', 'Title')}</th>
                        <th className="px-3 py-3">{t('tableArtist', 'Artist')}</th>
                        <th className="px-3 py-3">{t('tableAlbum', 'Album')}</th>
                        <th className="px-3 py-3">{t('format', 'Формат')}</th>
                        <th className="pr-7 px-3 py-3 text-right">{t('tableTime', 'Time')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {filteredExportTracks.map((track, idx) => {
                        const trackKey = track.id || track.path || idx;
                        const isChecked = selectedExportTrackIds.has(trackKey);
                        const isThisPlaying = currentTrack?.id === track.id && isPlaying;
                        return (
                          <tr
                            key={trackKey}
                            onDoubleClick={() => playTrack(track, filteredExportTracks)}
                            onClick={() => toggleTrackSelection(trackKey)}
                            className={`hover:bg-white/[0.04] transition-colors group cursor-pointer ${
                              isChecked ? 'bg-[#007AFF]/10' : ''
                            }`}
                          >
                            <td className="pl-7 pr-1 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <div
                                onClick={() => toggleTrackSelection(trackKey)}
                                className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                                  isChecked
                                    ? 'bg-[#007AFF] border-[#007AFF] text-white'
                                    : 'border-white/20 bg-black/20 group-hover:border-white/40'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </td>
                            <td className="px-1 py-2.5 text-center text-[#8E8E93] font-mono text-[12px] tabular-nums" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => playTrack(track, filteredExportTracks)}
                                className="w-5 h-5 mx-auto flex items-center justify-center rounded hover:text-[#007AFF] transition-colors cursor-pointer"
                              >
                                {isThisPlaying ? (
                                  <Pause className="w-3.5 h-3.5 fill-current text-[#007AFF]" />
                                ) : (
                                  <span className="group-hover:hidden">{idx + 1}</span>
                                )}
                                {!isThisPlaying && <Play className="w-3.5 h-3.5 fill-current hidden group-hover:block" />}
                              </button>
                            </td>

                            {/* Track title */}
                            <td className="px-3 py-2.5 font-semibold text-[15px] truncate max-w-[260px]">
                              <span className={`block truncate ${isThisPlaying ? 'text-[#007AFF]' : isChecked ? 'text-white font-bold' : 'text-white'}`}>
                                {track.title}
                              </span>
                            </td>

                            {/* Artist */}
                            <td className="px-3 py-2.5 text-[#8E8E93] text-[14px] font-medium truncate max-w-[180px] group-hover:text-[#A1A1A6]">
                              {track.artist}
                            </td>

                            {/* Album */}
                            <td className="px-3 py-2.5 text-[#8E8E93] text-[14px] truncate max-w-[200px]">
                              {track.album}
                            </td>

                            {/* Audio format */}
                            <td className="px-3 py-2.5 text-[#8E8E93] text-[12px]">
                              <span className="font-mono text-[10.5px] bg-white/[0.06] px-1.5 py-0.5 rounded uppercase text-[#8E8E93]">
                                {track.format || 'm4a'}
                              </span>
                            </td>

                            {/* Duration */}
                            <td className="pr-7 px-3 py-2.5 text-right text-[#8E8E93] font-mono text-[13px] tabular-nums">
                              {formatTime(track.duration)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* iPod Summary and storage tab */}
        {activeTab === 'ipod-summary' && (() => {
          const totalBytes = storageInfo.total || 1;
          const audioBytes = storageInfo.audioBytes || 0;
          const artworkBytes = storageInfo.artworkBytes || 0;
          const dbBytes = storageInfo.databaseBytes || 0;
          const otherBytes = storageInfo.otherBytes || 0;
          const freeBytes = storageInfo.free || 0;

          const audioPct = totalBytes > 0 ? (audioBytes / totalBytes) * 100 : 0;
          const artworkPct = totalBytes > 0 ? (artworkBytes / totalBytes) * 100 : 0;
          const dbPct = totalBytes > 0 ? (dbBytes / totalBytes) * 100 : 0;
          const otherPct = totalBytes > 0 ? (otherBytes / totalBytes) * 100 : 0;
          const freePct = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;

          const estSongsRemaining = Math.max(0, Math.floor(freeBytes / (8 * 1024 * 1024)));

          // Calculate total unsynced tracks for smart sync
          let selectedNewTracksCount = 0;
          if (selectedSyncPlaylistIds.has('all-library')) {
            selectedNewTracksCount += unsyncedLibrarySongs.length;
          }
          smartPlaylistsDiff.forEach(p => {
            if (p.id !== 'all-library' && selectedSyncPlaylistIds.has(p.id)) {
              if (!selectedSyncPlaylistIds.has('all-library')) {
                selectedNewTracksCount += p.unsyncedCount;
              }
            }
          });

          return (
            <div className="p-5 md:p-6 space-y-3.5 animate-fade-in max-w-6xl w-full mx-auto flex-1 flex flex-col min-h-0 overflow-hidden">

              {deviceInfo.connected ? (
                <>
                  {/* iPod hardware overview and storage card */}
                  <div className="rounded-[18px] bg-[#1a1a1d] border border-white/[0.06] p-4 sm:p-5 apple-card-shadow space-y-3 shrink-0">

                    {/* Device header: name, specs, and actions */}
                    <div className="space-y-3 w-full">

                      {/* Device custom name and quick controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            {isEditingDeviceName ? (
                              <form
                                onSubmit={(e) => { e.preventDefault(); handleSaveDeviceName(); }}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={deviceNameInput}
                                  onChange={(e) => setDeviceNameInput(e.target.value)}
                                  placeholder={t('renamePrompt', 'Enter new iPod name')}
                                  autoFocus
                                  className="px-2.5 py-0.5 bg-[#26262a] border border-white/20 rounded-[6px] text-white text-[20px] font-bold focus:outline-none focus:border-[#FA2D48] w-64 shadow-inner"
                                />
                                <button
                                  type="submit"
                                  disabled={isSavingDeviceName}
                                  className="px-2.5 py-1 bg-[#FA2D48] hover:bg-[#ff3b53] text-white text-[11.5px] font-semibold rounded-[6px] transition-all flex items-center gap-1 cursor-pointer shadow"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>{t('saveName', 'Save')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsEditingDeviceName(false)}
                                  className="px-2 py-1 bg-white/[0.06] hover:bg-white/10 text-[#8E8E93] text-[11.5px] rounded-[6px] transition-all cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </form>
                            ) : (
                              <div className="flex items-center gap-2">
                                <h1 className="text-[22px] font-bold text-white tracking-tight">
                                  {displayDeviceName}
                                </h1>
                                <button
                                  onClick={() => {
                                    setDeviceNameInput(displayDeviceName);
                                    setIsEditingDeviceName(true);
                                  }}
                                  title={t('editName', 'Edit Name')}
                                  className="p-1 rounded text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <p className="text-[12px] text-[#8E8E93] mt-0.5">
                              {modelDisplaySubtitle} • {formatBytes(storageInfo.total)} Total Capacity
                            </p>
                          </div>

                          {/* Top Right Quick Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => window.electron?.openExplorer && window.electron.openExplorer()}
                              className="px-3 py-1.5 rounded-[8px] bg-[#242428] border border-white/[0.08] text-[12px] font-medium text-white hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                            >
                              <Folder className="w-3.5 h-3.5 text-[#8E8E93]" />
                              <span>{t('openInExplorer', 'Open in Explorer')}</span>
                            </button>
                            <button
                              onClick={() => window.electron?.ejectIpod && window.electron.ejectIpod().then(r => alert(r.message))}
                              title={t('ejectTooltip', 'Safely eject iPod')}
                              className="px-3 py-1.5 rounded-[8px] bg-[#242428] border border-white/[0.08] text-[12px] font-medium text-[#8E8E93] hover:text-[#FA2D48] hover:border-[#FA2D48]/30 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>{t('eject', 'Eject')}</span>
                            </button>
                          </div>
                        </div>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-5 pt-2 border-t border-white/[0.06]">

                          {/* Serial */}
                          <div className="space-y-0.5">
                            <span className="text-[10.5px] font-medium text-[#8E8E93] block">{t('serialNumber', 'Serial Number')}</span>
                            <div
                              onClick={() => handleCopySerial(deviceInfo.serialNumber || 'YM8414QA2ME')}
                              className="flex items-center gap-1 cursor-pointer group"
                              title="Click to copy"
                            >
                              <span className="text-[12px] font-mono font-medium text-white tracking-wide group-hover:text-[#0A84FF] transition-colors">
                                {copiedSerial ? 'Copied!' : (deviceInfo.serialNumber || 'YM8414QA2ME')}
                              </span>
                              <Copy className="w-3 h-3 text-[#8E8E93] opacity-40 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>

                          {/* Production date and factory */}
                          <div className="space-y-0.5">
                            <span className="text-[10.5px] font-medium text-[#8E8E93] block">{t('productionInfo', 'Production')}</span>
                            <div className="text-[12px] font-medium text-white truncate" title={deviceInfo.serialInfo?.productionFormatted || '2008, Week 41'}>
                              {deviceInfo.serialInfo ? `${deviceInfo.serialInfo.year}, W${deviceInfo.serialInfo.week}` : '2008, Week 41'}
                            </div>
                            <div className="text-[10px] text-[#8E8E93] truncate">
                              {deviceInfo.serialInfo?.factory || 'Foxconn, China'}
                            </div>
                          </div>

                          {/* Firmware version */}
                          <div className="space-y-0.5">
                            <span className="text-[10.5px] font-medium text-[#8E8E93] block">{t('firmwareVersion', 'Firmware')}</span>
                            <div className="text-[12px] font-medium text-white">
                              {deviceInfo.firmware || 'v1.0.4'}
                            </div>
                            <div className="text-[10px] text-[#8E8E93]">
                              Installed
                            </div>
                          </div>

                          {/* Filesystem and drive path */}
                          <div className="space-y-0.5">
                            <span className="text-[10.5px] font-medium text-[#8E8E93] block">{t('fileSystem', 'Format')}</span>
                            <div className="text-[12px] font-medium text-white">
                              {deviceInfo.fileSystem || 'FAT32 (Windows)'}
                            </div>
                            <div className="text-[10px] text-[#8E8E93]">
                              {deviceInfo.path || 'D:\\'} • USB 2.0
                            </div>
                          </div>

                        </div>

                      </div>

                    {/* Storage capacity breakdown bar */}
                    <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-white uppercase tracking-wider text-[10px] text-[#8E8E93]">
                          {t('storageDistribution', 'Storage Distribution')}
                        </span>
                        <span className="text-[#8E8E93] font-medium">
                          {t('songsRemaining', 'approx. ~{{count}} songs remaining', { count: estSongsRemaining })}
                        </span>
                      </div>

                      {/* Capacity breakdown segments */}
                      <div className="w-full h-2.5 rounded-full bg-[#141416] p-0.5 border border-white/[0.08] flex gap-0.5 overflow-hidden shadow-inner">
                        {audioPct > 0 && (
                          <div
                            style={{ width: `${Math.max(2, audioPct)}%` }}
                            title={`Audio: ${formatBytes(audioBytes)} (${audioPct.toFixed(1)}%)`}
                            className="h-full rounded-l-full bg-gradient-to-r from-[#FA2D48] to-[#FF453A] transition-all duration-500 shadow-sm"
                          />
                        )}
                        {artworkPct > 0 && (
                          <div
                            style={{ width: `${Math.max(1, artworkPct)}%` }}
                            title={`Artwork: ${formatBytes(artworkBytes)} (${artworkPct.toFixed(1)}%)`}
                            className="h-full bg-gradient-to-r from-[#AF52DE] to-[#BF5AF2] transition-all duration-500 shadow-sm"
                          />
                        )}
                        {dbPct > 0 && (
                          <div
                            style={{ width: `${Math.max(1, dbPct)}%` }}
                            title={`iTunesDB & System: ${formatBytes(dbBytes)} (${dbPct.toFixed(1)}%)`}
                            className="h-full bg-gradient-to-r from-[#0A84FF] to-[#64D2FF] transition-all duration-500 shadow-sm"
                          />
                        )}
                        {otherPct > 0 && (
                          <div
                            style={{ width: `${Math.max(1, otherPct)}%` }}
                            title={`Other Files: ${formatBytes(otherBytes)} (${otherPct.toFixed(1)}%)`}
                            className="h-full bg-gradient-to-r from-[#FF9F0A] to-[#FFD60A] transition-all duration-500 shadow-sm"
                          />
                        )}
                        {freePct > 0 && (
                          <div
                            style={{ width: `${freePct}%` }}
                            title={`Free: ${formatBytes(freeBytes)} (${freePct.toFixed(1)}%)`}
                            className="h-full rounded-r-full bg-[#2C2C2E] transition-all duration-500"
                          />
                        )}
                      </div>

                      {/* Storage category color legend */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-[#FA2D48] shrink-0" />
                          <span className="text-[11.5px] text-[#AEAEB2]">{t('storageAudio', 'Audio')}: <strong className="text-white font-semibold">{formatBytes(audioBytes)}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-[#AF52DE] shrink-0" />
                          <span className="text-[11.5px] text-[#AEAEB2]">{t('storageArtwork', 'Artwork')}: <strong className="text-white font-semibold">{formatBytes(artworkBytes)}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-[#0A84FF] shrink-0" />
                          <span className="text-[11.5px] text-[#AEAEB2]">{t('storageDb', 'System')}: <strong className="text-white font-semibold">{formatBytes(dbBytes)}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-[#FF9F0A] shrink-0" />
                          <span className="text-[11.5px] text-[#AEAEB2]">{t('storageOther', 'Other')}: <strong className="text-white font-semibold">{formatBytes(otherBytes)}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-white/40 shrink-0" />
                          <span className="text-[11.5px] text-[#AEAEB2]">{t('storageFree', 'Free')}: <strong className="text-white font-semibold">{formatBytes(freeBytes)}</strong></span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Smart Playlist Sync section */}
                  <div className="space-y-2.5 flex-1 flex flex-col min-h-0">

                    {/* Section header and batch filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                      <div>
                        <h2 className="text-[17px] font-bold text-white tracking-tight">
                          {t('smartPlaylistSyncTitle', 'Smart Playlist Sync')}
                        </h2>
                        <p className="text-[12px] text-[#8E8E93] mt-0.5">
                          {t('smartSyncSubtitle', 'Select playlists to synchronize tracks with Apple Music library')}
                        </p>
                      </div>

                      {/* Batch selection buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleSelectAllPlaylists}
                          className="px-2.5 py-1 rounded-[6px] bg-white/[0.06] hover:bg-white/10 text-white text-[11.5px] font-medium transition-colors cursor-pointer border border-white/[0.06]"
                        >
                          {t('selectAll', 'Select All')}
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectNewOnly}
                          className="px-2.5 py-1 rounded-[6px] bg-white/[0.06] hover:bg-white/10 text-white text-[11.5px] font-medium transition-colors cursor-pointer border border-white/[0.06]"
                        >
                          {t('selectNewOnly', 'Only with New Tracks')}
                        </button>
                        {selectedSyncPlaylistIds.size > 0 && (
                          <button
                            type="button"
                            onClick={handleDeselectAllPlaylists}
                            className="px-2.5 py-1 rounded-[6px] bg-white/[0.06] hover:bg-white/10 text-[#8E8E93] hover:text-white text-[11.5px] font-medium transition-colors cursor-pointer border border-white/[0.06]"
                          >
                            {t('clearSelection', 'Clear')}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Playlists sync status grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 flex-1 min-h-0 overflow-y-auto pr-1">

                      {/* Card: All library songs */}
                      <div
                        onClick={() => {
                          const next = new Set(selectedSyncPlaylistIds);
                          if (next.has('all-library')) next.delete('all-library');
                          else next.add('all-library');
                          setSelectedSyncPlaylistIds(next);
                        }}
                        className={`p-3 rounded-[10px] border transition-all cursor-pointer flex items-center justify-between gap-2.5 select-none ${selectedSyncPlaylistIds.has('all-library')
                            ? 'bg-[#FA2D48]/15 border-[#FA2D48]/50 shadow-md ring-1 ring-[#FA2D48]/40'
                            : 'bg-[#1a1a1d] border-white/[0.06] hover:border-white/15 hover:bg-[#222226] apple-card-shadow'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className={`w-4.5 h-4.5 rounded-[4px] flex items-center justify-center border transition-all ${selectedSyncPlaylistIds.has('all-library')
                              ? 'bg-[#FA2D48] border-[#FA2D48] text-white'
                              : 'border-white/20 bg-[#141416]'
                            }`}>
                            {selectedSyncPlaylistIds.has('all-library') && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="truncate">
                            <div className="text-[13px] font-semibold text-white truncate">
                              {t('allLibrarySongs', 'All Library Songs')}
                            </div>
                            <div className="text-[11px] text-[#8E8E93]">
                              {librarySongs.length} {t('songs', 'songs')}
                            </div>
                          </div>
                        </div>

                        {unsyncedLibrarySongs.length > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FA2D48]/20 text-[#FA2D48] border border-[#FA2D48]/30 shrink-0">
                            +{unsyncedLibrarySongs.length} {t('newTracksSuffix', 'new')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-white/[0.05] text-[#8E8E93] border border-white/[0.08] shrink-0 inline-flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>{t('fullySyncedBadge', 'Synced')}</span>
                          </span>
                        )}
                      </div>

                      {/* User playlists diff list */}
                      {smartPlaylistsDiff.map(p => {
                        const isSelected = selectedSyncPlaylistIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              const next = new Set(selectedSyncPlaylistIds);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              setSelectedSyncPlaylistIds(next);
                            }}
                            className={`p-3 rounded-[10px] border transition-all cursor-pointer flex items-center justify-between gap-2.5 select-none ${isSelected
                                ? 'bg-[#FA2D48]/15 border-[#FA2D48]/50 shadow-md ring-1 ring-[#FA2D48]/40'
                                : 'bg-[#1a1a1d] border-white/[0.06] hover:border-white/15 hover:bg-[#222226] apple-card-shadow'
                              }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <div className={`w-4.5 h-4.5 rounded-[4px] flex items-center justify-center border transition-all ${isSelected
                                  ? 'bg-[#FA2D48] border-[#FA2D48] text-white'
                                  : 'border-white/20 bg-[#141416]'
                                }`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="truncate">
                                <div className="text-[13px] font-semibold text-white truncate">
                                  {p.name}
                                </div>
                                <div className="text-[11px] text-[#8E8E93]">
                                  {p.trackCount} {t('tracks', 'tracks')}
                                </div>
                              </div>
                            </div>

                            {p.unsyncedCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                +{p.unsyncedCount} {t('newTracksSuffix', 'new')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-white/[0.05] text-[#8E8E93] border border-white/[0.08] shrink-0 inline-flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>{t('fullySyncedBadge', 'Synced')}</span>
                              </span>
                            )}
                          </div>
                        );
                      })}

                    </div>

                    {/* Sync launch footer toolbar */}
                    <div className="p-3 sm:p-3.5 rounded-[12px] bg-[#1a1a1d] border border-white/[0.06] apple-card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                      <div className="text-[12.5px] text-[#8E8E93]">
                        <span className="font-bold text-white">{selectedSyncPlaylistIds.size}</span> {t('playlistsSelected', 'playlists selected')}
                        {selectedNewTracksCount > 0 && (
                          <span className="text-white font-medium ml-2">
                            (approx. <span className="text-[#FA2D48] font-bold">~{selectedNewTracksCount}</span> new tracks ready to transfer)
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleStartSmartSync}
                        disabled={selectedSyncPlaylistIds.size === 0}
                        className={`px-6 py-2 rounded-[8px] text-[13px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${selectedSyncPlaylistIds.size > 0
                            ? 'btn-apple-red shadow-[#FA2D48]/20 hover:scale-[1.02]'
                            : 'bg-[#2C2C2E] text-[#8E8E93] cursor-not-allowed opacity-50'
                          }`}
                      >
                        <Zap className="w-4 h-4 fill-current" />
                        <span>
                          {selectedNewTracksCount > 0
                            ? t('syncSelectedBtn', 'Sync Selected ({{count}} new tracks)', { count: selectedNewTracksCount })
                            : t('syncSelectedPlaylists', 'Sync Selected Playlists')}
                        </span>
                      </button>
                    </div>

                  </div>
                </>
              ) : (
                /* iPod not connected empty state */
                <div className="my-auto py-20 text-center space-y-3">
                  <Usb className="w-8 h-8 text-[#FA2D48] mx-auto stroke-[1.75]" />
                  <div className="space-y-1">
                    <h3 className="font-semibold text-[15px] text-white">{t('ipodNotConnected', 'iPod Not Connected')}</h3>
                    <p className="text-[12.5px] text-[#8E8E93] max-w-md mx-auto leading-relaxed">
                      {t('ipodNotConnectedDesc', 'Connect your iPod Classic, Nano, or Mini using a 30-pin USB cable. PodSync will automatically detect the device and load storage info.')}
                    </p>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* Songs on iPod tab */}
        {activeTab === 'ipod-songs' && (
          <div className="space-y-4 animate-fade-in pb-12">
            <div className="px-7 pt-6 pb-2 flex items-center justify-between">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight text-white">{t('ipodSongsTitle', 'Songs on iPod')}</h1>
                <p className="text-[#8E8E93] text-[12px] font-normal mt-0.5">
                  {deviceInfo.connected ? t('ipodSongsSubtitle', '{{count}} tracks stored in iPod memory', { count: filteredIpodTracks.length }) : t('connectIpodToViewTracks', 'Connect iPod to view tracks')}
                </p>
              </div>

              {deviceInfo.connected && (
                <button
                  onClick={fetchIpodTracks}
                  disabled={isLoadingIpodTracks}
                  title={t('scanIpod', 'Scan iPod')}
                  className="btn-apple-pill-glass py-1.5 px-3.5 rounded-full text-[12px] text-[#8E8E93] hover:text-white transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIpodTracks ? 'animate-spin text-[#FA2D48]' : ''}`} />
                  <span>{isLoadingIpodTracks ? t('scanningIpod', 'Scanning iPod...') : t('scanIpod', 'Scan iPod')}</span>
                </button>
              )}
            </div>

            {/* iPod songs table view */}
            {isLoadingIpodTracks ? (
              <div className="py-24 text-center space-y-3">
                <RefreshCw className="w-6 h-6 text-[#FA2D48] animate-spin mx-auto mb-2" />
                <p className="font-semibold text-[13px] text-white">{t('readingDatabase', 'Reading iTunesDB database on iPod...')}</p>
                <p className="text-[11px] text-[#8E8E93] mt-1">{t('loadingTracksAndMetadata', 'Loading tracks and metadata from device memory...')}</p>
              </div>
            ) : !deviceInfo.connected || filteredIpodTracks.length === 0 ? (
              <div className="py-24 text-center space-y-3">
                {!deviceInfo.connected ? (
                  <>
                    <Usb className="w-8 h-8 text-[#FA2D48] mx-auto stroke-[1.75]" />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-[15px] text-white">{t('ipodNotConnected', 'iPod Not Connected')}</h3>
                      <p className="text-[12.5px] text-[#8E8E93] max-w-md mx-auto leading-relaxed">
                        {t('ipodNotConnectedDesc', 'Connect your iPod Classic, Nano, or Mini using a 30-pin USB cable. PodSync will automatically detect the device and load storage info.')}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Disc className="w-8 h-8 text-[#8E8E93]/60 mx-auto stroke-[1.75]" />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-[15px] text-white">{t('noTracksFoundOnIpod', 'No tracks found on iPod')}</h3>
                      <p className="text-[12.5px] text-[#8E8E93] max-w-md mx-auto leading-relaxed">
                        {t('scanOrSyncDesc', "Click 'Scan iPod' above or sync tracks from Apple Music.")}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full overflow-x-auto select-none">
                <table className="w-full text-left text-[14px] border-collapse">
                  <thead className="sticky top-0 bg-[#18181a] z-10 text-[#8E8E93] text-[12px] font-semibold border-b border-white/[0.08]">
                    <tr>
                      <th className="w-12 pl-7 pr-3 py-3 text-center">#</th>
                      <th className="px-3 py-3">{t('tableTitle', 'Title')}</th>
                      <th className="px-3 py-3">{t('tableArtist', 'Artist')}</th>
                      <th className="px-3 py-3">{t('tableAlbum', 'Album')}</th>
                      <th className="px-3 py-3">{t('tableGenre', 'Genre')}</th>
                      <th className="w-24 pr-7 px-3 py-3 text-right">{t('tableTime', 'Time')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {filteredIpodTracks.map((track, idx) => {
                      const isThisPlaying = Boolean(
                        isPlaying && currentTrack && track &&
                        (
                          (currentTrack.id && track.id && currentTrack.id === track.id) ||
                          (currentTrack.path && track.path && currentTrack.path === track.path)
                        )
                      );
                      const trackGenre = track.genre && track.genre !== 'Unknown' ? track.genre : '—';
                      return (
                        <tr
                          key={track.id ? `${track.id}-${idx}` : (track.path ? `${track.path}-${idx}` : idx)}
                          onDoubleClick={() => playTrack(track, filteredIpodTracks)}
                          className={`group transition-colors cursor-pointer ${isThisPlaying
                              ? 'bg-[#FA2D48]/15 text-white'
                              : (idx % 2 === 1 ? 'bg-white/[0.035]' : 'bg-transparent')
                            } hover:bg-white/[0.08]`}
                        >
                          {/* Track index and play button */}
                          <td className="pl-7 pr-3 py-2.5 text-center text-[#8E8E93] font-mono text-[12px] tabular-nums">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playTrack(track, filteredIpodTracks);
                              }}
                              className="w-5 h-5 mx-auto flex items-center justify-center rounded hover:text-[#FA2D48] transition-colors cursor-pointer"
                            >
                              {isThisPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current text-[#FA2D48]" />
                              ) : (
                                <span className="group-hover:hidden">{idx + 1}</span>
                              )}
                              {!isThisPlaying && <Play className="w-3.5 h-3.5 fill-current hidden group-hover:block" />}
                            </button>
                          </td>

                          {/* Track title */}
                          <td className="px-3 py-2.5 font-semibold text-[15px] truncate max-w-[260px]">
                            <span className={`block truncate ${isThisPlaying ? 'text-[#FA2D48]' : 'text-white'}`}>
                              {track.title}
                            </span>
                          </td>

                          {/* Artist */}
                          <td className="px-3 py-2.5 text-[#8E8E93] text-[14px] font-medium truncate max-w-[180px] group-hover:text-[#A1A1A6]">
                            {track.artist}
                          </td>

                          {/* Album */}
                          <td className="px-3 py-2.5 text-[#8E8E93] text-[14px] truncate max-w-[200px]">
                            {track.album}
                          </td>

                          {/* Genre */}
                          <td className="px-3 py-2.5 text-[#8E8E93] text-[13.5px] truncate max-w-[140px]">
                            {trackGenre}
                          </td>

                          {/* Duration */}
                          <td className="pr-7 px-3 py-2.5 text-right text-[#8E8E93] font-mono text-[13px] tabular-nums">
                            {formatTime(track.duration)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* iPod playlists tab */}
        {activeTab === 'ipod-playlists' && (
          <div className="space-y-4 animate-fade-in pb-12">
            {selectedIpodPlaylist ? (
              /* Selected iPod playlist detail view */
              <div className="space-y-6">
                {/* Back to playlists button */}
                <div className="px-7 pt-6 pb-0">
                  <button
                    onClick={() => setSelectedIpodPlaylist(null)}
                    className="flex items-center gap-1 text-[12px] font-medium text-[#FA2D48] hover:underline cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{t('backToPlaylists', 'Back to playlists')}</span>
                  </button>
                </div>

                {/* Selected iPod playlist header */}
                <div className="px-7 flex items-end gap-6">
                  <div className="w-48 h-48 rounded-[10px] apple-cover-shadow overflow-hidden border border-white/10 shrink-0 bg-[#222225] relative">
                    {(() => {
                      const coverUrl = getPlaylistCover(selectedIpodPlaylist);
                      return coverUrl ? (
                        <img
                          src={coverUrl}
                          className="w-full h-full object-cover"
                          alt="Cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#2a2a2e] to-[#161618] flex items-center justify-center">
                          <ListMusic className="w-12 h-12 text-[#8E8E93]" />
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-2.5 flex-1 min-w-0 pb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#FA2D48]">{t('ipodPlaylistBadge', 'iPod Playlist')}</span>
                    <h1 className="text-[32px] font-bold tracking-tight text-white truncate">{selectedIpodPlaylist.title}</h1>
                    <p className="text-[#8E8E93] text-[13px] flex items-center gap-1.5 flex-wrap">
                      <span>{getSongCount(filteredIpodTracks.length, i18n.language)}</span>
                      {(() => {
                        const durStr = formatTotalDuration(filteredIpodTracks, i18n.language);
                        return durStr ? <span>• {durStr}</span> : null;
                      })()}
                      <span>• {displayDeviceName}</span>
                    </p>

                    <div className="flex items-center gap-3 pt-2 flex-wrap">
                      <button
                        onClick={() => {
                          if (filteredIpodTracks.length > 0) playTrack(filteredIpodTracks[0], filteredIpodTracks);
                        }}
                        className="btn-apple-red py-2 px-5 rounded-full text-[12px] font-bold flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{t('playAll', 'Play')}</span>
                      </button>

                      <button
                        onClick={() => {
                          if (filteredIpodTracks.length > 0) {
                            setIsShuffle(true);
                            isShuffleRef.current = true;
                            const randIdx = Math.floor(Math.random() * filteredIpodTracks.length);
                            playTrack(filteredIpodTracks[randIdx], filteredIpodTracks);
                          }
                        }}
                        className="btn-apple-pill-glass py-2 px-5 rounded-full text-[12px] font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-[#FA2D48]" />
                        <span>{t('shuffleAll', 'Shuffle')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Frameless Table or Clean Empty State */}
                {filteredIpodTracks.length === 0 ? (
                  <div className="py-20 text-center space-y-2">
                    <Disc className="w-8 h-8 text-[#8E8E93]/40 mx-auto mb-1" />
                    <p className="font-semibold text-[13px] text-white">{t('noTracksInThisPlaylist', 'No tracks in this playlist')}</p>
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto select-none">
                    <table className="w-full text-left text-[14px] border-collapse">
                      <tbody className="divide-y divide-white/[0.03]">
                        {filteredIpodTracks.map((track, idx) => {
                          const isThisPlaying = Boolean(
                            isPlaying && currentTrack && track &&
                            (
                              (currentTrack.id && track.id && currentTrack.id === track.id) ||
                              (currentTrack.path && track.path && currentTrack.path === track.path)
                            )
                          );
                          const trackGenre = track.genre && track.genre !== 'Unknown' ? track.genre : '—';
                          return (
                            <tr
                              key={track.id ? `${track.id}-${idx}` : (track.path ? `${track.path}-${idx}` : idx)}
                              onDoubleClick={() => playTrack(track, filteredIpodTracks)}
                              className={`group transition-colors cursor-pointer ${isThisPlaying
                                  ? 'bg-[#FA2D48]/15 text-white'
                                  : (idx % 2 === 1 ? 'bg-white/[0.035]' : 'bg-transparent')
                                } hover:bg-white/[0.08]`}
                            >
                              {/* # / Play Action */}
                              <td className="w-12 pl-7 pr-3 py-2.5 text-center text-[#8E8E93] font-mono text-[12px] tabular-nums">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playTrack(track, filteredIpodTracks);
                                  }}
                                  className="w-5 h-5 mx-auto flex items-center justify-center rounded hover:text-[#FA2D48] transition-colors cursor-pointer"
                                >
                                  {isThisPlaying ? (
                                    <Pause className="w-3.5 h-3.5 fill-current text-[#FA2D48]" />
                                  ) : (
                                    <span className="group-hover:hidden">{idx + 1}</span>
                                  )}
                                  {!isThisPlaying && <Play className="w-3.5 h-3.5 fill-current hidden group-hover:block" />}
                                </button>
                              </td>

                              {/* 1. Track Title */}
                              <td className="px-3 py-2.5 font-semibold text-[15px] truncate max-w-[280px]">
                                <span className={`block truncate ${isThisPlaying ? 'text-[#FA2D48]' : 'text-white'}`}>
                                  {track.title}
                                </span>
                              </td>

                              {/* 2. Artist */}
                              <td className="px-3 py-2.5 text-[#8E8E93] text-[14px] font-medium truncate max-w-[180px] group-hover:text-[#A1A1A6]">
                                {track.artist}
                              </td>

                              {/* 3. Album */}
                              <td className="px-3 py-2.5 text-[#8E8E93] text-[14px] truncate max-w-[200px]">
                                {track.album}
                              </td>

                              {/* 4. Genre */}
                              <td className="px-3 py-2.5 text-[#8E8E93] text-[13.5px] truncate max-w-[140px]">
                                {trackGenre}
                              </td>

                              {/* 5. Duration */}
                              <td className="pr-7 px-3 py-2.5 text-right text-[#8E8E93] font-mono text-[13px] tabular-nums">
                                {formatTime(track.duration)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* iPod Playlists Grid */
              <div className="space-y-4 animate-fade-in pb-12">
          <div className="px-7 pt-6 pb-2 flex items-center justify-between">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-white">{t('ipodPlaylists', 'iPod Playlists')}</h1>
              <p className="text-[#8E8E93] text-[12px] font-normal mt-0.5">
                {deviceInfo.connected
                  ? (i18n.language === 'ru'
                      ? `${ipodPlaylists.length} ${ipodPlaylists.length === 1 ? 'плейлист найден' : 'плейлистов найдено'} в памяти iPod`
                      : `${ipodPlaylists.length} ${ipodPlaylists.length === 1 ? 'playlist' : 'playlists'} found in iPod memory`)
                  : t('connectIpodToViewPlaylists', 'Connect iPod to view playlists')}
              </p>
            </div>

            <button
              onClick={() => { setSelectedPlaylist(null); setSelectedAlbum(null); setActiveTab('apple-playlists'); }}
              className="btn-apple-pill-glass py-1.5 px-4 rounded-full text-[12px] text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 text-[#FA2D48]" />
              <span>{t('allPlaylists', 'All Playlists')}</span>
            </button>
          </div>

          {!deviceInfo.connected ? (
            <div className="py-24 text-center space-y-3">
              <Usb className="w-8 h-8 text-[#FA2D48] mx-auto stroke-[1.75]" />
              <div className="space-y-1">
                <h3 className="font-semibold text-[15px] text-white">{t('ipodNotConnected', 'iPod Not Connected')}</h3>
                <p className="text-[12.5px] text-[#8E8E93] max-w-md mx-auto leading-relaxed">
                  {t('ipodNotConnectedDesc', 'Connect your iPod Classic, Nano, or Mini using a 30-pin USB cable. PodSync will automatically detect the device and load storage info.')}
                </p>
              </div>
            </div>
          ) : ipodPlaylists.length === 0 ? (
            <div className="py-24 text-center space-y-3">
              <ListMusic className="w-8 h-8 text-[#FA2D48] mx-auto stroke-[1.75]" />
              <div className="space-y-1">
                <h3 className="font-semibold text-[15px] text-white">{t('noPlaylistsOnIpod', 'No playlists on iPod')}</h3>
                <p className="text-[12.5px] text-[#8E8E93] max-w-md mx-auto leading-relaxed">
                  {t('transferPlaylistsDesc', 'You can transfer any playlists from Apple Music to your iPod in seconds via "All Playlists".')}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-7 pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {ipodPlaylists.map((pl, idx) => {
                const coverUrl = getPlaylistCover(pl);
                const actualTrackCount = pl.trackCount || pl.tracks?.length || 0;
                return (
                  <div
                    key={pl.id ? `${pl.id}-${idx}` : idx}
                    onClick={() => selectIpodPlaylist(pl)}
                    className="group cursor-pointer flex flex-col space-y-2 select-none"
                  >
                    <div className="aspect-square relative rounded-[8px] overflow-hidden bg-[#222225] border border-white/[0.06] apple-card-shadow">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          alt={pl.title}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#2a2a2e] to-[#161618] flex items-center justify-center">
                          <ListMusic className="w-10 h-10 text-[#8E8E93] group-hover:text-[#FA2D48] transition-colors" />
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2">
                        <span className="text-[9.5px] bg-black/75 px-1.5 py-0.5 rounded backdrop-blur font-mono text-white/90">
                          {getTrackCount(actualTrackCount, i18n.language)}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-[15px] text-white truncate group-hover:text-[#FA2D48] transition-colors tracking-tight">{pl.title}</h4>
                      <p className="text-[13px] text-[#8E8E93] truncate mt-0.5">{t('ipodPlaylists', 'iPod Playlist')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
              )}
      </div>
          )}

      {/* Sync Queue tab */}
      {activeTab === 'queue' && (() => {
        const distinctPlaylistsInQueue = Array.from(new Set(
          syncQueue.flatMap(t => (Array.isArray(t.targetPlaylists) ? t.targetPlaylists : [])).filter(Boolean)
        ));
        const singlesInQueue = syncQueue.filter(t => !Array.isArray(t.targetPlaylists) || t.targetPlaylists.length === 0);
        const allGroupKeys = [...distinctPlaylistsInQueue, ...(singlesInQueue.length > 0 ? ['__singles__'] : [])];
        const areAllCollapsed = allGroupKeys.length > 0 && allGroupKeys.every(k => collapsedQueueGroups.has(k));

        const displayedPlaylists = queueActiveFilter === 'all'
          ? distinctPlaylistsInQueue
          : (queueActiveFilter === '__singles__' ? [] : distinctPlaylistsInQueue.filter(p => p === queueActiveFilter));
        const showSingles = singlesInQueue.length > 0 && (queueActiveFilter === 'all' || queueActiveFilter === '__singles__');

        return (
          <div className="p-8 space-y-6 animate-fade-in max-w-6xl mx-auto">
            {/* Queue header and action controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight text-white">{t('syncQueue', 'Sync Queue')}</h1>
                <p className="text-[#8E8E93] text-[13px] font-normal mt-0.5">
                  {distinctPlaylistsInQueue.length > 0 && singlesInQueue.length > 0
                    ? t('syncSummaryFull', '{{playlists}} playlists, {{singles}} individual songs ({{total}} tracks)', { playlists: distinctPlaylistsInQueue.length, singles: singlesInQueue.length, total: syncQueue.length })
                    : distinctPlaylistsInQueue.length > 0
                      ? t('syncSummaryPlaylistsOnly', '{{playlists}} playlists ({{total}} tracks)', { playlists: distinctPlaylistsInQueue.length, total: syncQueue.length })
                      : t('syncSummarySinglesOnly', '{{singles}} individual songs ({{total}} tracks)', { singles: singlesInQueue.length, total: syncQueue.length })}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {syncQueue.length > 0 && (
                  <>
                    {allGroupKeys.length > 1 && (
                      <button
                        onClick={() => toggleAllGroupsCollapse(allGroupKeys)}
                        title={areAllCollapsed ? t('expandAll', 'Expand all') : t('collapseAll', 'Collapse all')}
                        className="px-3 py-1.5 rounded-[7px] bg-[#222225] border border-white/[0.08] text-[12px] font-medium text-[#8E8E93] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        {areAllCollapsed ? (
                          <>
                            <ChevronsUpDown className="w-3.5 h-3.5 text-[#FA2D48]" />
                            <span>{t('expandAll', 'Expand all')}</span>
                          </>
                        ) : (
                          <>
                            <ChevronsDownUp className="w-3.5 h-3.5 text-[#FA2D48]" />
                            <span>{t('collapseAll', 'Collapse all')}</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (syncQueue.length > 0) playTrack(syncQueue[0], syncQueue);
                      }}
                      className="px-3 py-1.5 rounded-[7px] bg-[#222225] border border-white/[0.08] text-[12px] font-medium text-white hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current text-[#FA2D48]" />
                      <span>{t('playAll', 'Play')}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (syncQueue.length > 0) {
                          const randIdx = Math.floor(Math.random() * syncQueue.length);
                          playTrack(syncQueue[randIdx], syncQueue);
                        }
                      }}
                      className="px-3 py-1.5 rounded-[7px] bg-[#222225] border border-white/[0.08] text-[12px] font-medium text-white hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Shuffle className="w-3.5 h-3.5 text-[#FA2D48]" />
                      <span>{t('shuffleAll', 'Shuffle')}</span>
                    </button>

                    <button
                      onClick={() => setSyncQueue([])}
                      className="px-3 py-1.5 rounded-[7px] bg-[#222225] border border-white/[0.08] text-[12px] font-medium text-[#8E8E93] hover:text-[#FA2D48] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('clear', 'Clear')}</span>
                    </button>

                    <button
                      onClick={startSyncPipeline}
                      className="btn-apple-red py-2 px-5 rounded-[8px] text-[13px] font-bold tracking-wide flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
                    >
                      <FolderSync className="w-4 h-4" />
                      <span>{t('syncLibraryBtn', 'Sync ({{count}})', { count: syncQueue.length })}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Deduplication notice and stream settings */}
            {syncQueue.length > 0 && (
              <div className="space-y-3">
                {/* Deduplication notice */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-[10px] bg-blue-500/10 border border-blue-500/20 text-[#0A84FF] text-[12.5px]">
                  <Info className="w-4 h-4 shrink-0 text-[#0A84FF]" />
                  <span className="text-white/90 font-medium">
                    {t('allTracksDeduplicated', 'Shared songs across playlists are merged: downloaded once and linked to all respective iPod playlists')}
                  </span>
                </div>

                {/* Concurrency stream settings */}
                <div className="bg-[#18181b] border border-white/[0.06] p-4 rounded-[12px] space-y-2.5 apple-card-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] block">
                        {t('downloadSpeed', 'Download Speed')}
                      </label>
                      <p className="text-[12px] text-[#8E8E93]/80">{t('parallelThreads', 'Parallel download streams')}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0 flex-wrap items-center">
                      {[
                        { count: 4, label: t('streams_4', '4 streams'), hint: t('streams_4_hint', 'Standard (Low CPU)') },
                        { count: 8, label: t('streams_8', '8 streams'), hint: t('streams_8_hint', 'Fast (Balanced)') },
                        { count: 12, label: t('streams_12', '12 streams'), hint: t('streams_12_hint', 'Turbo (High CPU load)') },
                        { count: 16, label: t('streams_16', '16 streams'), hint: t('streams_16_hint', 'Maximum (Heavy CPU load)') }
                      ].map(opt => (
                        <button
                          key={opt.count}
                          onClick={() => setSyncConcurrency(opt.count)}
                          title={opt.hint}
                          className={`py-1.5 px-3 rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${syncConcurrency === opt.count
                              ? 'bg-[#FA2D48] text-white font-semibold shadow-sm'
                              : 'bg-[#222225] text-[#8E8E93] hover:text-white hover:bg-white/[0.06]'
                            }`}
                        >
                          <span>{opt.label}</span>
                          {opt.count >= 12 && (
                            <Zap className={`w-3 h-3 fill-current ${syncConcurrency === opt.count ? 'text-yellow-300' : 'text-yellow-400'}`} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {syncConcurrency >= 12 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-medium animate-fade-in pt-1 border-t border-white/[0.04]">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>{t('highCpuWarning', '12 and 16 streams significantly increase CPU load during conversion')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty queue state */}
            {syncQueue.length === 0 && (
              <div className="py-24 text-center space-y-3 select-none">
                <FolderSync className="w-8 h-8 text-[#8E8E93]/60 mx-auto stroke-[1.75]" />
                <h3 className="font-semibold text-[14px] text-white">{t('queueEmpty', 'Queue is empty')}</h3>
                <p className="text-[12px] text-[#8E8E93] max-w-sm mx-auto">
                  {t('queueEmptyDesc', 'Select songs from Apple Music or YouTube to add them to your sync queue.')}
                </p>
              </div>
            )}

            {/* Playlist group filter */}
            {syncQueue.length > 0 && allGroupKeys.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                <button
                  onClick={() => setQueueActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${queueActiveFilter === 'all'
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-[#222225] text-[#8E8E93] hover:text-white hover:bg-white/[0.08]'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t('allGroups', 'All')}</span>
                  <span className="text-[10.5px] opacity-75 font-mono">({syncQueue.length})</span>
                </button>

                {distinctPlaylistsInQueue.map(pName => {
                  const pCount = syncQueue.filter(t => Array.isArray(t.targetPlaylists) && t.targetPlaylists.includes(pName)).length;
                  const isActive = queueActiveFilter === pName;
                  return (
                    <button
                      key={pName}
                      onClick={() => setQueueActiveFilter(pName)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${isActive
                          ? 'bg-[#FA2D48] text-white font-semibold shadow-sm'
                          : 'bg-[#222225] text-[#8E8E93] hover:text-white hover:bg-white/[0.08]'
                        }`}
                    >
                      <ListMusic className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[140px]">{pName}</span>
                      <span className="text-[10.5px] opacity-75 font-mono">({pCount})</span>
                    </button>
                  );
                })}

                {singlesInQueue.length > 0 && (
                  <button
                    onClick={() => setQueueActiveFilter('__singles__')}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${queueActiveFilter === '__singles__'
                        ? 'bg-[#007AFF] text-white font-semibold shadow-sm'
                        : 'bg-[#222225] text-[#8E8E93] hover:text-white hover:bg-white/[0.08]'
                      }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>{t('individualTracks', 'Individual')}</span>
                    <span className="text-[10.5px] opacity-75 font-mono">({singlesInQueue.length})</span>
                  </button>
                )}
              </div>
            )}

            {/* Playlist group cards in queue */}
            {displayedPlaylists.map((pName) => {
              const plTracks = syncQueue.filter(t => Array.isArray(t.targetPlaylists) && t.targetPlaylists.includes(pName));
              const plDuration = plTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
              const isEditingThis = editingPlaylistName === pName;
              const isCollapsed = collapsedQueueGroups.has(pName);

              return (
                <div key={pName} className="bg-[#18181b] border border-white/[0.06] rounded-[14px] p-4.5 space-y-3 apple-card-shadow transition-all">
                  {/* Playlist group header */}
                  <div
                    onClick={() => toggleGroupCollapse(pName)}
                    className="flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-[7px] bg-[#FA2D48]/10 border border-[#FA2D48]/20 flex items-center justify-center text-[#FA2D48] shrink-0">
                        <ListMusic className="w-4 h-4" />
                      </div>

                      {isEditingThis ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 min-w-0 flex-1 max-w-md"
                        >
                          <input
                            type="text"
                            value={tempPlaylistName}
                            onChange={(e) => setTempPlaylistName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renamePlaylistGroupInQueue(pName, tempPlaylistName);
                              if (e.key === 'Escape') setEditingPlaylistName(null);
                            }}
                            autoFocus
                            className="w-full px-2.5 py-1 bg-[#222225] border border-white/20 rounded-[6px] text-white text-[14px] font-semibold focus:outline-none focus:border-[#FA2D48]"
                          />
                          <button
                            onClick={() => renamePlaylistGroupInQueue(pName, tempPlaylistName)}
                            title={t('save', 'Save')}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-white/[0.06] rounded-[5px] transition-colors cursor-pointer shrink-0"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingPlaylistName(null)}
                            title={t('cancel', 'Cancel')}
                            className="p-1.5 text-[#8E8E93] hover:text-white hover:bg-white/[0.06] rounded-[5px] transition-colors cursor-pointer shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-[15px] text-white tracking-tight truncate">{pName}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlaylistName(pName);
                              setTempPlaylistName(pName);
                            }}
                            title={t('renamePlaylistGroup', 'Rename playlist')}
                            className="p-1 text-[#8E8E93] hover:text-white hover:bg-white/[0.06] rounded-[5px] transition-colors cursor-pointer shrink-0"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono tabular-nums text-[#8E8E93] bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">
                          {plTracks.length} {plTracks.length === 1 ? 'track' : 'tracks'}
                        </span>
                        {plDuration > 0 && (
                          <span className="text-[11px] font-mono tabular-nums text-[#8E8E93]">
                            {formatTime(plDuration)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Group action controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePlaylistGroupFromQueue(pName);
                        }}
                        title={t('removeGroupFromQueue', 'Remove group from queue')}
                        className="px-2.5 py-1 rounded-[6px] text-[12px] font-medium text-[#8E8E93] hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('removeGroupFromQueue', 'Remove group')}</span>
                      </button>

                      <div className="w-6 h-6 rounded-[5px] flex items-center justify-center text-[#8E8E93] hover:text-white transition-colors">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Playlist track list */}
                  {!isCollapsed && (
                    <div className="space-y-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1 pt-2 border-t border-white/[0.06]">
                      {plTracks.map((item, idx) => {
                        const isThisPlaying = currentTrack?.id === item.id && isPlaying;
                        const isThisCurrent = currentTrack?.id === item.id;
                        const coverSrc = getTrackCover(item) || item.cover_url || item.artworkUrl || item.artwork?.url || 'https://images.unsplash.com/photo-1514525253361-b83f859b73c0?w=100';
                        const otherPlaylists = (item.targetPlaylists || []).filter(x => x !== pName);

                        return (
                          <div
                            key={item.id ? `${pName}-${item.id}-${idx}` : `${pName}-${idx}`}
                            onDoubleClick={() => playTrack(item, plTracks)}
                            className={`group bg-[#151517]/80 hover:bg-[#202024] border ${isThisCurrent
                                ? 'border-[#FA2D48]/60 bg-[#FA2D48]/10'
                                : 'border-white/[0.03] hover:border-white/[0.08]'
                              } p-2 rounded-[8px] flex items-center justify-between gap-3 transition-colors cursor-pointer`}
                          >
                            <div className="flex items-center gap-3 truncate min-w-0 flex-1">
                              {/* Artwork and playback overlay */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playTrack(item, plTracks);
                                }}
                                className="relative w-9 h-9 rounded-[4px] overflow-hidden shrink-0 border border-white/10 group/cover cursor-pointer"
                              >
                                <img
                                  src={coverSrc}
                                  className="w-full h-full object-cover"
                                  alt={item.title}
                                />
                                <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100'
                                  }`}>
                                  {isThisPlaying ? (
                                    <Pause className="w-3.5 h-3.5 text-white fill-current" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                                  )}
                                </div>
                              </div>

                              <div className="truncate min-w-0 flex-1">
                                <div className="flex items-center gap-2 truncate">
                                  <h4 className={`font-semibold text-[13px] truncate ${isThisCurrent ? 'text-[#FA2D48]' : 'text-white'}`}>
                                    {item.title}
                                  </h4>
                                  {isThisPlaying && (
                                    <span className="shrink-0 flex items-center gap-0.5">
                                      <span className="w-1 h-3 bg-[#FA2D48] animate-pulse rounded-full" />
                                      <span className="w-1 h-2 bg-[#FA2D48] animate-pulse delay-75 rounded-full" />
                                      <span className="w-1 h-3.5 bg-[#FA2D48] animate-pulse delay-150 rounded-full" />
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11.5px] text-[#8E8E93] truncate mt-0.5">
                                  {item.artist} {item.album ? `• ${item.album}` : ''}
                                </p>
                              </div>
                            </div>

                            {/* Shared playlist badge */}
                            {otherPlaylists.length > 0 && (
                              <div
                                title={`${t('sharedInPlaylists', 'Also in')}: ${otherPlaylists.join(', ')}`}
                                className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] bg-[#FA2D48]/10 text-[#FA2D48] text-[11px] font-medium border border-[#FA2D48]/20 shrink-0"
                              >
                                <Layers className="w-3 h-3" />
                                <span className="truncate max-w-[150px]">+{otherPlaylists.length} {t('playlistGroup', 'playlist')}</span>
                              </div>
                            )}

                            {/* Duration and remove button */}
                            <div className="flex items-center gap-2 shrink-0">
                              {item.duration > 0 && (
                                <span className="text-[11px] font-mono tabular-nums text-[#8E8E93] hidden md:inline">
                                  {formatTime(item.duration)}
                                </span>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playTrack(item, plTracks);
                                }}
                                title={isThisPlaying ? t('pause', 'Pause') : t('play', 'Play')}
                                className={`w-7 h-7 rounded-[5px] flex items-center justify-center transition-colors cursor-pointer ${isThisPlaying ? 'bg-[#FA2D48] text-white' : 'bg-[#222225] hover:bg-white/[0.1] text-[#8E8E93] hover:text-white'
                                  }`}
                              >
                                {isThisPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeTrackFromPlaylistGroup(item.id, pName);
                                }}
                                title={t('removeFromQueue', 'Remove from queue')}
                                className="w-7 h-7 rounded-[5px] bg-[#222225] hover:bg-white/[0.1] hover:text-red-400 text-[#8E8E93] flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Individual tracks section */}
            {showSingles && (
              <div className="bg-[#18181b] border border-white/[0.06] rounded-[14px] p-4.5 space-y-3 apple-card-shadow transition-all">
                {/* Individual tracks group header */}
                <div
                  onClick={() => toggleGroupCollapse('__singles__')}
                  className="flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-[7px] bg-[#007AFF]/10 border border-[#007AFF]/20 flex items-center justify-center text-[#007AFF] shrink-0">
                      <Music className="w-4 h-4" />
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-semibold text-[15px] text-white tracking-tight truncate">
                        {t('individualTracksInQueue', 'Individual Tracks (iPod Library)')}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono tabular-nums text-[#8E8E93] bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">
                        {singlesInQueue.length} {singlesInQueue.length === 1 ? 'track' : 'tracks'}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-[#8E8E93]">
                        {formatTime(singlesInQueue.reduce((acc, t) => acc + (t.duration || 0), 0))}
                      </span>
                    </div>
                  </div>

                  {/* Group action controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSyncQueue(prev => prev.filter(t => Array.isArray(t.targetPlaylists) && t.targetPlaylists.length > 0));
                      }}
                      title={t('removeGroupFromQueue', 'Remove group from queue')}
                      className="px-2.5 py-1 rounded-[6px] text-[12px] font-medium text-[#8E8E93] hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t('removeGroupFromQueue', 'Remove group')}</span>
                    </button>

                    <div className="w-6 h-6 rounded-[5px] flex items-center justify-center text-[#8E8E93] hover:text-white transition-colors">
                      {collapsedQueueGroups.has('__singles__') ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Individual tracks list */}
                {!collapsedQueueGroups.has('__singles__') && (
                  <div className="space-y-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1 pt-2 border-t border-white/[0.06]">
                    {singlesInQueue.map((item, idx) => {
                      const isThisPlaying = currentTrack?.id === item.id && isPlaying;
                      const isThisCurrent = currentTrack?.id === item.id;
                      const coverSrc = getTrackCover(item) || item.cover_url || item.artworkUrl || item.artwork?.url || 'https://images.unsplash.com/photo-1514525253361-b83f859b73c0?w=100';

                      return (
                        <div
                          key={item.id ? `single-${item.id}-${idx}` : `single-${idx}`}
                          onDoubleClick={() => playTrack(item, singlesInQueue)}
                          className={`group bg-[#151517]/80 hover:bg-[#202024] border ${isThisCurrent
                              ? 'border-[#FA2D48]/60 bg-[#FA2D48]/10'
                              : 'border-white/[0.03] hover:border-white/[0.08]'
                            } p-2 rounded-[8px] flex items-center justify-between gap-3 transition-colors cursor-pointer`}
                        >
                          <div className="flex items-center gap-3 truncate min-w-0 flex-1">
                            {/* Artwork and playback overlay */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                playTrack(item, singlesInQueue);
                              }}
                              className="relative w-9 h-9 rounded-[4px] overflow-hidden shrink-0 border border-white/10 group/cover cursor-pointer"
                            >
                              <img
                                src={coverSrc}
                                className="w-full h-full object-cover"
                                alt={item.title}
                              />
                              <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100'
                                }`}>
                                {isThisPlaying ? (
                                  <Pause className="w-3.5 h-3.5 text-white fill-current" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                                )}
                              </div>
                            </div>

                            <div className="truncate min-w-0 flex-1">
                              <div className="flex items-center gap-2 truncate">
                                <h4 className={`font-semibold text-[13px] truncate ${isThisCurrent ? 'text-[#FA2D48]' : 'text-white'}`}>
                                  {item.title}
                                </h4>
                                {isThisPlaying && (
                                  <span className="shrink-0 flex items-center gap-0.5">
                                    <span className="w-1 h-3 bg-[#FA2D48] animate-pulse rounded-full" />
                                    <span className="w-1 h-2 bg-[#FA2D48] animate-pulse delay-75 rounded-full" />
                                    <span className="w-1 h-3.5 bg-[#FA2D48] animate-pulse delay-150 rounded-full" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[11.5px] text-[#8E8E93] truncate mt-0.5">
                                {item.artist} {item.album ? `• ${item.album}` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Duration and remove button */}
                          <div className="flex items-center gap-2 shrink-0">
                            {item.duration > 0 && (
                              <span className="text-[11px] font-mono tabular-nums text-[#8E8E93] hidden md:inline">
                                {formatTime(item.duration)}
                              </span>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playTrack(item, singlesInQueue);
                              }}
                              title={isThisPlaying ? t('pause', 'Pause') : t('play', 'Play')}
                              className={`w-7 h-7 rounded-[5px] flex items-center justify-center transition-colors cursor-pointer ${isThisPlaying ? 'bg-[#FA2D48] text-white' : 'bg-[#222225] hover:bg-white/[0.1] text-[#8E8E93] hover:text-white'
                                }`}
                            >
                              {isThisPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSyncQueue(prev => prev.filter(q => q.id !== item.id));
                              }}
                              title={t('removeFromQueue', 'Remove from queue')}
                              className="w-7 h-7 rounded-[5px] bg-[#222225] hover:bg-white/[0.1] hover:text-red-400 text-[#8E8E93] flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <div className="p-8 space-y-7 animate-fade-in max-w-6xl mx-auto">
          <div className="pb-4">
            <h1 className="text-[28px] font-bold tracking-tight text-white">{t('settingsTitle', 'Settings')}</h1>
            <p className="text-[#8E8E93] text-[13px] font-normal mt-0.5">
              {t('settingsSubtitle', 'Apple Music session authentication, audio transcode bitrate, and interface preferences')}
            </p>
          </div>

          {/* Settings grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Language preferences */}
            <div className="bg-[#1a1a1d] border border-white/[0.06] rounded-[16px] p-6 space-y-4 apple-card-shadow flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-5 h-5 text-[#0A84FF] shrink-0 stroke-[2]" />
                  <h3 className="font-semibold text-[15px] text-white tracking-tight">{t('languageSection', 'Interface Language')}</h3>
                </div>
                <p className="text-[12.5px] text-[#8E8E93] leading-relaxed">
                  {t('languageDesc', 'Select your preferred application display language')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <button
                  onClick={() => changeLanguage('en')}
                  className={`p-3.5 rounded-[10px] border text-left cursor-pointer transition-all flex items-center justify-between ${i18n.language === 'en' ? 'bg-[#FA243C]/10 border-[#FA243C] text-white shadow-sm ring-1 ring-[#FA243C]/30' : 'bg-[#242428] border-white/[0.06] text-[#8E8E93] hover:border-white/20 hover:text-white'}`}
                >
                  <span className="font-semibold text-[13px] text-white">English</span>
                  {i18n.language === 'en' && <Check className="w-4 h-4 text-[#FA243C]" />}
                </button>
                <button
                  onClick={() => changeLanguage('ru')}
                  className={`p-3.5 rounded-[10px] border text-left cursor-pointer transition-all flex items-center justify-between ${i18n.language === 'ru' ? 'bg-[#FA243C]/10 border-[#FA243C] text-white shadow-sm ring-1 ring-[#FA243C]/30' : 'bg-[#242428] border-white/[0.06] text-[#8E8E93] hover:border-white/20 hover:text-white'}`}
                >
                  <span className="font-semibold text-[13px] text-white">Русский</span>
                  {i18n.language === 'ru' && <Check className="w-4 h-4 text-[#FA243C]" />}
                </button>
              </div>
            </div>

            {/* Audio quality and transcode format */}
            <div className="bg-[#1a1a1d] border border-white/[0.06] rounded-[16px] p-6 space-y-4 apple-card-shadow flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-purple-400 shrink-0 stroke-[2]" />
                  <h3 className="font-semibold text-[15px] text-white tracking-tight">{t('audioQuality', 'Audio Quality & Format')}</h3>
                </div>
                <p className="text-[12.5px] text-[#8E8E93] leading-relaxed">
                  {t('audioQualityDesc', 'Transcoding bitrate for iPod AAC / MP3 audio transfer')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <button
                  onClick={() => setAudioQuality('256k')}
                  className={`p-3.5 rounded-[10px] border text-center cursor-pointer transition-all flex items-center justify-center font-semibold text-[13px] ${audioQuality === '256k' ? 'bg-[#FA243C]/10 border-[#FA243C] text-white ring-1 ring-[#FA243C]/30' : 'bg-[#242428] border-white/[0.06] text-[#8E8E93] hover:border-white/20 hover:text-white'}`}
                >
                  <span>{t('audioQualityAAC', 'AAC 256 kbps (Apple Standard)')}</span>
                </button>
                <button
                  onClick={() => setAudioQuality('320k')}
                  className={`p-3.5 rounded-[10px] border text-center cursor-pointer transition-all flex items-center justify-center font-semibold text-[13px] ${audioQuality === '320k' ? 'bg-[#FA243C]/10 border-[#FA243C] text-white ring-1 ring-[#FA243C]/30' : 'bg-[#242428] border-white/[0.06] text-[#8E8E93] hover:border-white/20 hover:text-white'}`}
                >
                  <span>{t('audioQualityMP3', 'MP3 320 kbps (Maximum)')}</span>
                </button>
              </div>
            </div>

            {/* Lyrics and metadata preferences */}
            <div className="bg-[#1a1a1d] border border-white/[0.06] rounded-[16px] p-6 space-y-3.5 apple-card-shadow flex flex-col">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <Mic2 className="w-5 h-5 text-[#FA2D48] shrink-0 stroke-[2]" />
                  <h3 className="font-semibold text-[15px] text-white tracking-tight">{t('lyrics', 'Lyrics')}</h3>
                </div>
                <p className="text-[12.5px] text-[#8E8E93] leading-relaxed">
                  {t('lyricsAutoEmbedDesc', 'Automatically fetch and save lyrics into iTunes & iPod tags (scrollable with Center button on iPod)')}
                </p>
              </div>

              <button
                onClick={() => {
                  const newVal = !autoFetchLyrics;
                  setAutoFetchLyrics(newVal);
                  localStorage.setItem('podsync_auto_lyrics', String(newVal));
                }}
                className={`w-full p-3.5 rounded-[10px] border text-left cursor-pointer transition-all flex items-center justify-between ${autoFetchLyrics ? 'bg-[#FA243C]/10 border-[#FA243C] text-white ring-1 ring-[#FA243C]/30' : 'bg-[#242428] border-white/[0.06] text-[#8E8E93] hover:border-white/20 hover:text-white'}`}
              >
                <span className="font-semibold text-[13px] text-white">{t('lyricsAutoEmbed', 'Auto-embed lyrics into tracks')}</span>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${autoFetchLyrics ? 'bg-[#FA243C] border-[#FA243C] text-white' : 'border-white/20 bg-transparent'}`}>
                  {autoFetchLyrics && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>
            </div>

            {/* Local cache management */}
            <div className="bg-[#1a1a1d] border border-white/[0.06] rounded-[16px] p-6 space-y-3.5 apple-card-shadow flex flex-col">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-5 h-5 text-amber-400 shrink-0 stroke-[2]" />
                  <h3 className="font-semibold text-[15px] text-white tracking-tight">{t('cacheManagement', 'Local SQLite Cache')}</h3>
                </div>
                <p className="text-[12.5px] text-[#8E8E93] leading-relaxed">
                  {t('cacheManagementDesc', 'Removes local song indices and forces a clean sync from Apple Music.')}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-1">
                <p className="text-[11.5px] text-[#8E8E93] leading-relaxed flex-1">
                  <span className="text-[#FA2D48] font-semibold mr-1">{t('cacheRecommendLabel', '* Recommended:')}</span>
                  <span>{t('cacheRecommendText', 'Use if newly added playlists or albums on your other devices are not showing up yet.')}</span>
                </p>

                <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 min-w-[170px]">
                  <button
                    onClick={async () => {
                      if (isClearingCache) return;
                      setIsClearingCache(true);
                      try {
                        if (window.electron?.clearCache) {
                          await window.electron.clearCache();
                        }
                        setLibrarySongs([]);
                        setPlaylists([]);
                        setPlaylistTracksMap({});
                        await fetchFreshData(true, false);
                      } catch (err) {
                        console.error('Clear cache error:', err);
                      } finally {
                        setIsClearingCache(false);
                      }
                    }}
                    disabled={isClearingCache}
                    className="w-full px-4 py-2.5 rounded-[8px] bg-[#242428] border border-white/[0.08] text-[13.5px] font-bold text-[#8E8E93] hover:text-[#FA2D48] hover:border-[#FA2D48]/30 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClearingCache && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FA2D48]" />}
                    <span>{isClearingCache ? t('clearingCache', 'Clearing...') : t('clearCacheBtn', 'Clear Cache')}</span>
                  </button>

                  <div className="text-[11.5px] text-[#8E8E93] tracking-tight text-center w-full">
                    <span className="text-white/90 font-medium">{librarySongs.length}</span> {i18n.language === 'ru' ? 'песен' : 'songs'} • <span className="text-white/90 font-medium">{playlists.length}</span> {i18n.language === 'ru' ? 'плейлистов' : 'playlists'}
                  </div>
                </div>
              </div>
            </div>

            {/* Apple ID authentication */}
            <div className="bg-[#1a1a1d] border border-white/[0.06] rounded-[16px] p-6 apple-card-shadow lg:col-span-2">
              {isApiConnected ? (
                /* Authenticated state */
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5 text-[#FA2D48] shrink-0 stroke-[2]" />
                    <div>
                      <h3 className="font-bold text-[15px] text-white tracking-tight">{t('appleAccount', 'Apple ID Account')}</h3>
                      <p className="text-[12.5px] text-[#8E8E93] mt-0.5 leading-relaxed">
                        {t('appleAccountActiveDesc', 'Apple Music cloud session active. Authorized to sync playlists and stream high-quality audio.')}
                      </p>
                    </div>
                  </div>

                  {/* Account switch and sign out */}
                  <div className="flex items-center gap-3 shrink-0 pt-1 sm:pt-0">
                    <button
                      disabled={isLoggingInApple}
                      onClick={async () => {
                        if (window.electron?.loginAppleMusic) {
                          setIsLoggingInApple(true);
                          try {
                            const res = await window.electron.loginAppleMusic();
                            if (res?.success) {
                              setDevToken(res.bearerToken);
                              setUserToken(res.userToken);
                              setIsApiConnected(true);
                              fetchFreshData();
                              alert(t('signedInSuccess', 'Signed in successfully to Apple Music!'));
                            }
                          } finally {
                            setIsLoggingInApple(false);
                          }
                        }
                      }}
                      className="px-4 py-2 rounded-[8px] bg-[#242428] border border-white/[0.08] text-[12.5px] font-semibold text-white hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-[#8E8E93]" />
                      <span>{isLoggingInApple ? t('signingInPopupOpen', 'Signing in...') : t('switchAccount', 'Switch Account')}</span>
                    </button>

                    <button
                      onClick={async () => {
                        if (window.confirm(t('confirmSignOut', 'Are you sure you want to sign out of Apple Music?'))) {
                          if (window.electron?.logoutAppleMusic) {
                            await window.electron.logoutAppleMusic();
                          } else if (window.electron?.saveTokens) {
                            await window.electron.saveTokens({ bearerToken: devToken, userToken: '' });
                          }
                          setUserToken('');
                          setIsApiConnected(false);
                          setLibrarySongs([]);
                          setPlaylists([]);
                          setPlaylistTracksMap({});
                          alert(t('signedOutSuccess', 'Signed out of Apple Music.'));
                        }
                      }}
                      className="px-4 py-2 rounded-[8px] bg-red-500/10 border border-red-500/20 text-[12.5px] font-semibold text-[#FA2D48] hover:bg-[#FA2D48] hover:text-white transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t('signOut', 'Sign Out')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Unauthenticated state */
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <LogIn className="w-5 h-5 text-[#8E8E93] shrink-0 stroke-[2]" />
                    <div>
                      <h3 className="font-bold text-[15px] text-white tracking-tight">{t('appleAccount', 'Apple ID Account')}</h3>
                      <p className="text-[12.5px] text-[#8E8E93] mt-0.5 leading-relaxed">
                        {t('appleAccountDesc', 'Sign in with your Apple ID using official web authentication to access your cloud library.')}
                      </p>
                    </div>
                  </div>

                  <button
                    disabled={isLoggingInApple}
                    onClick={async () => {
                      if (window.electron?.loginAppleMusic) {
                        setIsLoggingInApple(true);
                        try {
                          const res = await window.electron.loginAppleMusic();
                          if (res?.success) {
                            setDevToken(res.bearerToken);
                            setUserToken(res.userToken);
                            setIsApiConnected(true);
                            fetchFreshData();
                            alert(t('signedInSuccess', 'Signed in successfully to Apple Music!'));
                          }
                        } finally {
                          setIsLoggingInApple(false);
                        }
                      }
                    }}
                    className="btn-apple-red px-5 py-2.5 rounded-[8px] text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shrink-0"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{isLoggingInApple ? t('signingInPopupOpen', 'Signing in...') : t('signInToAppleMusic', 'Sign In to Apple Music')}</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </main>

        {/* Floating batch selection toolbar */}
  {
    selectedTracks.size > 0 && (
      <div
        className={`fixed ${deviceInfo.connected ? 'bottom-[64px]' : 'bottom-6'} left-1/2 -translate-x-1/2 bg-[#1c1c1f]/94 border border-white/15 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.75),0_0_1px_rgba(255,255,255,0.2)] rounded-full pl-4 pr-3.5 py-2 flex items-center gap-3 z-50 animate-fade-in transition-all duration-200`}
      >
        {/* Selected tracks counter */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FA2D48] animate-pulse shrink-0" />
          <span className="text-[12px] font-medium text-white/90 select-none">
            {t('selected', 'Selected')}: <strong className="font-mono text-[13px] text-white font-bold ml-0.5">{selectedTracks.size}</strong>
          </span>
        </div>

        <div className="h-4 w-[1px] bg-white/15 mx-0.5" />

        {/* Sync selected tracks */}
        <button
          onClick={addSelectedToQueue}
          className="btn-apple-red py-1.5 px-4 rounded-full text-[11.5px] font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_4px_16px_rgba(250,45,72,0.35)] active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{t('syncToIpod', 'Sync to iPod')}</span>
        </button>

        {/* Deselect button */}
        <button
          onClick={() => setSelectedTracks(new Set())}
          className="text-[#8E8E93] hover:text-white text-[11.5px] font-medium cursor-pointer transition-colors px-1.5 py-1 rounded-md hover:bg-white/[0.06]"
        >
          {t('deselect', 'Deselect')}
        </button>
      </div>
    )
  }

  {/* iPod storage capacity bar */}
  {
    deviceInfo.connected && (
      <div className="h-[46px] bg-[#151517] border-t border-white/[0.08] px-8 flex items-center justify-center shrink-0 select-none z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        {/* Capacity progress bar with tooltip */}
        <div className="relative w-full max-w-6xl mx-auto flex items-center justify-center">

          {/* Segment hover tooltip */}
          {hoveredCapacitySegment && (
            <div
              style={{
                left: `${hoveredCapacitySegment.x}px`
              }}
              className="absolute -top-12 -translate-x-1/2 bg-[#2A2A2E]/95 backdrop-blur-xl border border-white/20 rounded-[8px] px-3 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.8)] z-30 pointer-events-none select-none text-center flex flex-col items-center min-w-[85px] transition-all duration-75"
            >
              <span className="font-bold text-[12px] text-white leading-tight tracking-tight">
                {hoveredCapacitySegment.title}
              </span>
              <span className="text-[11px] text-[#AEAEB2] font-mono leading-tight mt-0.5">
                {hoveredCapacitySegment.value}
              </span>

              {/* Tooltip arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#2A2A2E] border-r border-b border-white/20 rotate-45" />
            </div>
          )}

          <div
            ref={capacityBarRef}
            onMouseLeave={() => setHoveredCapacitySegment(null)}
            className="relative w-full h-[20px] rounded-[5px] overflow-hidden bg-[#242428] border border-white/[0.12] flex shadow-inner cursor-default"
          >
            {/* Audio files segment */}
            <div
              onMouseMove={(e) => handleCapacityHover(e, t('audio', 'Audio'), formatBytes(storageInfo.audioBytes))}
              style={{ width: `${Math.max(1, Math.min(100, Math.round(((storageInfo.audioBytes || 0) / (storageInfo.total || 1)) * 100)))}%` }}
              className="bg-gradient-to-b from-[#0A84FF] to-[#0062D2] h-full rounded-none hover:brightness-115 transition-[filter]"
            />
            {/* Other files segment */}
            <div
              onMouseMove={(e) => handleCapacityHover(e, t('other', 'Other'), formatBytes(storageInfo.otherBytes))}
              style={{ width: `${Math.max(0.5, Math.min(100, Math.round(((storageInfo.otherBytes || 0) / (storageInfo.total || 1)) * 100)))}%` }}
              className="bg-gradient-to-b from-[#FF9F0A] to-[#D97D00] h-full rounded-none hover:brightness-115 transition-[filter]"
            />
            {/* Free space segment */}
            <div
              onMouseMove={() => setHoveredCapacitySegment(null)}
              className="flex-1 bg-transparent h-full"
            />

            {/* Free space label */}
            <span className="absolute inset-0 flex items-center justify-center text-[11.5px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none select-none tracking-tight">
              {t('free', 'Free')}: {formatBytes(storageInfo.free)}
            </span>
          </div>
        </div>
      </div>
    )
  }
        </div >
      </div >

    {/* Lyrics viewer modal */}
  {
    isLyricsOpen && (
      <div
        onClick={() => setIsLyricsOpen(false)}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      >
        <div
          className="w-full max-w-2xl max-h-[85vh] bg-[#161618]/95 border border-white/[0.12] rounded-[24px] shadow-[0_25px_70px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header with artwork and title */}
          <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3.5 min-w-0 pr-4">
              <div className="w-12 h-12 rounded-[10px] overflow-hidden bg-black/60 border border-white/10 shrink-0 flex items-center justify-center shadow-md">
                {(() => {
                  const cover = lyricsTrack ? (getTrackCover(lyricsTrack) || lyricsTrack.cover_url || lyricsTrack.cover) : null;
                  return cover ? (
                    <img src={cover} className="w-full h-full object-cover" alt="Art" />
                  ) : (
                    <Music className="w-5 h-5 text-[#8E8E93]" />
                  );
                })()}
              </div>
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold text-white truncate tracking-tight">
                  {lyricsTrack?.title || t('lyrics', 'Lyrics')}
                </h2>
                <p className="text-[13px] text-[#8E8E93] truncate mt-0.5 font-medium">
                  {lyricsTrack?.artist || ''}{lyricsTrack?.album ? ` — ${lyricsTrack.album}` : ''}
                </p>
              </div>
            </div>

            {/* Header action controls */}
            <div className="flex items-center gap-2 shrink-0">
              {lyricsText && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(lyricsText);
                    setCopiedLyrics(true);
                    setTimeout(() => setCopiedLyrics(false), 2000);
                  }}
                  title="Copy lyrics to clipboard"
                  className="px-3 py-1.5 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[12px] font-semibold text-[#8E8E93] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {copiedLyrics ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLyrics ? 'Copied' : 'Copy'}</span>
                </button>
              )}

              <button
                onClick={() => lyricsTrack && loadLyricsForTrack(lyricsTrack)}
                title="Refresh lyrics"
                disabled={isLoadingLyrics}
                className="w-8 h-8 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[#8E8E93] hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLyrics ? 'animate-spin text-[#FA2D48]' : ''}`} />
              </button>

              <button
                onClick={() => setIsLyricsOpen(false)}
                title={t('close', 'Close')}
                className="w-8 h-8 rounded-[8px] bg-white/[0.06] hover:bg-[#FA2D48] hover:text-white border border-white/[0.08] text-[#8E8E93] flex items-center justify-center transition-all cursor-pointer ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lyrics text container */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 select-text custom-scrollbar">
            {isLoadingLyrics ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3.5 text-center">
                <Loader2 className="w-8 h-8 text-[#FA2D48] animate-spin" />
                <p className="text-[14px] text-[#8E8E93] font-medium">{t('loadingLyrics', 'Loading lyrics...')}</p>
              </div>
            ) : lyricsText ? (
              <div className="max-w-xl mx-auto space-y-7">
                {lyricsText
                  .replace(/\r\n/g, '\n')
                  .split(/\n\s*\n/)
                  .filter(stanza => stanza.trim().length > 0)
                  .map((stanza, sIdx) => {
                    const lines = stanza.split('\n').map(l => l.trim()).filter(Boolean);
                    return (
                      <div key={sIdx} className="space-y-2 group">
                        {lines.map((line, lIdx) => (
                          <p
                            key={lIdx}
                            className="text-[17px] sm:text-[19px] font-semibold text-white/90 leading-relaxed hover:text-[#FA2D48] transition-colors duration-150 cursor-default select-text"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 space-y-3.5 text-center max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-[14px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#8E8E93]/60">
                  <Mic2 className="w-6 h-6" />
                </div>
                <p className="text-[15px] font-semibold text-white/80">{t('lyricsNotFound', 'No lyrics found for this track')}</p>
                <p className="text-[12.5px] text-[#8E8E93] leading-relaxed">
                  {i18n.language === 'ru'
                    ? 'Для этого трека пока нет текста в открытой базе LRCLIB или название отличается.'
                    : 'Lyrics are not available in LRCLIB for this specific track title or format.'}
                </p>
                <button
                  onClick={() => lyricsTrack && loadLyricsForTrack(lyricsTrack)}
                  className="mt-2 px-4 py-2 rounded-[8px] bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-[12.5px] font-semibold text-white cursor-pointer transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('refresh', 'Retry')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Lyrics modal footer */}
          <div className="p-3.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-[11.5px] text-[#8E8E93] px-6">
            <span className="flex items-center gap-1.5">
              <Quote className="w-3 h-3 text-[#FA2D48]" />
              <span>{i18n.language === 'ru' ? 'Синхронизируется с тегами iTunes и экраном iPod' : 'Embedded into iTunes tags & iPod screen'}</span>
            </span>
            <span className="font-mono text-[10.5px] opacity-60">LRCLIB Engine</span>
          </div>
        </div>
      </div>
    )
  }

    </div >
  );
}
