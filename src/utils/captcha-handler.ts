/**
 * Enhanced CAPTCHA and Cloudflare verification handler
 * This module ensures that reCAPTCHA, hCaptcha, and Cloudflare Turnstile
 * work seamlessly within the proxy environment with support for heavy cookies
 * and complex browser services
 */

/**
 * List of CAPTCHA and verification-related domains
 */
const CAPTCHA_DOMAINS = [
    // reCAPTCHA domains
    "google.com",
    "www.google.com",
    "recaptcha.net",
    "www.recaptcha.net",
    "gstatic.com",
    "www.gstatic.com",
    // hCaptcha domains
    "hcaptcha.com",
    "www.hcaptcha.com",
    "newassets.hcaptcha.com",
    "assets.hcaptcha.com",
    "imgs.hcaptcha.com",
    "js.hcaptcha.com",
    "api.hcaptcha.com",
    "api2.hcaptcha.com",
    // Cloudflare Turnstile domains
    "cloudflare.com",
    "challenges.cloudflare.com",
    "turnstile.cloudflare.com"
];

/**
 * List of domains known to use heavy cookies and complex browser services
 */
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

/**
 * Initialize CAPTCHA handlers on page load
 * This ensures that CAPTCHA widgets and heavy cookie sites can properly
 * communicate with their APIs and maintain session state
 */
export function initializeCaptchaHandlers() {
    if (typeof window === "undefined") return;

    // Ensure global CAPTCHA callbacks are accessible
    if (!window.___grecaptcha_cfg) {
        window.___grecaptcha_cfg = { clients: {} };
    }

    // Initialize hCaptcha global object
    if (!window.hcaptcha) {
        window.hcaptcha = {};
    }

    // Initialize Turnstile global object
    if (!window.turnstile) {
        window.turnstile = {};
    }

    // Check if URL is CAPTCHA-related
    const isCaptchaUrl = (url: string): boolean => {
        const urlLower = url.toLowerCase();
        return CAPTCHA_DOMAINS.some((domain) => urlLower.includes(domain));
    };

    // Setup CAPTCHA iframe with proper permissions
    const setupCaptchaIframe = (iframe: HTMLIFrameElement) => {
        const src = iframe.src || iframe.getAttribute("src") || "";
        if (
            src.includes("recaptcha") ||
            src.includes("hcaptcha") ||
            src.includes("challenges.cloudflare.com") ||
            src.includes("turnstile") ||
            isCaptchaUrl(src)
        ) {
            // Ensure the iframe has proper sandbox permissions
            if (iframe.sandbox && iframe.sandbox.length > 0) {
                iframe.sandbox.add("allow-same-origin");
                iframe.sandbox.add("allow-scripts");
                iframe.sandbox.add("allow-forms");
                iframe.sandbox.add("allow-popups");
                iframe.sandbox.add("allow-popups-to-escape-sandbox");
            }

            // Ensure credentials are included for CAPTCHA cookies
            if (iframe.getAttribute("credentialless") !== null) {
                iframe.removeAttribute("credentialless");
            }

            // Add proper allow attribute for permissions policy
            const allow = iframe.getAttribute("allow") || "";
            if (!allow.includes("cross-origin-isolated")) {
                iframe.setAttribute("allow", allow + (allow ? "; " : "") + "cross-origin-isolated");
            }
        }
    };

    // Monitor for CAPTCHA iframe creation and ensure proper setup
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLIFrameElement) {
                    setupCaptchaIframe(node);
                } else if (node instanceof HTMLElement) {
                    // Also check for iframes within added nodes
                    node.querySelectorAll("iframe").forEach((iframe) => {
                        setupCaptchaIframe(iframe as HTMLIFrameElement);
                    });
                }
            });
        });
    });

    // Start observing the document for changes
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Setup existing iframes
    document.querySelectorAll("iframe").forEach((iframe) => {
        setupCaptchaIframe(iframe as HTMLIFrameElement);
    });

    // Ensure cookies are properly handled for CAPTCHA tokens and heavy cookie sites
    enhanceCookieHandling();

    // Enhance fetch and XMLHttpRequest for CAPTCHA and heavy cookie requests
    enhanceNetworkRequests();

    // Add storage persistence for better cookie support
    enhanceStoragePersistence();

    // Setup postMessage handler for CAPTCHA communication
    setupPostMessageHandler();
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
                    // Check if this is a CAPTCHA or heavy cookie site cookie
                    const isCaptchaCookie =
                        value.includes("_GRECAPTCHA") ||
                        value.includes("h-captcha") ||
                        value.includes("cf_");
                    const isImportantCookie =
                        isCaptchaCookie ||
                        value.includes("session") ||
                        value.includes("auth") ||
                        value.includes("token");

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
        const isCaptchaRequest = CAPTCHA_DOMAINS.some((domain) => url.includes(domain));
        const isHeavyCookieRequest = HEAVY_COOKIE_DOMAINS.some((domain) => url.includes(domain));

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
            const isCaptchaRequest = CAPTCHA_DOMAINS.some((domain) => urlStr.includes(domain));
            const isHeavyCookieRequest = HEAVY_COOKIE_DOMAINS.some((domain) =>
                urlStr.includes(domain)
            );

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
 * Setup message handler placeholder for CAPTCHA-related messages
 * This function exists to be called as part of initialization but no longer
 * modifies postMessage behavior since overriding it broke MessagePort transfers
 */
function setupPostMessageHandler() {
    // Note: We intentionally don't override postMessage as it can break
    // transferable objects like MessagePort. The proxy handles cross-origin
    // issues at the service worker level instead.
    // CAPTCHA widgets communicate via postMessage with their own origins,
    // which works natively without intervention.
}

/**
 * Global declaration for CAPTCHA configs
 */
declare global {
    interface Window {
        ___grecaptcha_cfg?: {
            clients: Record<string, unknown>;
            [key: string]: unknown;
        };
        hcaptcha?: {
            [key: string]: unknown;
        };
        turnstile?: {
            [key: string]: unknown;
        };
    }
}
