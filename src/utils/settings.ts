import { StoreManager } from "./storage";
import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import { SW } from "@utils/proxy.ts";
import { SearchEngines } from "./types";
/**
 * The settings class
 * Initializes it's own StorageManager, and handles everything within the class itself
 *
 * @example
 * // Create a new Settings instance (needs to be done only once)
 * import { Settings } from "@utils/settings.ts";
 * const settings = new Settings();
 * //Consume any of the methods with:
 * settings.methodName();
 *
 * // Most of the time, you'll want to get the running instance this can be done with
 * import { Settings } from "@utils/settings.ts";
 * const settings = await Settings.getInstance();
 * //Consume any of the methods with:
 * settings.methodName();
 */
class Settings {
    // Our own internal StorageManager so things never interfere
    #storageManager: StoreManager<"radius||settings">;
    static #instance = new Set();

    /**
     * Method to get the current or other Settings instance(s)
     *
     *
     * @example
     * const settings = await Settings.getInstance();
     * // Consume the other methods
     */
    static async getInstance() {
        function* get() {
            for (const instance of Settings.#instance.keys()) {
                yield instance!;
            }
        }

        const ready = (): Promise<boolean> => {
            return new Promise((resolve) => {
                const i = setInterval(() => {
                    if (Settings.#instance.size !== 0) {
                        clearInterval(i);
                        resolve(true);
                    }
                }, 100);
            });
        };

        await ready();
        return get().next().value! as Settings;
    }

