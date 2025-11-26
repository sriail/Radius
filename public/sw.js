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

// Cache for routing decisions to avoid redundant checks
const routeCache = new Map();
const ROUTE_CACHE_MAX_SIZE = 500;
const ROUTE_CACHE_TTL = 30000; // 30 seconds
const CACHE_EVICT_COUNT = 50; // Evict 10% of cache

// Cache for domain checks to avoid redundant string operations
const domainCheckCache = new Map();
const DOMAIN_CHECK_CACHE_MAX_SIZE = 500;

// Enhanced CAPTCHA and Cloudflare verification support
// Use Set for O(1) lookup instead of Array with some()
const CAPTCHA_DOMAINS = new Set([
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
]);

// Domains that use heavy cookies and complex browser services
const HEAVY_COOKIE_DOMAINS = new Set([
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
]);

// Optimized helper function to check if URL is CAPTCHA-related
function isCaptchaRequest(url) {
    const cacheKey = "captcha:" + url;
    if (domainCheckCache.has(cacheKey)) {
        return domainCheckCache.get(cacheKey);
    }

    const urlStr = url.toString().toLowerCase();
    let result = false;
    for (const domain of CAPTCHA_DOMAINS) {
        if (urlStr.includes(domain)) {
            result = true;
            break;
        }
    }

    // Cache with size limit and batch eviction
    if (domainCheckCache.size >= DOMAIN_CHECK_CACHE_MAX_SIZE) {
        let evicted = 0;
        for (const key of domainCheckCache.keys()) {
            if (evicted >= CACHE_EVICT_COUNT) break;
            domainCheckCache.delete(key);
            evicted++;
        }
    }
    domainCheckCache.set(cacheKey, result);
    return result;
}

// Optimized helper function to check if URL is from a site with heavy cookies
function isHeavyCookieSite(url) {
    const cacheKey = "heavy:" + url;
    if (domainCheckCache.has(cacheKey)) {
        return domainCheckCache.get(cacheKey);
    }

    const urlStr = url.toString().toLowerCase();
    let result = false;
    for (const domain of HEAVY_COOKIE_DOMAINS) {
        if (urlStr.includes(domain)) {
            result = true;
            break;
        }
    }

    // Cache with size limit and batch eviction
    if (domainCheckCache.size >= DOMAIN_CHECK_CACHE_MAX_SIZE) {
        let evicted = 0;
        for (const key of domainCheckCache.keys()) {
            if (evicted >= CACHE_EVICT_COUNT) break;
            domainCheckCache.delete(key);
            evicted++;
        }
    }
    domainCheckCache.set(cacheKey, result);
    return result;
}

// Reusable headers for CAPTCHA requests
const CAPTCHA_HEADERS_TEMPLATE = { Accept: "*/*" };

