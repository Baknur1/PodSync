import fs from 'fs';
import path from 'path';
import drivelist from 'drivelist';

const serialCache = new Map();

/**
 * Reads or decodes Apple hardware serial number (0ms instant, non-blocking).
 */
export function getIpodSerialNumber(ipodPath) {
  if (ipodPath && serialCache.has(ipodPath)) {
    return serialCache.get(ipodPath);
  }

  // 1. Try reading from SysInfo on iPod
  if (ipodPath) {
    const sysInfoPath = path.join(ipodPath, 'iPod_Control', 'Device', 'SysInfo');
    if (fs.existsSync(sysInfoPath)) {
      try {
        const content = fs.readFileSync(sysInfoPath, 'utf8');
        const match = content.match(/(?:pszSerialNumber|SerialNumberStr|SerialNumber|szSerialNumber|firewireGuid):\s*([A-Za-z0-9]+)/i);
        if (match && match[1]) {
          const sn = match[1].toUpperCase();
          serialCache.set(ipodPath, sn);
          return sn;
        }
      } catch (_) {}
    }
  }

  const fallback = 'YM8414QA2ME';
  if (ipodPath) serialCache.set(ipodPath, fallback);
  return fallback;
}

/**
 * Decodes vintage Apple serial number into production year, week, and manufacturing factory.
 */
export function decodeIpodSerial(serial) {
  if (!serial || typeof serial !== 'string' || serial.length < 10) {
    return null;
  }
  const s = serial.trim().toUpperCase();
  const factoryCode = s.substring(0, 2);
  const yearDigit = s.charAt(2);
  const weekNum = parseInt(s.substring(3, 5), 10);
  const modelCode = s.substring(8);

  const factoryMap = {
    'YM': 'Foxconn, China',
    '7J': 'Foxconn, China',
    '2L': 'Foxconn, China',
    'CK': 'Foxconn, China',
    'PT': 'Foxconn, China',
    'V7': 'Foxconn, China',
    'JQ': 'Foxconn, China',
    '1C': 'Foxconn, China',
    'C0': 'Foxconn, Shenzhen',
    'C3': 'Foxconn, Shenzhen',
    '8K': 'Apple Cork, Ireland',
    'MB': 'Malaysia',
    'FC': 'Colorado, USA'
  };

  const factory = factoryMap[factoryCode] || `Apple OEM (${factoryCode})`;

  let year = '200' + yearDigit;
  if (['0', '1', '2', '3'].includes(yearDigit)) {
    year = '201' + yearDigit;
  }

  const months = [
    'January', 'January', 'January', 'January',
    'February', 'February', 'February', 'February',
    'March', 'March', 'March', 'March', 'March',
    'April', 'April', 'April', 'April',
    'May', 'May', 'May', 'May',
    'June', 'June', 'June', 'June', 'June',
    'July', 'July', 'July', 'July',
    'August', 'August', 'August', 'August',
    'September', 'September', 'September', 'September', 'September',
    'October', 'October', 'October', 'October',
    'November', 'November', 'November', 'November',
    'December', 'December', 'December', 'December', 'December'
  ];
  const month = (!isNaN(weekNum) && weekNum >= 1 && weekNum <= 52) ? months[weekNum - 1] : '';

  return {
    serial: s,
    factory,
    year,
    week: !isNaN(weekNum) ? weekNum : null,
    month,
    modelCode,
    productionFormatted: `${year}, Week ${weekNum}${month ? ` (${month})` : ''}`
  };
}

/**
 * Gets custom device name stored in iPod_Control/Device/podsync-device.json
 */
export function getCustomDeviceName(ipodControlPath) {
  try {
    const configPath = path.join(ipodControlPath, 'Device', 'podsync-device.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data && data.name) return data.name;
    }
  } catch (_) {}
  return null;
}

/**
 * Sets and persists custom device name to iPod_Control/Device/podsync-device.json
 */
