/**
 * PostMessage Fix Utility
 *
 * This module provides utilities to fix postMessage handling for CAPTCHA providers
 * and cross-origin communication. It prevents DataCloneError when MessagePorts
 * are not properly transferred.
 */

/**
 * Filter transferable objects to ensure only valid ones are included
 * This prevents DataCloneError when invalid objects are passed to postMessage
 *
 * @param transfer - Array of potential transferable objects
 * @returns Array of valid transferable objects
 */
export function filterValidTransferables(transfer: Transferable[]): Transferable[] {
    return transfer.filter((item) => {
        // Check for valid transferable types
        return (
            item instanceof ArrayBuffer ||
            item instanceof MessagePort ||
            (typeof ImageBitmap !== "undefined" && item instanceof ImageBitmap) ||
            (typeof OffscreenCanvas !== "undefined" && item instanceof OffscreenCanvas) ||
            (typeof ReadableStream !== "undefined" && item instanceof ReadableStream) ||
            (typeof WritableStream !== "undefined" && item instanceof WritableStream) ||
            (typeof TransformStream !== "undefined" && item instanceof TransformStream)
        );
    });
}

/**
 * Fix postMessage to properly handle MessagePort transfers
 * This prevents DataCloneError when CAPTCHA providers communicate between frames
 *
 * @param targetWindow - The window object to fix postMessage on
 */
export function fixPostMessage(targetWindow: Window): void {
    if (!targetWindow || !targetWindow.postMessage) return;

    try {
        // Store the original postMessage
        const originalPostMessage = targetWindow.postMessage.bind(targetWindow);

        // Create a wrapper that properly handles MessagePort transfers
        targetWindow.postMessage = function (
            message: any,
            targetOriginOrOptions?: string | WindowPostMessageOptions,
            transfer?: Transferable[]
        ) {
            try {
                // Handle both function signatures:
                // postMessage(message, targetOrigin, transfer)
                // postMessage(message, options)
                if (
                    typeof targetOriginOrOptions === "object" &&
                    targetOriginOrOptions !== null &&
                    !Array.isArray(targetOriginOrOptions)
                ) {
                    // New signature with options object
                    const options = { ...targetOriginOrOptions } as WindowPostMessageOptions;

                    // Ensure transfer array contains only valid transferables
                    if (options.transfer && Array.isArray(options.transfer)) {
                        options.transfer = filterValidTransferables(options.transfer);
                    }

                    return originalPostMessage(message, options);
                }

                // Old signature with targetOrigin string
                const targetOrigin =
                    typeof targetOriginOrOptions === "string" ? targetOriginOrOptions : "*";

                // Filter transfer array to only include valid transferables
                const validTransfer =
                    transfer && Array.isArray(transfer)
                        ? filterValidTransferables(transfer)
                        : undefined;

                return originalPostMessage(message, targetOrigin, validTransfer);
            } catch (error) {
                // If the call fails with DataCloneError, try without transfer
                if (error instanceof DOMException && error.name === "DataCloneError") {
                    console.warn(
                        "[PostMessage Fix] postMessage failed with DataCloneError, retrying without transfer"
                    );
                    try {
                        if (
                            typeof targetOriginOrOptions === "object" &&
                            targetOriginOrOptions !== null
                        ) {
                            const fallbackOptions = {
                                ...targetOriginOrOptions
                            } as WindowPostMessageOptions;
                            delete fallbackOptions.transfer;
                            return originalPostMessage(message, fallbackOptions);
                        }
                        const fallbackOrigin =
                            typeof targetOriginOrOptions === "string" ? targetOriginOrOptions : "*";
                        return originalPostMessage(message, fallbackOrigin);
                    } catch (retryError) {
                        console.error("[PostMessage Fix] postMessage retry failed:", retryError);
                        throw retryError;
                    }
                }
                throw error;
            }
        };
    } catch (e) {
        // If we can't override postMessage (e.g., cross-origin), that's fine
        console.warn("[PostMessage Fix] Could not fix postMessage:", e);
    }
}
