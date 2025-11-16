import type { Props } from "astro";

interface SettingsProps extends Props {
    active: "appearance" | "credits" | "links" | "proxy" | "cloaking";
    title: string;
}

type DropdownOptions = {
    name: string;
    value: string;
    default?: boolean;
};

type VerificationType = "none" | "recaptcha" | "cloudflare";

interface VerificationConfig {
    type: VerificationType;
    siteKey?: string;
    token?: string;
}

const SearchEngines: Record<string, string> = {
    Aol: "https://search.aol.com/aol/search?q=%s",
    Bing: "https://bing.com/search?q=%s",
    Brave: "https://search.brave.com/search?q=%s",
    DuckDuckGo: "https://duckduckgo.com/?q=%s",
    Google: "https://google.com/search?q=%s",
    Yahoo: "https://search.yahoo.com/search?p=%s",
    Yandex: "https://yandex.com/search/?text=%s"
};

export {
    type SettingsProps,
    type DropdownOptions,
    type VerificationType,
    type VerificationConfig,
    SearchEngines
};
