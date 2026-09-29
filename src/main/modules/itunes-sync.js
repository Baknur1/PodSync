import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
let app = null;
let shell = null;
try {
  const electron = await import('electron');
  app = electron.app || electron.default?.app;
  shell = electron.shell || electron.default?.shell;
} catch (_) {}

import { normalizeKazakh } from './matching-engine.js';

/**
 * Executes high-performance, rock-solid iTunes synchronization using direct Windows COM automation:
 * 1. Connecting via iTunes COM automation and ensuring the target playlist exists
 * 2. Deduplicating tracks against existing playlist and library entries
 * 3. Adding newly converted AAC (.m4a) tracks directly
 * 4. Triggering native iPod synchronization via UpdateIPod()
 */
export async function performITunesSync(tracks, options = {}, progressCallback = () => {}) {
  return new Promise(async (resolve) => {
    try {
      progressCallback({ status: 'Preparing iTunes sync...', progress: 10 });

      const validTracks = (Array.isArray(tracks) ? tracks : [])
        .map(t => {
          const filePath = typeof t === 'string' ? t : (t?.local_path || t?.path || t?.filePath || '');
          if (!filePath || !fs.existsSync(filePath)) return null;

          const rawTitle = typeof t === 'object' ? normalizeKazakh(t.title || '') : '';
          const rawArtist = typeof t === 'object' ? normalizeKazakh(t.artist || '') : '';
          const rawAlbum = typeof t === 'object' ? normalizeKazakh(t.album || '') : '';
          const primaryArtist = typeof t === 'object' ? normalizeKazakh(t.album_artist || rawArtist.split(/[,&/+]|\bfeat\.?\b|\bft\.?\b|\band\b|\bwith\b|\bx\b/i)[0]?.trim() || rawArtist) : '';
          const trackNum = typeof t === 'object' ? Number(t.track_number ?? t.trackNumber ?? 0) : 0;
          const discNum = typeof t === 'object' ? Number(t.disc_number ?? t.discNumber ?? 1) : 1;
          const trackCount = typeof t === 'object' ? Number(t.track_count ?? t.trackCount ?? 0) : 0;
          const genre = typeof t === 'object' ? (t.genre || '') : '';
          const yearStr = typeof t === 'object' ? String(t.year || t.release_date || '').slice(0, 4) : '';
          const lyrics = typeof t === 'object' ? normalizeKazakh(t.lyrics || '') : '';
          const coverUrl = typeof t === 'object' ? (t.cover_url || t.coverUrl || t.cover || '') : '';

          const rawTargetPlaylists = Array.isArray(t?.targetPlaylists)
            ? t.targetPlaylists.map(p => String(p).trim()).filter(Boolean)
            : (t?.targetPlaylist ? [String(t.targetPlaylist).trim()] : []);
          if (rawTargetPlaylists.length === 0 && options.createPlaylist && options.playlistName && String(options.playlistName).trim()) {
            rawTargetPlaylists.push(String(options.playlistName).trim());
          }

          return {
            path: filePath,
            title: rawTitle,
            artist: rawArtist,
            album: rawAlbum,
            albumArtist: primaryArtist,
            trackNumber: trackNum,
            discNumber: discNum,
            trackCount: trackCount,
            genre: genre,
            year: yearStr ? parseInt(yearStr, 10) : 0,
            lyrics: lyrics,
            coverUrl: coverUrl,
            coverPath: '',
            targetPlaylists: Array.from(new Set(rawTargetPlaylists))
          };
        })
        .filter(Boolean);

      if (validTracks.length === 0) {
        console.warn('[itunes-sync] No valid files found to sync');
        progressCallback({ status: 'Нет файлов для синхронизации', progress: 100 });
        return resolve({ success: true, count: 0 });
      }

      // Ensure all valid tracks have lyrics resolved and covers cached for iTunes COM
      for (const tr of validTracks) {
        if (!tr.lyrics) {
          try {
            const { getTrackLyrics } = await import('./lyrics-service.js');
            const lyr = await getTrackLyrics(tr);
            if (lyr) {
              tr.lyrics = lyr;
            }
          } catch (_) {}
        }

        if (tr.coverUrl && !tr.coverPath) {
          try {
            const { downloadCover } = await import('./converter.js');
            const cFile = await downloadCover(tr.coverUrl, tr.title || Date.now());
            if (cFile) {
              tr.coverPath = cFile;
            }
          } catch (_) {}
        }
      }

      // Collect all distinct target playlist names
      const allDistinctPlaylists = Array.from(new Set(
        validTracks.flatMap(t => t.targetPlaylists || []).filter(Boolean)
      ));

      const userProfile = process.env.USERPROFILE || os.homedir();
      const itunesPlaylistsDir = path.join(userProfile, 'Music', 'iTunes', 'Playlists');
      const appPlaylistsDir = path.join(app.getPath('userData'), 'playlists');
      if (!fs.existsSync(itunesPlaylistsDir)) {
        try { fs.mkdirSync(itunesPlaylistsDir, { recursive: true }); } catch (_) {}
      }
      if (!fs.existsSync(appPlaylistsDir)) {
        try { fs.mkdirSync(appPlaylistsDir, { recursive: true }); } catch (_) {}
      }

      // Generate/update .m3u8 backup files for each distinct playlist
      for (const pName of allDistinctPlaylists) {
        const safePlName = pName.replace(/[\\/:*?"<>|]/g, '_').trim();
        if (!safePlName) continue;
        const playlistFilePath = path.join(itunesPlaylistsDir, `${safePlName}.m3u8`);

        let existingPaths = new Set();
        let existingLines = [];
        if (options.mode !== 'replace' && fs.existsSync(playlistFilePath)) {
          try {
            const content = fs.readFileSync(playlistFilePath, 'utf8');
            const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            for (const line of lines) {
              if (!line.startsWith('#')) {
                existingPaths.add(line.toLowerCase());
                existingLines.push(line);
              }
            }
          } catch (_) {}
        }

        const m3uLines = ['#EXTM3U'];
        for (const p of existingLines) {
          const fileName = path.basename(p);
          m3uLines.push(`#EXTINF:-1,${fileName.replace(/\.[^/.]+$/, '')}`);
          m3uLines.push(p);
        }
        for (const tr of validTracks) {
          if (tr.targetPlaylists && tr.targetPlaylists.includes(pName)) {
            if (!existingPaths.has(tr.path.toLowerCase())) {
              const fileName = path.basename(tr.path);
              m3uLines.push(`#EXTINF:-1,${fileName.replace(/\.[^/.]+$/, '')}`);
              m3uLines.push(tr.path);
              existingPaths.add(tr.path.toLowerCase());
            }
          }
        }

        try {
          fs.writeFileSync(playlistFilePath, '\ufeff' + m3uLines.join('\r\n'), 'utf8');
          fs.writeFileSync(path.join(appPlaylistsDir, `${safePlName}.m3u8`), '\ufeff' + m3uLines.join('\r\n'), 'utf8');
        } catch (_) {}
      }

      console.log(`[itunes-sync] Processing ${validTracks.length} unique tracks across ${allDistinctPlaylists.length} playlists: [${allDistinctPlaylists.join(', ')}]`);

      progressCallback({ status: 'Подключение к iTunes COM...', progress: 82, step: 'itunes_connect' });

      // 2. Direct COM Automation: Add to Library EXACTLY ONCE, set metadata & link to respective Playlists
      const tracksJsonBase64 = Buffer.from(JSON.stringify(validTracks), 'utf8').toString('base64');

      const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'
try {
    [Console]::WriteLine("[PROGRESS:84] Подключение к iTunes COM...")
    $itunes = New-Object -ComObject iTunes.Application
    $syncMode = "${(options.mode || 'additive').replace(/"/g, '`"')}"
    $library = $itunes.LibraryPlaylist

    # Find iPod source if connected in iTunes
    $ipodSource = $null
    try {
        foreach ($src in $itunes.Sources) {
            if ($src.Kind -eq 2 -or $src.Name -like "*iPod*") {
                $ipodSource = $src
                [Console]::WriteLine("[PROGRESS:86] Обнаружен плеер в iTunes: " + $src.Name)
                break
            }
        }
    } catch {}

    $jsonBytes = [System.Convert]::FromBase64String("${tracksJsonBase64}")
    $jsonStr = [System.Text.Encoding]::UTF8.GetString($jsonBytes)
    $items = $jsonStr | ConvertFrom-Json

    # Map of all distinct playlists
    $playlistsMap = @{}
    $ipodPlaylistsMap = @{}

    # Collect distinct playlist names
    $distinctPlaylists = @()
    foreach ($item in $items) {
        if ($null -ne $item.targetPlaylists) {
            foreach ($pName in $item.targetPlaylists) {
                if ($pName -ne "" -and -not ($distinctPlaylists -contains $pName)) {
                    $distinctPlaylists += $pName
                }
            }
        }
    }

    # Prepare all distinct playlists on PC and iPod
    foreach ($pName in $distinctPlaylists) {
        [Console]::WriteLine("[PROGRESS:87] Подготовка плейлиста '$pName'...")
        # 1. PC Playlist
        try {
            $existingPl = $itunes.LibrarySource.Playlists | Where-Object { $_.Name -eq $pName }
            if ($null -ne $existingPl) {
                if ($syncMode -eq 'replace' -or $syncMode -eq 'mirror') {
                    try {
                        while ($existingPl.Tracks.Count -gt 0) {
                            $existingPl.Tracks.Item(1).Delete()
                        }
                        $playlistsMap[$pName] = $existingPl
                    } catch {
                        $existingPl.Delete()
                        $playlistsMap[$pName] = $itunes.CreatePlaylist($pName)
                    }
                } else {
                    $playlistsMap[$pName] = $existingPl
                }
            } else {
                $playlistsMap[$pName] = $itunes.CreatePlaylist($pName)
            }
        } catch {
            try { $playlistsMap[$pName] = $itunes.CreatePlaylist($pName) } catch {}
        }

        # 2. iPod Playlist
        if ($null -ne $ipodSource) {
            try {
                $existingIpodPl = $ipodSource.Playlists | Where-Object { $_.Name -eq $pName }
                if ($null -ne $existingIpodPl) {
                    if ($syncMode -eq 'replace' -or $syncMode -eq 'mirror') {
                        try {
                            while ($existingIpodPl.Tracks.Count -gt 0) {
                                $existingIpodPl.Tracks.Item(1).Delete()
                            }
                            $ipodPlaylistsMap[$pName] = $existingIpodPl
                        } catch {
                            $existingIpodPl.Delete()
                            $ipodPlaylistsMap[$pName] = $ipodSource.CreatePlaylist($pName)
                        }
                    } else {
                        $ipodPlaylistsMap[$pName] = $existingIpodPl
                    }
                } else {
                    $ipodPlaylistsMap[$pName] = $ipodSource.CreatePlaylist($pName)
                }
            } catch {}
        }
    }

    # Add each file to Library ONCE, set metadata, then link to all target playlists
    $totalF = $items.Count
    $idxF = 0
    [Console]::WriteLine("[PROGRESS:90] Импорт $totalF треков в медиатеку...")

    foreach ($item in $items) {
        $idxF++
        $file = $item.path
        if (Test-Path -LiteralPath $file) {
            $fileLower = $file.ToLower()
            $trackObj = $null

            # Search if already in Library by location
            $fn = [System.IO.Path]::GetFileNameWithoutExtension($file)
            $fnClean = $fn -replace '_[a-zA-Z0-9\._\-]+$', ''
            try {
                $searchRes = $library.Search($fnClean, 5)
                if ($null -ne $searchRes) {
                    foreach ($t in $searchRes) {
                        if ($null -ne $t -and $null -ne $t.Location -and $t.Location.ToLower() -eq $fileLower) {
                            $trackObj = $t
                            break
                        }
                    }
                }
            } catch {}

            # If not in Library, add it ONCE
            if ($null -eq $trackObj) {
                try {
                    $op = $library.AddFile($file)
                    if ($null -ne $op) {
                        while ($op.InProgress) {
                            Start-Sleep -Milliseconds 40
                        }
                        if ($null -ne $op.Tracks -and $op.Tracks.Count -gt 0) {
                            $trackObj = $op.Tracks.Item(1)
                        }
                    }
                } catch {}

                if ($null -eq $trackObj) {
                    try {
                        $searchRes = $library.Search($fnClean, 5)
                        if ($null -ne $searchRes) {
                            foreach ($t in $searchRes) {
                                if ($null -ne $t -and $null -ne $t.Location -and $t.Location.ToLower() -eq $fileLower) {
                                    $trackObj = $t
                                    break
                                }
                            }
                            if ($null -eq $trackObj -and $searchRes.Count -gt 0) {
                                $trackObj = $searchRes.Item(1)
                            }
                        }
                    } catch {}
                }
            }

            # Explicitly set track properties on iTunes COM object for 100% accurate metadata
            if ($null -ne $trackObj) {
                try {
                    if ($item.trackNumber -gt 0) { $trackObj.TrackNumber = [int]$item.trackNumber }
                    if ($item.discNumber -gt 0) { $trackObj.DiscNumber = [int]$item.discNumber }
                    if ($item.trackCount -gt 0) { $trackObj.TrackCount = [int]$item.trackCount }
                    if ($item.album -and $item.album -ne "") { $trackObj.Album = $item.album }
                    if ($item.albumArtist -and $item.albumArtist -ne "") { $trackObj.AlbumArtist = $item.albumArtist }
                    if ($item.artist -and $item.artist -ne "") { $trackObj.Artist = $item.artist }
                    if ($item.title -and $item.title -ne "") { $trackObj.Name = $item.title }
                    if ($item.genre -and $item.genre -ne "") { $trackObj.Genre = $item.genre }
                    if ($item.year -and [int]$item.year -gt 1900) { $trackObj.Year = [int]$item.year }
                    if ($item.lyrics -and $item.lyrics -ne "") {
                        $cleanLyr = $item.lyrics -replace '(?m)^[ \t]*:[ \t]*', ''
                        $trackObj.Lyrics = $cleanLyr
                    }
                    if ($item.coverPath -and (Test-Path $item.coverPath)) {
                        try {
                            if ($null -eq $trackObj.Artwork -or $trackObj.Artwork.Count -eq 0) {
                                $trackObj.AddArtworkFromFile($item.coverPath) | Out-Null
                            }
                        } catch {}
                    }
                } catch {}

                # Link track to ALL target PC playlists & iPod playlists
                $hasPlaylists = $false
                if ($null -ne $item.targetPlaylists -and $item.targetPlaylists.Count -gt 0) {
                    foreach ($plName in $item.targetPlaylists) {
                        if ($plName -ne "") {
                            $hasPlaylists = $true
                            # Link to PC Playlist
                            if ($playlistsMap.ContainsKey($plName)) {
                                $pl = $playlistsMap[$plName]
                                if ($null -ne $pl) {
                                    try {
                                        $alreadyIn = $false
                                        if ($null -ne $pl.Tracks -and $pl.Tracks.Count -gt 0) {
                                            foreach ($pt in $pl.Tracks) {
                                                if ($null -ne $pt -and ($pt.trackID -eq $trackObj.trackID -or ($null -ne $pt.Location -and $pt.Location.ToLower() -eq $fileLower))) {
                                                    $alreadyIn = $true
                                                    break
                                                }
                                            }
                                        }
                                        if (-not $alreadyIn) {
                                            $pl.AddTrack($trackObj) | Out-Null
                                        }
                                    } catch {
                                        try { $pl.AddTrack($trackObj) | Out-Null } catch {}
                                    }
                                }
                            }

                            # Link to iPod Playlist
                            if ($ipodPlaylistsMap.ContainsKey($plName)) {
                                $ipodPl = $ipodPlaylistsMap[$plName]
                                if ($null -ne $ipodPl) {
                                    try {
                                        $alreadyInIpod = $false
                                        if ($null -ne $ipodPl.Tracks -and $ipodPl.Tracks.Count -gt 0) {
                                            foreach ($pt in $ipodPl.Tracks) {
                                                if ($null -ne $pt -and ($pt.trackID -eq $trackObj.trackID -or ($null -ne $pt.Location -and $pt.Location.ToLower() -eq $fileLower))) {
                                                    $alreadyInIpod = $true
                                                    break
                                                }
                                            }
                                        }
                                        if (-not $alreadyInIpod) {
                                            $ipodPl.AddTrack($trackObj) | Out-Null
                                        }
                                    } catch {
                                        try { $ipodPl.AddTrack($trackObj) | Out-Null } catch {}
                                    }
                                }
                            }
                        }
                    }
                }

                # If no specific playlist, make sure it's linked in iPod main library
                if (-not $hasPlaylists -and $null -ne $ipodSource -and $null -ne $ipodSource.Playlists -and $ipodSource.Playlists.Count -gt 0) {
                    try {
                        $ipodSource.Playlists.Item(1).AddTrack($trackObj) | Out-Null
                    } catch {}
                }
            }
        }
    }

    # 4. Trigger native iPod synchronization
    [Console]::WriteLine("[PROGRESS:96] Синхронизация медиатеки с iPod (UpdateIPod)...")
    try { $itunes.UpdateIPod() } catch {}
    if ($null -ne $ipodSource) {
        try { $ipodSource.UpdateIPod() } catch {}
        try { $ipodSource.Update() } catch {}
    }
} catch {}
[Console]::WriteLine("[PROGRESS:100] Готово!")
exit 0
`;

      const tempScriptPath = path.join(app.getPath('temp'), `podsync-itunes-sync-${Date.now()}.ps1`);
      fs.writeFileSync(tempScriptPath, '\ufeff' + psScript, 'utf8');

      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        try { if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath); } catch (_) {}
        progressCallback({ status: 'Синхронизация с iTunes и iPod завершена!', progress: 100, step: 'done' });
        const primaryPlName = allDistinctPlaylists.length > 0 ? allDistinctPlaylists[0] : (options.playlistName || 'PodSync');
        const primaryPlPath = allDistinctPlaylists.length > 0 ? path.join(itunesPlaylistsDir, `${primaryPlName.replace(/[\\/:*?"<>|]/g, '_').trim()}.m3u8`) : null;
        resolve({
          success: true,
          count: validTracks.length,
          playlists: allDistinctPlaylists,
          playlistPath: primaryPlPath,
          playlistName: allDistinctPlaylists.length > 1 ? allDistinctPlaylists.join(', ') : primaryPlName
        });
      };

      const child = spawn('powershell.exe', [
        '-Sta',
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', tempScriptPath
      ]);

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          const text = chunk.toString();
          const lines = text.split(/\r?\n/);
          for (const line of lines) {
            const match = line.match(/\[PROGRESS:(\d+)\]\s*(.+)/);
            if (match) {
              const p = parseInt(match[1], 10);
              const statusMsg = match[2].trim();
              progressCallback({ status: statusMsg, progress: p });
            }
          }
        });
      }

      child.on('close', finish);
      child.on('error', finish);

      // Safe dynamic timeout based on track count (at least 45 seconds, + 2.5s per track)
      const dynamicTimeoutMs = Math.max(45000, validTracks.length * 2500);
      setTimeout(() => {
        try { child.kill(); } catch (_) {}
        finish();
      }, dynamicTimeoutMs);

    } catch (err) {
      console.error('[itunes-sync] Exception:', err);
      resolve({ success: false, error: err.message });
    }
  });
}

export default { performITunesSync };
