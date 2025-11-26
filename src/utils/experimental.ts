/**
 * Experimental Features Module
 *
 * This module implements the experimental features for the proxy:
 * 1. Preconfigured Sites - Automatically use optimal proxy configurations for known problematic sites
 * 2. Dynamic Loading - Monitor for errors and automatically try different configurations
 */

import { StoreManager } from "./storage";

// Preconfigured sites with their optimal proxy settings
// Format: { domain: { proxy: "uv" | "sj", routingMode: "wisp" | "bare", transport?: "epoxy" | "libcurl" } }
export const PRECONFIGURED_SITES: Record<
    string,
    {
        proxy: "uv" | "sj";
        routingMode: "wisp" | "bare";
        transport?: "epoxy" | "libcurl";
        reason?: string;
    }
> = {
    // E-commerce sites that work better with Scramjet + Bare
    "amazon.com": {
        proxy: "sj",
        routingMode: "bare",
        reason: "Complex cookie handling and bot detection"
    },
    "amazon.co.uk": { proxy: "sj", routingMode: "bare", reason: "Regional Amazon variant" },
    "amazon.de": { proxy: "sj", routingMode: "bare", reason: "Regional Amazon variant" },
    "ebay.com": {
        proxy: "sj",
        routingMode: "bare",
        reason: "Heavy JavaScript and session management"
    },
    "walmart.com": { proxy: "sj", routingMode: "bare", reason: "Bot detection systems" },

    // Social media that works better with Ultraviolet
    "twitter.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "WebSocket-heavy application"
    },
    "x.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "WebSocket-heavy application"
    },
    "instagram.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "Media-heavy with complex API"
    },
    "facebook.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "Complex single-page application"
    },

    // Video streaming sites
    "youtube.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "libcurl",
        reason: "Video streaming optimization"
    },
    "netflix.com": { proxy: "sj", routingMode: "bare", reason: "DRM and authentication" },
    "twitch.tv": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "WebSocket-based chat and streaming"
    },

    // Gaming sites
    "discord.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "WebSocket-heavy for real-time communication"
    },
    "roblox.com": { proxy: "sj", routingMode: "bare", reason: "Complex game client requirements" },

    // Search engines
    "google.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "Standard web search"
    },
    "bing.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "Standard web search"
    },
    "duckduckgo.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "Privacy-focused search"
    },

    // News and content sites
    "reddit.com": {
        proxy: "uv",
        routingMode: "wisp",
        transport: "epoxy",
        reason: "Single-page application with infinite scroll"
    },
    "medium.com": { proxy: "uv", routingMode: "wisp", reason: "Content-focused site" },
    "wikipedia.org": { proxy: "uv", routingMode: "wisp", reason: "Simple content delivery" }
};

// Configuration attempt order for dynamic loading
export const CONFIGURATION_ATTEMPTS = [
    { proxy: "uv" as const, routingMode: "wisp" as const, transport: "epoxy" as const },
    { proxy: "uv" as const, routingMode: "wisp" as const, transport: "libcurl" as const },
    { proxy: "sj" as const, routingMode: "wisp" as const, transport: "epoxy" as const },
    { proxy: "sj" as const, routingMode: "bare" as const },
    { proxy: "uv" as const, routingMode: "bare" as const }
];

/**
 * Extract the domain from a URL
 */
export function extractDomain(url: string): string | null {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, "");
    } catch {
        // Try to extract domain from partial URL
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
        return match ? match[1].replace(/^www\./, "") : null;
    }
}

/**
 * Get the preconfigured settings for a URL if available
 */
export function getPreconfiguredSettings(url: string): (typeof PRECONFIGURED_SITES)[string] | null {
    const domain = extractDomain(url);
    if (!domain) return null;

    // Check exact match first
    if (PRECONFIGURED_SITES[domain]) {
        return PRECONFIGURED_SITES[domain];
    }

    // Check for subdomain matches
    for (const configuredDomain of Object.keys(PRECONFIGURED_SITES)) {
        if (domain.endsWith("." + configuredDomain) || domain === configuredDomain) {
            return PRECONFIGURED_SITES[configuredDomain];
        }
    }

    return null;
}

/**
 * Check if preconfigured sites feature is enabled
 */
export function isPreconfiguredSitesEnabled(): boolean {
    const storage = new StoreManager<"radius||settings">("radius||settings");
    return storage.getVal("experimentPreconfiguredSites") === "true";
}

