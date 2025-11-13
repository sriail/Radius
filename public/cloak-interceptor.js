// Radius Cloak Interceptor
// This script intercepts window.open calls to apply cloaking when active
(function() {
    'use strict';
    
    // Only run if we're in a proxied context (has __uv or $scramjet)
    if (!window.__uv && !window.$scramjet) {
        return;
    }

    // Get the cloaking mode from localStorage
    const getCloakMode = () => {
        try {
            return localStorage.getItem("radius||settings||cloakMode");
        } catch (e) {
            return null;
        }
    };

    const cloakMode = getCloakMode();
    
    if (!cloakMode || cloakMode === "none") {
        return; // No cloaking active
    }

    // Store the original window.open
    const originalOpen = window.open;

    // Override window.open
    window.open = function(url, target, features) {
        // If opening in a specific named target, use original behavior
        // This preserves authentication flows that rely on specific window names
        if (target && target !== "_blank" && target !== "") {
            return originalOpen.call(this, url, target, features);
        }

        // Get the URL to open
        let urlToOpen = "";
        if (url) {
            urlToOpen = typeof url === "string" ? url : url.toString();
        }

        // Apply the cloaking method
        if (cloakMode === "aboutBlank") {
            const win = originalOpen.call(this);
            if (!win) return null;

            // Create the about:blank cloaked window
            win.document.body.setAttribute("style", "margin: 0; height: 100vh; width: 100%;");
            const iframe = win.document.createElement("iframe");
            iframe.setAttribute("style", "border: none; width: 100%; height: 100%; margin: 0;");
            
            // Set the iframe source to the requested URL
            if (urlToOpen) {
                iframe.src = urlToOpen;
            }
            
            win.document.body.appendChild(iframe);
            return win;
        } else if (cloakMode === "blob") {
            const win = originalOpen.call(this);
            if (!win) return null;

            // Create the blob cloaked window
            const content = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <style type="text/css">
                            body, html {
                                margin: 0;
                                padding: 0;
                                height: 100%;
                                width: 100%;
                                overflow: hidden;
                            }
                        </style>
                    </head>
                    <body>
                        <iframe style="border: none; width: 100%; height: 100%;" src="${urlToOpen || ''}"></iframe>
                    </body>
                </html>
            `;
            const blob = new Blob([content], { type: "text/html" });
            const blobUrl = URL.createObjectURL(blob);
            win.location.href = blobUrl;
            return win;
        }

        // Fallback to original behavior
        return originalOpen.call(this, url, target, features);
    };

    // Preserve the original function properties
    Object.defineProperty(window.open, 'name', { value: 'open' });
})();
