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
    // reCAPTCHA domains
    "google.com/recaptcha",
    "www.google.com/recaptcha",
    "recaptcha.net",
    "www.recaptcha.net",
    "gstatic.com/recaptcha",
    "www.gstatic.com/recaptcha",
    // hCaptcha domains
    "hcaptcha.com",
    "www.hcaptcha.com",
    "newassets.hcaptcha.com",
    "assets.hcaptcha.com",
    "imgs.hcaptcha.com",
    "js.hcaptcha.com",
    // Cloudflare Turnstile domains
    "challenges.cloudflare.com",
    "cloudflare.com/cdn-cgi/challenge",
    "turnstile.cloudflare.com",
    // Additional verification APIs
    "api.hcaptcha.com",
    "api2.hcaptcha.com"
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

// Script to inject into proxied pages for CAPTCHA support and new tab interception
const INTERCEPTOR_SCRIPT = `
<script>
(function() {
    // CAPTCHA domains that should not be blocked or intercepted
    var CAPTCHA_ORIGINS = [
        'google.com', 'gstatic.com', 'recaptcha.net',
        'hcaptcha.com', 'cloudflare.com', 'challenges.cloudflare.com'
    ];
    
    // Check if URL is CAPTCHA-related
    function isCaptchaUrl(url) {
        if (!url) return false;
        var urlLower = url.toString().toLowerCase();
        return CAPTCHA_ORIGINS.some(function(domain) {
            return urlLower.indexOf(domain) !== -1;
        });
    }
    
    // Initialize CAPTCHA global objects if not present
    if (typeof window.___grecaptcha_cfg === 'undefined') {
        window.___grecaptcha_cfg = { clients: {} };
    }
    if (typeof window.hcaptcha === 'undefined') {
        window.hcaptcha = window.hcaptcha || {};
    }
    if (typeof window.turnstile === 'undefined') {
        window.turnstile = window.turnstile || {};
    }
    
    // Intercept window.open but allow CAPTCHA-related popups
    var originalOpen = window.open;
    window.open = function(url, target, features) {
        // Allow CAPTCHA-related window.open calls to work normally
        if (isCaptchaUrl(url)) {
            return originalOpen.call(window, url, target, features);
        }
        
        if (url) {
            console.log('[Proxy Interceptor] Redirecting window.open to same window:', url);
            window.location.href = url;
            
            return new Proxy({}, {
                get: function() { return null; },
                set: function() { return true; }
            });
        }
        return null;
    };
    
    // Enhanced postMessage handler for CAPTCHA communication
    var originalPostMessage = window.postMessage;
    window.postMessage = function(message, targetOrigin, transfer) {
        // Allow all CAPTCHA-related postMessage communications
        if (targetOrigin && isCaptchaUrl(targetOrigin)) {
            targetOrigin = '*';
        }
        return originalPostMessage.call(window, message, targetOrigin, transfer);
    };
    
    // Monitor for CAPTCHA iframes and ensure proper setup
    function setupCaptchaIframe(iframe) {
        var src = iframe.src || iframe.getAttribute('src') || '';
        if (isCaptchaUrl(src)) {
            // Remove restrictive sandbox if present
            if (iframe.hasAttribute('sandbox')) {
                var sandbox = iframe.sandbox;
                if (!sandbox.contains('allow-same-origin')) sandbox.add('allow-same-origin');
                if (!sandbox.contains('allow-scripts')) sandbox.add('allow-scripts');
                if (!sandbox.contains('allow-forms')) sandbox.add('allow-forms');
                if (!sandbox.contains('allow-popups')) sandbox.add('allow-popups');
                if (!sandbox.contains('allow-popups-to-escape-sandbox')) sandbox.add('allow-popups-to-escape-sandbox');
            }
            
            // Remove credentialless attribute
            if (iframe.hasAttribute('credentialless')) {
                iframe.removeAttribute('credentialless');
            }
            
            // Ensure proper allow attribute for permissions
            var allow = iframe.getAttribute('allow') || '';
            if (allow.indexOf('cross-origin-isolated') === -1) {
                iframe.setAttribute('allow', allow + (allow ? '; ' : '') + 'cross-origin-isolated');
            }
        }
    }
    
    // Remove target="_blank" from non-CAPTCHA links
    function removeTargetBlank() {
        document.querySelectorAll('a[target="_blank"], a[target="_new"]').forEach(function(anchor) {
            if (!isCaptchaUrl(anchor.href)) {
                anchor.removeAttribute('target');
            }
        });
    }
    
    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeTargetBlank);
    } else {
        removeTargetBlank();
    }
    
    // Watch for dynamically added elements
    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return;
                    
                    // Handle iframes (CAPTCHA setup)
                    if (node.tagName === 'IFRAME') {
                        setupCaptchaIframe(node);
                    }
                    
                    // Handle links (remove target="_blank" for non-CAPTCHA)
                    if (node.tagName === 'A') {
                        var targetAttr = node.getAttribute('target');
                        if ((targetAttr === '_blank' || targetAttr === '_new') && !isCaptchaUrl(node.href)) {
                            node.removeAttribute('target');
                        }
                    }
                    
                    // Handle child elements
                    if (node.querySelectorAll) {
                        node.querySelectorAll('iframe').forEach(setupCaptchaIframe);
                        node.querySelectorAll('a[target="_blank"], a[target="_new"]').forEach(function(anchor) {
                            if (!isCaptchaUrl(anchor.href)) {
                                anchor.removeAttribute('target');
                            }
                        });
                    }
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    
    // Setup existing iframes on page load
    document.querySelectorAll('iframe').forEach(setupCaptchaIframe);
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
        if (text.includes("[Proxy Interceptor]")) {
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