    /**
     * Set's the theme either to the current theme OR to a new one
     *
     * @example
     * // Retrieve the Settings instance
     * const settings = await Settings.getInstance();
     *
     * // Consume the method
     * settings.theme() // Whatever value is in localstorage at the time
     * settings.theme('theme name') // A new theme based off of the class name
     */
    theme(theme?: string) {
        this.#storageManager.setVal("theme", theme || this.#storageManager.getVal("theme"));
        theme === "default"
            ? (document.documentElement.className = "default")
            : (document.documentElement.className = theme || this.#storageManager.getVal("theme"));
    }

    proxy(prox?: "uv" | "sj") {
        this.#storageManager.setVal("proxy", prox || "uv");
    }

    searchEngine(engine?: string) {
        this.#storageManager.setVal("searchEngine", engine || SearchEngines.DuckDuckGo);
    }

    cloak(location: string) {
        return {
            aboutBlank: () => {
                const win = window.open();
                if (!win) return;
                window.location.replace(location);
                const iframe = win.document.createElement("iframe") as HTMLIFrameElement;
                win.document.body.setAttribute("style", "margin: 0; height: 100vh; width: 100%;");
                iframe.setAttribute("style", "border: none; width: 100%; height: 100%; margin: 0;");
                iframe.src = window.location.href;
                win.document.body.appendChild(iframe);
            },
            blob: () => {
                const win = window.open();
                if (!win) return;
                window.location.replace(location);
                const content = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <style type="text/css">
                                body, html {
                                    margin: 0;
                                    padding: 0;
                                    height: 100%;
                                    width: 100%;
                                    overflow: hidden;
                                }
                            </style>
                        </head>
                        <body>
                            <iframe style="border: none; width: 100%; height: 100%;" src="${window.location.href}"></iframe>
                        </body>
                    </html>
                `;
                const blob = new Blob([content], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                win.location.href = url;
            }
        };
    }

    adBlock(enabled?: boolean) {
        if (enabled === true || enabled === false) {
            this.#storageManager.setVal("adBlock", enabled.valueOf().toString());
        } else {
            this.#storageManager.setVal("adBlock", "true");
        }
    }

    setAutomaticSwitching(enabled: boolean) {
        this.#storageManager.setVal("automaticSwitching", enabled.toString());
        if (enabled) {
            this.#enableAutomaticSwitching();
        } else {
            this.#disableAutomaticSwitching();
        }
    }

    setLoadAssist(enabled: boolean) {
        this.#storageManager.setVal("loadAssist", enabled.toString());
        if (enabled) {
            this.#enableLoadAssist();
        } else {
            this.#disableLoadAssist();
        }
    }

    #enableAutomaticSwitching() {
        // List of hard-to-load sites that need optimized configs
        const hardToLoadSites = [
            "youtube.com",
            "discord.com",
            "twitch.tv",
            "reddit.com",
            "twitter.com",
            "x.com",
            "instagram.com",
            "whatsapp.com",
            "tiktok.com",
            "messenger.com",
            "telegram.org",
            "snapchat.com",
            "linkedin.com",
            "pinterest.com",
            "threads.net",
            "store.steampowered.com",
            "store.epicgames.com",
            "roblox.com",
            "playstation.com",
            "xbox.com",
            "nintendo.com",
            "itch.io",
            "poki.com",
            "crazygames.com"
            
        ];

        // Monitor navigation events
        if (typeof window !== "undefined") {
            const checkAndSwitch = () => {
                try {
                    const currentUrl = window.location.href;
                    const isHardSite = hardToLoadSites.some((site) => currentUrl.includes(site));

                    if (isHardSite) {
                        // Switch to optimized config (Scramjet + Bare for better compatibility)
                        const currentProxy = this.#storageManager.getVal("proxy");
                        const currentRouting = this.#storageManager.getVal("routingMode");

                        if (currentProxy !== "sj" || currentRouting !== "bare") {
                            console.log(
                                "[Automatic Switching] Switching to optimized config for hard-to-load site"
                            );
                            this.#storageManager.setVal("autoSwitchActive", "true");
                            this.#storageManager.setVal("autoSwitchPrevProxy", currentProxy);
                            this.#storageManager.setVal("autoSwitchPrevRouting", currentRouting);

                            // Switch to Scramjet + Bare
                            this.proxy("sj");
                            const sw = SW.getInstance().next().value;
                            if (sw) {
                                sw.routingMode("bare", true);
                            }
                        }
                    } else if (this.#storageManager.getVal("autoSwitchActive") === "true") {
                        // Restore previous config when leaving hard site
                        console.log("[Automatic Switching] Restoring previous config");
                        const prevProxy = this.#storageManager.getVal("autoSwitchPrevProxy");
                        const prevRouting = this.#storageManager.getVal("autoSwitchPrevRouting");

                        if (prevProxy) this.proxy(prevProxy as "uv" | "sj");
                        if (prevRouting) {
                            const sw = SW.getInstance().next().value;
                            if (sw) {
                                sw.routingMode(prevRouting as "wisp" | "bare", true);
                            }
                        }

                        this.#storageManager.removeVal("autoSwitchActive");
                    }
                } catch (err) {
                    console.error("[Automatic Switching] Error:", err);
                }
            };

            // Initial check
            checkAndSwitch();

            // Store the handler for cleanup
            (window as any).__automaticSwitchingHandler = checkAndSwitch;
        }
    }

    #disableAutomaticSwitching() {
        if (typeof window !== "undefined") {
            // Clean up
            delete (window as any).__automaticSwitchingHandler;

            // Restore config if currently switched
            if (this.#storageManager.getVal("autoSwitchActive") === "true") {
                const prevProxy = this.#storageManager.getVal("autoSwitchPrevProxy");
                const prevRouting = this.#storageManager.getVal("autoSwitchPrevRouting");

                if (prevProxy) this.proxy(prevProxy as "uv" | "sj");
                if (prevRouting) {
                    const sw = SW.getInstance().next().value;
                    if (sw) {
                        sw.routingMode(prevRouting as "wisp" | "bare", true);
                    }
                }

                this.#storageManager.removeVal("autoSwitchActive");
                this.#storageManager.removeVal("autoSwitchPrevProxy");
                this.#storageManager.removeVal("autoSwitchPrevRouting");
            }
        }
    }

    #enableLoadAssist() {
        if (typeof window !== "undefined" && typeof console !== "undefined") {
            let errorCount = 0;
            let lastErrorTime = 0;
            const ERROR_THRESHOLD = 3; // Number of errors before switching
            const ERROR_WINDOW = 5000; // Time window in ms (5 seconds)

            const originalError = console.error;
            const errorHandler = (...args: any[]) => {
                originalError.apply(console, args);

                const now = Date.now();
                const errorMessage = args.join(" ");

                // Check if error is proxy-related
                const isProxyError =
                    errorMessage.includes("bare") ||
                    errorMessage.includes("wisp") ||
                    errorMessage.includes("proxy") ||
                    errorMessage.includes("Failed to fetch") ||
                    errorMessage.includes("NetworkError") ||
                    errorMessage.includes("ERR_");

                if (isProxyError) {
                    // Reset counter if outside time window
                    if (now - lastErrorTime > ERROR_WINDOW) {
                        errorCount = 0;
                    }

                    errorCount++;
                    lastErrorTime = now;

                    console.log(
                        `[Load Assist] Proxy error detected (${errorCount}/${ERROR_THRESHOLD})`
                    );

                    if (errorCount >= ERROR_THRESHOLD) {
                        console.log("[Load Assist] Error threshold reached, switching config");
                        errorCount = 0; // Reset to prevent continuous switching

                        // Try different config
                        const currentProxy = this.#storageManager.getVal("proxy");
                        const currentRouting = this.#storageManager.getVal("routingMode");
                        const currentTransport = this.#storageManager.getVal("transport");

                        // Cycle through configurations
                        if (currentProxy === "uv" && currentRouting === "wisp") {
                            // Try Scramjet + Wisp
                            console.log("[Load Assist] Switching to Scramjet + Wisp");
                            this.proxy("sj");
                        } else if (currentProxy === "sj" && currentRouting === "wisp") {
                            // Try UV + Bare
                            console.log("[Load Assist] Switching to UV + Bare");
                            this.proxy("uv");
                            const sw = SW.getInstance().next().value;
                            if (sw) {
                                sw.routingMode("bare", true);
                            }
                        } else if (currentRouting === "bare") {
                            // Try different transport
                            console.log("[Load Assist] Switching transport");
                            const sw = SW.getInstance().next().value;
                            if (sw) {
                                sw.routingMode("wisp", true);
                                const newTransport =
                                    currentTransport === "libcurl" ? "epoxy" : "libcurl";
                                sw.setTransport(newTransport as "epoxy" | "libcurl");
                            }
                        } else {
                            // Fall back to default config
                            console.log("[Load Assist] Switching to default config");
                            this.proxy("uv");
                            const sw = SW.getInstance().next().value;
                            if (sw) {
                                sw.routingMode("wisp", true);
                                sw.setTransport("libcurl");
                            }
                        }
                    }
                }
            };

            console.error = errorHandler;
            (window as any).__loadAssistErrorHandler = errorHandler;
            (window as any).__loadAssistOriginalError = originalError;
        }
    }

    #disableLoadAssist() {
        if (typeof window !== "undefined") {
            // Restore original console.error
            if ((window as any).__loadAssistOriginalError) {
                console.error = (window as any).__loadAssistOriginalError;
                delete (window as any).__loadAssistErrorHandler;
                delete (window as any).__loadAssistOriginalError;
            }
        }
    }

    async *#init() {
        yield this.theme(this.#storageManager.getVal("theme") || "default");

        // Initialize experimental features if enabled
        if (this.#storageManager.getVal("automaticSwitching") === "true") {
            this.#enableAutomaticSwitching();
        }
        if (this.#storageManager.getVal("loadAssist") === "true") {
            this.#enableLoadAssist();
        }
    }

    constructor() {
        this.#storageManager = new StoreManager("radius||settings");
        Settings.#instance.add(this);
        (async () => {
            for await (const _ of this.#init());
        })();
    }
}

export { Settings };
