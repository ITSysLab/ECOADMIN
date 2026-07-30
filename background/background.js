// Background Service Worker for ECOADMIN Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ECOADMIN] Extension installed successfully.');
});

// Listener for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'OK', message: 'ECOADMIN Background active' });
  }
  return true;
});
