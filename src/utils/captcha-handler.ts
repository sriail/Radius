/**
 * Enhanced CAPTCHA and Cloudflare verification handler
 * This module ensures that reCAPTCHA, hCaptcha, and Cloudflare Turnstile
 * work seamlessly within the proxy environment with support for heavy cookies
 * and complex browser services
 */

/**
 * Use Sets for O(1) lookup instead of Array.some()
 */
const CAPTCHA_DOMAINS = new Set([
    "google.com",
    "recaptcha.net",
    "gstatic.com",
    "hcaptcha.com",
    "cloudflare.com",
    "challenges.cloudflare.com"
]);

/**
 * Set of domains known to use heavy cookies and complex browser services
 */
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

// Cache for domain checks to avoid redundant operations
const domainCheckCache = new Map<string, boolean>();
const DOMAIN_CACHE_MAX_SIZE = 500;
const DOMAIN_CACHE_EVICT_COUNT = 50; // Evict 10% of cache

// Helper to check if URL matches any domain
function matchesDomain(url: string, domains: Set<string>): boolean {
    const cacheKey = url;
    if (domainCheckCache.has(cacheKey)) {
        return domainCheckCache.get(cacheKey)!;
    }

    const urlLower = url.toLowerCase();
    let result = false;
    for (const domain of domains) {
        if (urlLower.includes(domain)) {
            result = true;
            break;
        }
    }

    // Cache with size limit and batch eviction
    if (domainCheckCache.size >= DOMAIN_CACHE_MAX_SIZE) {
        let evicted = 0;
        for (const key of domainCheckCache.keys()) {
            if (evicted >= DOMAIN_CACHE_EVICT_COUNT) break;
            domainCheckCache.delete(key);
            evicted++;
        }
    }
    domainCheckCache.set(cacheKey, result);
    return result;
}

// Precompiled patterns for CAPTCHA iframe detection
const CAPTCHA_IFRAME_PATTERNS = ["recaptcha", "hcaptcha", "challenges.cloudflare.com", "turnstile"];

// Precompiled patterns for important cookies
const IMPORTANT_COOKIE_PATTERNS = ["_GRECAPTCHA", "h-captcha", "cf_", "session", "auth", "token"];

// Track if handlers have been initialized to avoid duplicate setup
let handlersInitialized = false;

/**
 * Initialize CAPTCHA handlers on page load
 * This ensures that CAPTCHA widgets and heavy cookie sites can properly
 * communicate with their APIs and maintain session state
 */
export function initializeCaptchaHandlers() {
    if (typeof window === "undefined") return;

    // Prevent duplicate initialization
    if (handlersInitialized) return;
    handlersInitialized = true;

    // Ensure global CAPTCHA callbacks are accessible
    if (!window.___grecaptcha_cfg) {
        window.___grecaptcha_cfg = { clients: {} };
    }

    // Debounced batch processing for mutations
    let pendingNodes: Node[] = [];
    let processingScheduled = false;

    const processPendingNodes = () => {
        processingScheduled = false;
        const nodesToProcess = pendingNodes;
        pendingNodes = [];

        for (const node of nodesToProcess) {
            if (node instanceof HTMLIFrameElement) {
                const src = node.src || "";
                // Check if this is a CAPTCHA iframe using precompiled patterns
                const isCaptchaIframe = CAPTCHA_IFRAME_PATTERNS.some((pattern) =>
                    src.includes(pattern)
                );

                if (isCaptchaIframe) {
                    // Ensure the iframe has proper sandbox permissions
                    if (node.sandbox && node.sandbox.length > 0) {
                        node.sandbox.add("allow-same-origin");
                        node.sandbox.add("allow-scripts");
                        node.sandbox.add("allow-forms");
                    }

                    // Ensure credentials are included for CAPTCHA cookies
                    if (node.getAttribute("credentialless") !== null) {
                        node.removeAttribute("credentialless");
                    }
                }
            }
        }
    };

    // Monitor for CAPTCHA iframe creation with batched processing
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node instanceof HTMLIFrameElement) {
                    pendingNodes.push(node);
                }
            }
        }

        // Schedule batch processing
        if (pendingNodes.length > 0 && !processingScheduled) {
            processingScheduled = true;
            // Use requestIdleCallback if available, otherwise setTimeout
            if ("requestIdleCallback" in window) {
                (window as any).requestIdleCallback(processPendingNodes, { timeout: 100 });
            } else {
                setTimeout(processPendingNodes, 0);
            }
        }
    });

    // Start observing the document for changes
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Ensure cookies are properly handled for CAPTCHA tokens and heavy cookie sites
    enhanceCookieHandling();

    // Enhance fetch and XMLHttpRequest for CAPTCHA and heavy cookie requests
    enhanceNetworkRequests();

    // Add storage persistence for better cookie support
    enhanceStoragePersistence();
}

