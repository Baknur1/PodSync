import fs from 'fs';

/**
 * ITunesDBWriter - Generates a binary iTunesDB file for legacy iPods.
 * Specifically handles Nano 4th Gen requirements and custom playlists.
 */
export class ITunesDBWriter {
  constructor(firewireId = '000A27001D294F3E') {
    this.tracks = [];
    this.nextTrackId = 1;

    // Parse the 16-character hex Firewire ID into an 8-byte Buffer
    const cleanId = firewireId.replace('0x', '').padStart(16, '0');
    const dbidBytes = [];
    for (let i = 0; i < 16; i += 2) {
      dbidBytes.push(parseInt(cleanId.substring(i, i + 2), 16));
    }
    this.dbid = Buffer.from(dbidBytes);
  }

  addTrack(metadata) {
    const track = {
      ...metadata,
      id: this.nextTrackId++
    };
    this.tracks.push(track);
    return track;
  }

  /**
   * Main entry point to build the binary buffer.
   * @param {Array<{ title: string, trackIds: number[] }>} playlists
   */
  async build(playlists = []) {
    console.log(`Building iTunesDB for ${this.tracks.length} tracks and ${(playlists || []).length} playlists...`);

    // 1. Create MHIT chunks for all tracks
    const trackChunks = this.tracks.map(t => this.createMhit(t));
    
    // 2. Create MHLT (List of tracks)
    const mhlt = this.createListingChunk('mhlt', trackChunks);
    
    // 3. Create MHSD (Dataset for tracks - type 1)
    const mhsd_tracks = this.createDatasetChunk(1, mhlt);
    
    // 4. Create MHYP Master Playlist of all tracks
    const trackIds = this.tracks.map(t => t.id);
    const mhyp_master = this.createMhyp('iPod Library', trackIds, 1);
    
    // 5. Create user playlist MHYP chunks
    const userMhyps = (playlists || []).map(pl => {
      const plTrackIds = pl.trackIds || [];
      return this.createMhyp(pl.title || pl.name || 'Playlist', plTrackIds, 0);
    });

    // 6. Create MHLP (List of playlists)
    const mhlp = this.createListingChunk('mhlp', [mhyp_master, ...userMhyps]);
    
    // 7. Create MHSD (Dataset for playlists - type 2)
    const mhsd_playlists = this.createDatasetChunk(2, mhlp);
    
    // 8. Create MHBD (Master Header with both datasets)
    const mhbd = this.createMhbd([mhsd_tracks, mhsd_playlists]);
    
    return mhbd;
  }

  /**
   * MHOD Creator (String Metadata)
   * Types: 1=Title, 2=Path, 3=Album, 4=Artist, 5=Genre, 12=Subtitle/Composer
   */
  createMhod(type, str) {
    if (!str) str = "Unknown";
    const headerSize = 24;
    const strBuf = Buffer.from(str, 'utf16le');
    const totalSize = headerSize + strBuf.length;

    const buf = Buffer.alloc(headerSize, 0);
    buf.write('mhod', 0);
    buf.writeUInt32LE(headerSize, 4);
    buf.writeUInt32LE(totalSize, 8);
    buf.writeUInt32LE(type, 12);
    buf.writeUInt32LE(1, 16); // Position

    return Buffer.concat([buf, strBuf]);
  }

  /**
   * MHIT Creator (Track Entry)
   */
  createMhit(track) {
    const mhods = [
      this.createMhod(1, track.title),
      this.createMhod(2, track.internalPath),
      this.createMhod(3, track.album),
      this.createMhod(4, track.artist),
    ];

    const childBuffer = Buffer.concat(mhods);
    const headerSize = 312; // Standard size for modern mhit
    const totalSize = headerSize + childBuffer.length;

    const buf = Buffer.alloc(headerSize, 0);
    buf.write('mhit', 0);
    buf.writeUInt32LE(headerSize, 4);
    buf.writeUInt32LE(totalSize, 8);
    buf.writeUInt32LE(mhods.length, 12); // MHOD count
    buf.writeUInt32LE(track.id, 16); // ID
    
    // Crucial visible flag at offset 20: set to 1 so the songs actually show up!
    buf.writeUInt32LE(1, 20); 

    // File type tag at offset 24 (4 bytes) - 'M4A ' for .m4a
    buf.write('M4A ', 24); 

    // mtime (current UNIX time mapped to Mac time offset 2082844800) at offset 32
    const macTime = Math.round(Date.now() / 1000) + 2082844800;
    buf.writeUInt32LE(macTime, 32); 

    buf.writeUInt32LE(track.fileSize || 0, 36); // File Size at offset 36
    buf.writeUInt32LE(track.duration * 1000, 40); // Duration in ms at offset 40
    
    buf.writeUInt32LE(track.id, 44); // Track number
    buf.writeUInt32LE(1, 48); // Total tracks
    buf.writeUInt32LE(2026, 52); // Year
    
    buf.writeUInt32LE(track.bitrate || 256, 56); // kbps at offset 56
    buf.writeUInt16LE(44100, 62); // Sample rate at offset 62

    // Write database ID (DBID) at offset 112 and 168 (8 bytes)
    this.dbid.copy(buf, 112);
    this.dbid.copy(buf, 168);
    
    buf[244] = 0x33; // format flag
    buf[256] = 1; // played mark

    return Buffer.concat([buf, childBuffer]);
  }

