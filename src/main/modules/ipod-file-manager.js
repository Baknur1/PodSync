import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Manages the file system on the iPod device.
 * Handles folder creation (F00-F19) and path mapping.
 */
export class IPodFileManager {
  constructor(ipodPath) {
    this.ipodPath = ipodPath;
    this.baseMusicPath = path.join(ipodPath, 'iPod_Control', 'Music');
  }

  /**
   * Performs a clean wipe of the iPod music directory.
   */
  clearLibrary() {
    if (fs.existsSync(this.baseMusicPath)) {
      fs.rmSync(this.baseMusicPath, { recursive: true, force: true });
    }
    fs.mkdirSync(this.baseMusicPath, { recursive: true });

    // Create F00 to F13 folders as per requested iPod structure
    for (let i = 0; i < 14; i++) {
      const folderName = `F${i.toString().padStart(2, '0')}`;
      fs.mkdirSync(path.join(this.baseMusicPath, folderName), { recursive: true });
    }
  }

  /**
   * Generates a unique 4-letter filename and assigns it to a random Fxx folder.
   * Returns both the local system path and the internal iPod path (colon-separated).
   */
  prepareTrackDestination(extension = '.m4a') {
    const folderNum = Math.floor(Math.random() * 14);
    const folder = `F${folderNum.toString().padStart(2, '0')}`;
    
    // Generate a random 4-character filename (A-Z)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randomName = '';
    for (let i = 0; i < 4; i++) {
      randomName += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const filename = `${randomName}${extension}`;
    
    const folderPath = path.join(this.baseMusicPath, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const absolutePath = path.join(folderPath, filename);
    
    // iPod internal DB uses colon-separated paths starting from the root of the "Music" folder usually,
    // or relative to the root. MacOS/Original iTunes uses :iPod_Control:Music:Fxx:FILE.m4a
    const internalPath = `:iPod_Control:Music:${folder}:${filename}`;

    return {
      absolutePath,
      internalPath,
      folder,
      filename
    };
  }

  /**
   * Copies a file from local temp storage to the iPod.
   */
  copyToIpod(sourcePath, destPath) {
    fs.copyFileSync(sourcePath, destPath);
  }
}
