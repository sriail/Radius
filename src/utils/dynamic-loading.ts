import { StoreManager } from "./storage";
import { BareMuxConnection } from "@mercuryworkshop/bare-mux";

/**
 * Proxy configuration type
 */
interface ProxyConfig {
    proxy: "uv" | "sj";
    transport: "epoxy" | "libcurl";
    routingMode: "wisp" | "bare";
}

/**
 * Error patterns that indicate a site failed to load completely
 * These are critical errors that prevent page rendering
 */
const CRITICAL_ERROR_PATTERNS: RegExp[] = [
    // JSON parsing errors
    /unexpected\s+token.*json/i,
    /json\s+parse\s+error/i,
    /invalid\s+json/i,
    /unexpected\s+end\s+of\s+json\s+input/i,
    /syntaxerror.*json/i,

    // Network/fetch errors that indicate complete failure
    /failed\s+to\s+fetch/i,
    /networkerror/i,
    /typeerror:\s*failed\s+to\s+fetch/i,
    /load\s+failed/i,
    /net::err_/i,
    /connection\s+refused/i,
    /connection\s+reset/i,
    /connection\s+timed\s+out/i,

    // Proxy-specific errors
    /bare\s+server\s+error/i,
    /wisp\s+connection\s+failed/i,
    /proxy\s+connection\s+failed/i,
    /transport\s+error/i,
    /service\s+worker\s+error/i,

    // Script loading errors (critical for page render)
    /script\s+error/i,
    /failed\s+to\s+load\s+script/i,
    /failed\s+to\s+load\s+resource.*script/i
];

/**
 * Error patterns to ignore (minor errors that don't prevent page loading)
 */
const IGNORED_ERROR_PATTERNS: RegExp[] = [
    // 404 errors for resources (not critical)
    /404\s+not\s+found/i,
    /failed\s+to\s+load\s+resource.*404/i,

    // Analytics/tracking failures
    /analytics/i,
    /tracking/i,
    /beacon/i,
    /telemetry/i,

    // Ad-related failures
    /ads\./i,
    /adservice/i,
    /doubleclick/i,
    /googlesyndication/i,

    // Font loading failures
    /font.*failed/i,
    /woff2?.*failed/i,

    // Image loading failures
    /failed\s+to\s+load\s+resource.*image/i,
    /failed\s+to\s+load\s+resource.*png/i,
    /failed\s+to\s+load\s+resource.*jpg/i,
    /failed\s+to\s+load\s+resource.*gif/i,
    /failed\s+to\s+load\s+resource.*svg/i,

    // Favicon failures
    /favicon/i,

    // CORS errors for non-essential resources
    /cors.*font/i,
    /cors.*image/i
];

/**
 * All possible proxy configurations to try
 */
const PROXY_CONFIGS: ProxyConfig[] = [
    { proxy: "uv", transport: "epoxy", routingMode: "wisp" },
    { proxy: "uv", transport: "libcurl", routingMode: "wisp" },
    { proxy: "uv", transport: "epoxy", routingMode: "bare" },
    { proxy: "sj", transport: "epoxy", routingMode: "wisp" },
    { proxy: "sj", transport: "libcurl", routingMode: "wisp" },
    { proxy: "sj", transport: "epoxy", routingMode: "bare" }
];

/**
 * DynamicLoading class handles automatic proxy configuration switching
 * when a site fails to load due to critical errors.
 *
 * It monitors for errors, maintains site-specific override configurations,
 * and reverts to the original configuration when leaving a site.
 */
class DynamicLoading {
    #storageManager: StoreManager<"radius||settings">;
    #baremuxConn: BareMuxConnection | null = null;
    #currentSite: string | null = null;
    #errorCount: number = 0;
    #configIndex: number = 0;
    #originalConfig: ProxyConfig | null = null;
    #isEnabled: boolean = false;
    #errorBuffer: string[] = [];
    #errorCheckTimeout: number | null = null;
    #siteOverrides: Map<string, number> = new Map(); // Maps site domain to config index
    #originalConsoleError: ((...args: unknown[]) => void) | null = null;
    #errorListenersAttached: boolean = false;