  /**
   * Playlist Record Creator (MHYP)
   */
  createMhyp(playlistName, trackIds, isMaster = 1) {
    const mhods = [
      this.createMhod(1, playlistName)
    ];
    const mhips = trackIds.map(id => this.createMhip(id));
    const childBuffer = Buffer.concat([...mhods, ...mhips]);
    
    const headerSize = 104;
    const totalSize = headerSize + childBuffer.length;
    const buf = Buffer.alloc(headerSize, 0);
    
    buf.write('mhyp', 0);
    buf.writeUInt32LE(headerSize, 4);
    buf.writeUInt32LE(totalSize, 8);
    buf.writeUInt32LE(mhods.length, 12); // Child count (Data Objects count)
    
    // Playlists flags and counts
    buf.writeUInt32LE(trackIds.length, 16); // Playlist Item Count (number of tracks)
    buf.writeUInt32LE(isMaster, 20); // Master flag (1 for iPod Library, 0 for others)
    
    // Calculated Mac epoch timestamp at offset 24 (Mac epoch offset 2082844800)
    const macTime = Math.round(Date.now() / 1000) + 2082844800;
    buf.writeUInt32LE(macTime, 24);
    
    // Write unique 8-byte playlist ID (PLID) at offset 28
    const plid = Buffer.alloc(8);
    plid.writeUInt32LE(isMaster ? 0x99999999 : Math.floor(Math.random() * 0xFFFFFFFF), 0);
    plid.writeUInt32LE(isMaster ? 0x88888888 : Math.floor(Math.random() * 0xFFFFFFFF), 4);
    plid.copy(buf, 28);
    
    // Sort order at offset 44 (100 for master, 1 for others)
    buf.writeUInt32LE(isMaster ? 100 : 1, 44);
    
    return Buffer.concat([buf, childBuffer]);
  }

  /**
   * Playlist Track Reference Creator (MHIP)
   */
  createMhip(trackId) {
    const headerSize = 76;
    const buf = Buffer.alloc(headerSize, 0);
    
    buf.write('mhip', 0);
    buf.writeUInt32LE(headerSize, 4);
    buf.writeUInt32LE(headerSize, 8); // Total size is same as header size
    buf.writeUInt32LE(0, 12); // Child count is 0
    buf.writeUInt32LE(trackId, 16); // Reference track ID
    
    return buf;
  }

  /**
   * Generic Listing Chunk (MHLT / MHLP)
   */
  createListingChunk(id, children) {
    const childBuffer = Buffer.concat(children);
    const headerSize = 92;
    const totalSize = headerSize + childBuffer.length;

    const buf = Buffer.alloc(headerSize, 0);
    buf.write(id, 0);
    buf.writeUInt32LE(headerSize, 4);
    buf.writeUInt32LE(children.length, 8); // Count

    return Buffer.concat([buf, childBuffer]);
  }

  /**
   * Dataset Chunk (MHSD)
   */
  createDatasetChunk(type, child) {
    const headerSize = 92;
    const totalSize = headerSize + child.length;

    const buf = Buffer.alloc(headerSize, 0);
    buf.write('mhsd', 0);
    buf.writeUInt32LE(headerSize, 4);
    buf.writeUInt32LE(totalSize, 8);
    buf.writeUInt32LE(type, 12); // 1=Library, 2=Playlists

    return Buffer.concat([buf, child]);
  }

  /**
   * Master Header (MHBD)
   */
  createMhbd(children) {
    const childBuffer = Buffer.concat(children);
    const headerSize = 108; // Standard size for modern signed mhbd
    const totalSize = headerSize + childBuffer.length;

    const buf = Buffer.alloc(headerSize, 0);
    buf.write('mhbd', 0);
    buf.writeUInt32LE(headerSize, 4);
    buf.writeUInt32LE(totalSize, 8);
    buf.writeUInt32LE(0, 12); // Unknown/Padding
    buf.writeUInt32LE(0x13, 16); // dbversion: 19 in decimal (representing iTunes 7.0 database version, matching the 312-byte mhit size perfectly)
    buf.writeUInt32LE(children.length, 20); // Child count (Dataset count = 2)
    
    // Unique 8-byte database ID (DBID) at offset 24 (must match zeroes slot in hash58)
    this.dbid.copy(buf, 24);
    
    buf.writeUInt16LE(2, 32); // Int16
    // Padding 14 from offset 34 to 48
    
    buf.writeUInt16LE(0, 48); // Hash indicator (set later by hash58)
    // Padding 20 from offset 50 to 70 for secondary hash
    
    buf.write('en', 70); // Language: en
    buf.write('\x00rePear!', 72); // persistent ID

    return Buffer.concat([buf, childBuffer]);
  }
}

export default { ITunesDBWriter };
