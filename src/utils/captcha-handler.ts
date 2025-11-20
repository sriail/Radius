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
    "yandex.com",
    "yandex.ru",
    "yandex.net",
    "captcha-delivery.com"
];

/**
 * Initialize CAPTCHA handlers on page load
 * This ensures that CAPTCHA widgets can properly communicate with their APIs
 */
export function initializeCaptchaHandlers() {
    if (typeof window === "undefined") return;

    // Fix postMessage to properly handle MessagePorts (critical for CAPTCHA functionality)
    patchPostMessage();

    // Ensure global CAPTCHA callbacks are accessible
    if (!window.___grecaptcha_cfg) {
        window.___grecaptcha_cfg = { clients: {} };
    }

    // Monitor for CAPTCHA iframe creation and ensure proper setup
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                // Handle iframe elements
                if (node instanceof HTMLIFrameElement) {
                    const src = node.src || "";
                    // Check if this is a CAPTCHA iframe
                    if (
                        src.includes("recaptcha") ||
                        src.includes("hcaptcha") ||
                        src.includes("challenges.cloudflare.com") ||
                        src.includes("turnstile") ||
                        src.includes("yandex") ||
                        src.includes("captcha-delivery")
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

                // Handle link preload elements for CAPTCHA resources
                if (node instanceof HTMLLinkElement && node.rel === "preload") {
                    const href = node.href || "";
                    // Check if this is a CAPTCHA-related preload
                    if (
                        href.includes("recaptcha") ||
                        href.includes("hcaptcha") ||
                        href.includes("gstatic.com") ||
                        href.includes("cloudflare.com") ||
                        href.includes("yandex") ||
                        href.includes("captcha-delivery")
                    ) {
                        // Add crossorigin attribute to avoid credential mode mismatch
                        if (!node.hasAttribute("crossorigin")) {
                            node.setAttribute("crossorigin", "anonymous");
                        }

                        // Ensure proper 'as' attribute
                        if (!node.hasAttribute("as")) {
                            // Determine 'as' value based on URL
                            if (href.endsWith(".js") || href.includes(".js?")) {
                                node.setAttribute("as", "script");
                            } else if (href.endsWith(".css") || href.includes(".css?")) {
                                node.setAttribute("as", "style");
                            } else if (
                                href.endsWith(".woff2") ||
                                href.endsWith(".woff") ||
                                href.endsWith(".ttf")
                            ) {
                                node.setAttribute("as", "font");
                            }
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

    if (originalCookieDescriptor) {
        Object.defineProperty(document, "cookie", {
            get() {
                return originalCookieDescriptor.get?.call(this) || "";
            },
            set(value) {
                // Ensure SameSite=None for CAPTCHA cookies in cross-origin iframes
                if (typeof value === "string" && value.includes("_GRECAPTCHA")) {
                    if (!value.includes("SameSite")) {
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
 * Patch postMessage to properly handle MessagePort transfers
 * This is critical for CAPTCHA systems that use MessagePorts for communication
 */
function patchPostMessage() {
    // Store the original postMessage method
    const originalPostMessage = window.postMessage;
    const originalWindowPostMessage = Window.prototype.postMessage;

    /**
     * Enhanced postMessage that properly handles MessagePort transfers
     */
    const enhancedPostMessage = function (
        this: Window,
        message: any,
        targetOrigin: string,
        transfer?: any[]
    ) {
        try {
            // Extract MessagePorts from the message
            const ports: MessagePort[] = [];

            // Check if transfer array is provided
            if (transfer && Array.isArray(transfer)) {
                // Transfer array already contains ports, use it directly
                return originalWindowPostMessage.call(this, message, targetOrigin, transfer);
            }

            // Check if the message contains MessagePort objects
            if (message && typeof message === "object") {
                // Recursively find MessagePorts in the message
                const findPorts = (obj: any, visited = new WeakSet()): void => {
                    if (!obj || typeof obj !== "object") return;
                    if (visited.has(obj)) return;
                    visited.add(obj);

                    if (obj instanceof MessagePort) {
                        ports.push(obj);
                        return;
                    }

                    // Check arrays
                    if (Array.isArray(obj)) {
                        for (const item of obj) {
                            findPorts(item, visited);
                        }
                        return;
                    }

                    // Check object properties
                    for (const key in obj) {
                        try {
                            if (obj.hasOwnProperty(key)) {
                                findPorts(obj[key], visited);
                            }
                        } catch (e) {
                            // Ignore errors accessing properties
                        }
                    }
                };

                findPorts(message);
            }

            // If we found MessagePorts, transfer them
            if (ports.length > 0) {
                return originalWindowPostMessage.call(this, message, targetOrigin, ports);
            }

            // Otherwise, use the original call
            return originalWindowPostMessage.call(this, message, targetOrigin, transfer);
        } catch (error) {
            // If our enhanced version fails, fall back to original
            console.warn("Enhanced postMessage failed, using original:", error);
            return originalWindowPostMessage.call(this, message, targetOrigin, transfer);
        }
    };

    // Override Window.prototype.postMessage
    try {
        Object.defineProperty(Window.prototype, "postMessage", {
            value: enhancedPostMessage,
            writable: true,
            enumerable: true,
            configurable: true
        });
    } catch (e) {
        console.warn("Failed to override Window.prototype.postMessage:", e);
    }

    // Also patch the window.postMessage directly
    try {
        Object.defineProperty(window, "postMessage", {
            value: enhancedPostMessage.bind(window),
            writable: true,
            enumerable: true,
            configurable: true
        });
    } catch (e) {
        console.warn("Failed to override window.postMessage:", e);
    }

    // Patch HTMLIFrameElement.contentWindow.postMessage
    const originalIFrameContentWindowGetter = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype,
        "contentWindow"
    );

    if (originalIFrameContentWindowGetter) {
        Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
            get: function () {
                const contentWindow = originalIFrameContentWindowGetter.get!.call(this);
                if (contentWindow && contentWindow.postMessage) {
                    try {
                        contentWindow.postMessage = enhancedPostMessage.bind(contentWindow);
                    } catch (e) {
                        // Ignore cross-origin access errors
                    }
                }
                return contentWindow;
            },
            enumerable: true,
            configurable: true
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
