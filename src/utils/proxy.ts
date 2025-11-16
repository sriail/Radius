import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import { StoreManager } from "./storage";
import type { VerificationConfig } from "./types";

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
        return proxy === "uv"
            ? `${__uv$config.prefix}${__uv$config.encodeUrl!(input)}`
            : this.#scramjetController!.encodeUrl(input);
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

        // Get verification configuration
        const verificationConfig = this.getVerificationConfig();

        if (get) return this.#storageManager.getVal("transport");
        this.#storageManager.setVal(
            "transport",
            transport || this.#storageManager.getVal("transport") || "epoxy"
        );

        if (routingMode === "bare") {
            // Use bare server transport with verification
            await this.#baremuxConn!.setTransport(
                "/baremod/index.mjs",
                [bareServer()],
                [
                    {
                        headers: this.getVerificationHeaders(verificationConfig)
                    }
                ]
            );
        } else {
            // Use wisp server transport (default) with verification
            switch (transport) {
                case "epoxy": {
                    await this.#baremuxConn!.setTransport("/epoxy/index.mjs", [
                        {
                            wisp: wispServer(),
                            ...this.getVerificationHeaders(verificationConfig)
                        }
                    ]);
                    break;
                }
                case "libcurl": {
                    await this.#baremuxConn!.setTransport("/libcurl/index.mjs", [
                        {
                            wisp: wispServer(),
                            ...this.getVerificationHeaders(verificationConfig)
                        }
                    ]);
                    break;
                }
                default: {
                    await this.#baremuxConn!.setTransport("/epoxy/index.mjs", [
                        {
                            wisp: wispServer(),
                            ...this.getVerificationHeaders(verificationConfig)
                        }
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

    getVerificationConfig(): VerificationConfig {
        const type = this.#storageManager.getVal("verificationType") || "none";
        const siteKey = this.#storageManager.getVal("verificationSiteKey");
        const token = this.#storageManager.getVal("verificationToken");

        return {
            type: type as "none" | "recaptcha" | "cloudflare",
            siteKey,
            token
        };
    }

    setVerificationConfig(config: VerificationConfig) {
        this.#storageManager.setVal("verificationType", config.type);
        if (config.siteKey) {
            this.#storageManager.setVal("verificationSiteKey", config.siteKey);
        }
        if (config.token) {
            this.#storageManager.setVal("verificationToken", config.token);
        }
    }

    getVerificationHeaders(config: VerificationConfig): Record<string, string> {
        const headers: Record<string, string> = {};

        if (config.type === "recaptcha" && config.token) {
            headers["X-Recaptcha-Token"] = config.token;
            if (config.siteKey) {
                headers["X-Recaptcha-Site-Key"] = config.siteKey;
            }
        } else if (config.type === "cloudflare" && config.token) {
            headers["X-Turnstile-Token"] = config.token;
            if (config.siteKey) {
                headers["X-Turnstile-Site-Key"] = config.siteKey;
            }
        }

        return headers;
    }

    async refreshVerificationToken(): Promise<string | null> {
        const config = this.getVerificationConfig();

        if (config.type === "none" || !config.siteKey) {
            return null;
        }

        return new Promise((resolve) => {
            if (config.type === "recaptcha") {
                // ReCAPTCHA v3 implementation
                if (typeof grecaptcha !== "undefined" && grecaptcha.ready) {
                    grecaptcha.ready(() => {
                        grecaptcha
                            .execute(config.siteKey!, { action: "proxy_request" })
                            .then((token: string) => {
                                this.#storageManager.setVal("verificationToken", token);
                                resolve(token);
                            })
                            .catch(() => resolve(null));
                    });
                } else {
                    resolve(null);
                }
            } else if (config.type === "cloudflare") {
                // Cloudflare Turnstile implementation
                if (typeof turnstile !== "undefined") {
                    try {
                        const token = turnstile.getResponse();
                        if (token) {
                            this.#storageManager.setVal("verificationToken", token);
                            resolve(token);
                        } else {
                            resolve(null);
                        }
                    } catch {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        });
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
