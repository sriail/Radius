# Tab and Window Interception System

## Overview

This system intercepts attempts to open new tabs or windows in proxied web content (using Scramjet and Ultraviolet web proxies) and redirects them to open in the main iframe instead.

## How It Works

The solution uses a multi-layered approach:

### 1. Iframe Sandbox Attributes
The main proxy iframe in `src/pages/index.astro` includes carefully configured sandbox attributes:
```html
<iframe 
    id="iframe" 
    sandbox="allow-forms allow-modals allow-pointer-lock allow-same-origin allow-scripts allow-top-navigation allow-top-navigation-by-user-activation"
/>
```

**Note:** The `allow-popups` and `allow-popups-to-escape-sandbox` permissions are intentionally **omitted**. This blocks popup windows at the browser security level.

### 2. Client-Side Script Injection
The `radius-client.js` script is injected into every proxied page when it loads. This script:

- **Overrides `window.open()`**: Intercepts all JavaScript calls to `window.open()` and redirects them to the parent frame via postMessage
- **Intercepts `target="_blank"` links**: Uses event listeners to catch clicks on links with `target="_blank"` or `target="_new"`
- **Intercepts form submissions**: Catches form submissions with `target="_blank"` and redirects them appropriately
- **Returns fake window objects**: To prevent JavaScript errors, `window.open()` returns a fake window object instead of null

### 3. Parent-Child Communication
The system uses the `postMessage` API for secure cross-frame communication:

1. **From iframe (proxied content)** → **To parent (main page)**: 
   - The radius-client.js script sends messages of type `'radius-open-url'` with the URL to open
   
2. **Parent receives and handles**:
   - The parent page listens for these messages in `src/pages/index.astro`
   - When received, it navigates the iframe to the new URL using the proxy's URL encoding

## Files Modified/Created

### Created Files:
- `public/radius-client.js` - Client script injected into proxied pages
- `public/tab-interceptor.js` - Alternative standalone version (not currently used)
- `public/popup-test.html` - Test page for verifying interception works
- `docs/TAB_INTERCEPTION.md` - This documentation

### Modified Files:
- `src/pages/index.astro` - Added iframe sandbox attributes, script injection, and message listener
- `public/vu/uv.config.js` - Added inject configuration (optional, for future use)

## Testing

### Manual Testing
1. Start the Radius server: `npm start`
2. Navigate to a website through the proxy
3. Try clicking links with `target="_blank"` or triggering `window.open()`
4. Verify that the URL loads in the main iframe instead of opening a new tab

### Test Page
A test page is available at `/popup-test.html` with various popup scenarios:
- window.open() calls
- Links with target="_blank"
- Links with target="_new"
- Forms with target="_blank"

## Browser Compatibility

This solution works with:
- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Both Scramjet and Ultraviolet proxy backends
- ✅ CORS-compliant (uses postMessage for cross-origin communication)

## Known Limitations

1. **Same-origin requirement for injection**: The script injection happens after the iframe loads. For optimal performance, consider configuring the proxy to inject the script during HTML rewriting (future enhancement).

2. **POST form handling**: Forms with `method="POST"` and `target="_blank"` are currently redirected as GET requests. Full POST handling would require more complex implementation.

3. **Multiple simultaneous popups**: If a page tries to open multiple popups rapidly, only the last one will be loaded in the iframe.

## Security Considerations

- The iframe sandbox prevents malicious popups from escaping containment
- The `allow-same-origin` permission is required for the proxy to function but combined with `allow-scripts` could theoretically allow sandbox escape. This is a necessary trade-off for proxy functionality.
- postMessage communication validates message source to prevent spoofing

## Future Enhancements

1. **Proxy-level injection**: Configure Scramjet/Ultraviolet to inject radius-client.js during HTML rewriting for earlier execution
2. **Popup queue**: Handle multiple simultaneous popup attempts
3. **POST form support**: Properly handle POST form submissions with target="_blank"
4. **User preferences**: Allow users to toggle popup blocking on/off per-site
5. **Popup notifications**: Show a notification when a popup is intercepted

## Troubleshooting

### Popups still opening in new tabs
- Check browser console for errors
- Verify radius-client.js is being loaded (check Network tab)
- Ensure iframe has correct sandbox attributes
- Check that postMessage listener is active

### Script not injecting
- Verify the iframe content is same-origin (proxied content should be)
- Check for Content Security Policy (CSP) restrictions
- Review browser console for injection errors

## References

- [Scramjet Documentation](https://github.com/MercuryWorkshop/scramjet)
- [Ultraviolet Documentation](https://github.com/titaniumnetwork-dev/Ultraviolet)
- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [MDN: iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox)
