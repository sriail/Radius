/**
 * Popup Interceptor Script
 * This script is injected into proxied pages to intercept window.open calls
 * and redirect them to the parent iframe instead of opening new tabs/windows.
 *
 * The script only runs in iframe contexts and intercepts popups that would
 * normally open in new tabs/windows (target="_blank", "_new", or empty).
 */

(function () {
    "use strict";

    // Only run if we're in an iframe
    if (window.self === window.top) {
        return;
    }

    // Store the original window.open function
    const originalWindowOpen = window.open;

    // Override window.open to intercept popup attempts
    window.open = function (url, target, features) {
        console.log("[Radius] Intercepting window.open:", url, target);

        // If target is _blank, _new, or not specified, intercept it
        if (!target || target === "_blank" || target === "_new" || target === "") {
            // Send message to parent window to open the URL in the main iframe
            try {
                window.top.postMessage(
                    {
                        type: "radius-popup-intercept",
                        url: url ? url.toString() : ""
                    },
                    "*"
                );

                console.log("[Radius] Popup intercepted and sent to parent");

                // Return null since we're not actually opening a new window
                return null;
            } catch (e) {
                console.error("[Radius] Failed to send popup intercept message:", e);
                // Fallback to original behavior if messaging fails
                return originalWindowOpen.call(this, url, target, features);
            }
        }

        // For other targets (like named frames), use the original function
        return originalWindowOpen.call(this, url, target, features);
    };

    console.log("[Radius] Popup interceptor initialized");
})();
