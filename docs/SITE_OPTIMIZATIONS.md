# Site-Specific Optimizations

This document explains the site-specific optimization feature in Radius proxy.

## Overview

Radius automatically detects when you're accessing certain websites that require special handling and applies optimized configurations for the best experience.

## How It Works

When you navigate to a supported website, Radius:
1. Detects the domain you're visiting
2. Checks if it has a pre-configured optimization profile
3. Automatically applies the best proxy settings for that site
4. Logs the optimization in the console for transparency

## Optimized Websites

### Cloud Gaming Platforms
- **now.gg** - Optimized for low-latency cloud gaming
  - Proxy: Scramjet
  - Transport: Epoxy
  - Routing: Wisp Server

- **GeForce NOW** - NVIDIA cloud gaming service
  - Proxy: Scramjet
  - Transport: Epoxy
  - Routing: Wisp Server

### Communication Platforms
- **Discord** - Real-time messaging and voice
  - Proxy: Scramjet
  - Transport: Epoxy
  - Routing: Wisp Server

### Streaming Platforms
- **YouTube** - Video streaming
  - Proxy: Scramjet
  - Transport: LibCurl
  - Routing: Wisp Server

- **Twitch** - Live streaming
  - Proxy: Scramjet
  - Transport: LibCurl
  - Routing: Wisp Server

## Configuration Details

### Why Different Settings?

Different websites have different requirements:

- **Cloud Gaming (now.gg)**: Requires WebSocket support, low latency, and real-time communication
  - **Scramjet** provides better compatibility with complex web applications
  - **Epoxy** offers superior WebSocket performance
  
- **Streaming**: Requires high bandwidth and stable connections
  - **LibCurl** provides better performance for large data transfers

- **Real-time Apps**: Need persistent connections and instant updates
  - **Epoxy** maintains WebSocket connections more reliably

## Adding Custom Optimizations

To add optimization for a new site, edit `src/utils/siteOptimizations.ts`:

```typescript
{
    domains: ["example.com", "www.example.com"],
    preferredProxy: "sj", // or "uv"
    preferredTransport: "epoxy", // or "libcurl"
    preferredRoutingMode: "wisp", // or "bare"
    requiresSpecialHandling: true
}
```

## Technical Details

### Proxy Options
- **Ultraviolet (uv)**: General-purpose proxy, widely compatible
- **Scramjet (sj)**: Advanced proxy with better support for complex web apps

### Transport Options
- **Epoxy**: WebSocket-optimized transport, best for real-time applications
- **LibCurl**: High-performance transport, best for large data transfers

### Routing Modes
- **Wisp Server**: WebSocket-based routing, default and recommended
- **Bare Server**: HTTP-based routing, fallback option

## Disabling Auto-Optimization

Currently, optimizations are applied automatically. Manual control through settings is preserved - you can override automatic optimizations by changing settings in the proxy settings page.

## Performance Impact

Site-specific optimizations provide:
- ✅ Better compatibility with complex websites
- ✅ Improved performance for specific use cases
- ✅ More reliable connections for real-time applications
- ✅ Optimized resource usage

## Troubleshooting

If a website isn't working correctly with auto-optimization:

1. Check the console for optimization logs
2. Try manually changing proxy settings in Settings > Proxy
3. Test different combinations of proxy, transport, and routing mode
4. Report issues with specific sites so we can improve optimizations

## Contributing

Help us improve site compatibility! If you find a website that works better with specific settings, please:
1. Test different configurations
2. Note which settings work best
3. Submit a pull request or issue with your findings
