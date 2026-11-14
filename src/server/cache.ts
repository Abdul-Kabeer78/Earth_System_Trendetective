interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  fetchedAt: string;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<{ data: T; cached: boolean; fetchedAt: string }> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return {
      data: existing.data,
      cached: true,
      fetchedAt: existing.fetchedAt,
    };
  }

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) {
    const data = await running;
    const after = store.get(key) as CacheEntry<T> | undefined;
    return {
      data,
      cached: true,
      fetchedAt: after?.fetchedAt ?? new Date().toISOString(),
    };
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      const fetchedAt = new Date().toISOString();
      store.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
        fetchedAt,
      });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  const data = await promise;
  const entry = store.get(key) as CacheEntry<T> | undefined;
  return {
    data,
    cached: false,
    fetchedAt: entry?.fetchedAt ?? new Date().toISOString(),
  };
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EarthSystemTrendDetective/1.0',
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
