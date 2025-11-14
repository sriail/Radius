importScripts("/vu/uv.bundle.js", "/vu/uv.config.js", "/marcs/scramjet.all.js");
importScripts(__uv$config.sw || "/vu/uv.sw.js");

const uv = new UVServiceWorker();

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const sj = new ScramjetServiceWorker();

// Enhanced error handling and reCAPTCHA support
self.addEventListener("fetch", function (event) {
    event.respondWith(
        (async () => {
            try {
                await sj.loadConfig();

                // Check if this is a reCAPTCHA related request
                const url = event.request.url;
                const isRecaptcha =
                    url.includes("recaptcha") ||
                    url.includes("google.com/recaptcha") ||
                    url.includes("gstatic.com/recaptcha");

                // Handle reCAPTCHA requests with minimal rewriting for better compatibility
                if (isRecaptcha) {
                    console.log("[SW] ReCAPTCHA request detected:", url);
                    // Pass through with minimal interference
                    if (sj.route(event)) {
                        return await sj.fetch(event);
                    }
                }

                // Route through appropriate proxy
                if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
                    return await uv.fetch(event);
                } else if (sj.route(event)) {
                    return await sj.fetch(event);
                } else {
                    return await fetch(event.request);
                }
            } catch (error) {
                console.error("[SW] Fetch error:", error);
                // Return a basic error response instead of crashing
                return new Response("Proxy Error: " + error.message, {
                    status: 500,
                    statusText: "Internal Proxy Error",
                    headers: { "Content-Type": "text/plain" }
                });
            }
        })()
    );
});

// Add message handler for communication with main thread
self.addEventListener("message", function (event) {
    if (event.data && event.data.type === "RELOAD_CONFIG") {
        console.log("[SW] Reloading configuration");
        sj.loadConfig()
            .then(() => {
                event.ports[0].postMessage({ success: true });
            })
            .catch((err) => {
                event.ports[0].postMessage({ success: false, error: err.message });
            });
    }
});
