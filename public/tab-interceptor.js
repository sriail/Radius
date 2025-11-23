/**
 * Tab and Window Interceptor for Radius Proxy
 * 
 * This script intercepts attempts to open new tabs or windows in proxied content
 * and redirects them to open in the main iframe instead.
 * 
 * Works with both Scramjet and Ultraviolet web proxies.
 */

(function() {
    'use strict';

    // Store the original window.open function
    const originalWindowOpen = window.open;
    
    // Get a reference to the parent window (if in iframe)
    const isInIframe = window.self !== window.top;
    
    /**
     * Intercept window.open() calls
     */
    window.open = function(...args) {
        const url = args[0];
        const target = args[1];
        const features = args[2];
        
        // If we're in an iframe and can communicate with parent
        if (isInIframe && window.parent) {
            try {
                // Send message to parent to load URL in main iframe
                window.parent.postMessage({
                    type: 'radius-open-url',
                    url: url,
                    target: target,
                    features: features
                }, window.location.origin);
                
                // Return a fake window object to prevent errors
                return {
                    closed: false,
                    close: () => {},
                    focus: () => {},
                    blur: () => {},
                    postMessage: () => {}
                };
            } catch (e) {
                console.warn('Failed to intercept window.open:', e);
                // Fallback to original behavior if interception fails
                return originalWindowOpen.apply(this, args);
            }
        }
        
        // If not in iframe, use original behavior
        return originalWindowOpen.apply(this, args);
    };
    
    /**
     * Intercept clicks on links with target="_blank"
     */
    document.addEventListener('click', function(event) {
        // Find the closest anchor element
        let target = event.target;
        while (target && target.tagName !== 'A') {
            target = target.parentElement;
        }
        
        // If it's a link with target="_blank" or similar
        if (target && target.tagName === 'A') {
            const linkTarget = target.getAttribute('target');
            
            if (linkTarget === '_blank' || linkTarget === '_new') {
                event.preventDefault();
                event.stopPropagation();
                
                const href = target.href;
                
                if (isInIframe && window.parent) {
                    // Send message to parent to load URL in main iframe
                    window.parent.postMessage({
                        type: 'radius-open-url',
                        url: href,
                        target: linkTarget
                    }, window.location.origin);
                } else {
                    // If not in iframe, navigate in current window
                    window.location.href = href;
                }
            }
        }
    }, true); // Use capture phase to intercept before other handlers
    
    /**
     * Intercept form submissions with target="_blank"
     */
    document.addEventListener('submit', function(event) {
        const form = event.target;
        
        if (form && form.tagName === 'FORM') {
            const formTarget = form.getAttribute('target');
            
            if (formTarget === '_blank' || formTarget === '_new') {
                event.preventDefault();
                event.stopPropagation();
                
                // Build form data
                const formData = new FormData(form);
                const action = form.action || window.location.href;
                const method = (form.method || 'GET').toUpperCase();
                
                if (isInIframe && window.parent) {
                    // Send message to parent
                    window.parent.postMessage({
                        type: 'radius-form-submit',
                        url: action,
                        method: method,
                        data: Object.fromEntries(formData),
                        target: formTarget
                    }, window.location.origin);
                }
            }
        }
    }, true);
    
    console.log('Radius Tab Interceptor loaded');
})();
