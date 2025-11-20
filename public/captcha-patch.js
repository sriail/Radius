/**
 * CAPTCHA Compatibility Patch
 * This script must be loaded BEFORE UV handler to fix MessagePort handling in postMessage
 *
 * Fixes the error: "DataCloneError: Failed to execute 'postMessage' on 'Window':
 * A MessagePort could not be cloned because it was not transferred."
 */

(function () {
    "use strict";

    // Only run once
    if (window.__captchaPatchApplied) return;
    window.__captchaPatchApplied = true;

    // Store the original postMessage method
    const originalWindowPostMessage = Window.prototype.postMessage;

    /**
     * Enhanced postMessage that properly handles MessagePort transfers
     * This is critical for CAPTCHA systems (reCAPTCHA, hCaptcha, Cloudflare Turnstile, Yandex)
     */
    Window.prototype.postMessage = function (message, targetOrigin, transfer) {
        try {
            // If transfer is already provided, use it directly
            if (transfer !== undefined) {
                return originalWindowPostMessage.call(this, message, targetOrigin, transfer);
            }

            // Extract MessagePorts from the message to transfer them properly
            const ports = [];

            if (message && typeof message === "object") {
                // Recursively find MessagePorts in the message
                const findPorts = (obj, visited) => {
                    if (!obj || typeof obj !== "object") return;

                    // Avoid circular references
                    visited = visited || new WeakSet();
                    if (visited.has(obj)) return;
                    visited.add(obj);

                    // Check if this is a MessagePort
                    if (obj instanceof MessagePort) {
                        ports.push(obj);
                        return;
                    }

                    // Check arrays
                    if (Array.isArray(obj)) {
                        for (let i = 0; i < obj.length; i++) {
                            findPorts(obj[i], visited);
                        }
                        return;
                    }

                    // Check object properties
                    for (const key in obj) {
                        try {
                            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                findPorts(obj[key], visited);
                            }
                        } catch (e) {
                            // Ignore errors accessing properties (e.g., cross-origin)
                        }
                    }
                };

                findPorts(message);
            }

            // If we found MessagePorts, transfer them
            if (ports.length > 0) {
                return originalWindowPostMessage.call(this, message, targetOrigin, ports);
            }

            // Otherwise, use the original call
            return originalWindowPostMessage.call(this, message, targetOrigin);
        } catch (error) {
            // If our enhanced version fails, try the original
            console.warn("[CAPTCHA Patch] Enhanced postMessage failed, using fallback:", error);
            try {
                return originalWindowPostMessage.call(this, message, targetOrigin, transfer);
            } catch (fallbackError) {
                console.error("[CAPTCHA Patch] Original postMessage also failed:", fallbackError);
                throw fallbackError;
            }
        }
    };

    // Mark the patched method to prevent UV from breaking it
    Window.prototype.postMessage.__captchaPatched = true;

    console.log("[CAPTCHA Patch] MessagePort handling enabled for CAPTCHA compatibility");
})();
