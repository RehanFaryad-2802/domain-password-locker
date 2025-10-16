// Track unlocked domains per tab - this will persist until Chrome is closed
const unlockedTabs = new Map();

// Track navigation history per tab
const tabNavigationHistory = new Map();

// Track if context menu is already created
let contextMenuCreated = false;

// Initialize when extension loads
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

function initializeExtension() {
  console.log("Domain Password Locker initialized");
  createContextMenu();
}

// Helper function to safely get unlocked domains for a tab
function getTabUnlockedDomains(tabId) {
  let tabUnlockedDomains = unlockedTabs.get(tabId);
  if (!tabUnlockedDomains) {
    tabUnlockedDomains = new Set();
    unlockedTabs.set(tabId, tabUnlockedDomains);
  }
  return tabUnlockedDomains;
}

// Handle extension icon click - open options page
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: "options.html" });
});

// Listen for tab updates and navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    checkAndLockDomain(tabId, tab.url);
  }
});

// Also listen for navigation events
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    // Only process main frame navigation
    checkAndLockDomain(details.tabId, details.url);
  }
});

async function checkAndLockDomain(tabId, url) {
  try {
    const domain = extractDomain(url);
    if (!domain) return;

    console.log(`🔍 Checking domain: ${domain} for tab: ${tabId}`);

    const result = await chrome.storage.local.get([
      "lockedDomains",
      "settings",
    ]);
    const lockedDomains = result.lockedDomains || {};
    const settings = result.settings || {};

    // Check both www and non-www versions
    const domainsToCheck = [domain];
    if (domain.startsWith("www.")) {
      domainsToCheck.push(domain.replace(/^www\./, ""));
    } else {
      domainsToCheck.push("www." + domain);
    }

    const lockedDomain = domainsToCheck.find((d) => lockedDomains[d]);

    if (lockedDomain) {
      // Check if this tab already has this domain unlocked
      const tabUnlockedDomains = getTabUnlockedDomains(tabId);

      // CRITICAL FIX: Check if this is a page reload
      const isReload = await isPageReload(tabId, url);

      if (isReload) {
        console.log(
          `🔄 Page reload detected - clearing unlocked state for tab ${tabId}`
        );
        // Clear the unlocked state for this domain on reload
        tabUnlockedDomains.delete(lockedDomain);
      }

      if (!tabUnlockedDomains.has(lockedDomain)) {
        console.log(`🔒 Domain ${lockedDomain} is locked for tab ${tabId}`);

        // Check if we should re-ask for navigation within same domain
        const currentUrl = new URL(url);
        const currentPath =
          currentUrl.pathname + currentUrl.search + currentUrl.hash;

        // If reask on navigation is disabled, don't lock for same domain navigation
        // If reask on navigation is disabled, don't lock for same domain navigation
        if (!settings.reaskOnNavigation) {
          const navigationType = isSameDomainNavigation(
            tabId,
            lockedDomain,
            currentPath
          );

          // Don't auto-unlock on reloads - always show lock screen
          if (navigationType === "same-domain" && navigationType !== "reload") {
            console.log(
              `✅ Same domain navigation - not locking (reask disabled)`
            );

            // Auto-unlock for this navigation since reask is disabled
            tabUnlockedDomains.add(lockedDomain);

            // Update navigation history
            tabNavigationHistory.set(tabId, {
              domain: lockedDomain,
              path: currentPath,
            });

            return;
          }
        }

        // Send lock message (either reask is enabled, or it's a different domain, or it's a reload)
        setTimeout(() => {
          sendLockMessageWithRetry(tabId, lockedDomain, 0);
        }, 300);
      } else {
        console.log(
          `✅ Domain ${lockedDomain} already unlocked for tab ${tabId}`
        );
      }
    } else {
      console.log(`🔓 Domain ${domain} not in locked domains list`);
    }
  } catch (error) {
    console.error("❌ Error in checkAndLockDomain:", error);
  }
}