// Helper function to ensure proper CAPTCHA handling
function enhanceCaptchaRequest(request) {
    // Clone the request to ensure all headers and properties are preserved
    const headers = new Headers(request.headers);

    // Ensure proper headers for CAPTCHA requests
    if (!headers.has("Accept")) {
        headers.set("Accept", CAPTCHA_HEADERS_TEMPLATE.Accept);
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

// Cache sj config loading status
let sjConfigLoaded = false;

self.addEventListener("fetch", function (event) {
    event.respondWith(
        (async () => {
            try {
                // Only load config once per SW lifecycle
                if (!sjConfigLoaded) {
                    await sj.loadConfig();
                    sjConfigLoaded = true;
                }

                const url = event.request.url;

                // Check route cache for faster routing
                let routeInfo = routeCache.get(url);
                const now = Date.now();

                if (!routeInfo || now - routeInfo.timestamp > ROUTE_CACHE_TTL) {
                    // Safely check if this is a proxied request using optional chaining
                    const uvPrefix =
                        (typeof __uv$config !== "undefined" && __uv$config?.prefix) || null;
                    const isUvRequest = uvPrefix
                        ? url.startsWith(location.origin + uvPrefix)
                        : false;
                    const isSjRequest = sj.route(event);

                    routeInfo = {
                        isUvRequest,
                        isSjRequest,
                        isProxiedRequest: isUvRequest || isSjRequest,
                        timestamp: now
                    };

                    // Cache with size limit and batch eviction
                    if (routeCache.size >= ROUTE_CACHE_MAX_SIZE) {
                        let evicted = 0;
                        for (const key of routeCache.keys()) {
                            if (evicted >= CACHE_EVICT_COUNT) break;
                            routeCache.delete(key);
                            evicted++;
                        }
                    }
                    routeCache.set(url, routeInfo);
                }

                const { isUvRequest, isSjRequest, isProxiedRequest } = routeInfo;

                // Only check CAPTCHA and heavy cookie for non-proxied requests
                let request = event.request;
                if (!isProxiedRequest) {
                    const isCaptcha = isCaptchaRequest(url);
                    if (isCaptcha) {
                        request = enhanceCaptchaRequest(event.request);
                    } else {
                        const isHeavyCookie = isHeavyCookieSite(url);
                        if (isHeavyCookie) {
                            request = enhanceHeavyCookieRequest(event.request);
                        }
                    }
                }

                let response;
                if (isUvRequest) {
                    response = await uv.fetch(event);
                } else if (isSjRequest) {
                    response = await sj.fetch(event);
                } else {
                    response = await fetch(request);
                }

                // Inject interceptor script into proxied HTML responses
                if (isProxiedRequest) {
                    response = await injectInterceptorScript(response);
                }

                return response;
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

// Script to inject into proxied pages to intercept new tab/window attempts
const INTERCEPTOR_SCRIPT = `
<script>
(function() {
    // Intercept window.open to prevent new tabs/windows from opening
    const originalOpen = window.open;
    window.open = function(url, target, features) {
        if (url) {
            console.log('[Proxy Interceptor] Redirecting window.open to same window:', url);
            // Navigate in the current window instead of opening a new one
            // The URL is already proxied at this point, so we can directly navigate
            window.location.href = url;
            
            // Return a Proxy that mimics a Window object for compatibility
            return new Proxy({}, {
                get: function() { return null; },
                set: function() { return true; }
            });
        }
        return null;
    };
    
    // Remove target="_blank" from all links
    function removeTargetBlank() {
        document.querySelectorAll('a[target="_blank"], a[target="_new"]').forEach(function(anchor) {
            anchor.removeAttribute('target');
        });
    }
    
    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeTargetBlank);
    } else {
        removeTargetBlank();
    }
    
    // Watch for dynamically added links
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    // Check if it's an Element node (nodeType === 1)
                    if (node.nodeType !== 1) return;
                    
                    if (node.tagName === 'A' && (node.getAttribute('target') === '_blank' || node.getAttribute('target') === '_new')) {
                        node.removeAttribute('target');
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll('a[target="_blank"], a[target="_new"]').forEach(function(anchor) {
                            anchor.removeAttribute('target');
                        });
                    }
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
})();
</script>
`;

// Precompiled regex patterns for better performance
const HEAD_TAG_REGEX = /<head(\s[^>]*)?>/i;
const BODY_TAG_REGEX = /<body(\s[^>]*)?>/i;
const HTML_TAG_REGEX = /<html(\s[^>]*)?>/i;

// Helper function to inject script into HTML responses
async function injectInterceptorScript(response) {
    const contentType = response.headers.get("content-type") || "";

    // Only inject into HTML responses
    if (!contentType.includes("text/html")) {
        return response;
    }

    try {
        const text = await response.text();

        // Check if script was already injected to prevent duplicates
        if (text.includes("[Proxy Interceptor]")) {
            return new Response(text, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        }

        // Inject the script just after opening tags using precompiled regex
        let modifiedHtml = text;
        let injected = false;

        // Try to inject after <head> tag (normal or self-closing)
        if (!injected && HEAD_TAG_REGEX.test(text)) {
            modifiedHtml = text.replace(HEAD_TAG_REGEX, (match) => match + INTERCEPTOR_SCRIPT);
            injected = true;
        }

        // Fallback: inject after <body> tag (normal or self-closing)
        if (!injected && BODY_TAG_REGEX.test(text)) {
            modifiedHtml = text.replace(BODY_TAG_REGEX, (match) => match + INTERCEPTOR_SCRIPT);
            injected = true;
        }

        // Last resort: inject after <html> tag (normal or self-closing)
        if (!injected && HTML_TAG_REGEX.test(text)) {
            modifiedHtml = text.replace(HTML_TAG_REGEX, (match) => match + INTERCEPTOR_SCRIPT);
            injected = true;
        }

        // Return modified response
        return new Response(modifiedHtml, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    } catch (error) {
        console.error("Error injecting interceptor script:", error);
        return response;
    }
}

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
