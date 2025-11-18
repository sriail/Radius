importScripts("/vu/uv.bundle.js", "/vu/uv.config.js", "/marcs/scramjet.all.js");
importScripts(__uv$config.sw || "/vu/uv.sw.js");

const uv = new UVServiceWorker();

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const sj = new ScramjetServiceWorker();

self.addEventListener("fetch", function (event) {
    event.respondWith(
        (async () => {
            await sj.loadConfig();

            const url = event.request.url;

            // Route to appropriate proxy handler
            // Both UV and Scramjet handle CAPTCHA requests properly when given the original event
            if (url.startsWith(location.origin + __uv$config.prefix)) {
                return await uv.fetch(event);
            } else if (sj.route(event)) {
                return await sj.fetch(event);
            } else {
                // For non-proxied requests, use the original request to avoid stream issues
                return await fetch(event.request);
            }
        })()
    );
});
