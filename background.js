const unlockedTabs = new Map();

const tabNavigationHistory = new Map();

let contextMenuCreated = false;

chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

function initializeExtension() {
  createContextMenu();
}

function getTabUnlockedDomains(tabId) {
  let tabUnlockedDomains = unlockedTabs.get(tabId);
  if (!tabUnlockedDomains) {
    tabUnlockedDomains = new Set();
    unlockedTabs.set(tabId, tabUnlockedDomains);
  }
  return tabUnlockedDomains;
}

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: "options.html" });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    checkAndLockDomain(tabId, tab.url);
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    checkAndLockDomain(details.tabId, details.url);
  }
});

async function checkAndLockDomain(tabId, url) {
  try {
    const domain = extractDomain(url);
    if (!domain) return;

    const result = await chrome.storage.local.get([
      "lockedDomains",
      "settings",
    ]);
    const lockedDomains = result.lockedDomains || {};
    const settings = result.settings || {};

    const domainsToCheck = [domain];
    if (domain.startsWith("www.")) {
      domainsToCheck.push(domain.replace(/^www\./, ""));
    } else {
      domainsToCheck.push("www." + domain);
    }

    const lockedDomain = domainsToCheck.find((d) => lockedDomains[d]);

    if (lockedDomain) {
      const tabUnlockedDomains = getTabUnlockedDomains(tabId);

      const isReload = await isPageReload(tabId, url);

      if (isReload) {
        tabUnlockedDomains.delete(lockedDomain);
      }

      if (!tabUnlockedDomains.has(lockedDomain)) {
        const currentUrl = new URL(url);
        const currentPath =
          currentUrl.pathname + currentUrl.search + currentUrl.hash;

        if (!settings.reaskOnNavigation) {
          const navigationType = isSameDomainNavigation(
            tabId,
            lockedDomain,
            currentPath
          );

          if (navigationType === "same-domain" && navigationType !== "reload") {
            tabUnlockedDomains.add(lockedDomain);

            tabNavigationHistory.set(tabId, {
              domain: lockedDomain,
              path: currentPath,
            });

            return;
          }
        }

        setTimeout(() => {
          sendLockMessageWithRetry(tabId, lockedDomain, 0);
        }, 300);
      } else {
      }
    } else {
    }
  } catch (error) {
    console.error("❌ Error in checkAndLockDomain:", error);
  }
}

async function isPageReload(tabId, currentUrl) {
  try {
    const history = tabNavigationHistory.get(tabId);

    if (!history) {
      return false;
    }

    const currentUrlObj = new URL(currentUrl);
    const currentPath =
      currentUrlObj.pathname + currentUrlObj.search + currentUrlObj.hash;

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
      tabNavigationHistory.set(tabId, { domain, path: currentPath });

      return "first-navigation";
    }

    if (history.domain === domain) {
      const oldPath = history.path;

      tabNavigationHistory.set(tabId, { domain, path: currentPath });

      if (currentPath === oldPath) {
        return "reload";
      }

      const oldPathWithoutHash = oldPath.split("#")[0];
      const currentPathWithoutHash = currentPath.split("#")[0];

      if (oldPathWithoutHash === currentPathWithoutHash) {
        return "same-domain";
      }

      return "same-domain";
    } else {
      tabNavigationHistory.set(tabId, { domain, path: currentPath });

      return "different-domain";
    }
  } catch (error) {
    console.error("❌ Error in isSameDomainNavigation:", error);
    return "different-domain";
  }
}

function sendLockMessageWithRetry(tabId, domain, attempt) {
  const maxAttempts = 5;
  const delay = 500 * (attempt + 1);

  chrome.tabs
    .sendMessage(tabId, {
      action: "showLockScreen",
      domain: domain,
    })
    .then((response) => {})
    .catch((err) => {
      if (attempt < maxAttempts - 1) {
        setTimeout(() => {
          sendLockMessageWithRetry(tabId, domain, attempt + 1);
        }, delay);
      } else {
        chrome.tabs.reload(tabId);
      }
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === "domainUnlocked") {
      const domain = request.domain;
      const tabId = sender.tab.id;

      const tabUnlockedDomains = getTabUnlockedDomains(tabId);
      tabUnlockedDomains.add(domain);

      if (sender.tab && sender.tab.url) {
        try {
          const currentUrl = new URL(sender.tab.url);
          const currentPath =
            currentUrl.pathname + currentUrl.search + currentUrl.hash;
          tabNavigationHistory.set(tabId, { domain, path: currentPath });
        } catch (urlError) {
          console.error("❌ Error parsing URL:", urlError);
        }
      }

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

          const domainsToCheck = [domain];
          if (domain.startsWith("www.")) {
            domainsToCheck.push(domain.replace(/^www\./, ""));
          } else {
            domainsToCheck.push("www." + domain);
          }

          const isLocked = domainsToCheck.some(
            (d) => lockedDomains[d] && !tabUnlockedDomains.has(d)
          );

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

        const domainsToCheck = [domain];
        if (domain.startsWith("www.")) {
          domainsToCheck.push(domain.replace(/^www\./, ""));
        } else {
          domainsToCheck.push("www." + domain);
        }

        const isUnlocked = domainsToCheck.some((d) =>
          tabUnlockedDomains.has(d)
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

chrome.tabs.onRemoved.addListener((tabId) => {
  unlockedTabs.delete(tabId);
  tabNavigationHistory.delete(tabId);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  unlockedTabs.delete(removedTabId);
  tabNavigationHistory.delete(removedTabId);
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

function createContextMenu() {
  if (contextMenuCreated) {
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

          contextMenuCreated = false;
        } else {
          contextMenuCreated = true;
        }
      }
    );
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lock-current-tab") {
    lockCurrentTab(tab);
  }
});

async function lockCurrentTab(tab) {
  if (!tab.url) return;

  const domain = extractDomain(tab.url);
  if (!domain) return;

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
    const tabUnlockedDomains = getTabUnlockedDomains(tab.id);
    tabUnlockedDomains.delete(existingDomain);

    sendLockMessageWithRetry(tab.id, existingDomain, 0);
  } else {
    chrome.tabs
      .sendMessage(tab.id, {
        action: "promptForNewDomainLock",
        domain: domain,
      })
      .catch((err) => {
        promptForNewDomainLockFallback(tab, domain);
      });
  }
}

function promptForNewDomainLockFallback(tab, domain) {
  const password = prompt(`Set a password to lock "${domain}":`);
  if (password && password.trim()) {
    chrome.storage.local.get(["lockedDomains"], (result) => {
      const lockedDomains = result.lockedDomains || {};
      lockedDomains[domain] = {
        password: password.trim(),
        securityAnswers: [],
      };

      chrome.storage.local.set({ lockedDomains }, () => {
        const tabUnlockedDomains = getTabUnlockedDomains(tab.id);
        tabUnlockedDomains.delete(domain);

        sendLockMessageWithRetry(tab.id, domain, 0);
      });
    });
  }
}

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
  unlockedTabs.clear();
  tabNavigationHistory.clear();

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url) {
        checkAndLockDomain(tab.id, tab.url);
      }
    });
  });
}

chrome.tabs.onActivated.addListener(resetInactivityTimer);
chrome.windows.onFocusChanged.addListener(resetInactivityTimer);

resetInactivityTimer();
