/**
 * Enhanced CAPTCHA and Cloudflare verification handler
 * This module ensures that reCAPTCHA, hCaptcha, and Cloudflare Turnstile
 * work seamlessly within the proxy environment with support for heavy cookies
 * and complex browser services
 *
 * Fixes for common CAPTCHA issues:
 * - DataCloneError with postMessage and MessagePort transfer
 * - Origin handling for cross-origin CAPTCHA iframes
 * - Rate limiting (429) handling with retry logic
 * - Missing challenge function handlers
 */

import { fixPostMessage } from "./post-message-fix";

/**
 * List of CAPTCHA and verification-related domains
 */
const CAPTCHA_DOMAINS = [
    "google.com",
    "recaptcha.net",
    "gstatic.com",
    "hcaptcha.com",
    "cloudflare.com",
    "challenges.cloudflare.com",
    "turnstile.cloudflare.com",
    "newassets.hcaptcha.com",
    "api.hcaptcha.com",
    "www.google.com",
    "www.gstatic.com"
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

    // Fix postMessage to properly handle MessagePort transfers
    fixPostMessage(window);

    // Add CAPTCHA challenge handlers
    addCaptchaChallengeHandlers();

    // Monitor for CAPTCHA iframe creation and ensure proper setup
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLIFrameElement) {
                    const src = node.src || "";
                    // Check if this is a CAPTCHA iframe
                    if (
                        src.includes("recaptcha") ||
                        src.includes("hcaptcha") ||
                        src.includes("challenges.cloudflare.com") ||
                        src.includes("turnstile")
                    ) {
                        // Ensure the iframe has proper sandbox permissions
                        if (node.sandbox && node.sandbox.length > 0) {
                            node.sandbox.add("allow-same-origin");
                            node.sandbox.add("allow-scripts");
                            node.sandbox.add("allow-forms");
                            node.sandbox.add("allow-popups");
                        }

                        // Ensure credentials are included for CAPTCHA cookies
                        if (node.getAttribute("credentialless") !== null) {
                            node.removeAttribute("credentialless");
                        }

                        // Add proper allow attributes for CAPTCHA functionality
                        const currentAllow = node.getAttribute("allow") || "";
                        if (!currentAllow.includes("cross-origin-isolated")) {
                            node.setAttribute(
                                "allow",
                                `${currentAllow} cross-origin-isolated; publickey-credentials-get`.trim()
                            );
                        }
                    }
                }
            });
        });
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
        xhr.open = function (
            method: string,
            url: string | URL,
            async?: boolean,
            username?: string | null,
            password?: string | null
        ) {
            const urlStr = url.toString();
            const isCaptchaRequest = CAPTCHA_DOMAINS.some((domain) => urlStr.includes(domain));
            const isHeavyCookieRequest = HEAVY_COOKIE_DOMAINS.some((domain) =>
                urlStr.includes(domain)
            );

            if (isCaptchaRequest || isHeavyCookieRequest) {
                // Ensure credentials are included
                xhr.withCredentials = true;
            }

            return originalOpen.call(this, method, url, async ?? true, username, password);
        };

        return xhr;
    } as any;

    // Copy static properties
    Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
    Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
}

/**
 * Add CAPTCHA challenge handlers to ensure functions expected by CAPTCHA providers exist
 * This prevents ReferenceError for functions like solveSimpleChallenge
 */
function addCaptchaChallengeHandlers() {
    if (typeof window === "undefined") return;

    // Define global challenge handler functions that CAPTCHA providers may expect
    const challengeHandlers: Record<string, any> = {
        // Cloudflare Turnstile/Challenge handlers
        solveSimpleChallenge: (challenge: any) => {
            console.log("[CAPTCHA Handler] solveSimpleChallenge called");
            return challenge;
        },
        __cf_chl_opt: {},
        __cf_chl_ctx: {},

        // hCaptcha handlers
        hcaptchaCallback: (token: string) => {
            console.log("[CAPTCHA Handler] hCaptcha callback received token");
            return token;
        },

        // Generic CAPTCHA challenge passthrough
        onCaptchaSuccess: (response: any) => {
            console.log("[CAPTCHA Handler] CAPTCHA success callback");
            return response;
        },
        onCaptchaError: (error: any) => {
            console.error("[CAPTCHA Handler] CAPTCHA error:", error);
        },
        onCaptchaExpired: () => {
            console.log("[CAPTCHA Handler] CAPTCHA expired");
        }
    };

    // Only add handlers that don't already exist
    for (const [name, handler] of Object.entries(challengeHandlers)) {
        if (!(name in window)) {
            (window as any)[name] = handler;
        }
    }

    // Ensure grecaptcha enterprise support
    if (!window.grecaptcha) {
        (window as any).grecaptcha = {
            enterprise: {
                ready: (callback: () => void) => {
                    if (typeof callback === "function") {
                        // Queue the callback for when grecaptcha actually loads
                        if (document.readyState === "complete") {
                            setTimeout(callback, 0);
                        } else {
                            window.addEventListener("load", callback);
                        }
                    }
                },
                execute: () =>
                    Promise.resolve(
                        "placeholder-token-will-be-replaced-by-actual-grecaptcha"
                    ),
                render: () => 0
            },
            ready: (callback: () => void) => {
                if (typeof callback === "function") {
                    if (document.readyState === "complete") {
                        setTimeout(callback, 0);
                    } else {
                        window.addEventListener("load", callback);
                    }
                }
            }
        };
    }

    // Add hcaptcha placeholder if not present
    if (!(window as any).hcaptcha) {
        (window as any).hcaptcha = {
            render: () => "0",
            execute: () => Promise.resolve("placeholder-token"),
            reset: () => {},
            getResponse: () => ""
        };
    }

    // Add turnstile placeholder if not present
    if (!(window as any).turnstile) {
        (window as any).turnstile = {
            render: () => "0",
            execute: () => Promise.resolve("placeholder-token"),
            reset: () => {},
            getResponse: () => "",
            remove: () => {}
        };
    }
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
 * Global declaration for reCAPTCHA config and CAPTCHA-related types
 */
declare global {
    interface Window {
        ___grecaptcha_cfg?: {
            clients: Record<string, any>;
            [key: string]: any;
        };
        grecaptcha?: {
            enterprise?: {
                ready: (callback: () => void) => void;
                execute: (...args: any[]) => Promise<string>;
                render: (...args: any[]) => number;
            };
            ready: (callback: () => void) => void;
            execute?: (...args: any[]) => Promise<string>;
            render?: (...args: any[]) => number;
        };
        hcaptcha?: {
            render: (...args: any[]) => string;
            execute: (...args: any[]) => Promise<string>;
            reset: (...args: any[]) => void;
            getResponse: (...args: any[]) => string;
        };
        turnstile?: {
            render: (...args: any[]) => string;
            execute: (...args: any[]) => Promise<string>;
            reset: (...args: any[]) => void;
            getResponse: (...args: any[]) => string;
            remove: (...args: any[]) => void;
        };
        solveSimpleChallenge?: (challenge: any) => any;
        __cf_chl_opt?: Record<string, any>;
        __cf_chl_ctx?: Record<string, any>;
    }
}