/**
 * Enhance cookie handling to ensure CAPTCHA tokens and heavy cookies are properly stored
 */
function enhanceCookieHandling() {
    // Store original cookie descriptor
    const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");

    if (originalCookieDescriptor) {
        Object.defineProperty(document, "cookie", {
            get() {
                return originalCookieDescriptor.get?.call(this) || "";
            },
            set(value) {
                // Ensure SameSite=None for cookies in cross-origin contexts
                if (typeof value === "string") {
                    // Check if this is a CAPTCHA or heavy cookie site cookie using precompiled patterns
                    const isImportantCookie = IMPORTANT_COOKIE_PATTERNS.some((pattern) =>
                        value.includes(pattern)
                    );

                    if (isImportantCookie && !value.includes("SameSite")) {
                        value += "; SameSite=None; Secure";
                    }
                }
                originalCookieDescriptor.set?.call(this, value);
            },
            configurable: true
        });
    }
}

/**
 * Enhance network requests to properly handle CAPTCHA API calls and heavy cookie sites
 */
function enhanceNetworkRequests() {
    // Store original fetch
    const originalFetch = window.fetch;

    // Override fetch to ensure proper headers for CAPTCHA and heavy cookie requests
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        const url =
            typeof input === "string"
                ? input
                : input instanceof Request
                  ? input.url
                  : input.toString();

        // Check if this is a CAPTCHA-related or heavy cookie site request
        const isCaptchaRequest = matchesDomain(url, CAPTCHA_DOMAINS);
        const isHeavyCookieRequest = !isCaptchaRequest && matchesDomain(url, HEAVY_COOKIE_DOMAINS);

        if (isCaptchaRequest || isHeavyCookieRequest) {
            // Ensure credentials are included
            init = init || {};
            if (!init.credentials) {
                init.credentials = "include";
            }

            // Ensure proper headers
            init.headers = new Headers(init.headers);
            if (!init.headers.has("Accept")) {
                init.headers.set("Accept", "*/*");
            }

            // Add cache control for better performance while maintaining freshness
            if (!init.headers.has("Cache-Control") && !isCaptchaRequest) {
                init.headers.set("Cache-Control", "private, max-age=300");
            }
        }

        return originalFetch.call(this, input, init);
    };

    // Store original XMLHttpRequest
    const OriginalXHR = window.XMLHttpRequest;

    // Override XMLHttpRequest for CAPTCHA and heavy cookie requests
    window.XMLHttpRequest = function (this: XMLHttpRequest) {
        const xhr = new OriginalXHR();

        // Store original open method
        const originalOpen = xhr.open;
        xhr.open = function (method: string, url: string | URL, ...args: any[]) {
            const urlStr = url.toString();
            const isCaptchaRequest = matchesDomain(urlStr, CAPTCHA_DOMAINS);
            const isHeavyCookieRequest =
                !isCaptchaRequest && matchesDomain(urlStr, HEAVY_COOKIE_DOMAINS);

            if (isCaptchaRequest || isHeavyCookieRequest) {
                // Ensure credentials are included
                xhr.withCredentials = true;
            }

            return originalOpen.call(this, method, url, ...args);
        };

        return xhr;
    } as any;

    // Copy static properties
    Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
    Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
}

/**
 * Enhance storage persistence for better cookie and session support
 */
function enhanceStoragePersistence() {
    // Request persistent storage for better data retention (silently)
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {
            // Silently fail - not critical for functionality
        });
    }
}

/**
 * Global declaration for reCAPTCHA config
 */
declare global {
    interface Window {
        ___grecaptcha_cfg?: {
            clients: Record<string, any>;
            [key: string]: any;
        };
    }
}
