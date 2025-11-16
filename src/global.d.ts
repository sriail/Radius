declare global {
    interface Window {
        __uv: any;
        $scramjet: any;
    }

    // Scramjet global functions
    function $scramjetLoadController(): any;
    function $scramjetLoadClient(): any;
    function $scramjetLoadWorker(): any;

    // UV config
    const __uv$config: any;

    // ScramjetController type (will be available after calling $scramjetLoadController)
    type ScramjetController = any;

    // ReCAPTCHA v3
    const grecaptcha: {
        ready(callback: () => void): void;
        execute(siteKey: string, options: { action: string }): Promise<string>;
    };

    // Cloudflare Turnstile
    const turnstile: {
        render(element: string | HTMLElement, options: any): string;
        getResponse(widgetId?: string): string;
        reset(widgetId?: string): void;
    };
}
export {};