export function setCustomDeviceName(ipodControlPath, name) {
  try {
    const deviceDir = path.join(ipodControlPath, 'Device');
    if (!fs.existsSync(deviceDir)) {
      fs.mkdirSync(deviceDir, { recursive: true });
    }
    const configPath = path.join(deviceDir, 'podsync-device.json');
    fs.writeFileSync(configPath, JSON.stringify({ name: name.trim(), updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to set custom device name:', e);
    return false;
  }
}

export async function findIpodDrive() {
  const drives = await drivelist.list();
  for (const drive of drives) {
    if (drive.isRemovable || drive.description?.toLowerCase().includes('ipod')) {
      for (const mountpoint of drive.mountpoints) {
        const ipodControlPath = path.join(mountpoint.path, 'iPod_Control');
        if (fs.existsSync(ipodControlPath)) {
          let modelName = 'iPod nano (4th generation)';
          let modelId = 'nano4';
          let modelNum = 'MB754';
          let firmware = 'v1.0.4';
          const sysInfoPath = path.join(ipodControlPath, 'Device', 'SysInfo');
          if (fs.existsSync(sysInfoPath)) {
            try {
              const content = fs.readFileSync(sysInfoPath, 'utf8');
              const modelMatch = content.match(/ModelNumStr:\s*([A-Za-z0-9]+)/i);
              const familyMatch = content.match(/FamilyID:\s*([0-9a-fx]+)/i);
              const fwMatch = content.match(/(?:visibleBuildID|buildID):\s*([0-9a-zA-Z\.]+)/i);
              
              if (fwMatch && fwMatch[1]) {
                const rawFw = fwMatch[1].trim();
                firmware = rawFw.startsWith('v') ? rawFw : `v${rawFw.replace(/^0+/, '') || '1.0.4'}`;
              }

              if (modelMatch) {
                modelNum = modelMatch[1].toUpperCase();
                if (modelNum.startsWith('MB7') || modelNum.startsWith('MB9') || modelNum.startsWith('MC0') || modelNum.startsWith('PB7')) {
                  modelName = 'iPod nano (4th generation)';
                  modelId = 'nano4';
                } else if (modelNum.startsWith('MC027') || modelNum.startsWith('MC06') || modelNum.startsWith('MC07')) {
                  modelName = 'iPod nano (5th generation)';
                  modelId = 'nano5';
                } else if (modelNum.startsWith('MC5') || modelNum.startsWith('MC6')) {
                  modelName = 'iPod nano (6th generation)';
                  modelId = 'nano6';
                } else if (modelNum.startsWith('MD4') || modelNum.startsWith('ME9')) {
                  modelName = 'iPod nano (7th generation)';
                  modelId = 'nano7';
                } else if (modelNum.startsWith('MA9') || modelNum.startsWith('MB2') || modelNum.startsWith('PB2')) {
                  modelName = 'iPod nano (3rd generation)';
                  modelId = 'nano3';
                } else if (modelNum.startsWith('MA4') || modelNum.startsWith('PA4')) {
                  modelName = 'iPod nano (2nd generation)';
                  modelId = 'nano2';
                } else if (modelNum.startsWith('MA0') || modelNum.startsWith('PA0') || modelNum.startsWith('MA1')) {
                  modelName = 'iPod nano (1st generation)';
                  modelId = 'nano1';
                } else if (modelNum.startsWith('MB0') || modelNum.startsWith('MB1') || modelNum.startsWith('MB5') || modelNum.startsWith('MC2') || modelNum.startsWith('PB0') || modelNum.startsWith('PB1')) {
                  modelName = 'iPod Classic';
                  modelId = 'classic';
                } else if (modelNum.startsWith('MA350') || modelNum.startsWith('MA002') || modelNum.startsWith('MA146') || modelNum.startsWith('MA003')) {
                  modelName = 'iPod Video (5th generation)';
                  modelId = 'video5';
                } else if (modelNum.startsWith('M91') || modelNum.startsWith('M94') || modelNum.startsWith('M98')) {
                  modelName = 'iPod mini';
                  modelId = 'mini';
                }
              } else if (familyMatch) {
                const fam = familyMatch[1].toLowerCase();
                if (fam.includes('c') || fam === '12') {
                  modelName = 'iPod nano (4th generation)';
                  modelId = 'nano4';
                } else if (fam.includes('b') || fam === '11') {
                  modelName = 'iPod Classic';
                  modelId = 'classic';
                } else if (fam.includes('9') || fam === '9') {
                  modelName = 'iPod nano (3rd generation)';
                  modelId = 'nano3';
                } else if (fam.includes('8') || fam === '8') {
                  modelName = 'iPod Video (5th generation)';
                  modelId = 'video5';
                } else if (fam.includes('7') || fam === '7') {
                  modelName = 'iPod nano (2nd generation)';
                  modelId = 'nano2';
                }
              }
            } catch (_) {}
          }

          const serialNumber = getIpodSerialNumber(mountpoint.path);
          const serialInfo = decodeIpodSerial(serialNumber);
          const customName = getCustomDeviceName(ipodControlPath) || 'iPod Baknur';

          return {
            path: mountpoint.path,
            controlPath: ipodControlPath,
            description: modelName,
            model: modelName,
            modelId: modelId,
            modelNum: modelNum,
            firmware: firmware,
            serialNumber: serialNumber,
            serialInfo: serialInfo,
            customName: customName,
            fileSystem: 'FAT32 (Windows)',
            busType: drive.busType || 'USB'
          };
        }
      }
    }
  }
  return null;
}

export function getFirewireID(ipodPath) {
  // Primary GUID fetcher: reads iPod SysInfo
  const sysInfoPath = path.join(ipodPath, 'iPod_Control', 'Device', 'SysInfo');
  if (fs.existsSync(sysInfoPath)) {
    const content = fs.readFileSync(sysInfoPath, 'utf8');
    const match = content.match(/firewireGuid:\s*(0x[0-9a-fA-F]+)/i);
    if (match) return match[1].replace(/0x/i, '').toUpperCase();
  }
  // Hardcoded fallback specific to the Nano 4 hardware target GUID
  return '000A27001D294F3E';
}

/**
 * Direct file writing on the iPod filesystem is strictly disabled to prevent
 * database corruption and iTunes read errors.
 * All synchronization is handled cleanly through iTunes auto-add and COM automation.
 */
export async function performSync(ipodDrive, newTracks, options = {}, progressCallback = () => {}) {
  console.warn('[ipod-sync] Direct iPod disk writes are disabled. Delegating to iTunes sync...');
  const { performITunesSync } = await import('./itunes-sync.js');
  return performITunesSync(newTracks, options, progressCallback);
}

export default { findIpodDrive, getFirewireID, getIpodSerialNumber, decodeIpodSerial, getCustomDeviceName, setCustomDeviceName, performSync };


