# Backend Improvements for Heavy Cookies, Error Handling, Speed, and Compatibility

## Overview
This document describes the improvements made to the Radius proxy to better support websites that use heavy cookies, service workers, and other complex browser services. The changes focus on improving error handling, speed, connection stability, and overall site compatibility.

## Key Improvements

### 1. Server Configuration Enhancements (server/index.ts)

#### Increased Header Size Limits
- **Max Header Size**: Increased from 16KB (default) to **32KB**
- **Purpose**: Supports websites with heavy cookies and complex authentication headers
- **Benefits**: Sites like Amazon, Google, Facebook, and enterprise applications that use extensive cookies now work properly

#### Connection Stability Improvements
- **Keep-Alive**: Enabled with 65-second timeout
- **Connection Timeout**: Set to 120 seconds for long-running requests
- **Request Timeout**: 120 seconds to handle slow or complex page loads
- **Benefits**: Better connection persistence, fewer dropped connections, improved reliability for slow networks

#### Enhanced Connection Limits
- **Max Connections per IP**: Increased to 1000 (from 500)
- **Window Duration**: 60 seconds (from 10)
- **Block Duration**: 30 seconds (from 5)
- **Benefits**: Better support for sites that make many parallel requests while maintaining security

#### Comprehensive Error Handling
- Added try-catch blocks around request and WebSocket upgrade handlers
- Added error handlers for server errors and client errors
- Implemented Fastify error handler with proper status codes
- Added graceful error responses instead of silent failures
- **Benefits**: Better debugging, improved user experience, more stable operation

#### Improved Body Limits
- **Body Limit**: Increased to 10MB
- **Purpose**: Support larger file uploads and complex form submissions
- **Benefits**: File upload sites, form-heavy applications work better

### 2. Service Worker Improvements (public/sw.js)

#### Heavy Cookie Domain Support
Added explicit support for popular sites known to use heavy cookies:
- Amazon, eBay, Walmart (E-commerce)
- Google, YouTube (Google services)
- Facebook, Instagram, Twitter, LinkedIn (Social media)
- Microsoft, Apple (Enterprise services)
- Netflix, Spotify (Streaming services)

#### Enhanced ScramjetServiceWorker Configuration
- **Service Workers**: Enabled for nested service worker support
- **Error Capture**: Enabled for better debugging
- **Synchronous XHR**: Enabled for complex callbacks
- **Cookie Store**: Better cookie persistence
- **Benefits**: Complex web applications work more reliably

#### Error Recovery
- Added try-catch in fetch event listener
- Proper error responses instead of failed requests
- Service worker activation and installation handlers
- Immediate client claiming for faster activation
- **Benefits**: More resilient to errors, better recovery from failures

#### Request Enhancement
- Special handling for CAPTCHA requests
- Special handling for heavy cookie site requests
- Credential inclusion for cross-origin requests
- Cache control optimization
- **Benefits**: Better compatibility with authentication systems and CAPTCHAs

### 3. Proxy Configuration Enhancements (src/utils/proxy.ts)

#### Enhanced Scramjet Flags
- **CAPTCHA Support**: Enabled
- **Cookie Store**: Better cookie persistence
- **Service Workers**: Full support
- **Error Capture**: Enabled
- **Flexible Rewrites**: Enabled for complex sites
- **Benefits**: Better compatibility with modern web applications

### 4. Cookie and Network Handling (src/utils/captcha-handler.ts)

#### Enhanced Cookie Handling
- Automatic SameSite=None for CAPTCHA cookies
- SameSite=None for session and auth cookies
- Secure flag for cross-origin cookies
- **Benefits**: Cookies work properly in cross-origin contexts

#### Network Request Enhancements
- Credential inclusion for CAPTCHA and heavy cookie sites
- Proper Accept headers
- Cache control headers for performance
- XMLHttpRequest enhancements
- **Benefits**: Better API communication, proper cookie transmission

#### Storage Persistence
- Request persistent storage API
- Storage quota monitoring
- **Benefits**: Better data retention, fewer session losses

