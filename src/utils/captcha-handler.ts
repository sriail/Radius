/**
 * Enhanced CAPTCHA and Cloudflare verification handler
 * This module ensures that reCAPTCHA, hCaptcha, and Cloudflare Turnstile
 * work seamlessly within the proxy environment
 */

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
    "cdn-cgi",
    "cf-assets",
    "turnstile"
];

/**
 * Initialize CAPTCHA handlers on page load
 * This ensures that CAPTCHA widgets can properly communicate with their APIs
 */
export function initializeCaptchaHandlers() {
    if (typeof window === "undefined") return;

    // Ensure global CAPTCHA callbacks are accessible
    if (!window.___grecaptcha_cfg) {
        window.___grecaptcha_cfg = { clients: {} };
    }

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
                        }

                        // Ensure credentials are included for CAPTCHA cookies
                        if (node.getAttribute("credentialless") !== null) {
                            node.removeAttribute("credentialless");
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

    // Ensure cookies are properly handled for CAPTCHA tokens
    enhanceCookieHandling();

    // Enhance fetch and XMLHttpRequest for CAPTCHA requests
    enhanceNetworkRequests();
}

/**
 * Enhance cookie handling to ensure CAPTCHA tokens are properly stored
 */
function enhanceCookieHandling() {
    // Store original cookie descriptor
    const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");

    if (originalCookieDescriptor && originalCookieDescriptor.configurable) {
        try {
            Object.defineProperty(document, "cookie", {
                get() {
                    return originalCookieDescriptor.get?.call(this) || "";
                },
                set(value) {
                    // Ensure SameSite=None for CAPTCHA cookies in cross-origin iframes
                    if (typeof value === "string") {
                        // Handle various CAPTCHA-related cookies
                        const isCaptchaCookie = value.includes("_GRECAPTCHA") || 
                                                value.includes("_hcaptcha") || 
                                                value.includes("cf_clearance") ||
                                                value.includes("__cf_bm");
                        
                        if (isCaptchaCookie && !value.includes("SameSite")) {
                            // Add SameSite=None and Secure for cross-origin cookies
                            value += "; SameSite=None; Secure";
                        }
                    }
                    originalCookieDescriptor.set?.call(this, value);
                },
                configurable: true
            });
        } catch (error) {
            console.warn("Failed to enhance cookie handling:", error);
        }
    }
}

/**
 * Enhance network requests to properly handle CAPTCHA API calls
 */
function enhanceNetworkRequests() {
    // Store original fetch
    const originalFetch = window.fetch;

    // Override fetch to ensure proper headers for CAPTCHA requests
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        const url =
            typeof input === "string"
                ? input
                : input instanceof Request
                  ? input.url
                  : input.toString();

        // Check if this is a CAPTCHA-related request
        const isCaptchaRequest = CAPTCHA_DOMAINS.some((domain) => url.includes(domain));

        if (isCaptchaRequest) {
            // Ensure credentials are included
            init = init || {};
            if (!init.credentials || init.credentials === "omit") {
                init.credentials = "include";
            }

            // Ensure proper headers
            init.headers = new Headers(init.headers);
            if (!init.headers.has("Accept")) {
                init.headers.set("Accept", "*/*");
            }
            
            // Don't override cache mode for CAPTCHA requests
            if (!init.cache) {
                init.cache = "default";
            }
        }

        return originalFetch.call(this, input, init);
    };

    // Store original XMLHttpRequest
    const OriginalXHR = window.XMLHttpRequest;

    // Override XMLHttpRequest for CAPTCHA requests
    window.XMLHttpRequest = function (this: XMLHttpRequest) {
        const xhr = new OriginalXHR();

        // Store original open method
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function (method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
            const urlStr = url.toString();
            const isCaptchaRequest = CAPTCHA_DOMAINS.some((domain) => urlStr.includes(domain));

            if (isCaptchaRequest) {
                // Ensure credentials are included for CAPTCHA requests
                xhr.withCredentials = true;
            }

            if (async !== undefined) {
                if (username !== undefined) {
                    if (password !== undefined) {
                        return originalOpen.call(this, method, url, async, username, password);
                    }
                    return originalOpen.call(this, method, url, async, username);
                }
                return originalOpen.call(this, method, url, async);
            }
            return originalOpen.call(this, method, url);
        };
        
        // Ensure headers are properly set
        xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
            return originalSend.call(this, body);
        };

        return xhr;
    } as any;

    // Copy static properties
    Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
    Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
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
