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
    "smartcaptcha.yandexcloud.net"
];

/**
 * Initialize CAPTCHA handlers on page load
 * This ensures that CAPTCHA widgets can properly communicate with their APIs
 */
export function initializeCaptchaHandlers() {
    if (typeof window === "undefined") return;

    // Fix MessagePort cloning errors for CAPTCHA iframes
    fixMessagePortCloning();

    // Add missing Cloudflare challenge solver functions
    addCloudflareChallengeHandlers();

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
 * Fix MessagePort cloning errors that occur in CAPTCHA iframes
 * This prevents "DataCloneError: Failed to execute 'postMessage' on 'Window'" errors
 */
function fixMessagePortCloning() {
    // Maximum recursion depth when searching for MessagePort objects
    const MAX_RECURSION_DEPTH = 10;
    
    const originalPostMessage = window.postMessage.bind(window);

    // Helper to check if an object is a MessagePort
    const isMessagePort = (obj: any): boolean => {
        if (!obj) return false;
        // Try instanceof first (most reliable)
        if (obj instanceof MessagePort) return true;
        // Fallback: check for MessagePort-like interface
        if (
            typeof obj === "object" &&
            typeof obj.postMessage === "function" &&
            typeof obj.start === "function" &&
            typeof obj.close === "function"
        ) {
            // Additional check for constructor name as a hint (not definitive)
            return obj.constructor?.name === "MessagePort" || obj.toString() === "[object MessagePort]";
        }
        return false;
    };

    // Override postMessage to properly handle MessagePort transfers
    // Note: Using unknown for message type as it can be any cloneable data
    (window as any).postMessage = function (message: unknown, ...args: any[]) {
        try {
            // Handle both old (targetOrigin, transfer) and new (options) signatures
            const targetOrigin = typeof args[0] === "string" ? args[0] : "*";
            let transfer = args[1];

            // Handle new WindowPostMessageOptions signature
            if (typeof args[0] === "object" && args[0] !== null && "targetOrigin" in args[0]) {
                const options = args[0] as WindowPostMessageOptions;
                transfer = options.transfer;
                return originalPostMessage(message, options);
            }

            // If transfer array contains MessagePort objects, ensure they are properly transferred
            if (transfer && Array.isArray(transfer)) {
                const hasMessagePort = transfer.some((item: any) => isMessagePort(item));

                if (hasMessagePort) {
                    // Use the transfer parameter explicitly
                    return originalPostMessage(message, targetOrigin, transfer);
                }
            }

            // For other cases, check if message contains MessagePort and auto-detect transfer
            if (message && typeof message === "object") {
                const ports: MessagePort[] = [];
                const collectPorts = (obj: any, depth: number = 0) => {
                    // Limit recursion depth to prevent infinite loops
                    if (depth > MAX_RECURSION_DEPTH) return;
                    
                    if (isMessagePort(obj)) {
                        ports.push(obj);
                    } else if (obj && typeof obj === "object") {
                        for (const key in obj) {
                            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                collectPorts(obj[key], depth + 1);
                            }
                        }
                    }
                };
                collectPorts(message);

                if (ports.length > 0) {
                    // Auto-transfer detected MessagePorts
                    return originalPostMessage(message, targetOrigin, ports);
                }
            }

            // Standard call
            if (transfer !== undefined) {
                return originalPostMessage(message, targetOrigin, transfer);
            } else {
                return originalPostMessage(message, targetOrigin);
            }
        } catch (error) {
            // Fallback: try without transfer parameter
            console.warn("postMessage transfer failed, attempting without transfer:", error);
            try {
                const targetOrigin = typeof args[0] === "string" ? args[0] : "*";
                return originalPostMessage(message, targetOrigin);
            } catch (fallbackError) {
                console.error("postMessage completely failed:", fallbackError);
                throw fallbackError;
            }
        }
    };
}

/**
 * Add missing Cloudflare challenge solver functions
 * This fixes "ReferenceError: solveSimpleChallenge is not defined" errors
 * 
 * Note: These are stub implementations. Cloudflare's actual challenge solving
 * is handled by their own scripts loaded in the page. These functions just need
 * to exist to prevent reference errors when Cloudflare scripts try to call them.
 */