## Configuration

### Environment Variables

The following environment variables can be used to customize the behavior:

```bash
# Server port (default: 8080)
PORT=8080

# Bare server connection limits
BARE_MAX_CONNECTIONS_PER_IP=1000  # Default: 1000
BARE_WINDOW_DURATION=60           # Default: 60 seconds
BARE_BLOCK_DURATION=30            # Default: 30 seconds

# Logging (optional)
LOG_LEVEL=error                   # Options: debug, info, warn, error
NODE_ENV=production               # Options: development, production
```

### Default Settings

- **Max Header Size**: 32KB
- **Connection Timeout**: 120 seconds
- **Keep-Alive Timeout**: 65 seconds
- **Body Limit**: 10MB
- **Max Connections per IP**: 1000
- **Window Duration**: 60 seconds
- **Block Duration**: 30 seconds

## Performance Impact

### Speed Improvements
- **Keep-Alive Connections**: Reduces connection overhead by reusing TCP connections
- **Increased Timeouts**: Prevents premature connection drops for slow operations
- **Better Caching**: Optimized cache control headers for faster repeat visits
- **Connection Pooling**: Supports more parallel connections for faster page loads

### Memory Considerations
- Increased header buffer: +16KB per connection (minimal impact)
- Increased body limit: Only affects requests with large payloads
- Connection pooling: Managed by limits to prevent abuse

### Recommended Resources
- **Minimum**: 512MB RAM, 1 CPU core (light usage)
- **Recommended**: 1GB RAM, 2 CPU cores (moderate usage)
- **High Traffic**: 2GB+ RAM, 4+ CPU cores (high usage)

## Compatibility Improvements

### Sites Now Better Supported
1. **E-commerce**: Amazon, eBay, Walmart
2. **Social Media**: Facebook, Instagram, Twitter, LinkedIn
3. **Streaming**: YouTube, Netflix, Spotify
4. **Productivity**: Google Workspace, Microsoft 365
5. **Authentication**: Sites with complex OAuth flows
6. **CAPTCHAs**: reCAPTCHA, hCaptcha, Cloudflare Turnstile

### Features Now Working Better
- Service workers in proxied sites
- Heavy cookie persistence
- Complex authentication flows
- File uploads
- WebSocket connections
- Long-polling requests
- Cross-origin requests
- CAPTCHA verification

## Testing

To verify the improvements work:

```bash
# Build the project
npm run build

# Start the server
npm start
```

The server should display:
```
Server listening on http://localhost:8080/
Server also listening on http://0.0.0.0:8080/
Connection timeout: 120s, Keep-alive timeout: 65s
Max header size: 32KB, Body limit: 10MB
```

## Troubleshooting

### High Memory Usage
- Reduce `BARE_MAX_CONNECTIONS_PER_IP` if experiencing memory pressure
- Reduce timeouts if connections are staying open too long

### Connection Limits Hit
- Increase `BARE_MAX_CONNECTIONS_PER_IP` if legitimate users are being blocked
- Adjust `BARE_WINDOW_DURATION` to change the time window for counting connections

### Slow Performance
- Enable `LOG_LEVEL=debug` to identify bottlenecks
- Check network connectivity between proxy and target sites
- Consider using a CDN for static assets

## Future Enhancements

Potential future improvements:
- HTTP/2 support for faster multiplexing
- Connection pooling to backend servers
- Response compression (gzip, brotli)
- Request/response caching layer
- Rate limiting per user/session
- Metrics and monitoring dashboard

## Maintenance

### Regular Checks
- Monitor error logs for recurring issues
- Check memory usage trends
- Review connection limit blocks
- Update dependencies regularly

### Updates
- Keep proxy libraries updated (Ultraviolet, Scramjet, Bare)
- Update Node.js to latest LTS version
- Monitor security advisories

## Support

For issues or questions:
- Check existing GitHub issues
- Create a new issue with detailed information
- Join the Discord community for help

## License

These improvements maintain the same license as the original Radius project.
