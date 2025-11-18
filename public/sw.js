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
            } else if (sj.route(event)) {
                response = await sj.fetch(event);
            } else {
                response = await fetch(request);
            }

            // Inject popup interceptor script into HTML pages
            if (response && response.headers.get("content-type")?.includes("text/html")) {
                // Only inject into proxied content
                if (url.startsWith(location.origin + __uv$config.prefix) || sj.route(event)) {
                    try {
                        const text = await response.text();
                        // Inject the popup interceptor script at the beginning of the body or head
                        const injectedScript = '<script src="/popup-interceptor.js"></script>';
                        let modifiedText = text;

                        // Try to inject into <head> first, then <body>, then at start of html
                        if (text.includes("<head>")) {
                            modifiedText = text.replace("<head>", "<head>" + injectedScript);
                        } else if (text.includes("<body>")) {
                            modifiedText = text.replace("<body>", "<body>" + injectedScript);
                        } else if (text.includes("<html>")) {
                            modifiedText = text.replace("<html>", "<html>" + injectedScript);
                        }

                        // Create new response with modified content
                        response = new Response(modifiedText, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    } catch (e) {
                        console.error("[Radius SW] Failed to inject popup interceptor:", e);
                        // Return original response if injection fails
                    }
                }
            }

            return response;
        })()
    );
});
