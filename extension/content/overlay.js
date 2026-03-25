// AccessiScan Extension — Content Script (Overlay)
// This script is injected into pages to manage the violation overlay.
// The actual overlay logic is in popup.js (toggleOverlay function injected via scripting API).

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLEAR_OVERLAY') {
        const overlay = document.getElementById('accessiscan-overlay');
        if (overlay) overlay.remove();
        document.querySelectorAll('.accessiscan-highlight').forEach(el => {
            el.classList.remove('accessiscan-highlight');
            el.removeAttribute('data-accessiscan-label');
            el.removeAttribute('data-accessiscan-impact');
        });
        sendResponse({ cleared: true });
    }
    return true;
});
