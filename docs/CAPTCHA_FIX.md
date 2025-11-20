# CAPTCHA Compatibility Fix

## Problem Statement

When attempting to load CAPTCHA verification systems (reCAPTCHA, hCaptcha, Cloudflare Turnstile, Yandex Cloud, etc.) through the Ultraviolet proxy, the following errors occurred:

```
Uncaught DataCloneError: Failed to execute 'postMessage' on 'Window': 
A MessagePort could not be cloned because it was not transferred.
```

Additionally, preload resource warnings appeared:
```
A preload for '...' is found, but is not used because the request credentials mode does not match. 
Consider taking a look at crossorigin attribute.
```

## Root Cause

The issue stems from how Ultraviolet intercepts `postMessage` calls. CAPTCHA systems extensively use `postMessage` with `MessagePort` objects for secure cross-origin communication between iframes. According to the [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), `MessagePort` objects cannot be cloned - they must be explicitly transferred via the `transfer` parameter.

When UV intercepts `postMessage`, it doesn't properly handle the transfer of `MessagePort` objects, causing the `DataCloneError`.

## Solution

### 1. CAPTCHA Patch Script (`/public/captcha-patch.js`)

A standalone script that must be loaded **before** the UV handler. It patches `Window.prototype.postMessage` to:

- Recursively scan the message object for `MessagePort` instances
- Automatically add found ports to the `transfer` array
- Properly invoke the native `postMessage` with transfers

**Key Features:**
- Avoids circular references with `WeakSet` tracking
- Fallback to original implementation on error
- Marks itself to prevent UV from overriding the fix

### 2. Enhanced CAPTCHA Handler (`src/utils/captcha-handler.ts`)

Extended to provide comprehensive CAPTCHA support:

**`patchPostMessage()` Function:**
- Secondary patch layer for iframe contentWindow
- Handles edge cases UV might miss
- Ensures proper MessagePort transfer in all contexts

**Preload Resource Monitor:**
- Watches for `<link rel="preload">` elements for CAPTCHA resources
- Automatically adds `crossorigin="anonymous"` attribute
- Sets appropriate `as` attribute (script, style, font) based on file type

**Supported CAPTCHA Providers:**
- Google reCAPTCHA v2/v3
- hCaptcha
- Cloudflare Turnstile
- Yandex Cloud CAPTCHA
- Other providers using similar patterns

### 3. Service Worker Updates (`public/sw.js`)

Added CAPTCHA domain detection for proper request handling:
- Preserves credentials for CAPTCHA cookies
- Ensures proper headers for CAPTCHA requests
- Handles special routing for verification domains

### 4. Proxy Initialization (`src/utils/proxy.ts`)

Modified to load the CAPTCHA patch **before** UV scripts:
```javascript
createScript("/captcha-patch.js", false); // Load first
createScript("/vu/uv.bundle.js", true);
createScript("/vu/uv.config.js", true);
```

## Technical Details

### MessagePort Transfer

The fix implements the proper way to handle MessagePorts in `postMessage`:

```javascript
// ❌ WRONG - Causes DataCloneError
window.postMessage(messageWithPort, "*");

// ✅ CORRECT - Transfers the port
window.postMessage(messageWithPort, "*", [messagePort]);
```

Our patch automatically detects ports in the message and constructs the proper transfer array.

### Crossorigin Attribute

CAPTCHA resources often load from different origins (e.g., `gstatic.com` for reCAPTCHA). Preload hints must match the credential mode:

```html
<!-- Without crossorigin, credentials mode mismatch occurs -->
<link rel="preload" href="https://www.gstatic.com/recaptcha/..." as="script">

<!-- Fixed with crossorigin attribute -->
<link rel="preload" href="https://www.gstatic.com/recaptcha/..." as="script" crossorigin="anonymous">
```

## Testing

To test CAPTCHA functionality:

1. Build the project: `npm run build`
2. Start the server: `npm start`
3. Navigate through the proxy to a site with CAPTCHA:
   - reCAPTCHA: https://www.google.com/recaptcha/api2/demo
   - hCaptcha: https://www.hcaptcha.com/
   - Cloudflare Turnstile: Sites with Cloudflare bot protection

The CAPTCHA should load and function properly without console errors.

## Browser Compatibility

The fix is compatible with all modern browsers that support:
- `Window.prototype.postMessage`
- `MessagePort` API
- `MutationObserver`
- `WeakSet` (for circular reference detection)

This includes:
- Chrome/Edge 60+
- Firefox 55+
- Safari 11+

## Security Considerations

- The patch does not modify the security model of `postMessage`
- MessagePorts are still transferred (not cloned), maintaining their single-owner semantics
- CAPTCHA verification still occurs server-side; this only fixes client-side communication
- No sensitive data is exposed or logged

## Future Improvements

Potential enhancements:
- Upstream fix to Ultraviolet to natively handle MessagePort transfers
- Performance optimization for large object trees
- Support for additional transferable objects (e.g., ArrayBuffer)

## References

- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [MDN: MessagePort](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort)
- [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- [HTML Spec: MessagePort transfer](https://html.spec.whatwg.org/multipage/web-messaging.html#message-ports)
