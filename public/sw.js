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
    "turnstile.cloudflare.com",
    "yandex.com/captcha",
    "yandex.ru/captcha",
    "smartcaptcha.yandexcloud.net"
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

            if (url.startsWith(location.origin + __uv$config.prefix)) {
                return await uv.fetch(event);
            } else if (sj.route(event)) {
                return await sj.fetch(event);
            } else {
                return await fetch(request);
            }
        })()
    );
});