// New function to detect page reloads
async function isPageReload(tabId, currentUrl) {
  try {
    const history = tabNavigationHistory.get(tabId);

    if (!history) {
      return false; // No history, so not a reload
    }

    const currentUrlObj = new URL(currentUrl);
    const currentPath =
      currentUrlObj.pathname + currentUrlObj.search + currentUrlObj.hash;

    // If the domain and path are exactly the same as the last navigation, it's likely a reload
    if (
      history.domain === currentUrlObj.hostname &&
      history.path === currentPath
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("❌ Error detecting page reload:", error);
    return false;
  }
}

function isSameDomainNavigation(tabId, domain, currentPath) {
  try {
    const history = tabNavigationHistory.get(tabId);

    if (!history) {
      // First navigation to this domain in this tab
      tabNavigationHistory.set(tabId, { domain, path: currentPath });
      console.log(`📝 First navigation to ${domain}: ${currentPath}`);
      return "first-navigation";
    }

    // Check if it's the same domain
    if (history.domain === domain) {
      // Same domain navigation
      const oldPath = history.path;

      // Update history with new path
      tabNavigationHistory.set(tabId, { domain, path: currentPath });

      console.log(
        `🔄 Navigation within ${domain}: "${oldPath}" -> "${currentPath}"`
      );

      // If paths are exactly the same, it's a reload
      if (currentPath === oldPath) {
        console.log(`🔄 Same path - likely page reload`);
        return "reload";
      }

      // Check if it's just a hash change (anchor navigation)
      const oldPathWithoutHash = oldPath.split("#")[0];
      const currentPathWithoutHash = currentPath.split("#")[0];

      if (oldPathWithoutHash === currentPathWithoutHash) {
        console.log(`🔗 Hash change only - not considered new navigation`);
        return "same-domain";
      }

      // For different paths within same domain
      console.log(
        `🆕 Different path within same domain - this is a new page navigation`
      );
      return "same-domain"; // Still same domain, just different path
    } else {
      // Different domain - update history and treat as new navigation
      tabNavigationHistory.set(tabId, { domain, path: currentPath });
      console.log(`🌐 Different domain: ${history.domain} -> ${domain}`);
      return "different-domain";
    }
  } catch (error) {
    console.error("❌ Error in isSameDomainNavigation:", error);
    return "different-domain";
  }
}

function sendLockMessageWithRetry(tabId, domain, attempt) {
  const maxAttempts = 5; // Increased from 3 to 5
  const delay = 500 * (attempt + 1); // Increased base delay

  chrome.tabs
    .sendMessage(tabId, {
      action: "showLockScreen",
      domain: domain,
    })
    .then((response) => {
      console.log(`✅ Lock screen message delivered to tab ${tabId}`);
    })
    .catch((err) => {
      console.log(
        `❌ Attempt ${attempt + 1} failed for tab ${tabId}:`,
        err.message
      );

      if (attempt < maxAttempts - 1) {
        setTimeout(() => {
          sendLockMessageWithRetry(tabId, domain, attempt + 1);
        }, delay);
      } else {
        console.log(
          `💥 Failed to deliver lock screen after ${maxAttempts} attempts`
        );
        // Final fallback: reload the tab to trigger content script again
        chrome.tabs.reload(tabId);
      }
    });
}

// Message listener for communication with content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    console.log("Message received:", request, "from tab:", sender.tab?.id);

    if (request.action === "domainUnlocked") {
      const domain = request.domain;
      const tabId = sender.tab.id;

      // Add domain to unlocked domains for this tab
      const tabUnlockedDomains = getTabUnlockedDomains(tabId);
      tabUnlockedDomains.add(domain);

      // Update navigation history with current URL
      if (sender.tab && sender.tab.url) {
        try {
          const currentUrl = new URL(sender.tab.url);
          const currentPath =
            currentUrl.pathname + currentUrl.search + currentUrl.hash;
          tabNavigationHistory.set(tabId, { domain, path: currentPath });
          console.log(
            `📝 Updated navigation history for tab ${tabId}: ${domain}${currentPath}`
          );
        } catch (urlError) {
          console.error("❌ Error parsing URL:", urlError);
        }
      }

      console.log(`✅ Domain ${domain} unlocked for tab ${tabId}`);
      sendResponse({ success: true });
    }
    if (request.action === "checkDomainLock") {
      const domain = request.domain;
      chrome.storage.local.get(["lockedDomains"], (result) => {
        try {
          const lockedDomains = result.lockedDomains || {};
          const tabId = sender.tab?.id;
          const tabUnlockedDomains = tabId
            ? getTabUnlockedDomains(tabId)
            : new Set();

          // Check both www and non-www versions
          const domainsToCheck = [domain];
          if (domain.startsWith("www.")) {
            domainsToCheck.push(domain.replace(/^www\./, ""));
          } else {
            domainsToCheck.push("www." + domain);
          }

          const isLocked = domainsToCheck.some(
            (d) => lockedDomains[d] && !tabUnlockedDomains.has(d)
          );

          console.log(`🔍 Background check for ${domain}: ${isLocked}`);
          sendResponse({ isLocked: isLocked });
        } catch (error) {
          console.error("❌ Error in checkDomainLock handler:", error);
          sendResponse({ isLocked: false });
        }
      });
      return true;
    }

    if (request.action === "isDomainUnlocked") {
      const domain = request.domain;
      const tabId = sender.tab?.id;

      try {
        const tabUnlockedDomains = tabId
          ? getTabUnlockedDomains(tabId)
          : new Set();

        // Check both www and non-www versions
        const domainsToCheck = [domain];
        if (domain.startsWith("www.")) {
          domainsToCheck.push(domain.replace(/^www\./, ""));
        } else {
          domainsToCheck.push("www." + domain);
        }

        const isUnlocked = domainsToCheck.some((d) =>
          tabUnlockedDomains.has(d)
        );

        console.log(
          `🔍 Is domain ${domain} unlocked for tab ${tabId}? ${isUnlocked}`
        );
        sendResponse({ isUnlocked: isUnlocked });
      } catch (error) {
        console.error("❌ Error in isDomainUnlocked handler:", error);
        sendResponse({ isUnlocked: false });
      }
      return true;
    }
  } catch (error) {
    console.error("❌ Error in message listener:", error);
    sendResponse({ success: false, error: error.message });
  }

  return true;
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  unlockedTabs.delete(tabId);
  tabNavigationHistory.delete(tabId);
  console.log(`🧹 Cleaned up data for tab ${tabId}`);
});

