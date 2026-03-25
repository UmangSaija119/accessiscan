// AccessiScan Extension — Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
    console.log('AccessiScan by Astound Digital — Extension installed');
    chrome.action.setBadgeBackgroundColor({ color: '#00c48c' });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCAN_COMPLETE') {
        const violCount = message.violations || 0;
        chrome.action.setBadgeText({ text: violCount > 0 ? String(violCount) : '✓' });
        chrome.action.setBadgeBackgroundColor({ color: violCount > 0 ? '#ef4444' : '#00c48c' });
    }
    return true;
});
