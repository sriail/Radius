importScripts("/vu/uv.bundle.js", "/vu/uv.config.js", "/marcs/scramjet.all.js");
importScripts(__uv$config.sw || "/vu/uv.sw.js");

const uv = new UVServiceWorker();

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const sj = new ScramjetServiceWorker({
    // Enhanced configuration for better cookie and service worker support
    defaultFlags: {
        serviceworkers: true, // Enable service worker support
        captureErrors: true, // Better error handling
        syncxhr: true, // Support synchronous XHR for complex sites
        scramitize: true, // Better domain handling
        cleanErrors: false, // Keep error messages for debugging
        strictRewrites: false, // Allow flexible rewrites
        allowFailedIntercepts: true // Continue on failed intercepts
    }
});

// Enhanced CAPTCHA and Cloudflare verification support
// List of CAPTCHA and verification domains that need special handling
const CAPTCHA_DOMAINS = [
    "google.com/recaptcha",
    "www.google.com/recaptcha",
    "recaptcha.net",
    "www.recaptcha.net",
    "gstatic.com/recaptcha",
    "hcaptcha.com",
    "newassets.hcaptcha.com",
    "challenges.cloudflare.com",
    "cloudflare.com/cdn-cgi/challenge",
    "turnstile.cloudflare.com"
];

// Domains that use heavy cookies and complex browser services
const HEAVY_COOKIE_DOMAINS = [
    "amazon.com",
    "ebay.com",
    "walmart.com",
    "google.com",
    "youtube.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "linkedin.com",
    "microsoft.com",
    "apple.com",
    "netflix.com",
    "spotify.com"
];

// Helper function to check if URL is CAPTCHA-related
function isCaptchaRequest(url) {
    const urlStr = url.toString().toLowerCase();
    return CAPTCHA_DOMAINS.some((domain) => urlStr.includes(domain));
}

// Helper function to check if URL is from a site with heavy cookies
function isHeavyCookieSite(url) {
    const urlStr = url.toString().toLowerCase();
    return HEAVY_COOKIE_DOMAINS.some((domain) => urlStr.includes(domain));
}

// Helper function to ensure proper CAPTCHA handling
function enhanceCaptchaRequest(request) {
    // Clone the request to ensure all headers and properties are preserved
    const headers = new Headers(request.headers);

    // Ensure proper headers for CAPTCHA requests
    if (!headers.has("Accept")) {
        headers.set("Accept", "*/*");
    }

    // Preserve credentials for CAPTCHA cookies
    return new Request(request, {
        headers: headers,
        credentials: "include",
        mode: request.mode === "navigate" ? "same-origin" : request.mode
    });
}

// Enhanced request handler for heavy cookie sites
function enhanceHeavyCookieRequest(request) {
    const headers = new Headers(request.headers);

    // Ensure credentials are included for cookie persistence
    return new Request(request, {
        headers: headers,
        credentials: "include",
        cache: "no-cache" // Prevent caching issues with cookie-dependent content
    });
}

self.addEventListener("fetch", function (event) {
    event.respondWith(
        (async () => {
            try {
                await sj.loadConfig();

                const url = event.request.url;
                const isCaptcha = isCaptchaRequest(url);
                const isHeavyCookie = isHeavyCookieSite(url);

                // Enhanced handling for CAPTCHA and heavy cookie requests
                let request = event.request;
                if (isCaptcha) {
                    request = enhanceCaptchaRequest(event.request);
                } else if (isHeavyCookie) {
                    request = enhanceHeavyCookieRequest(event.request);
                }

                if (url.startsWith(location.origin + __uv$config.prefix)) {
                    return await uv.fetch(event);
                } else if (sj.route(event)) {
                    return await sj.fetch(event);
                } else {
                    return await fetch(request);
                }
            } catch (error) {
                console.error("Service worker fetch error:", error);
                // Return a proper error response instead of failing silently
                return new Response("Service Worker Error", {
                    status: 500,
                    statusText: "Internal Service Worker Error",
                    headers: { "Content-Type": "text/plain" }
                });
            }
        })()
    );
});

// Add error handling for service worker activation
self.addEventListener("activate", function (event) {
    event.waitUntil(
        (async () => {
            try {
                // Claim all clients to ensure the service worker takes control immediately
                await self.clients.claim();
            } catch (error) {
                console.error("Service worker activation error:", error);
            }
        })()
    );
});

// Add error handling for service worker installation
self.addEventListener("install", function (event) {
    // Skip waiting to activate immediately
    self.skipWaiting();
});
