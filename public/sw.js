importScripts("/vu/uv.bundle.js", "/vu/uv.config.js", "/marcs/scramjet.all.js");
importScripts(__uv$config.sw || "/vu/uv.sw.js");

const uv = new UVServiceWorker();

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const sj = new ScramjetServiceWorker();

self.addEventListener("fetch", function (event) {
    event.respondWith(
        (async () => {
            try {
                await sj.loadConfig();
                if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
                    return await uv.fetch(event);
                } else if (sj.route(event)) {
                    return await sj.fetch(event);
                } else {
                    return await fetch(event.request);
                }
            } catch (err) {
                console.error("Service worker fetch error:", err);
                // Return a proper error response instead of letting it fail silently
                return new Response("Service Worker Error", {
                    status: 500,
                    statusText: "Internal Service Worker Error"
                });
            }
        })()
    );
});
