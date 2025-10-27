// src/background/background.js
// Listen for extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Send message to content script to open sidebar
  chrome.tabs.sendMessage(tab.id, { type: "OPEN_SIDEBAR" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Content script not loaded on this tab");
    }
  });
});
