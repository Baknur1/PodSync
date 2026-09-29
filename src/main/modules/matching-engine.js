import { searchTrack } from './downloader.js';

/**
 * Calculates Dice's Coefficient bigram similarity between two strings (0.0 to 1.0).
 */
export function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = String(str1).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const s2 = String(str2).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bi = s1.substr(i, 2);
    bigrams.set(bi, (bigrams.get(bi) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bi = s2.substr(i, 2);
    const count = bigrams.get(bi) || 0;
    if (count > 0) {
      bigrams.set(bi, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (s1.length - 1 + s2.length - 1);
}

/**
 * Transliterates Cyrillic to standard Latin.
 */
export function transliterate(text) {
  if (!text) return '';
  const map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya', 'ә': 'a', 'і': 'i', 'ң': 'n', 'ғ': 'g', 'ү': 'u', 'ұ': 'u', 'қ': 'k',
    'ө': 'o', 'һ': 'h'
  };
  return text.toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('');
}

/**
 * Transliterates Cyrillic to ISO-9 / International transliteration (e.g. ja, ju, jo).
 */
export function transliterateIso(text) {
  if (!text) return '';
  const map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'jo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'ju',
    'я': 'ja', 'ә': 'a', 'і': 'i', 'ң': 'n', 'ғ': 'g', 'ү': 'u', 'ұ': 'u', 'қ': 'k',
    'ө': 'o', 'һ': 'h'
  };
  return text.toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('');
}

/**
 * Normalizes title string by removing parentheticals, featured tags, and non-letter punctuation
 * while fully preserving international unicode characters and retaining remaster/technical suffixes.
 */
export function cleanTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s*\([^)]*feat[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*feat[^\]]*\]/gi, '')
    .replace(/\s*\([^)]*official[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*official[^\]]*\]/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits complex artist strings into individual clean artist names.
 * Example: "Ayau, Shiza & M'Dee" -> ["ayau", "shiza", "m dee"]
 */
