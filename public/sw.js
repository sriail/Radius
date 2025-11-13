importScripts("/vu/uv.bundle.js", "/vu/uv.config.js", "/marcs/scramjet.all.js");
importScripts(__uv$config.sw || "/vu/uv.sw.js");

const uv = new UVServiceWorker();

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const sj = new ScramjetServiceWorker();

// Helper function to inject cloak interceptor into HTML responses
async function injectCloakInterceptor(response) {
    if (!response.headers.get('content-type')?.includes('text/html')) {
        return response;
    }

    try {
        const text = await response.text();
        // Inject our cloak interceptor script right after <head> or at the beginning of <html>
        let modifiedHtml = text;
        
        const scriptTag = '<script src="/cloak-interceptor.js" defer></script>';
        
        if (text.includes('<head>')) {
            modifiedHtml = text.replace('<head>', '<head>' + scriptTag);
        } else if (text.includes('<html>')) {
            modifiedHtml = text.replace('<html>', '<html><head>' + scriptTag + '</head>');
        } else {
            // If no proper HTML structure, prepend the script
            modifiedHtml = scriptTag + text;
        }

        return new Response(modifiedHtml, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    } catch (e) {
        console.error('Failed to inject cloak interceptor:', e);
        return response;
    }
}

self.addEventListener("fetch", function (event) {
    event.respondWith(
        (async () => {
            await sj.loadConfig();
            let response;
            
            if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
                response = await uv.fetch(event);
            } else if (sj.route(event)) {
                response = await sj.fetch(event);
            } else {
                return await fetch(event.request);
            }
            
            // Inject the cloak interceptor into proxied HTML responses
            return await injectCloakInterceptor(response);
        })()
    );
});
