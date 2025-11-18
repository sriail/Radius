importScripts("/vu/uv.bundle.js", "/vu/uv.config.js", "/marcs/scramjet.all.js");
importScripts(__uv$config.sw || "/vu/uv.sw.js");

const uv = new UVServiceWorker();

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const sj = new ScramjetServiceWorker();

// Enhanced CAPTCHA and Cloudflare verification support
// List of CAPTCHA and verification domains that need special handling
const CAPTCHA_DOMAINS = [
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
];

// Helper function to check if URL is CAPTCHA-related
function isCaptchaRequest(url) {
    const urlStr = url.toString().toLowerCase();
    return CAPTCHA_DOMAINS.some((domain) => urlStr.includes(domain));
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

// Script to inject at the very beginning of HTML documents
const INTERCEPT_SCRIPT = `<script>
(function() {
    'use strict';
    console.log('[Iframe Intercept] Script injected by service worker');
    const originalWindowOpen = window.open;
    window.open = function(url, target, features) {
        console.log('[Iframe Intercept] window.open called:', url, target);
        if (url && window.parent !== window) {
            try {
                console.log('[Iframe Intercept] Posting message to parent');
                window.parent.postMessage({
                    type: 'navigate-iframe',
                    url: url.toString()
                }, '*');
                return null;
            } catch (e) {
                console.error('[Iframe Intercept] Failed to communicate with parent:', e);
            }
        }
        return originalWindowOpen.call(this, url, target, features);
    };
    
    document.addEventListener('click', function(e) {
        const anchor = e.target.closest('a');
        if (anchor && anchor.href) {
            const target = anchor.getAttribute('target');
            console.log('[Iframe Intercept] Link clicked:', anchor.href, 'target:', target);
            if (target === '_blank' || target === '_new' || target === '_parent' || target === '_top') {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Iframe Intercept] Intercepting, will call window.open');
                window.open(anchor.href);
            }
        }
    }, true);
    
    // Set base target to prevent new windows
    setTimeout(function() {
        const baseTag = document.querySelector('base');
        if (!baseTag && document.head) {
            const newBase = document.createElement('base');
            newBase.target = '_self';
            document.head.insertBefore(newBase, document.head.firstChild);
            console.log('[Iframe Intercept] Created base tag with target="_self"');
        }
    }, 0);
})();
</script>`;

// Helper to inject script into HTML responses
async function injectInterceptScript(response) {
    const contentType = response.headers.get('content-type') || '';
    console.log('[SW] Response content-type:', contentType);
    if (!contentType.includes('text/html')) {
        console.log('[SW] Not HTML, skipping injection');
        return response;
    }
    
    try {
        let text = await response.text();
        console.log('[SW] Got response text, length:', text.length);
        
        // Inject the script right after the opening <html> tag or at the start
        if (text.includes('<html')) {
            text = text.replace(/<html([^>]*)>/, `<html$1>${INTERCEPT_SCRIPT}`);
            console.log('[SW] Injected after <html> tag');
        } else if (text.includes('<head')) {
            text = text.replace(/<head([^>]*)>/, `<head$1>${INTERCEPT_SCRIPT}`);
            console.log('[SW] Injected after <head> tag');
        } else {
            text = INTERCEPT_SCRIPT + text;
            console.log('[SW] Injected at start');
        }
        
        return new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    } catch (e) {
        console.error('[SW] Failed to inject script:', e);
        return response;
    }
}

self.addEventListener("fetch", function (event) {
    event.respondWith(
        (async () => {
            await sj.loadConfig();

            const url = event.request.url;
            const isCaptcha = isCaptchaRequest(url);

            // Enhanced handling for CAPTCHA requests
            let request = event.request;
            if (isCaptcha) {
                request = enhanceCaptchaRequest(event.request);
            }

            let response;
            if (url.startsWith(location.origin + __uv$config.prefix)) {
                response = await uv.fetch(event);
                // Inject our script into proxied HTML content
                if (event.request.destination === 'document' || event.request.destination === 'iframe') {
                    response = await injectInterceptScript(response);
                }
            } else if (sj.route(event)) {
                response = await sj.fetch(event);
                // Inject our script into proxied HTML content
                if (event.request.destination === 'document' || event.request.destination === 'iframe') {
                    response = await injectInterceptScript(response);
                }
            } else {
                response = await fetch(request);
            }
            
            return response;
        })()
    );
});
