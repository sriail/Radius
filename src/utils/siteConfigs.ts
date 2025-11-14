/**
 * Site-specific proxy configurations
 * This file contains optimized configurations for difficult-to-load or popular sites
 */

export interface SiteConfig {
    domains: string[];
    proxy: "uv" | "sj";
    transport: "epoxy" | "libcurl";
    routingMode: "wisp" | "bare";
    description: string;
}

/**
 * Database of site-specific configurations
 * These configs are optimized for specific sites that are known to be difficult to proxy
 */
export const SITE_CONFIGS: Record<string, SiteConfig> = {
    nowgg: {
        domains: ["now.gg", "www.now.gg"],
        proxy: "sj",
        transport: "epoxy",
        routingMode: "wisp",
        description: "Cloud gaming platform - requires Scramjet proxy with Epoxy transport"
    },
    easyfungg: {
        domains: ["easyfun.gg", "www.easyfun.gg"],
        proxy: "sj",
        transport: "epoxy",
        routingMode: "wisp",
        description: "Gaming platform - optimized with Scramjet and Epoxy"
    },
    discord: {
        domains: ["discord.com", "www.discord.com", "discordapp.com"],
        proxy: "sj",
        transport: "epoxy",
        routingMode: "wisp",
        description: "Discord - requires Scramjet for WebSocket support"
    },
    youtube: {
        domains: ["youtube.com", "www.youtube.com", "m.youtube.com"],
        proxy: "uv",
        transport: "libcurl",
        routingMode: "wisp",
        description: "YouTube - optimized with Ultraviolet and Libcurl"
    },
    spotify: {
        domains: ["spotify.com", "www.spotify.com", "open.spotify.com"],
        proxy: "sj",
        transport: "epoxy",
        routingMode: "wisp",
        description: "Spotify - requires Scramjet for audio streaming"
    },
    twitch: {
        domains: ["twitch.tv", "www.twitch.tv"],
        proxy: "sj",
        transport: "epoxy",
        routingMode: "wisp",
        description: "Twitch - optimized for live streaming with Scramjet"
    },
    roblox: {
        domains: ["roblox.com", "www.roblox.com"],
        proxy: "sj",
        transport: "epoxy",
        routingMode: "wisp",
        description: "Roblox - requires Scramjet for game client support"
    }
};

/**
 * Popular sites that benefit from automatic switching
 */
export const POPULAR_SITES = [
    "now.gg",
    "easyfun.gg",
    "discord.com",
    "youtube.com",
    "twitch.tv",
    "roblox.com",
    "spotify.com"
];

/**
 * Get site configuration for a given URL
 * @param url The URL to check
 * @returns Site configuration if found, undefined otherwise
 */
export function getSiteConfig(url: string): SiteConfig | undefined {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "");

        for (const config of Object.values(SITE_CONFIGS)) {
            for (const domain of config.domains) {
                const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");
                if (hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`)) {
                    return config;
                }
            }
        }
    } catch (_) {
        // Invalid URL, return undefined
    }
    return undefined;
}

/**
 * Check if a URL is for a popular/difficult site
 * @param url The URL to check
 * @returns true if the site is popular/difficult
 */
export function isPopularSite(url: string): boolean {
    return getSiteConfig(url) !== undefined;
}

/**
 * Get all available fallback configurations
 * Returns an array of configs to try in order
 */
export function getFallbackConfigs(): Array<{
    proxy: "uv" | "sj";
    transport: "epoxy" | "libcurl";
    routingMode: "wisp" | "bare";
}> {
    return [
        { proxy: "sj", transport: "epoxy", routingMode: "wisp" },
        { proxy: "uv", transport: "libcurl", routingMode: "wisp" },
        { proxy: "sj", transport: "libcurl", routingMode: "wisp" },
        { proxy: "uv", transport: "epoxy", routingMode: "wisp" },
        { proxy: "uv", transport: "libcurl", routingMode: "bare" },
        { proxy: "sj", transport: "epoxy", routingMode: "bare" }
    ];
}
