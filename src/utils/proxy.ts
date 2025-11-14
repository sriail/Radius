import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import { StoreManager } from "./storage";
import { applySiteOptimizations, requiresSpecialHandling } from "./siteOptimizations";

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
    static #instance = new Set();

    static *getInstance() {
        for (const val of SW.#instance.keys()) {
            yield val as SW;
        }
    }

    search(input: string, template: string) {
        // Enhanced URL detection for better compatibility
        try {
            // Try parsing as complete URL first
            const parsedUrl = new URL(input);
            return parsedUrl.toString();
        } catch (_) {}

        try {
            // Try with http:// prefix
            const url = new URL(`http://${input}`);
            if (url.hostname.includes(".")) return url.toString();
        } catch (_) {}

        try {
            // Try with https:// prefix for secure sites
            const url = new URL(`https://${input}`);
            if (url.hostname.includes(".")) return url.toString();
        } catch (_) {}

        // Fallback to search engine
        return template.replace("%s", encodeURIComponent(input));
    }

    async encodeURL(string: string): Promise<string> {
        const proxy = this.#storageManager.getVal("proxy") as "uv" | "sj";
        const transport = this.#storageManager.getVal("transport") as "epoxy" | "libcurl";
        const routingMode = this.#storageManager.getVal("routingMode") as "wisp" | "bare";
        const input = this.search(string, this.#storageManager.getVal("searchEngine"));

        try {
            // Check if site requires special handling and apply optimizations
            if (requiresSpecialHandling(input)) {
                const optimizations = applySiteOptimizations(
                    input,
                    proxy,
                    transport || "epoxy",
                    routingMode || "wisp"
                );

                if (optimizations.optimized) {
                    console.log("Applying site-specific optimizations for:", input);

                    // Apply optimized settings
                    if (optimizations.proxy !== proxy) {
                        this.#storageManager.setVal("proxy", optimizations.proxy);
                    }
                    if (optimizations.transport !== transport) {
                        await this.setTransport(optimizations.transport);
                    }
                    if (optimizations.routingMode !== routingMode) {
                        await this.routingMode(optimizations.routingMode, true);
                    }

                    // Use optimized proxy
                    return optimizations.proxy === "uv"
                        ? `${__uv$config.prefix}${__uv$config.encodeUrl!(input)}`
                        : this.#scramjetController!.encodeUrl(input);
                }
            }

            // Use current proxy settings
            return proxy === "uv"
                ? `${__uv$config.prefix}${__uv$config.encodeUrl!(input)}`
                : this.#scramjetController!.encodeUrl(input);
        } catch (error) {
            console.error("URL encoding error:", error);
            // Fallback to UV encoding if Scramjet fails
            return `${__uv$config.prefix}${__uv$config.encodeUrl!(input)}`;
        }
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

        try {
            if (routingMode === "bare") {
                // Use bare server transport with better error handling
                await this.#baremuxConn!.setTransport("/baremod/index.mjs", [bareServer()]);
                console.log("Bare transport configured successfully");
            } else {
                // Use wisp server transport (default) with enhanced configuration
                const currentTransport =
                    transport || this.#storageManager.getVal("transport") || "epoxy";
                switch (currentTransport) {
                    case "epoxy": {
                        await this.#baremuxConn!.setTransport("/epoxy/index.mjs", [
                            { wisp: wispServer() }
                        ]);
                        console.log("Epoxy transport configured successfully");
                        break;
                    }
                    case "libcurl": {
                        await this.#baremuxConn!.setTransport("/libcurl/index.mjs", [
                            { wisp: wispServer() }
                        ]);
                        console.log("LibCurl transport configured successfully");
                        break;
                    }
                    default: {
                        // Fallback to epoxy for maximum compatibility
                        await this.#baremuxConn!.setTransport("/epoxy/index.mjs", [
                            { wisp: wispServer() }
                        ]);
                        console.log("Default epoxy transport configured");
                        break;
                    }
                }
            }
        } catch (error) {
            console.error("Transport configuration error:", error);
            // Attempt fallback to epoxy transport
            try {
                await this.#baremuxConn!.setTransport("/epoxy/index.mjs", [{ wisp: wispServer() }]);
                console.log("Fallback to epoxy transport succeeded");
            } catch (fallbackError) {
                console.error("Fallback transport configuration failed:", fallbackError);
                throw fallbackError;
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

        checkScripts()
            .then(async () => {
                try {
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
                        try {
                            await this.#scramjetController.init();
                            navigator.serviceWorker.ready.then(async (reg) => {
                                console.log("SW ready to go!");
                                this.#serviceWorker = reg;
                            });

                            // Register service worker with error handling
                            const registration = await navigator.serviceWorker.register("/sw.js", {
                                scope: "/",
                                updateViaCache: "none" // Always check for updates
                            });

                            console.log("Service worker registered successfully");

                            // Handle service worker updates
                            registration.addEventListener("updatefound", () => {
                                console.log("Service worker update found");
                            });
                        } catch (swError) {
                            console.error("Service worker initialization error:", swError);
                            throw swError;
                        }
                    } else {
                        throw new Error(
                            "Your browser is not supported! This website uses Service Workers heavily."
                        );
                    }
                } catch (error) {
                    console.error("Proxy initialization error:", error);
                    throw error;
                }
            })
            .catch((error) => {
                console.error("Script loading error:", error);
            });
    }
}

export { SW };
