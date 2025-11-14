/**
 * Site-specific optimizations for improved compatibility
 * This module provides optimized configurations for specific websites
 */

interface SiteConfig {
    domains: string[];
    preferredProxy?: "uv" | "sj";
    preferredTransport?: "epoxy" | "libcurl";
    preferredRoutingMode?: "wisp" | "bare";
    requiresSpecialHandling?: boolean;
}

/**
 * Site-specific configurations for improved compatibility
 * Websites that require special handling or specific proxy configurations
 */
const SITE_CONFIGS: SiteConfig[] = [
    {
        // Cloud gaming platforms often require WebSocket support and low latency
        domains: ["now.gg", "www.now.gg"],
        preferredProxy: "sj", // Scramjet often works better for complex web apps
        preferredTransport: "epoxy", // Epoxy provides better WebSocket support
        preferredRoutingMode: "wisp",
        requiresSpecialHandling: true
    },
    {
        // Discord and similar real-time apps
        domains: ["discord.com", "www.discord.com"],
        preferredProxy: "sj",
        preferredTransport: "epoxy",
        preferredRoutingMode: "wisp",
        requiresSpecialHandling: true
    },
    {
        // Streaming platforms
        domains: ["youtube.com", "www.youtube.com", "twitch.tv", "www.twitch.tv"],
        preferredProxy: "sj",
        preferredTransport: "libcurl",
        preferredRoutingMode: "wisp",
        requiresSpecialHandling: true
    },
    {
        // General cloud gaming platforms
        domains: ["geforce.com", "www.geforce.com", "stadia.google.com"],
        preferredProxy: "sj",
        preferredTransport: "epoxy",
        preferredRoutingMode: "wisp",
        requiresSpecialHandling: true
    }
];

/**
 * Get optimal configuration for a given URL
 * @param url The URL to check
 * @returns Site configuration if found, null otherwise
 */
export function getSiteConfig(url: string): SiteConfig | null {
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();

        for (const config of SITE_CONFIGS) {
            for (const domain of config.domains) {
                if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                    return config;
                }
            }
        }
    } catch (error) {
        console.error("Error parsing URL for site config:", error);
    }

    return null;
}

/**
 * Apply site-specific optimizations if available
 * @param url The URL to optimize for
 * @param currentProxy Current proxy setting
 * @param currentTransport Current transport setting
 * @param currentRoutingMode Current routing mode
 * @returns Optimized settings or current settings if no optimization available
 */
export function applySiteOptimizations(
    url: string,
    currentProxy: "uv" | "sj",
    currentTransport: "epoxy" | "libcurl",
    currentRoutingMode: "wisp" | "bare"
): {
    proxy: "uv" | "sj";
    transport: "epoxy" | "libcurl";
    routingMode: "wisp" | "bare";
    optimized: boolean;
} {
    const siteConfig = getSiteConfig(url);

    if (siteConfig?.requiresSpecialHandling) {
        console.log(`Applying optimizations for ${url}`);
        return {
            proxy: siteConfig.preferredProxy || currentProxy,
            transport: siteConfig.preferredTransport || currentTransport,
            routingMode: siteConfig.preferredRoutingMode || currentRoutingMode,
            optimized: true
        };
    }

    return {
        proxy: currentProxy,
        transport: currentTransport,
        routingMode: currentRoutingMode,
        optimized: false
    };
}

/**
 * Check if a URL requires special handling
 * @param url The URL to check
 * @returns True if special handling is required
 */
export function requiresSpecialHandling(url: string): boolean {
    const config = getSiteConfig(url);
    return config?.requiresSpecialHandling || false;
}
