import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import { StoreManager } from "./storage";
import { initializeCaptchaHandlers } from "./captcha-handler";
import {
    getPreconfiguredSettings,
    isPreconfiguredSitesEnabled,
    isDynamicLoadingEnabled,
    DynamicLoadingHandler,
    resetConfigurationAttempts
} from "./experimental";

// Cache for URL encoding to avoid redundant computations
const urlEncodingCache = new Map<string, string>();
const URL_CACHE_MAX_SIZE = 500;
const URL_CACHE_EVICT_COUNT = 50; // Evict 10% of cache

// Cache for transport settings to avoid redundant storage reads
let cachedTransportSettings: {
    transport?: string;
    routingMode?: string;
    wispServer?: string;
    adBlock?: string;
    lastUpdate: number;
} | null = null;
const TRANSPORT_CACHE_TTL = 5000; // 5 seconds

const createScript = (src: string, defer?: boolean): HTMLScriptElement => {
    // Check if script already exists to avoid duplicate loading
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
        return existingScript as HTMLScriptElement;
    }

    const script = document.createElement("script") as HTMLScriptElement;
    script.src = src;
    if (defer) script.defer = defer;
    // Add async loading for better performance
    script.async = false; // Keep execution order
    return document.body.appendChild(script);
};

/**
 * This class automatically sets up and handles lots of stuff for us.
 *
 * It registers/fixes errors with SW reg
 * It creates our bareMux worker
 * And other stuff.
 *
 * @example
 * import { SW } from "@utils/proxy.ts";
 * const handler = new SW();
 * //Consume the methods
 * // Or if an instance is already running
 * import { SW } from "@utils/proxy.ts";
 * const handler = SW.getInstance();
 * //Consume the methods
 */
class SW {
    #baremuxConn?: BareMuxConnection;
    #scramjetController?: ScramjetController;
    #serviceWorker?: ServiceWorkerRegistration;
    #storageManager: StoreManager<"radius||settings">;
    #ready: Promise<void>;
    #dynamicLoadingHandler?: DynamicLoadingHandler;
    static #instance = new Set();

    static *getInstance() {
        for (const val of SW.#instance.keys()) {
            yield val as SW;
        }
    }

    /**
     * Returns a promise that resolves when the SW instance is ready to use
     */
    ready(): Promise<void> {
        return this.#ready;
    }

    search(input: string, template: string) {
        try {
            return new URL(input).toString();
        } catch (_) {}

        try {
            const url = new URL(`http://${input}`);
            if (url.hostname.includes(".")) return url.toString();
        } catch (_) {}

        return template.replace("%s", encodeURIComponent(input));
    }

    /**
     * Apply preconfigured settings for a URL if available and enabled
     */
    async applyPreconfiguredSettings(url: string): Promise<boolean> {
        if (!isPreconfiguredSitesEnabled()) return false;

        const settings = getPreconfiguredSettings(url);
        if (!settings) return false;

        // Apply the preconfigured settings
        this.#storageManager.setVal("proxy", settings.proxy);

        if (settings.routingMode) {
            await this.routingMode(settings.routingMode, false);
        }

        if (settings.transport) {
            await this.setTransport(settings.transport);
        } else {
            await this.setTransport();
        }

        this.#invalidateTransportCache();
        return true;
    }

    encodeURL(string: string): string {
        // Check cache first
        const cacheKey = `${this.#storageManager.getVal("proxy") || "uv"}:${string}`;
        const cached = urlEncodingCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const proxy = this.#storageManager.getVal("proxy") as "uv" | "sj";
        const input = this.search(string, this.#storageManager.getVal("searchEngine"));
        const encoded =
            proxy === "uv"
                ? `${__uv$config.prefix}${__uv$config.encodeUrl!(input)}`
                : this.#scramjetController!.encodeUrl(input);

        // Cache the result with iterator-based eviction
        if (urlEncodingCache.size >= URL_CACHE_MAX_SIZE) {
            // Remove oldest entries using iterator to avoid array allocation
            let evicted = 0;
            for (const key of urlEncodingCache.keys()) {
                if (evicted >= URL_CACHE_EVICT_COUNT) break;
                urlEncodingCache.delete(key);
                evicted++;
            }
        }
        urlEncodingCache.set(cacheKey, encoded);

        return encoded;
    }

    /**
     * Encode URL with experimental features support
     * This method applies preconfigured settings if enabled before encoding
     */
    async encodeURLWithExperiments(url: string): Promise<string> {
        // Reset configuration attempts for new URL
        resetConfigurationAttempts(url);

        // Apply preconfigured settings if available
        await this.applyPreconfiguredSettings(url);

        // Start dynamic loading if enabled
        if (isDynamicLoadingEnabled() && !this.#dynamicLoadingHandler) {
            this.#dynamicLoadingHandler = new DynamicLoadingHandler();
            this.#dynamicLoadingHandler.start(
                async (config) => {
                    // Apply new configuration
                    this.#storageManager.setVal("proxy", config.proxy);
                    await this.routingMode(config.routingMode, false);
                    if (config.transport) {
                        await this.setTransport(config.transport);
                    } else {
                        await this.setTransport();
                    }
                    this.#invalidateTransportCache();
                    // Clear URL cache to re-encode with new settings
                    urlEncodingCache.clear();
                },
                () => {
                    // All configurations failed - redirect to 404
                    window.location.href = "/404";
                }
            );
        }

        return this.encodeURL(url);
    }

