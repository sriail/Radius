/**
 * Enhanced CAPTCHA and verification handler
 * This module ensures that reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile, 
 * and Yandex SmartCaptcha work seamlessly within the proxy environment
 */

/**
 * List of CAPTCHA and verification-related domains
 * Enhanced to support reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile, and Yandex SmartCaptcha
 */
const CAPTCHA_DOMAINS = [
    // Google reCAPTCHA domains
    "google.com/recaptcha",
    "www.google.com/recaptcha",
    "recaptcha.net",
    "www.recaptcha.net",
    "gstatic.com/recaptcha",
    "www.gstatic.com/recaptcha",
    "google.com",
    "gstatic.com",
    // hCaptcha domains
    "hcaptcha.com",
    "newassets.hcaptcha.com",
    "js.hcaptcha.com",
    // Cloudflare Turnstile domains
    "cloudflare.com",
    "challenges.cloudflare.com",
    "turnstile.cloudflare.com",
    // Yandex SmartCaptcha and Cloud domains
    "smartcaptcha.yandexcloud.net",
    "cloud.yandex.com",
    "cloud.yandex.ru",
    "api.cloud.yandex.net",
    "storage.yandexcloud.net",
    "yandex.com/showcaptcha",
    "yastatic.net/s3/captcha-frontend"
];

/**
 * Initialize CAPTCHA handlers on page load
 * This ensures that CAPTCHA widgets can properly communicate with their APIs
 */
export function initializeCaptchaHandlers() {
    if (typeof window === "undefined") return;

    // Ensure global CAPTCHA callbacks are accessible
    // Google reCAPTCHA
    if (!window.___grecaptcha_cfg) {
        window.___grecaptcha_cfg = { clients: {} };
    }

    // Yandex SmartCaptcha
    if (!window.smartCaptcha) {
        window.smartCaptcha = {};
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
                        src.includes("turnstile") ||
                        src.includes("smartcaptcha.yandexcloud.net") ||
                        src.includes("yandex.com/showcaptcha")
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

                        // Set proper referrer policy for CAPTCHA requests
                        if (!node.referrerPolicy) {
                            node.referrerPolicy = "strict-origin-when-cross-origin";
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
 * Supports reCAPTCHA, hCaptcha, Cloudflare Turnstile, and Yandex SmartCaptcha
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
                // Ensure SameSite=None for CAPTCHA cookies in cross-origin iframes
                if (typeof value === "string") {
                    const needsSameSite =
                        value.includes("_GRECAPTCHA") || // Google reCAPTCHA
                        value.includes("hmt_id") || // hCaptcha
                        value.includes("cf_clearance") || // Cloudflare
                        value.includes("yandex") || // Yandex general
                        value.includes("smart-captcha") || // Yandex SmartCaptcha
                        value.includes("spravka"); // Yandex verification

                    if (needsSameSite && !value.includes("SameSite")) {
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
            if (!init.credentials) {
                init.credentials = "include";
            }

            // Ensure proper headers
            init.headers = new Headers(init.headers);
            if (!init.headers.has("Accept")) {
                init.headers.set("Accept", "*/*");
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
        xhr.open = function (method: string, url: string | URL, ...args: any[]) {
            const urlStr = url.toString();
            const isCaptchaRequest = CAPTCHA_DOMAINS.some((domain) => urlStr.includes(domain));

            if (isCaptchaRequest) {
                // Ensure credentials are included for CAPTCHA requests
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
 * Global declarations for CAPTCHA systems
 */
declare global {
    interface Window {
        // Google reCAPTCHA config
        ___grecaptcha_cfg?: {
            clients: Record<string, any>;
            [key: string]: any;
        };
        // Yandex SmartCaptcha
        smartCaptcha?: {
            [key: string]: any;
        };
    }
}
