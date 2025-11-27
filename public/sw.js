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
    "www.gstatic.com/recaptcha",
    "hcaptcha.com",
    "newassets.hcaptcha.com",
    "api.hcaptcha.com",
    "js.hcaptcha.com",
    "challenges.cloudflare.com",
    "cloudflare.com/cdn-cgi/challenge",
    "turnstile.cloudflare.com",
    "cf-turnstile.com",
    "cloudflareinsights.com"
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

// Allowed origins for CAPTCHA providers (for proper cross-origin messaging)
const CAPTCHA_ALLOWED_ORIGINS = [
    "https://www.google.com",
    "https://google.com",
    "https://recaptcha.net",
    "https://www.recaptcha.net",
    "https://gstatic.com",
    "https://www.gstatic.com",
    "https://hcaptcha.com",
    "https://newassets.hcaptcha.com",
    "https://api.hcaptcha.com",
    "https://challenges.cloudflare.com",
    "https://cloudflare.com",
    "https://turnstile.cloudflare.com"
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

                // Safely check if this is a proxied request using optional chaining
                const uvPrefix =
                    (typeof __uv$config !== "undefined" && __uv$config?.prefix) || null;
                const isUvRequest = uvPrefix ? url.startsWith(location.origin + uvPrefix) : false;
                const isSjRequest = sj.route(event);
                const isProxiedRequest = isUvRequest || isSjRequest;

                // Enhanced handling for CAPTCHA and heavy cookie requests
                let request = event.request;
                if (isCaptcha) {
                    request = enhanceCaptchaRequest(event.request);
                } else if (isHeavyCookie) {
                    request = enhanceHeavyCookieRequest(event.request);
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
// and provide CAPTCHA support with proper postMessage handling
const INTERCEPTOR_SCRIPT = `
<script>
(function() {
    // CAPTCHA provider domains that should be allowed for cross-origin messaging
    var CAPTCHA_ORIGINS = [
        'https://www.google.com',
        'https://google.com',
        'https://recaptcha.net',
        'https://www.recaptcha.net',
        'https://gstatic.com',
        'https://www.gstatic.com',
        'https://hcaptcha.com',
        'https://newassets.hcaptcha.com',
        'https://api.hcaptcha.com',
        'https://challenges.cloudflare.com',
        'https://cloudflare.com',
        'https://turnstile.cloudflare.com'
    ];

    // Fix postMessage to properly handle MessagePort transfers
    // This prevents DataCloneError when CAPTCHA providers communicate
    var originalPostMessage = window.postMessage;
    if (originalPostMessage && typeof originalPostMessage === 'function') {
        window.postMessage = function(message, targetOrigin, transfer) {
            try {
                // Handle both old and new signatures
                if (typeof targetOrigin === 'object' && targetOrigin !== null && !Array.isArray(targetOrigin)) {
                    // New signature: postMessage(message, options)
                    var options = targetOrigin;
                    if (options.transfer && Array.isArray(options.transfer)) {
                        // Filter transfer to only valid transferables
                        options.transfer = options.transfer.filter(function(item) {
                            return item instanceof ArrayBuffer ||
                                   item instanceof MessagePort ||
                                   (typeof ImageBitmap !== 'undefined' && item instanceof ImageBitmap) ||
                                   (typeof OffscreenCanvas !== 'undefined' && item instanceof OffscreenCanvas);
                        });
                    }
                    return originalPostMessage.call(window, message, options);
                }
                
                // Old signature: postMessage(message, targetOrigin, transfer)
                var origin = targetOrigin || '*';
                var validTransfer = transfer;
                
                if (transfer && Array.isArray(transfer)) {
                    validTransfer = transfer.filter(function(item) {
                        return item instanceof ArrayBuffer ||
                               item instanceof MessagePort ||
                               (typeof ImageBitmap !== 'undefined' && item instanceof ImageBitmap) ||
                               (typeof OffscreenCanvas !== 'undefined' && item instanceof OffscreenCanvas);
                    });
                }
                
                return originalPostMessage.call(window, message, origin, validTransfer);
            } catch (e) {
                // If transfer fails, try without it
                if (e.name === 'DataCloneError') {
                    console.warn('[CAPTCHA Support] postMessage fallback without transfer');
                    try {
                        if (typeof targetOrigin === 'object' && targetOrigin !== null) {
                            var fallbackOptions = Object.assign({}, targetOrigin);
                            delete fallbackOptions.transfer;
                            return originalPostMessage.call(window, message, fallbackOptions);
                        }
                        return originalPostMessage.call(window, message, targetOrigin || '*');
                    } catch (e2) {
                        console.error('[CAPTCHA Support] postMessage failed:', e2);
                    }
                }
                throw e;
            }
        };
    }

    // Add global CAPTCHA challenge handlers to prevent ReferenceErrors
    if (typeof window.solveSimpleChallenge === 'undefined') {
        window.solveSimpleChallenge = function(challenge) {
            console.log('[CAPTCHA Support] solveSimpleChallenge passthrough');
            return challenge;
        };
    }
    if (typeof window.__cf_chl_opt === 'undefined') {
        window.__cf_chl_opt = {};
    }
    if (typeof window.__cf_chl_ctx === 'undefined') {
        window.__cf_chl_ctx = {};
    }

    // Initialize reCAPTCHA configuration if not present
    if (typeof window.___grecaptcha_cfg === 'undefined') {
        window.___grecaptcha_cfg = { clients: {} };
    }

    // Ensure grecaptcha enterprise support
    if (typeof window.grecaptcha === 'undefined') {
        window.grecaptcha = {
            enterprise: {
                ready: function(callback) {
                    if (typeof callback === 'function') {
                        if (document.readyState === 'complete') {
                            setTimeout(callback, 0);
                        } else {
                            window.addEventListener('load', callback);
                        }
                    }
                },
                execute: function() { return Promise.resolve(''); },
                render: function() { return 0; }
            },
            ready: function(callback) {
                if (typeof callback === 'function') {
                    if (document.readyState === 'complete') {
                        setTimeout(callback, 0);
                    } else {
                        window.addEventListener('load', callback);
                    }
                }
            }
        };
    }

    // hCaptcha placeholder
    if (typeof window.hcaptcha === 'undefined') {
        window.hcaptcha = {
            render: function() { return '0'; },
            execute: function() { return Promise.resolve(''); },
            reset: function() {},
            getResponse: function() { return ''; }
        };
    }

    // Turnstile placeholder
    if (typeof window.turnstile === 'undefined') {
        window.turnstile = {
            render: function() { return '0'; },
            execute: function() { return Promise.resolve(''); },
            reset: function() {},
            getResponse: function() { return ''; },
            remove: function() {}
        };
    }

    // Intercept window.open to prevent new tabs/windows from opening
    var originalOpen = window.open;
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
        var observer = new MutationObserver(function(mutations) {
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

    console.log('[CAPTCHA Support] Interceptor with CAPTCHA support loaded');
})();
</script>
`;

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
        // Look for either the old or new marker
        if (text.includes("[CAPTCHA Support]") || text.includes("[Proxy Interceptor]")) {
            return new Response(text, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        }

        // Inject the script just after opening tags
        // Handle both normal opening tags and self-closing tags
        let modifiedHtml = text;
        let injected = false;

        // Try to inject after <head> tag (normal or self-closing)
        if (!injected && /<head(\s[^>]*)?>/i.test(text)) {
            modifiedHtml = text.replace(/<head(\s[^>]*)?>/i, (match) => match + INTERCEPTOR_SCRIPT);
            injected = true;
        }

        // Fallback: inject after <body> tag (normal or self-closing)
        if (!injected && /<body(\s[^>]*)?>/i.test(text)) {
            modifiedHtml = text.replace(/<body(\s[^>]*)?>/i, (match) => match + INTERCEPTOR_SCRIPT);
            injected = true;
        }

        // Last resort: inject after <html> tag (normal or self-closing)
        if (!injected && /<html(\s[^>]*)?>/i.test(text)) {
            modifiedHtml = text.replace(/<html(\s[^>]*)?>/i, (match) => match + INTERCEPTOR_SCRIPT);
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