    // Helper method to get cached transport settings
    #getTransportSettings() {
        const now = Date.now();
        if (
            cachedTransportSettings &&
            now - cachedTransportSettings.lastUpdate < TRANSPORT_CACHE_TTL
        ) {
            return cachedTransportSettings;
        }

        cachedTransportSettings = {
            transport: this.#storageManager.getVal("transport"),
            routingMode: this.#storageManager.getVal("routingMode"),
            wispServer: this.#storageManager.getVal("wispServer"),
            adBlock: this.#storageManager.getVal("adBlock"),
            lastUpdate: now
        };

        return cachedTransportSettings;
    }

    // Invalidate transport cache when settings change
    #invalidateTransportCache() {
        cachedTransportSettings = null;
    }

    async setTransport(transport?: "epoxy" | "libcurl", get?: boolean) {
        const settings = this.#getTransportSettings();
        const routingMode = settings.routingMode || "wisp";

        const wispServer = (): string => {
            const wispServerVal =
                settings.wispServer ||
                (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/";
            if (settings.adBlock === "true") {
                return wispServerVal.replace("/wisp/", "/adblock/");
            }
            return wispServerVal;
        };
        const bareServer = (): string => {
            return (
                (location.protocol === "https:" ? "https://" : "http://") + location.host + "/bare/"
            );
        };
        if (get) return settings.transport;

        const newTransport = transport || settings.transport || "epoxy";
        this.#storageManager.setVal("transport", newTransport);
        this.#invalidateTransportCache();

        if (routingMode === "bare") {
            // Use bare server transport
            await this.#baremuxConn!.setTransport("/baremod/index.mjs", [bareServer()]);
        } else {
            // Use wisp server transport (default)
            // Optimize transport path selection
            const transportPath =
                newTransport === "libcurl" ? "/libcurl/index.mjs" : "/epoxy/index.mjs";
            await this.#baremuxConn!.setTransport(transportPath, [{ wisp: wispServer() }]);
        }
    }

    async routingMode(mode?: "wisp" | "bare", set?: true) {
        this.#storageManager.setVal(
            "routingMode",
            mode || this.#storageManager.getVal("routingMode") || "wisp"
        );
        this.#invalidateTransportCache();
        if (set) await this.setTransport();
    }

    async wispServer(wispServer?: string, set?: true) {
        this.#storageManager.setVal(
            "wispServer",
            wispServer ||
                this.#storageManager.getVal("wispServer") ||
                (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/"
        );
        this.#invalidateTransportCache();
        if (set) await this.setTransport();
    }

    constructor() {
        SW.#instance.add(this);
        this.#storageManager = new StoreManager("radius||settings");

        // Optimized script loading check with debounced interval
        const checkScripts = (): Promise<void> => {
            return new Promise((resolve) => {
                // Use a reasonable interval (16ms = ~60fps) instead of default
                const t = setInterval(() => {
                    if (
                        typeof __uv$config !== "undefined" &&
                        typeof $scramjetLoadController !== "undefined"
                    ) {
                        clearInterval(t);
                        resolve();
                    }
                }, 16);
            });
        };

        // Load scripts in optimal order
        createScript("/vu/uv.bundle.js", true);
        createScript("/vu/uv.config.js", true);
        createScript("/marcs/scramjet.all.js", true);

        this.#ready = checkScripts().then(async () => {
            this.#baremuxConn = new BareMuxConnection("/erab/worker.js");
            await this.setTransport();

            // Load the ScramjetController class from the factory function
            const { ScramjetController } = $scramjetLoadController();

            this.#scramjetController = new ScramjetController({
                prefix: "/~/scramjet/",
                files: {
                    wasm: "/marcs/scramjet.wasm.wasm",
                    all: "/marcs/scramjet.all.js",
                    sync: "/marcs/scramjet.sync.js"
                },
                flags: {
                    rewriterLogs: false,
                    // Enhanced flags for optimal support of complex browser services
                    serviceworkers: true, // Enable service worker support
                    captureErrors: true, // Capture errors for better debugging
                    cleanErrors: false, // Keep error messages for debugging
                    strictRewrites: false, // Allow flexible rewrites for complex sites
                    syncxhr: true, // Enable synchronous XHR for complex callbacks
                    scramitize: true, // Enable advanced domain handling
                    allowFailedIntercepts: true // Continue on failed intercepts for better compatibility
                }
            });
            if ("serviceWorker" in navigator) {
                await this.#scramjetController.init();
                navigator.serviceWorker.ready.then(async (reg) => {
                    this.#serviceWorker = reg;

                    // Initialize CAPTCHA handlers for automatic verification support
                    initializeCaptchaHandlers();
                });
                navigator.serviceWorker.register("/sw.js", { scope: "/" });
            } else {
                throw new Error(
                    "Your browser is not supported! This website uses Service Workers heavily."
                );
            }
        });
    }
}

export { SW };
