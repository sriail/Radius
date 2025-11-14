importScripts("/vu/uv.bundle.js", "/vu/uv.config.js", "/marcs/scramjet.all.js");
importScripts(__uv$config.sw || "/vu/uv.sw.js");

const uv = new UVServiceWorker();

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const sj = new ScramjetServiceWorker();

// Cache configuration for static resources
const CACHE_NAME = "radius-proxy-cache-v1";
const STATIC_CACHE_RESOURCES = ["/vu/uv.bundle.js", "/vu/uv.config.js", "/marcs/scramjet.all.js"];

// Install event - pre-cache static resources
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_CACHE_RESOURCES).catch((error) => {
                console.error("Cache installation error:", error);
            });
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log("Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control immediately
    return self.clients.claim();
});

// Enhanced fetch handling with caching, retry logic and better error handling
self.addEventListener("fetch", function (event) {
    event.respondWith(
        (async () => {
            try {
                await sj.loadConfig();

                // Route to UV proxy
                if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
                    return await uv.fetch(event);
                }
                // Route to Scramjet proxy
                else if (sj.route(event)) {
                    return await sj.fetch(event);
                }
                // Pass through for non-proxy requests with caching strategy
                else {
                    // Try cache first for static resources
                    const cachedResponse = await caches.match(event.request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // If not in cache, fetch from network
                    const networkResponse = await fetch(event.request);

                    // Cache successful responses for static resources
                    if (
                        networkResponse.ok &&
                        (event.request.url.includes("/vu/") ||
                            event.request.url.includes("/marcs/") ||
                            event.request.url.includes("/erab/") ||
                            event.request.url.includes("/epoxy/") ||
                            event.request.url.includes("/libcurl/") ||
                            event.request.url.includes("/baremod/"))
                    ) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(event.request, networkResponse.clone());
                    }

                    return networkResponse;
                }
            } catch (error) {
                console.error("Service worker fetch error:", error);

                // Try cache as fallback
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Retry logic for failed requests
                try {
                    return await fetch(event.request);
                } catch (retryError) {
                    // Return error response
                    return new Response("Proxy request failed", {
                        status: 500,
                        statusText: "Internal Server Error"
                    });
                }
            }
        })()
    );
});
