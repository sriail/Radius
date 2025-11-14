# Advanced Proxy Features

This document describes the advanced features added to Radius to improve website compatibility and streamline proxy usage.

## Features Overview

### 1. Automatic Switching (Experimental)

**What it does:** Automatically detects when you're visiting difficult-to-load or popular sites and temporarily switches your proxy configuration to an optimized setup.

**How to use:**
1. Go to Settings → Proxy
2. Enable "Automatic Switching (Experimental)"
3. Browse normally - the proxy will automatically switch when needed

**Supported Sites:**
- **now.gg** - Cloud gaming platform (uses Scramjet + Epoxy)
- **easyfun.gg** - Gaming platform (uses Scramjet + Epoxy)
- **Discord** - Chat platform (uses Scramjet + Epoxy for WebSocket support)
- **YouTube** - Video streaming (uses Ultraviolet + Libcurl)
- **Twitch** - Live streaming (uses Scramjet + Epoxy)
- **Roblox** - Gaming platform (uses Scramjet + Epoxy)
- **Spotify** - Music streaming (uses Scramjet + Epoxy)

**How it works:**
- When you visit a supported site, Radius temporarily applies the optimal proxy configuration
- Your original settings are preserved and can be restored manually
- Each site has been tested and configured for maximum compatibility

### 2. Load Assist

**What it does:** Automatically detects loading errors and tries different proxy configurations until one works successfully.

**How to use:**
1. Go to Settings → Proxy
2. Enable "Load Assist"
3. When a site fails to load, Load Assist will automatically try alternative configurations

**How it works:**
- Monitors page loading for errors and timeouts (15-second timeout)
- Automatically cycles through 6 different proxy configurations:
  1. Scramjet + Epoxy + Wisp
  2. Ultraviolet + Libcurl + Wisp
  3. Scramjet + Libcurl + Wisp
  4. Ultraviolet + Epoxy + Wisp
  5. Ultraviolet + Libcurl + Bare
  6. Scramjet + Epoxy + Bare
- Stops trying after 6 attempts to prevent infinite loops
- Resets automatically on successful page load

**Best Practices:**
- Use Load Assist when you're having trouble accessing a specific site
- It works best in combination with Automatic Switching
- May take longer to load pages as it tries multiple configurations

### 3. Enhanced reCAPTCHA Support

**What it does:** Improves compatibility with sites that use reCAPTCHA and other Google verification systems.

**How it works:**
- Automatically detects reCAPTCHA requests
- Uses optimized proxy handling to prevent reCAPTCHA from breaking
- Reduces interference with Google verification scripts

**Benefits:**
- Better success rate with reCAPTCHA-protected sites
- More reliable form submissions
- Improved compatibility with Google services

### 4. Optimized Backend Systems

**Improvements Made:**
- Enhanced error handling in service worker to prevent crashes
- Better routing logic for proxy requests
- Improved compatibility with WebSocket connections
- Optimized configurations for popular sites
- More robust fallback mechanisms

## Configuration Details

### Site-Specific Configurations

The following configurations have been optimized and tested for specific sites:

| Site Category | Proxy | Transport | Routing Mode | Use Case |
|--------------|-------|-----------|--------------|----------|
| Gaming (now.gg, Roblox) | Scramjet | Epoxy | Wisp | Cloud gaming, game clients |
| Streaming (Twitch, Spotify) | Scramjet | Epoxy | Wisp | Live streaming, audio |
| Video (YouTube) | Ultraviolet | Libcurl | Wisp | Video playback |
| Chat (Discord) | Scramjet | Epoxy | Wisp | WebSocket messaging |

### Fallback Configuration Order

When Load Assist is enabled, configurations are tried in this order:

1. **Scramjet + Epoxy + Wisp** - Best for modern web apps with WebSocket
2. **Ultraviolet + Libcurl + Wisp** - Good for traditional websites
3. **Scramjet + Libcurl + Wisp** - Alternative for web apps
4. **Ultraviolet + Epoxy + Wisp** - Alternative for websites
5. **Ultraviolet + Libcurl + Bare** - Bare server fallback
6. **Scramjet + Epoxy + Bare** - Last resort configuration

## Troubleshooting

### Site Still Won't Load

1. **Try disabling Automatic Switching** - Sometimes manual configuration works better
2. **Enable Load Assist** - Let it cycle through configurations
3. **Check your Wisp Server** - Make sure it's properly configured
4. **Try Bare Server mode** - Switch Routing Mode to "Bare Server" in settings

### Performance Issues

1. **Disable Load Assist** - If you're experiencing slowdowns
2. **Use site-specific manual config** - Set your proxy manually based on the table above
3. **Check your connection** - Ensure your internet is stable

### Automatic Switching Not Working

1. **Verify it's enabled** - Check Settings → Proxy
2. **Clear browser cache** - Refresh the page
3. **Check console logs** - Look for "[Auto Switch]" messages in browser console

## Technical Details

### For Developers

The advanced features are implemented across several files:

- **`src/utils/siteConfigs.ts`** - Site-specific configuration database
- **`src/utils/proxy.ts`** - Proxy management with auto-switching and load assist
- **`src/utils/settings.ts`** - Settings management for new features
- **`src/pages/settings/index.astro`** - UI for feature toggles
- **`public/sw.js`** - Enhanced service worker with reCAPTCHA support

### Adding New Site Configurations

To add a new site configuration, edit `src/utils/siteConfigs.ts`:

```typescript
export const SITE_CONFIGS: Record<string, SiteConfig> = {
    mysite: {
        domains: ["example.com", "www.example.com"],
        proxy: "sj", // or "uv"
        transport: "epoxy", // or "libcurl"
        routingMode: "wisp", // or "bare"
        description: "Example site - description of why this config works"
    },
    // ... other configs
};
```

## Privacy & Security

- All processing happens locally in your browser
- No data is sent to external servers for configuration
- Your original settings are preserved and can be restored
- Configuration changes are temporary and page-specific when using Automatic Switching

## Future Improvements

Planned enhancements:
- User-customizable site configurations
- Machine learning-based configuration selection
- More comprehensive site database
- Performance metrics and analytics
- Automatic site detection improvements

## Feedback

If you encounter issues or have suggestions for improving these features:
1. Open an issue on GitHub
2. Join our Discord server
3. Contribute to the project

---

**Note:** These features are experimental and may not work perfectly with all websites. We're continuously improving compatibility and performance.