// Also clean up when tabs are replaced (like when navigating)
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  unlockedTabs.delete(removedTabId);
  tabNavigationHistory.delete(removedTabId);
  console.log(`🔄 Tab replaced: ${removedTabId} -> ${addedTabId}`);
});

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error("❌ Error extracting domain from URL:", url, e);
    return "";
  }
}

// Create context menu with duplicate prevention
function createContextMenu() {
  if (contextMenuCreated) {
    console.log("✅ Context menu already exists");
    return;
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: "lock-current-tab",
        title: "Lock This Domain",
        contexts: ["page", "selection", "link"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "❌ Error creating context menu:",
            chrome.runtime.lastError
          );
          // Reset flag if creation failed
          contextMenuCreated = false;
        } else {
          contextMenuCreated = true;
          console.log("✅ Context menu created successfully");
        }
      }
    );
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lock-current-tab") {
    lockCurrentTab(tab);
  }
});

// Lock current tab function
async function lockCurrentTab(tab) {
  if (!tab.url) return;

  const domain = extractDomain(tab.url);
  if (!domain) return;

  // Check if domain is already in locked domains
  const result = await chrome.storage.local.get(["lockedDomains"]);
  const lockedDomains = result.lockedDomains || {};

  const domainsToCheck = [domain];
  if (domain.startsWith("www.")) {
    domainsToCheck.push(domain.replace(/^www\./, ""));
  } else {
    domainsToCheck.push("www." + domain);
  }

  const existingDomain = domainsToCheck.find((d) => lockedDomains[d]);

  if (existingDomain) {
    // Domain already exists, just lock it
    const tabUnlockedDomains = getTabUnlockedDomains(tab.id);
    tabUnlockedDomains.delete(existingDomain);

    // Show lock screen
    sendLockMessageWithRetry(tab.id, existingDomain, 0);
  } else {
    // New domain - prompt for password
    chrome.tabs
      .sendMessage(tab.id, {
        action: "promptForNewDomainLock",
        domain: domain,
      })
      .catch((err) => {
        // If content script isn't ready, use a fallback
        promptForNewDomainLockFallback(tab, domain);
      });
  }
}

// Fallback if content script isn't ready
// In background.js, update this function:
function promptForNewDomainLockFallback(tab, domain) {
  const password = prompt(`Set a password to lock "${domain}":`);
  if (password && password.trim()) {
    chrome.storage.local.get(["lockedDomains"], (result) => {
      const lockedDomains = result.lockedDomains || {};
      lockedDomains[domain] = {
        password: password.trim(),
        securityAnswers: [],
        // REMOVE THIS LINE: enable2FA: false,
      };

      chrome.storage.local.set({ lockedDomains }, () => {
        // Immediately lock the domain
        const tabUnlockedDomains = getTabUnlockedDomains(tab.id);
        tabUnlockedDomains.delete(domain);

        sendLockMessageWithRetry(tab.id, domain, 0);
      });
    });
  }
}

// Auto-lock functionality
let inactivityTimer;

function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }

  chrome.storage.local.get(["settings"], (result) => {
    const settings = result.settings || {};
    if (settings.autoLockAfterTime && settings.autoLockMinutes) {
      const minutes = settings.autoLockMinutes;
      inactivityTimer = setTimeout(() => {
        lockAllDomainsDueToInactivity();
      }, minutes * 60 * 1000);
    }
  });
}

function lockAllDomainsDueToInactivity() {
  console.log("🔒 Auto-locking all domains due to inactivity");
  unlockedTabs.clear();
  tabNavigationHistory.clear();

  // Notify all tabs to show lock screens
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url) {
        checkAndLockDomain(tab.id, tab.url);
      }
    });
  });
}

// Reset timer on user activity
chrome.tabs.onActivated.addListener(resetInactivityTimer);
chrome.windows.onFocusChanged.addListener(resetInactivityTimer);

// Initialize timer
resetInactivityTimer();
