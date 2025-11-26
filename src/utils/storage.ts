// Memory cache for frequently accessed values
const storageCache = new Map<string, { value: string; timestamp: number }>();
const STORAGE_CACHE_TTL = 5000; // 5 seconds
const STORAGE_CACHE_MAX_SIZE = 100;
const STORAGE_CACHE_EVICT_COUNT = 20; // Evict 20% of cache

class StoreManager<Prefix extends string> {
    #prefix: string;

    constructor(pref: Prefix) {
        this.#prefix = pref;
    }

    getVal(key: string): string {
        const fullKey = `${this.#prefix}||${key}`;

        // Check cache first
        const cached = storageCache.get(fullKey);
        const now = Date.now();
        if (cached && now - cached.timestamp < STORAGE_CACHE_TTL) {
            return cached.value;
        }

        // Get from localStorage
        const value = localStorage.getItem(fullKey) as string;

        // Update cache with batch eviction
        if (storageCache.size >= STORAGE_CACHE_MAX_SIZE) {
            // Remove oldest entries using iterator to avoid array allocation
            let evicted = 0;
            for (const cacheKey of storageCache.keys()) {
                if (evicted >= STORAGE_CACHE_EVICT_COUNT) break;
                storageCache.delete(cacheKey);
                evicted++;
            }
        }
        if (value !== null) {
            storageCache.set(fullKey, { value, timestamp: now });
        }

        return value;
    }

    setVal(key: string, val: string): void {
        const fullKey = `${this.#prefix}||${key}`;
        localStorage.setItem(fullKey, val);

        // Update cache
        storageCache.set(fullKey, { value: val, timestamp: Date.now() });
    }

    removeVal(key: string): void {
        const fullKey = `${this.#prefix}||${key}`;
        localStorage.removeItem(fullKey);

        // Remove from cache
        storageCache.delete(fullKey);
    }

    // Clear cache when needed (e.g., for debugging)
    static clearCache(): void {
        storageCache.clear();
    }
}

export { StoreManager };