export function parseArtists(artistStr) {
  if (!artistStr) return [];
  const protectedStr = artistStr.replace(/\bac\/dc\b/gi, 'AC_DC');
  return protectedStr
    .split(/[,&+]|\s+\/\s+|\bfeat\.?\b|\bft\.?\b|\band\b|\bwith\b|\bx\b/i)
    .map(a => a.replace(/AC_DC/g, 'ac/dc').toLowerCase().replace(/\$/g, 's').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter(a => a.length > 0);
}

/**
 * Normalizes Kazakh/Cyrillic specific letters into basic Cyrillic.
 */
export function normalizeKazakh(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/ә/g, 'а').replace(/Ә/g, 'А')
    .replace(/і/g, 'и').replace(/І/g, 'И')
    .replace(/ң/g, 'н').replace(/Ң/g, 'Н')
    .replace(/ғ/g, 'г').replace(/Ғ/g, 'Г')
    .replace(/ү/g, 'у').replace(/Ү/g, 'У')
    .replace(/ұ/g, 'у').replace(/Ұ/g, 'У')
    .replace(/қ/g, 'к').replace(/Қ/g, 'К')
    .replace(/ө/g, 'о').replace(/Ө/g, 'О')
    .replace(/һ/g, 'х').replace(/Һ/g, 'Х')
    .replace(/['`’ʼ]/g, '');
}

/**
 * Generates all algorithmic variations for an artist dynamically without any hardcoded dictionary:
 * (Direct, Transliterated, ISO-9 Latin, Kazakh-normalized, and Punctuation-stripped).
 */
export function getDynamicArtistVariants(artistName) {
  if (!artistName) return [];
  const base = artistName.toLowerCase().replace(/\$/g, 's').replace(/['`’ʼ]/g, '').trim();
  const cleanAlpha = base.replace(/[^\p{L}\p{N}]/gu, '');
  
  const variants = new Set([
    cleanAlpha,
    normalizeKazakh(cleanAlpha),
    transliterate(cleanAlpha).replace(/[^\p{L}\p{N}]/gu, ''),
    transliterateIso(cleanAlpha).replace(/[^\p{L}\p{N}]/gu, '')
  ]);

  return Array.from(variants).filter(v => v.length > 0);
}

/**
 * Calculates a match score between Apple Music metadata and a YouTube result.
 * @param {Object} track - Apple Music track (title, artist, album, duration)
 * @param {Object} candidate - YouTube candidate (title, channel, duration)
 * @returns {number} Score (0 to 100)
 */
export function calculateMatchScore(track, candidate) {
  if (!track || !candidate) return 0;

  let score = 0;

  const rawTrackTitle = (track.title || '').toLowerCase();
  const rawCandTitle = (candidate.title || '').toLowerCase();
  const rawCandChannel = (candidate.channel || candidate.uploader || '').toLowerCase();

  const cleanTrack = cleanTitle(track.title);
  const cleanCand = cleanTitle(candidate.title);
  const artists = parseArtists(track.artist);
  const primaryArtist = artists[0] || '';

  const cleanArtAlpha = primaryArtist.replace(/[^\p{L}\p{N}]/gu, '');
  const cleanChanAlpha = rawCandChannel.replace(/[^\p{L}\p{N}]/gu, '');
  const cleanCandAlpha = cleanCand.replace(/[^\p{L}\p{N}]/gu, '');

  // 1. TOPIC & CHANNEL AUTHORITY (Max 55 pts)
  const isTopic = rawCandChannel.includes('topic');
  const isVevo = rawCandChannel.includes('vevo');

  if (isTopic) {
    const isVariousArtists = rawCandChannel.includes('various artists');
    if (isVariousArtists) {
      // Compilation / Soundtrack Topic channel: verify artist is mentioned in candidate title
      let artistFoundInCompilation = false;
      for (const art of artists) {
        const variants = getDynamicArtistVariants(art);
        for (const variant of variants) {
          if (variant.length >= 3 && cleanCandAlpha.includes(variant)) {
            artistFoundInCompilation = true;
            break;
          }
        }
        if (artistFoundInCompilation) break;
      }

      if (artistFoundInCompilation) {
        score += 45; // Valid compilation track from official Various Artists Topic
      } else {
        return 0; // Completely unrelated song on a compilation album
      }
    } else {
      // Regular artist topic channel: check against artist & dynamic variants
      const topicArtist = rawCandChannel.replace(/\s*-\s*topic$/i, '').trim();
      const cleanTopicArt = topicArtist.replace(/[^\p{L}\p{N}]/gu, '');

      const topicMatchesArtist = artists.some(art => {
        const variants = getDynamicArtistVariants(art);
        return variants.some(variant => {
          return variant && (
            cleanTopicArt.includes(variant) ||
            variant.includes(cleanTopicArt) ||
            stringSimilarity(cleanTopicArt, variant) >= 0.75
          );
        });
      });

      if (!topicMatchesArtist) {
        // Different artist's Topic channel -> DISQUALIFIED!
        return 0;
      }
      score += 55; // Verified studio master from official YouTube Music artist topic
    }
  } else {
    // Artist channel / VEVO
    const isArtistChannel = Boolean(
      cleanArtAlpha && (
        cleanChanAlpha.includes(cleanArtAlpha) ||
        (cleanChanAlpha.length > 3 && cleanArtAlpha.includes(cleanChanAlpha)) ||
        stringSimilarity(cleanChanAlpha, cleanArtAlpha) >= 0.75
      )
    );

    if (isVevo || isArtistChannel) {
      score += 30; // Verified artist channel
    } else {
      score -= 15; // Unverified / third-party uploader
    }
  }

  // 2. MULTI-VARIANT & FUZZY TITLE MATCHING (Max 40 pts)
  const trackVariants = new Set([
    cleanTrack,
    normalizeKazakh(cleanTrack),
    transliterate(cleanTrack),
    transliterateIso(cleanTrack)
  ]);

  let titleMatched = false;
  let maxTitleSim = 0;

  for (const variant of trackVariants) {
    if (!variant) continue;
    const cleanVarAlpha = variant.replace(/[^\p{L}\p{N}]/gu, '');

    if (cleanCand === variant || cleanCandAlpha === cleanVarAlpha) {
      score += 40;
      titleMatched = true;
      break;
    } else if (cleanCand.includes(variant) || cleanCandAlpha.includes(cleanVarAlpha)) {
      score += 30;
      titleMatched = true;
      break;
    } else {
      const sim = stringSimilarity(cleanCand, variant);
      if (sim > maxTitleSim) maxTitleSim = sim;

      const words = variant.split(' ').filter(w => w.length > 1);
      const matched = words.filter(w => cleanCand.includes(w));
      if (words.length > 0 && matched.length === words.length) {
        score += 25;
        titleMatched = true;
        break;
      }
    }
  }

  if (!titleMatched) {
    if (maxTitleSim >= 0.70) {
      score += Math.round(maxTitleSim * 30);
      titleMatched = true;
    } else {
      return 0; // Title does not match
    }
  }

  // 3. ARTIST IN CANDIDATE TITLE / CHANNEL (Max 25 pts)
  let artistFound = false;
  for (const art of artists) {
    const variants = getDynamicArtistVariants(art);
    for (const variant of variants) {
      if (variant.length >= 3 && (cleanCandAlpha.includes(variant) || cleanChanAlpha.includes(variant))) {
        artistFound = true;
        break;
      }
    }
    if (artistFound) break;
  }

  if (artistFound) {
    score += 25;
  } else {
    score -= 40; // Heavy penalty if artist is missing from title and channel
  }

  // 4. STRICT VERSION ALIGNMENT (Remix / Acoustic / Live / Instrumental)
  const versionTags = [
    { key: 'remix', patterns: ['remix', 're-mix', 'ремикс', 'club mix', 'vip mix', 'extended mix'] },
    { key: 'acoustic', patterns: ['acoustic', 'акустика', 'акустическая', 'unplugged'] },
    { key: 'live', patterns: ['live', 'лайв', 'живой звук', 'concert', 'концерт', 'tour'] },
    { key: 'instrumental', patterns: ['instrumental', 'инструментал', 'караоке', 'karaoke', 'backing track', 'минус'] },
    { key: 'slowed', patterns: ['slowed', 'reverb', 'sped up', 'speed up', 'nightcore', '8d audio', 'bass boosted'] },
    { key: 'cover', patterns: ['cover', 'кавер', 'tribute', 'parody', 'fan made', 'ai cover', 'ai version'] }
  ];

  for (const { patterns } of versionTags) {
    const trackHasTag = patterns.some(p => rawTrackTitle.includes(p));
    const candHasTag = patterns.some(p => rawCandTitle.includes(p));

    if (trackHasTag) {
      if (candHasTag) {
        score += 25; // Exact version match (e.g. requested Acoustic and found Acoustic)
      } else {
        score -= 40; // User wanted specific version (Remix/Acoustic), but candidate is original
      }
    } else {
      if (candHasTag) {
        score -= 55; // User wanted original, but candidate is an unwanted remix/live/acoustic/cover
      }
    }
  }

  // 5. OFFICIAL STUDIO AUDIO VS MUSIC VIDEO SKITS
  if (rawCandTitle.includes('official audio') || rawCandTitle.includes('official track') || rawCandTitle.includes('official visualizer') || rawCandTitle.includes('album version')) {
    score += 20; // Official studio audio release bonus
  }

  const isMusicVideo = (
    rawCandTitle.includes('official music video') ||
    rawCandTitle.includes('official video') ||
    rawCandTitle.includes('music video') ||
    rawCandTitle.includes('4k video') ||
    rawCandTitle.includes('directed by') ||
    rawCandTitle.includes('video clip') ||
    rawCandTitle.includes('клип') ||
    rawCandTitle.includes('clip officiel') ||
    rawCandTitle.includes('video oficial')
  );

  if (isMusicVideo && !rawTrackTitle.includes('video')) {
    // Check if music video duration is inflated with movie dialogues / intro skits
    if (track.duration && candidate.duration && (candidate.duration - track.duration) > 8) {
      score -= 40; // Heavy penalty: contains video dialogue/intro skits
    } else {
      score -= 15; // Prefer pure audio tracks over video audio
    }
  }

  // 6. DURATION MATCHING (Max 25 pts)
  if (track.duration && candidate.duration) {
    const diff = Math.abs(track.duration - candidate.duration);
    if (diff <= 3) score += 25;
    else if (diff <= 6) score += 18;
    else if (diff <= 12) score += 10;
    else if (diff <= 25) score += 2;
    else if (diff > 30) score -= 45; // Full album or long intro
  }

  return Math.max(0, Math.min(score, 100));
}

/**
 * Finds and returns a ranked list of candidates for a given track, sorted by match score.
 */
export async function findCandidateList(track) {
  if (!track || (!track.title && !track.artist)) return [];

  const rawTitle = track.title || '';
  const cleanT = cleanTitle(rawTitle);
  const artists = parseArtists(track.artist);
  const primaryArt = artists[0] || track.artist || '';

  const normTitle = normalizeKazakh(cleanT);
  const normArtist = normalizeKazakh(primaryArt);
  const translitTitle = transliterate(cleanT);

  // Cascade of distinct search queries (Prioritizing official YouTube Topic & studio audio)
  const querySet = new Set([
    `${cleanT} ${primaryArt} Topic`,
    `${translitTitle} ${primaryArt} Topic`,
    `${rawTitle} ${primaryArt} official audio`,
    `${rawTitle} ${track.artist}`,
    `${normTitle} ${normArtist}`,
    `${cleanT} ${primaryArt}`,
    `${rawTitle} audio`
  ]);

  if (track.album && track.album !== 'Unknown Album') {
    querySet.add(`${cleanT} ${primaryArt} ${track.album}`);
  }

  let candidates = [];
  for (const query of querySet) {
    try {
      const res = await searchTrack(query);
      if (Array.isArray(res) && res.length > 0) {
        candidates = candidates.concat(res);
        if (candidates.length >= 30) break;
      }
    } catch (_) { }
  }

  if (candidates.length === 0) return [];

  // Deduplicate candidates by YouTube ID
  const seen = new Set();
  const uniqueCandidates = [];
  for (const c of candidates) {
    if (c && c.id && !seen.has(c.id)) {
      seen.add(c.id);
      uniqueCandidates.push(c);
    }
  }

  // Score each candidate
  const scored = uniqueCandidates.map(cand => {
    const score = calculateMatchScore(track, {
      title: cand.title,
      channel: cand.uploader || cand.channel,
      duration: cand.duration
    });
    return { ...cand, score };
  });

  // Sort by highest score first
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Finds the highest-fidelity YouTube match for a given Apple Music track.
 */
export async function findBestMatch(track) {
  const list = await findCandidateList(track);
  if (list.length === 0) return null;
  return list[0];
}

export default {
  findBestMatch,
  findCandidateList,
  calculateMatchScore,
  normalizeKazakh,
  cleanTitle,
  parseArtists,
  transliterate,
  transliterateIso,
  stringSimilarity,
  getDynamicArtistVariants
};
