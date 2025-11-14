import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import { type SiteConfig, getFallbackConfigs, getSiteConfig } from "./siteConfigs";
import { StoreManager } from "./storage";

const createScript = (src: string, defer?: boolean) => {
    const script = document.createElement("script") as HTMLScriptElement;
    script.src = src;
    if (defer) script.defer = defer;
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
    #originalConfig?: {
        proxy: "uv" | "sj";
        transport: "epoxy" | "libcurl";
        routingMode: "wisp" | "bare";
    };
    #currentUrl?: string;
    #loadAttempts: number = 0;
    #maxLoadAttempts: number = 6;
    static #instance = new Set();

    static *getInstance() {
        for (const val of SW.#instance.keys()) {
            yield val as SW;
        }
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

    encodeURL(string: string): string {
        const proxy = this.#storageManager.getVal("proxy") as "uv" | "sj";
        const input = this.search(string, this.#storageManager.getVal("searchEngine"));

        // Check if automatic switching is enabled
        const autoSwitch = this.#storageManager.getVal("autoSwitch") === "true";
        if (autoSwitch) {
            this.#currentUrl = input;
            this.applyAutoSwitch(input);
        }

        return proxy === "uv"
            ? `${__uv$config.prefix}${__uv$config.encodeUrl!(input)}`
            : this.#scramjetController!.encodeUrl(input);
    }

    /**
     * Apply automatic switching based on site configuration
     */
    async applyAutoSwitch(url: string) {
        const siteConfig = getSiteConfig(url);
        if (siteConfig) {
            console.log(`[Auto Switch] Detected site: ${siteConfig.description}`);

            // Save original config if not already saved
            if (!this.#originalConfig) {
                this.#originalConfig = {
                    proxy: this.#storageManager.getVal("proxy") as "uv" | "sj",
                    transport: this.#storageManager.getVal("transport") as "epoxy" | "libcurl",
                    routingMode: this.#storageManager.getVal("routingMode") as "wisp" | "bare"
                };
            }

            // Apply site-specific config
            this.#storageManager.setVal("proxy", siteConfig.proxy);
            this.#storageManager.setVal("transport", siteConfig.transport);
            this.#storageManager.setVal("routingMode", siteConfig.routingMode);

            // Update transport
            await this.routingMode(siteConfig.routingMode, true);

            console.log(
                `[Auto Switch] Applied config: Proxy=${siteConfig.proxy}, Transport=${siteConfig.transport}, Routing=${siteConfig.routingMode}`
            );
        }
    }

    /**
     * Restore original configuration after automatic switching
     */
    async restoreOriginalConfig() {
        if (this.#originalConfig) {
            console.log("[Auto Switch] Restoring original configuration");
            this.#storageManager.setVal("proxy", this.#originalConfig.proxy);
            this.#storageManager.setVal("transport", this.#originalConfig.transport);
            this.#storageManager.setVal("routingMode", this.#originalConfig.routingMode);
            await this.routingMode(this.#originalConfig.routingMode, true);
            this.#originalConfig = undefined;
        }
    }

    /**
     * Handle load errors with automatic fallback
     * This is the Load Assist feature
     */
    async handleLoadError(): Promise<boolean> {
        const loadAssist = this.#storageManager.getVal("loadAssist") === "true";
        if (!loadAssist) {
            return false;
        }

        this.#loadAttempts++;
        console.log(
            `[Load Assist] Load error detected. Attempt ${this.#loadAttempts}/${this.#maxLoadAttempts}`
        );

        if (this.#loadAttempts >= this.#maxLoadAttempts) {
            console.log("[Load Assist] Max attempts reached. Giving up.");
            this.#loadAttempts = 0;
            return false;
        }

        // Try fallback configurations
        const fallbackConfigs = getFallbackConfigs();
        const currentIndex = this.#loadAttempts - 1;

        if (currentIndex < fallbackConfigs.length) {
            const fallbackConfig = fallbackConfigs[currentIndex];
            console.log(
                `[Load Assist] Trying fallback config ${currentIndex + 1}: Proxy=${fallbackConfig.proxy}, Transport=${fallbackConfig.transport}, Routing=${fallbackConfig.routingMode}`
            );

            this.#storageManager.setVal("proxy", fallbackConfig.proxy);
            this.#storageManager.setVal("transport", fallbackConfig.transport);
            this.#storageManager.setVal("routingMode", fallbackConfig.routingMode);

            await this.routingMode(fallbackConfig.routingMode, true);
            return true;
        }

        return false;
    }

    /**
     * Reset load attempts counter (call on successful load)
     */
    resetLoadAttempts() {
        this.#loadAttempts = 0;
    }

    async setTransport(transport?: "epoxy" | "libcurl", get?: boolean) {
        console.log("Setting transport");
        const routingMode = this.#storageManager.getVal("routingMode") || "wisp";
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
        if (get) return this.#storageManager.getVal("transport");
        this.#storageManager.setVal(
            "transport",
            transport || this.#storageManager.getVal("transport") || "epoxy"
        );

        if (routingMode === "bare") {
            // Use bare server transport
            await this.#baremuxConn!.setTransport("/baremod/index.mjs", [bareServer()]);
        } else {
            // Use wisp server transport (default)
            switch (transport) {
                case "epoxy": {
                    await this.#baremuxConn!.setTransport("/epoxy/index.mjs", [
                        { wisp: wispServer() }
                    ]);
                    break;
                }
                case "libcurl": {
                    await this.#baremuxConn!.setTransport("/libcurl/index.mjs", [
                        { wisp: wispServer() }
                    ]);
                    break;
                }
                default: {
                    await this.#baremuxConn!.setTransport("/epoxy/index.mjs", [
                        { wisp: wispServer() }
                    ]);
                    break;
                }
            }
        }
    }

    async routingMode(mode?: "wisp" | "bare", set?: true) {
        this.#storageManager.setVal(
            "routingMode",
            mode || this.#storageManager.getVal("routingMode") || "wisp"
        );
        if (set) await this.setTransport();
    }

    async wispServer(wispServer?: string, set?: true) {
        console.log(wispServer?.replace("/wisp/", "/adblock/"));
        this.#storageManager.setVal(
            "wispServer",
            wispServer ||
                this.#storageManager.getVal("wispServer") ||
                (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/"
        );
        if (set) await this.setTransport();
    }

    constructor() {
        SW.#instance.add(this);
        this.#storageManager = new StoreManager("radius||settings");
        const checkScripts = (): Promise<void> => {
            return new Promise((resolve) => {
                const t = setInterval(() => {
                    if (
                        typeof __uv$config !== "undefined" &&
                        typeof $scramjetLoadController !== "undefined"
                    ) {
                        clearInterval(t);
                        resolve();
                    }
                });
            });
        };
        createScript("/vu/uv.bundle.js", true);
        createScript("/vu/uv.config.js", true);
        createScript("/marcs/scramjet.all.js", true);

        checkScripts().then(async () => {
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
                    rewriterLogs: false
                }
            });
            if ("serviceWorker" in navigator) {
                await this.#scramjetController.init();
                navigator.serviceWorker.ready.then(async (reg) => {
                    console.log("SW ready to go!");
                    this.#serviceWorker = reg;
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