function addCloudflareChallengeHandlers() {
    // Define solveSimpleChallenge for Cloudflare Turnstile/Challenge pages
    // This is a stub - actual challenge solving is done by Cloudflare's own scripts
    if (typeof (window as any).solveSimpleChallenge === "undefined") {
        (window as any).solveSimpleChallenge = function () {
            console.log("Simple challenge solver called - handled by Cloudflare scripts");
            // Empty implementation - Cloudflare's scripts handle the actual solving
        };
    }

    // Add support for managed challenge callback
    // This receives the challenge token from Cloudflare after successful verification
    if (typeof (window as any).managedChallengeCallback === "undefined") {
        (window as any).managedChallengeCallback = function (token: string) {
            const tokenPreview = token && token.length > 20 ? token.substring(0, 20) + "..." : token;
            console.log("Managed challenge callback received token:", tokenPreview);
            // The token is automatically used by Cloudflare's scripts
            // This callback is just for logging/debugging purposes
        };
    }

    // Add support for interactive challenge
    // Called when user interaction is required (e.g., clicking a checkbox)
    if (typeof (window as any).interactiveChallenge === "undefined") {
        (window as any).interactiveChallenge = function () {
            console.log("Interactive challenge initiated - waiting for user interaction");
            // Cloudflare's scripts handle the actual UI and interaction
        };
    }
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

            // Set mode to cors for CAPTCHA requests to avoid CORS issues
            if (!init.mode || init.mode === "navigate") {
                init.mode = "cors";
            }
        }

        return originalFetch.call(this, input, init).catch((error) => {
            // Enhanced error handling for CAPTCHA requests
            if (isCaptchaRequest) {
                console.warn("CAPTCHA fetch error:", url, error);
                // Try again without custom init for preload compatibility
                if (init && (init.credentials || init.mode)) {
                    console.log("Retrying CAPTCHA request with default settings");
                    return originalFetch.call(this, input, { credentials: "include" });
                }
            }
            throw error;
        });
    };

    // Store original XMLHttpRequest
    const OriginalXHR = window.XMLHttpRequest;

    // Override XMLHttpRequest for CAPTCHA requests
    window.XMLHttpRequest = function (this: XMLHttpRequest) {
        const xhr = new OriginalXHR();

        // Store original open method
        const originalOpen = xhr.open.bind(xhr);
        
        // Override open method to add CAPTCHA support
        xhr.open = function (
            this: XMLHttpRequest,
            method: string,
            url: string | URL,
            async?: boolean,
            username?: string | null,
            password?: string | null
        ) {
            const urlStr = url.toString();
            const isCaptchaRequest = CAPTCHA_DOMAINS.some((domain) => urlStr.includes(domain));

            if (isCaptchaRequest) {
                // Ensure credentials are included for CAPTCHA requests
                xhr.withCredentials = true;
            }

            // Call original open with appropriate arguments
            // Note: Using 'as any' here because XMLHttpRequest.open has overloaded signatures
            // that TypeScript cannot properly infer when calling dynamically with variable arguments.
            // This is safe because we're calling the same native method with its original signatures.
            const openFn = originalOpen as any;
            if (username !== undefined && password !== undefined) {
                return openFn(method, url, async ?? true, username, password);
            } else if (username !== undefined) {
                return openFn(method, url, async ?? true, username);
            } else if (async !== undefined) {
                return openFn(method, url, async);
            } else {
                return openFn(method, url);
            }
        } as typeof xhr.open;

        return xhr;
    } as any;

    // Copy static properties
    Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
    Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);

    // Fix preload resource loading for CAPTCHA scripts
    enhancePreloadHandling();
}

/**
 * Enhance preload handling to fix credential mode mismatches
 */
function enhancePreloadHandling() {
    // Monitor for link elements being added to the page
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLLinkElement && node.rel === "preload") {
                    const href = node.href || "";
                    // Check if this is a CAPTCHA-related resource
                    if (CAPTCHA_DOMAINS.some((domain) => href.includes(domain))) {
                        // Ensure crossorigin attribute is set for proper credential handling
                        if (!node.hasAttribute("crossorigin")) {
                            node.setAttribute("crossorigin", "use-credentials");
                        }
                    }
                }
                // Also handle script tags that might be preloaded
                if (node instanceof HTMLScriptElement) {
                    const src = node.src || "";
                    if (CAPTCHA_DOMAINS.some((domain) => src.includes(domain))) {
                        // Ensure crossorigin attribute is set
                        if (!node.hasAttribute("crossorigin")) {
                            node.setAttribute("crossorigin", "use-credentials");
                        }
                    }
                }
            });
        });
    });

    // Start observing
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
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
