/** In-memory cache with TTL for platform page data (stale-while-revalidate). */

const cache = new Map();
const inflight = new Map();

export const CACHE_TTL = {
  leaderboard: 60_000,
  gap: 120_000,
  roadmap: 120_000,
  curriculum: 120_000,
  interviews: 60_000,
  practice: 60_000,
  practiceSuggest: 120_000,
  jobs: 120_000,
  // Admin dashboard — short TTLs since an admin actively monitoring the
  // platform wants reasonably live data, but this still kills the "every
  // tab switch re-fetches from scratch and blanks the page" lag.
  admin: 30_000,
  adminDetail: 20_000,
  // The skills catalog is a versioned static file, not live activity data.
  adminCatalog: 300_000,
};

/**
 * @template T
 * @param {string} key
 * @returns {{ data: T | null, fresh: boolean }}
 */
export function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return { data: null, fresh: false };
  return { data: entry.data, fresh: Date.now() - entry.at <= entry.ttl };
}

/**
 * @template T
 * @param {string} key
 * @param {T} data
 * @param {number} ttl
 */
export function writeCache(key, data, ttl) {
  cache.set(key, { data, at: Date.now(), ttl });
}

/** @param {string} [prefix] — if set, deletes keys that include this substring */
export function invalidateCache(prefix) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(prefix)) cache.delete(key);
  }
}

/**
 * Fetch with cache: returns fresh cached data immediately; otherwise dedupes
 * in-flight requests and falls back to stale data on error.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetcher
 * @param {number} [ttl]
 * @returns {Promise<T>}
 */
export async function loadWithCache(key, fetcher, ttl = 60_000) {
  const { data: stale, fresh } = readCache(key);
  if (fresh && stale != null) return stale;

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    try {
      const data = await fetcher();
      writeCache(key, data, ttl);
      return data;
    } catch (err) {
      if (stale != null) return stale;
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
