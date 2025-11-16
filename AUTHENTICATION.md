# Authentication and Verification Support

Radius fully supports reCAPTCHA, Cloudflare verification, and Google Sign-in through its advanced proxy systems (Ultraviolet and Scramjet).

## Supported Features

### ✅ reCAPTCHA Support
- reCAPTCHA v2 (checkbox and invisible)
- reCAPTCHA v3
- hCAPTCHA

Ultraviolet proxy includes built-in CAPTCHA support that handles:
- Proper iframe rendering
- Cross-origin communication (postMessage)
- Cookie and session management
- Header forwarding (Origin, Referer)

### ✅ Cloudflare Verification
- Cloudflare Turnstile challenges
- Cloudflare bot verification
- Cloudflare Access authentication

The proxy correctly forwards:
- Challenge cookies
- Security headers
- Verification tokens

### ✅ Google Sign-In
- Google OAuth 2.0 authentication
- Google Sign-in button
- One Tap sign-in
- Cross-origin identity verification

Properly handles:
- OAuth redirect flows
- Third-party cookies
- CORS headers with credentials
- Token exchange

## How It Works

### Service Worker Architecture
Radius uses two proxy engines:
1. **Ultraviolet** (`/~/uv/` prefix) - Advanced proxy with built-in CAPTCHA support
2. **Scramjet** (`/~/scramjet/` prefix) - Alternative proxy engine

Both proxies handle:
- **URL Rewriting** - Encodes and rewrites URLs to route through the proxy
- **Header Management** - Preserves and forwards authentication headers
- **Cookie Handling** - Manages cookies across origins
- **iframe Support** - Properly handles cross-origin iframes for authentication
- **CORS** - Adds necessary Access-Control headers

### Bare Server Configuration
The backend Bare server is configured to:
- Allow sufficient concurrent connections for authentication flows (500 per IP)
- Use appropriate rate limiting windows (60 seconds)
- Not filter remote URLs, allowing connections to auth services

## Usage

### Accessing Sites with reCAPTCHA
1. Navigate to any website through Radius
2. When a reCAPTCHA appears, interact with it normally
3. The proxy will handle the challenge automatically

Example sites that work:
- Google services with reCAPTCHA
- Cloudflare-protected sites
- Sites with verification challenges

### Using Google Sign-In
1. Navigate to a site with Google Sign-In
2. Click the "Sign in with Google" button
3. Complete the OAuth flow in the popup/iframe
4. The proxy maintains session cookies and tokens

### Cloudflare Verification
1. Visit a Cloudflare-protected site
2. Wait for the verification challenge to complete
3. The proxy automatically handles the challenge cookies

## Troubleshooting

### reCAPTCHA Not Loading
- Ensure JavaScript is enabled in your browser
- Clear site data and reload
- Try switching to a different proxy engine (UV vs Scramjet) in settings

### Google Sign-In Fails
- Check that third-party cookies are enabled in your browser
- Some browsers block third-party cookies by default in private/incognito mode
- Try using regular (non-private) browsing mode

### Cloudflare Endless Loop
- Clear browser cache and cookies
- Try a different browser
- Check if your IP is being rate-limited

## Technical Details

### Bare Server Rate Limiting
Default configuration (can be adjusted via environment variables):
- `BARE_MAX_CONNECTIONS_PER_IP`: 500 (default)
- `BARE_WINDOW_DURATION`: 60 seconds (default)
- `BARE_BLOCK_DURATION`: 30 seconds (default)

### Proxy Selection
Users can choose between Ultraviolet and Scramjet in Settings:
- **Ultraviolet**: Recommended for sites with CAPTCHA
- **Scramjet**: Alternative with different rewriting strategies

### Transport Protocols
- **Wisp**: WebSocket-based transport (default)
- **Bare**: HTTP-based transport (fallback)
- **Epoxy**: TLS transport with enhanced security
- **Libcurl**: Alternative transport using libcurl

## Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| reCAPTCHA | ✅ | ✅ | ✅ |
| Cloudflare | ✅ | ✅ | ✅ |
| Google Sign-In | ✅ | ✅ | ⚠️ * |

\* Safari may require additional third-party cookie permissions

## Privacy Considerations

- Authentication tokens and cookies are handled client-side
- Passwords and credentials are never logged or stored by the proxy
- OAuth flows use secure HTTPS connections
- Third-party cookies are only used for authentication purposes

## Support

If you experience issues with authentication:
1. Check the browser console for errors
2. Ensure you're using a supported browser
3. Try clearing cache and cookies
4. Report issues on [GitHub](https://github.com/RadiusProxy/Radius/issues)

## Technical Implementation

For developers interested in how this works:

### Service Worker (`public/sw.js`)
Routes requests to appropriate proxy based on URL prefix:
```javascript
if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
    return await uv.fetch(event);
} else if (sj.route(event)) {
    return await sj.fetch(event);
}
```

### UV Configuration (`public/vu/uv.config.js`)
```javascript
self.__uv$config = {
    prefix: "/~/uv/",
    encodeUrl: /* XOR encoding function */,
    decodeUrl: /* XOR decoding function */,
    // ... other config
};
```

### Bare Server (`server/index.ts`)
```javascript
const bareServer = createBareServer("/bare/", {
    connectionLimiter: {
        maxConnectionsPerIP: 500,
        windowDuration: 60,
        blockDuration: 30,
    }
});
```

## Updates

Both Ultraviolet and Scramjet are regularly updated. Keep your Radius installation up to date to ensure the latest authentication compatibility:

```bash
npm update @titaniumnetwork-dev/ultraviolet
npm update @mercuryworkshop/scramjet
```

---

For more information about Radius, see the main [README](README.md).
