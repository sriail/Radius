// This script intercepts window.open calls and link clicks to force them to open in the parent iframe
// It must be injected into the iframe context after UV/Scramjet initialization

(function() {
    'use strict';
    
    // Store reference to original window.open
    const originalWindowOpen = window.open;
    
    // Override window.open to redirect to parent iframe
    window.open = function(url, target, features) {
        if (url && window.parent !== window) {
            // We're in an iframe, communicate with parent to navigate the iframe
            try {
                window.parent.postMessage({
                    type: 'navigate-iframe',
                    url: url.toString()
                }, '*');
                // Return null since we're not actually opening a window
                return null;
            } catch (e) {
                console.error('Failed to communicate with parent:', e);
            }
        }
        // Fallback to original behavior if not in iframe or message failed
        return originalWindowOpen.call(this, url, target, features);
    };
    
    // Intercept clicks on links with target="_blank" or similar
    document.addEventListener('click', function(e) {
        const anchor = e.target.closest('a');
        if (anchor && anchor.href) {
            const target = anchor.getAttribute('target');
            // Intercept _blank, _new, and other new window targets
            if (target === '_blank' || target === '_new' || target === '_parent' || target === '_top') {
                e.preventDefault();
                e.stopPropagation();
                // Use window.open override which will message parent
                window.open(anchor.href);
            }
        }
    }, true); // Use capture phase to intercept early
    
    // Also set base target to prevent default new window behavior
    const baseTag = document.querySelector('base');
    if (!baseTag) {
        const newBase = document.createElement('base');
        newBase.target = '_self';
        document.head.insertBefore(newBase, document.head.firstChild);
    } else if (!baseTag.hasAttribute('target')) {
        baseTag.target = '_self';
    }
})();