/**
 * Check if dynamic loading feature is enabled
 */
export function isDynamicLoadingEnabled(): boolean {
    const storage = new StoreManager<"radius||settings">("radius||settings");
    return storage.getVal("experimentDynamicLoading") === "true";
}

// Track current configuration attempt index for dynamic loading
let currentAttemptIndex = 0;
let lastFailedUrl = "";

/**
 * Get the next configuration to try for dynamic loading
 * Returns null if all configurations have been tried
 */
export function getNextConfiguration(): (typeof CONFIGURATION_ATTEMPTS)[number] | null {
    if (currentAttemptIndex >= CONFIGURATION_ATTEMPTS.length) {
        return null;
    }
    return CONFIGURATION_ATTEMPTS[currentAttemptIndex++];
}

/**
 * Reset the configuration attempt counter
 */
export function resetConfigurationAttempts(url?: string): void {
    if (url !== lastFailedUrl) {
        currentAttemptIndex = 0;
        lastFailedUrl = url || "";
    }
}

/**
 * Check if all configurations have been exhausted
 */
export function allConfigurationsExhausted(): boolean {
    return currentAttemptIndex >= CONFIGURATION_ATTEMPTS.length;
}

// Error patterns that indicate a configuration issue
const ERROR_PATTERNS = [
    "Failed to fetch",
    "NetworkError",
    "net::ERR_",
    "TypeError: Failed to fetch",
    "AbortError",
    "Connection refused",
    "CORS error",
    "blocked by CORS",
    "WebSocket connection failed",
    "Service Worker Error"
];

/**
 * Check if an error message indicates a configuration issue
 */
export function isConfigurationError(errorMessage: string): boolean {
    const lowerMessage = errorMessage.toLowerCase();
    return ERROR_PATTERNS.some((pattern) => lowerMessage.includes(pattern.toLowerCase()));
}

/**
 * Dynamic loading error handler class
 * Monitors console errors and triggers configuration changes
 */
export class DynamicLoadingHandler {
    private storage: StoreManager<"radius||settings">;
    private originalConsoleError: typeof console.error;
    private errorCount: number = 0;
    private readonly ERROR_THRESHOLD = 3;
    private readonly ERROR_WINDOW = 5000; // 5 seconds
    private lastErrorTime: number = 0;
    private isActive: boolean = false;
    private onConfigChange?: (config: (typeof CONFIGURATION_ATTEMPTS)[number]) => Promise<void>;
    private onAllFailed?: () => void;

    constructor() {
        this.storage = new StoreManager<"radius||settings">("radius||settings");
        this.originalConsoleError = console.error;
    }

    /**
     * Start monitoring for errors
     */
    start(
        onConfigChange: (config: (typeof CONFIGURATION_ATTEMPTS)[number]) => Promise<void>,
        onAllFailed: () => void
    ): void {
        if (this.isActive) return;
        this.isActive = true;
        this.onConfigChange = onConfigChange;
        this.onAllFailed = onAllFailed;

        // Override console.error to catch proxy errors
        console.error = (...args: any[]) => {
            this.originalConsoleError.apply(console, args);
            this.handleError(args.map((a) => String(a)).join(" "));
        };

        // Listen for unhandled errors
        window.addEventListener("error", this.handleWindowError);
        window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
    }

    /**
     * Stop monitoring for errors
     */
    stop(): void {
        if (!this.isActive) return;
        this.isActive = false;

        console.error = this.originalConsoleError;
        window.removeEventListener("error", this.handleWindowError);
        window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
    }

    private handleWindowError = (event: ErrorEvent): void => {
        this.handleError(event.message);
    };

    private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
        this.handleError(String(event.reason));
    };

    private handleError(message: string): void {
        if (!isConfigurationError(message)) return;

        const now = Date.now();

        // Reset error count if outside the window
        if (now - this.lastErrorTime > this.ERROR_WINDOW) {
            this.errorCount = 0;
        }

        this.errorCount++;
        this.lastErrorTime = now;

        // If we've hit the threshold, try a new configuration
        if (this.errorCount >= this.ERROR_THRESHOLD) {
            this.errorCount = 0;
            this.tryNextConfiguration();
        }
    }

    private async tryNextConfiguration(): Promise<void> {
        const nextConfig = getNextConfiguration();

        if (nextConfig && this.onConfigChange) {
            await this.onConfigChange(nextConfig);
        } else if (this.onAllFailed) {
            this.onAllFailed();
        }
    }
}