    // Error threshold before switching configs
    static readonly ERROR_THRESHOLD = 3;
    // Debounce time for error checking (ms)
    static readonly DEBOUNCE_TIME = 500;

    constructor() {
        this.#storageManager = new StoreManager("radius||settings");
        this.#isEnabled = this.#storageManager.getVal("experimentDynamicLoading") === "true";
        this.#loadSiteOverrides();
    }

    /**
     * Initialize the dynamic loading system
     */
    async init(baremuxConn: BareMuxConnection): Promise<void> {
        this.#baremuxConn = baremuxConn;
        if (this.#isEnabled) {
            this.#setupErrorListeners();
        }
    }

    /**
     * Check if dynamic loading is enabled
     */
    isEnabled(): boolean {
        return this.#isEnabled;
    }

    /**
     * Enable or disable dynamic loading
     */
    setEnabled(enabled: boolean): void {
        this.#isEnabled = enabled;
        this.#storageManager.setVal("experimentDynamicLoading", enabled.toString());
        if (enabled) {
            this.#setupErrorListeners();
        }
    }

    /**
     * Get the current original configuration
     */
    #getCurrentConfig(): ProxyConfig {
        return {
            proxy: (this.#storageManager.getVal("proxy") as "uv" | "sj") || "uv",
            transport: (this.#storageManager.getVal("transport") as "epoxy" | "libcurl") || "epoxy",
            routingMode: (this.#storageManager.getVal("routingMode") as "wisp" | "bare") || "wisp"
        };
    }

    /**
     * Load site-specific overrides from storage
     */
    #loadSiteOverrides(): void {
        try {
            const stored = this.#storageManager.getVal("dynamicLoadingOverrides");
            if (stored) {
                const parsed = JSON.parse(stored);
                this.#siteOverrides = new Map(
                    Object.entries(parsed)
                        .map(([k, v]) => {
                            const num = parseInt(String(v), 10);
                            return [k, Number.isNaN(num) ? 0 : num];
                        })
                        .filter(([, v]) => typeof v === "number") as [string, number][]
                );
            }
        } catch {
            this.#siteOverrides = new Map();
        }
    }

    /**
     * Save site-specific overrides to storage
     */
    #saveSiteOverrides(): void {
        const obj = Object.fromEntries(this.#siteOverrides);
        this.#storageManager.setVal("dynamicLoadingOverrides", JSON.stringify(obj));
    }

