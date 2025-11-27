/**
 * Radius Client Script
 * 
 * This script runs in proxied pages to intercept window.open and new tab attempts,
 * redirecting them to the parent iframe instead.
 * 
 * This works with both Scramjet and Ultraviolet proxies.
 */

(function() {
    'use strict';
    
    // Check if we're in an iframe
    const isInIframe = window.self !== window.top;
    
    if (!isInIframe) {
        // Not in an iframe, no need to intercept
        return;
    }
    
    // Store original functions
    const originalWindowOpen = window.open;
    
    /**
     * Override window.open to redirect to parent iframe
     */
    window.open = function(url, target, features) {
        try {
            // Notify parent to navigate to the URL
            // Using window.location.origin as target origin for security
            window.parent.postMessage({
                type: 'radius-open-url',
                url: url || 'about:blank',
                target: target,
                features: features
            }, window.location.origin);
            
            // Return a fake window object to satisfy callers
            const fakeWindow = {
                closed: false,
                close: function() { this.closed = true; },
                focus: function() {},
                blur: function() {},
                postMessage: function() {},
                location: { href: url || 'about:blank' },
                document: {},
                opener: window,
                parent: window,
                top: window,
                name: target || ''
            };
            
            return fakeWindow;
        } catch (e) {
            console.warn('Radius: Failed to intercept window.open, falling back:', e);
            // If postMessage fails, try original (though it may be blocked by sandbox)
            return originalWindowOpen.call(this, url, target, features);
        }
    };
    
    // Preserve toString to avoid detection
    window.open.toString = function() {
        return 'function open() { [native code] }';
    };
    
    /**
     * Intercept link clicks with target="_blank" or "_new"
     */
    document.addEventListener('click', function(event) {
        let element = event.target;
        
        // Traverse up to find an anchor tag
        while (element && element.tagName !== 'A') {
            element = element.parentElement;
            if (!element) return;
        }
        
        // Check if it's a link with target="_blank" or "_new"
        if (element.tagName === 'A') {
            const target = element.getAttribute('target');
            
            if (target === '_blank' || target === '_new') {
                // Prevent default new tab behavior
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                const href = element.href;
                
                // Notify parent
                try {
                    window.parent.postMessage({
                        type: 'radius-open-url',
                        url: href,
                        target: target
                    }, window.location.origin);
                } catch (e) {
                    console.warn('Radius: Failed to send message to parent:', e);
                    // Fallback: navigate in current window
                    window.location.href = href;
                }
            }
        }
    }, true); // Use capture to intercept early
    
    /**
     * Intercept form submissions with target="_blank" or "_new"  
     */
    document.addEventListener('submit', function(event) {
        const form = event.target;
        
        if (form && form.tagName === 'FORM') {
            const target = form.getAttribute('target');
            
            if (target === '_blank' || target === '_new') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                // Resolve action to absolute URL
                const action = form.action || window.location.href;
                const method = (form.method || 'GET').toUpperCase();
                
                // Warn if method was not specified (potential security concern)
                if (!form.method) {
                    console.warn('Radius: Form has no method specified, defaulting to GET. Sensitive data may be exposed in URL.');
                }
                
                if (method === 'GET') {
                    // For GET, build URL with form data
                    const formData = new FormData(form);
                    const params = new URLSearchParams(formData);
                    const separator = action.includes('?') ? '&' : '?';
                    const fullUrl = action + separator + params.toString();
                    
                    try {
                        window.parent.postMessage({
                            type: 'radius-open-url',
                            url: fullUrl,
                            target: target
                        }, window.location.origin);
                    } catch (e) {
                        console.warn('Radius: Failed to send form data to parent:', e);
                        window.location.href = fullUrl;
                    }
                } else {
                    // For POST and other methods, just navigate to the action URL
                    // (proper POST handling would require more complex implementation)
                    try {
                        window.parent.postMessage({
                            type: 'radius-open-url',
                            url: action,
                            target: target
                        }, window.location.origin);
                    } catch (e) {
                        console.warn('Radius: Failed to send form action to parent:', e);
                        window.location.href = action;
                    }
                }
            }
        }
    }, true);
    
    console.log('Radius client script initialized - new tab/window interception active');
})();