    /**
     * Extract domain from a URL for site identification
     */
    #extractDomain(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return url;
        }
    }

    /**
     * Set up console error listeners to detect critical errors
     */
    #setupErrorListeners(): void {
        // Only attach listeners once
        if (this.#errorListenersAttached) {
            return;
        }
        this.#errorListenersAttached = true;

        // Store and override console.error to capture errors
        this.#originalConsoleError = console.error;
        const self = this;
        console.error = function (...args: unknown[]) {
            self.#originalConsoleError!.apply(console, args);
            if (self.#isEnabled && self.#currentSite) {
                self.#handleError(args.map((a) => String(a)).join(" "));
            }
        };

        // Listen for unhandled errors
        window.addEventListener("error", (event) => {
            if (this.#isEnabled && this.#currentSite) {
                this.#handleError(event.message || String(event.error));
            }
        });

        // Listen for unhandled promise rejections
        window.addEventListener("unhandledrejection", (event) => {
            if (this.#isEnabled && this.#currentSite) {
                this.#handleError(String(event.reason));
            }
        });
    }

    /**
     * Restore original console.error method
     */
    restoreConsoleError(): void {
        if (this.#originalConsoleError) {
            console.error = this.#originalConsoleError;
            this.#originalConsoleError = null;
        }
    }

    /**
     * Check if an error message matches critical error patterns
     */
    #isCriticalError(errorMessage: string): boolean {
        // First check if it should be ignored
        for (const pattern of IGNORED_ERROR_PATTERNS) {
            if (pattern.test(errorMessage)) {
                return false;
            }
        }

        // Then check if it's a critical error
        for (const pattern of CRITICAL_ERROR_PATTERNS) {
            if (pattern.test(errorMessage)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Handle an error and decide whether to switch configurations
     */
    #handleError(errorMessage: string): void {
        if (!this.#isCriticalError(errorMessage)) {
            return;
        }

        this.#errorBuffer.push(errorMessage);

        // Debounce error checking
        if (this.#errorCheckTimeout !== null) {
            clearTimeout(this.#errorCheckTimeout);
        }

        this.#errorCheckTimeout = window.setTimeout(() => {
            this.#processErrorBuffer();
        }, DynamicLoading.DEBOUNCE_TIME);
    }

    /**
     * Process collected errors and decide whether to switch configs
     */
    async #processErrorBuffer(): Promise<void> {
        if (this.#errorBuffer.length >= DynamicLoading.ERROR_THRESHOLD) {
            console.log(
                `[DynamicLoading] Detected ${this.#errorBuffer.length} critical errors, attempting config switch`
            );
            await this.#tryNextConfig();
        }
        this.#errorBuffer = [];
        this.#errorCheckTimeout = null;
    }

    /**
     * Try the next proxy configuration
     */
    async #tryNextConfig(): Promise<boolean> {
        this.#configIndex++;

        if (this.#configIndex >= PROXY_CONFIGS.length) {
            // All configs exhausted, redirect to 404
            console.log("[DynamicLoading] All configurations exhausted, redirecting to 404");
            this.#redirectTo404();
            return false;
        }

        const config = PROXY_CONFIGS[this.#configIndex];
        console.log(
            `[DynamicLoading] Switching to config ${this.#configIndex}: proxy=${config.proxy}, transport=${config.transport}, routingMode=${config.routingMode}`
        );

        await this.#applyConfig(config);

        // Store the working config index for this site
        if (this.#currentSite) {
            const domain = this.#extractDomain(this.#currentSite);
            this.#siteOverrides.set(domain, this.#configIndex);
            this.#saveSiteOverrides();
        }

        return true;
    }

    /**
     * Apply a proxy configuration
     */
    async #applyConfig(config: ProxyConfig): Promise<void> {
        if (!this.#baremuxConn) {
            console.warn("[DynamicLoading] BareMux connection not initialized");
            return;
        }

        const wispServer = (): string => {
            const wispServerVal = this.#storageManager.getVal("wispServer");
            if (this.#storageManager.getVal("adBlock") === "true") {
                return wispServerVal.replace("/wisp/", "/adblock/");
            }
            return wispServerVal;
        };

        const bareServer = (): string => {
            return (
                (location.protocol === "https:" ? "https://" : "http://") + location.host + "/bare/"
            );
        };

        // Set the transport based on routing mode
        if (config.routingMode === "bare") {
            await this.#baremuxConn.setTransport("/baremod/index.mjs", [bareServer()]);
        } else {
            const transportPath =
                config.transport === "libcurl" ? "/libcurl/index.mjs" : "/epoxy/index.mjs";
            await this.#baremuxConn.setTransport(transportPath, [{ wisp: wispServer() }]);
        }

        // Store current config in session for proxy selection
        sessionStorage.setItem("dynamicLoading_proxy", config.proxy);
        sessionStorage.setItem("dynamicLoading_transport", config.transport);
        sessionStorage.setItem("dynamicLoading_routingMode", config.routingMode);
    }

    /**
     * Redirect to the 404 page
     */
    #redirectTo404(): void {
        // Clear current site tracking
        this.#currentSite = null;
        this.#configIndex = 0;
        this.#errorCount = 0;

        // Navigate to 404 page
        window.location.href = "/404";
    }

    /**
     * Called when navigating to a new site - stores original config and applies any overrides
     */
    async onSiteEnter(siteUrl: string): Promise<"uv" | "sj"> {
        if (!this.#isEnabled) {
            return (this.#storageManager.getVal("proxy") as "uv" | "sj") || "uv";
        }

        this.#currentSite = siteUrl;
        this.#errorCount = 0;
        this.#errorBuffer = [];

        // Store original config for later restoration
        this.#originalConfig = this.#getCurrentConfig();

        // Check if we have a stored override for this site
        const domain = this.#extractDomain(siteUrl);
        const overrideIndex = this.#siteOverrides.get(domain);

        if (overrideIndex !== undefined && overrideIndex < PROXY_CONFIGS.length) {
            // Apply the known working config for this site
            this.#configIndex = overrideIndex;
            const config = PROXY_CONFIGS[overrideIndex];
            console.log(
                `[DynamicLoading] Applying saved config for ${domain}: proxy=${config.proxy}`
            );
            await this.#applyConfig(config);
            return config.proxy;
        }

        // Start with first config (index 0)
        this.#configIndex = 0;
        return this.#originalConfig.proxy;
    }

    /**
     * Called when leaving a site - restores original configuration
     */
    async onSiteLeave(): Promise<void> {
        if (!this.#isEnabled || !this.#originalConfig) {
            return;
        }

        console.log("[DynamicLoading] Restoring original configuration");

        // Clear session storage
        sessionStorage.removeItem("dynamicLoading_proxy");
        sessionStorage.removeItem("dynamicLoading_transport");
        sessionStorage.removeItem("dynamicLoading_routingMode");

        // Restore original config
        await this.#applyConfig(this.#originalConfig);

        // Reset state
        this.#resetState();
    }

    /**
     * Synchronous cleanup for use in beforeunload/pagehide handlers
     * Clears session storage without async operations
     */
    cleanupSync(): void {
        if (!this.#isEnabled) {
            return;
        }
        sessionStorage.removeItem("dynamicLoading_proxy");
        sessionStorage.removeItem("dynamicLoading_transport");
        sessionStorage.removeItem("dynamicLoading_routingMode");
        this.#resetState();
    }

    /**
     * Internal state reset helper
     */
    #resetState(): void {
        this.#currentSite = null;
        this.#errorCount = 0;
        this.#configIndex = 0;
        this.#originalConfig = null;
        this.#errorBuffer = [];
    }

    /**
     * Get the currently active proxy type (considering dynamic overrides)
     */
    getActiveProxy(): "uv" | "sj" {
        const override = sessionStorage.getItem("dynamicLoading_proxy");
        if (override === "uv" || override === "sj") {
            return override;
        }
        return (this.#storageManager.getVal("proxy") as "uv" | "sj") || "uv";
    }

    /**
     * Manually trigger a configuration switch (can be called if user detects issues)
     */
    async manualSwitch(): Promise<boolean> {
        if (!this.#isEnabled || !this.#currentSite) {
            return false;
        }
        return await this.#tryNextConfig();
    }

    /**
     * Clear all site-specific overrides
     */
    clearOverrides(): void {
        this.#siteOverrides.clear();
        this.#storageManager.removeVal("dynamicLoadingOverrides");
    }

    /**
     * Get the number of saved site overrides
     */
    getOverrideCount(): number {
        return this.#siteOverrides.size;
    }
}

// Singleton instance
let dynamicLoadingInstance: DynamicLoading | null = null;

/**
 * Get or create the DynamicLoading singleton instance
 */
function getDynamicLoading(): DynamicLoading {
    if (!dynamicLoadingInstance) {
        dynamicLoadingInstance = new DynamicLoading();
    }
    return dynamicLoadingInstance;
}

export { DynamicLoading, getDynamicLoading, type ProxyConfig };
