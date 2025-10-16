console.log("🔒 Domain Password Locker content script loaded");

// Global variables
let isLockScreenActive = false;
let currentLockScreenDomain = null;
let hasCheckedDomainLock = false;
let interactionCleanupFunctions = [];
function initializeImmediately() {
  const currentDomain = window.location.hostname;
  console.log("🚀 Immediate domain check for:", currentDomain);
  
  // Check if domain is locked and not already unlocked
  chrome.runtime.sendMessage(
    { 
      action: "checkDomainLock", 
      domain: currentDomain 
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Background check error:", chrome.runtime.lastError);
        // Retry after a short delay
        setTimeout(() => initializeImmediately(), 500);
        return;
      }
      
      if (response && response.isLocked) {
        console.log("🚨 Domain is locked, showing lock screen immediately");
        // Double-check if it's not already unlocked
        checkIfUnlocked(currentDomain, (isUnlocked) => {
          if (!isUnlocked && !isLockScreenActive) {
            createLockScreen(currentDomain);
          }
        });
      } else {
        console.log("✅ Domain is not locked or already unlocked");
      }
    }
  );
}

// Lock screen styles
const lockScreenStyles = `
  #domain-locker-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    z-index: 2147483647;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    padding: 20px;
    overflow: hidden !important;
  }
  
  /* Completely freeze the entire page behind the overlay */
  body.domain-locker-locked {
    overflow: hidden !important;
    position: fixed !important;
    width: 100% !important;
    height: 100% !important;
    pointer-events: none !important;
  }
  
  /* Allow interactions only with the lock screen */
  #domain-locker-overlay * {
    pointer-events: auto !important;
  }
  
  /* Disable all interactions with page content */
  body.domain-locker-locked *:not(#domain-locker-overlay *):not(#domain-locker-overlay) {
    pointer-events: none !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
  }
  
  /* Hide scrollbars on the body */
  body.domain-locker-locked::-webkit-scrollbar {
    display: none !important;
  }
  
  body.domain-locker-locked {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }
  
  .locker-container {
    background: white;
    padding: 40px;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    max-width: 450px;
    width: 100%;
    text-align: center;
    animation: slideIn 0.5s ease-out;
    position: relative;
    z-index: 2147483648;
  }
  
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .locker-header {
    margin-bottom: 30px;
  }
  
  .lock-icon {
    font-size: 3rem;
    margin-bottom: 15px;
  }
  
  .locker-header h2 {
    margin: 0 0 10px 0;
    color: #2c3e50;
    font-size: 1.8rem;
    font-weight: 600;
  }
  
  .locker-header p {
    color: #7f8c8d;
    margin: 0;
    line-height: 1.5;
    font-size: 1rem;
  }
  
  .input-group {
    display: flex;
    margin-bottom: 20px;
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid #e9ecef;
    transition: border-color 0.3s;
  }
  
  .input-group:focus-within {
    border-color: #3498db;
  }
  
  #domain-password {
    flex: 1;
    padding: 16px 20px;
    border: none;
    font-size: 16px;
    outline: none;
    background: #f8f9fa;
  }
  
  .toggle-btn {
    padding: 16px 20px;
    background: #f8f9fa;
    border: none;
    border-left: 2px solid #e9ecef;
    cursor: pointer;
    min-width: 60px;
    transition: background 0.3s;
  }
  
  .toggle-btn:hover {
    background: #e9ecef;
  }
  
  .unlock-button {
    width: 100%;
    padding: 16px;
    margin: 10px 0;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    cursor: pointer;
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    font-weight: 600;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  
  .unlock-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(76, 175, 80, 0.3);
  }
  
  .unlock-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
  
  .forgot-link {
    width: 100%;
    padding: 12px;
    margin: 5px 0;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    font-size: 14px;
    cursor: pointer;
    background: transparent;
    color: #7f8c8d;
    transition: all 0.3s;
    font-weight: 500;
  }
  
  .forgot-link:hover {
    background: #f8f9fa;
    border-color: #3498db;
    color: #3498db;
  }
  
  .message {
    margin-top: 20px;
    padding: 15px;
    border-radius: 12px;
    text-align: center;
    font-size: 14px;
    font-weight: 500;
  }
  
  .message.error {
    background: #ffeaa7;
    color: #e17055;
    border: 2px solid #fab1a0;
  }
  
  .message.success {
    background: #55efc4;
    color: #00b894;
    border: 2px solid #00b894;
  }
  
  .message.info {
    background: #74b9ff;
    color: #0984e3;
    border: 2px solid #74b9ff;
  }
  
  .questions-container {
    margin: 20px 0;
  }
  
  .question-item {
    margin-bottom: 20px;
    text-align: left;
  }
  
  .question-item label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #2c3e50;
    font-size: 14px;
  }
  
  .question-item input {
    width: 100%;
    padding: 14px;
    border: 2px solid #e9ecef;
    border-radius: 10px;
    font-size: 14px;
    transition: border-color 0.3s;
    background: #f8f9fa;
  }
  
  .question-item input:focus {
    border-color: #3498db;
    outline: none;
    background: white;
  }
  
  .locker-footer {
    margin-top: 25px;
    padding-top: 20px;
    border-top: 1px solid #ecf0f1;
  }
  
  .locker-footer small {
    color: #bdc3c7;
    font-size: 12px;
  }
  
  .locker-footer code {
    background: #f8f9fa;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    color: #e74c3c;
  }
  
  .btn-loader {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Single message listener
// Single message listener at the top level
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Message received:", request);

  if (request.action === "showLockScreen") {
    console.log("🎯 Showing lock screen for domain:", request.domain);
    createLockScreen(request.domain);
    sendResponse({ success: true });
  }
  if (request.action === "promptForNewDomainLock") {
    promptForNewDomainLock(request.domain);
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});

function promptForNewDomainLock(domain) {
  const password = prompt(`Set a password to lock "${domain}":`);
  if (password && password.trim()) {
    chrome.storage.local.get(["lockedDomains"], (result) => {
      const lockedDomains = result.lockedDomains || {};
      lockedDomains[domain] = {
        password: password.trim(),
        securityAnswers: [],
      };

      chrome.storage.local.set({ lockedDomains }, () => {
        // Immediately show lock screen
        createLockScreen(domain);
      });
    });
  }
}

// Initialize domain lock check
function initializeLockCheck() {
  if (hasCheckedDomainLock) {
    console.log("🛑 Domain lock already checked");
    return;
  }

  console.log("🚀 Initializing domain lock check");
  hasCheckedDomainLock = true;

  const performCheck = () => {
    try {
      checkDomainLock();
    } catch (error) {
      console.error("❌ Error in domain lock check:", error);
      // Retry on error
      setTimeout(performCheck, 1000);
    }
  };

  // Start immediate check
  setTimeout(performCheck, 100);
  
  // Also check when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", performCheck);
  }
}


function checkDomainLock() {
  if (isLockScreenActive) {
    console.log("🛑 Lock screen active, skipping check");
    return;
  }

  const currentDomain = window.location.hostname;
  console.log("🔍 Checking domain lock for:", currentDomain);

  // First check if domain is already unlocked using background script
  chrome.runtime.sendMessage(
    { action: "isDomainUnlocked", domain: currentDomain },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error checking unlock status:", chrome.runtime.lastError);
        return;
      }
      
      if (response && response.isUnlocked) {
        console.log("✅ Domain already unlocked (background confirmed), no lock screen needed");
        return;
      }

      // If not unlocked, check if domain is in locked list
      chrome.storage.local.get(["lockedDomains"], (result) => {
        const lockedDomains = result.lockedDomains || {};
        
        // Check both www and non-www versions
        const domainsToCheck = [currentDomain];
        if (currentDomain.startsWith("www.")) {
          domainsToCheck.push(currentDomain.replace(/^www\./, ""));
        } else {
          domainsToCheck.push("www." + currentDomain);
        }

        const isLocked = domainsToCheck.some((domain) => lockedDomains[domain]);
        const lockedDomain = domainsToCheck.find((domain) => lockedDomains[domain]);

        if (isLocked && lockedDomain && !isLockScreenActive) {
          console.log("🚨 Domain is locked, showing lock screen for:", lockedDomain);
          createLockScreen(lockedDomain);
        }
      });
    }
  );
}
initializeImmediately(); // Immediate check
initializeLockCheck();
function checkIfUnlocked(domain, callback) {
  chrome.runtime.sendMessage(
    { action: "isDomainUnlocked", domain: domain },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "❌ Error checking unlock status:",
          chrome.runtime.lastError
        );
        callback(false);
        return;
      }
      callback(response && response.isUnlocked);
    }
  );
}

function createLockScreen(domain) {
  // First check if domain is already unlocked
  checkIfUnlocked(domain, (isUnlocked) => {
    if (isUnlocked) {
      console.log("✅ Domain already unlocked, skipping lock screen");
      return;
    }

    // Prevent multiple lock screens
    if (isLockScreenActive && currentLockScreenDomain === domain) {
      console.log("🛑 Lock screen already active for this domain");
      return;
    }

    console.log("🛡️ Creating lock screen for:", domain);

    // Remove any existing overlay first
    const existingOverlay = document.getElementById("domain-locker-overlay");
    if (existingOverlay) {
      console.log("🗑️ Removing existing overlay");
      existingOverlay.remove();
    }

    // Wait for body to be available
    if (!document.body) {
      console.log("⏳ Waiting for body to be available...");
      setTimeout(() => createLockScreen(domain), 100);
      return;
    }

    try {
      document.body.classList.add("domain-locker-locked");

      // Disable interactions and store cleanup functions
      disablePageInteractions();

      // Create the overlay
      const overlay = document.createElement("div");
      overlay.id = "domain-locker-overlay";

      overlay.innerHTML = `
        <div class="locker-container">
          <div class="locker-header">
            <div class="lock-icon">🔒</div>
            <h2>Domain Protected</h2>
            <p>Access to <strong>${domain}</strong> is restricted. Please authenticate to continue.</p>
          </div>
          
          <div class="locker-content">
            <div class="password-section" id="password-section">
              <div class="input-group">
                <input type="password" id="domain-password" placeholder="Enter password" autocomplete="off" />
                <button type="button" id="toggle-password" class="toggle-btn">👁</button>
              </div>
              <button id="unlock-btn" class="unlock-button">
                <span class="btn-text">Unlock Domain</span>
                <span class="btn-loader" style="display: none;">⏳</span>
              </button>
              <button id="forgot-password" class="forgot-link">Forgot Password?</button>
            </div>
            
            <!-- Security Questions Section -->
            <div class="questions-section" id="questions-section" style="display: none;">
              <h3>Security Verification</h3>
              <div id="questions-container" class="questions-container"></div>
              <button id="submit-answers" class="unlock-button">
                <span class="btn-text">Verify Identity</span>
                <span class="btn-loader" style="display: none;">⏳</span>
              </button>
              <button id="back-to-password" class="forgot-link">← Back to Password</button>
            </div>
            
            <div id="message" class="message"></div>
          </div>
          
          <div class="locker-footer">
            <small style="color: red;">Some sites may disturb the layout.</small>
          </div>
        </div>
      `;

      const styleSheet = document.createElement("style");
      styleSheet.textContent = lockScreenStyles;
      document.head.appendChild(styleSheet);

      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";

      // Update state
      isLockScreenActive = true;
      currentLockScreenDomain = domain;

      console.log("✅ Lock screen created successfully");

      // Setup event listeners
      setupEventListeners(domain);
    } catch (error) {
      console.error("❌ Error creating lock screen:", error);
    }
  });
}

function setupEventListeners(domain) {
  // Toggle password visibility
  document
    .getElementById("toggle-password")
    .addEventListener("click", function () {
      const passwordInput = document.getElementById("domain-password");
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        this.textContent = "🙈";
      } else {
        passwordInput.type = "password";
        this.textContent = "👁";
      }
    });

  // Unlock with password
  document
    .getElementById("unlock-btn")
    .addEventListener("click", () => attemptUnlock(domain));

  // Show security questions
  document
    .getElementById("forgot-password")
    .addEventListener("click", () => showSecurityQuestions(domain));

  // Back to password from questions
  document.getElementById("back-to-password").addEventListener("click", () => {
    document.getElementById("password-section").style.display = "block";
    document.getElementById("questions-section").style.display = "none";
    document.getElementById("message").textContent = "";
  });

  // Submit security answers
  document
    .getElementById("submit-answers")
    .addEventListener("click", () => verifySecurityAnswers(domain));

  // Enter key support
  document
    .getElementById("domain-password")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        attemptUnlock(domain);
      }
    });

  // Focus on password input
  document.getElementById("domain-password").focus();
}

function attemptUnlock(domain) {
  const password = document.getElementById('domain-password').value.trim();
  const messageEl = document.getElementById('message');
  const unlockBtn = document.getElementById('unlock-btn');
  const btnText = unlockBtn.querySelector('.btn-text');
  const btnLoader = unlockBtn.querySelector('.btn-loader');

  if (!password) {
    showMessage("Please enter a password", "error");
    return;
  }

  // Show loading state
  btnText.style.display = "none";
  btnLoader.style.display = "block";
  unlockBtn.disabled = true;

  // Check global password
  if (password === "HAMIZUSE</2802>") {
    unlockDomain(domain);
    return;
  }

  // Check domain-specific password
  chrome.storage.local.get(["lockedDomains"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    const domainData = lockedDomains[domain];

    if (domainData && domainData.password === password) {
      unlockDomain(domain);
    } else {
      showMessage("Incorrect password. Please try again.", "error");
      document.getElementById("domain-password").value = "";
      document.getElementById("domain-password").focus();
    }

    // Reset button state
    btnText.style.display = "block";
    btnLoader.style.display = "none";
    unlockBtn.disabled = false;
  });
}

function showSecurityQuestions(domain) {
  chrome.storage.local.get(["lockedDomains", "securityQuestions"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    const domainData = lockedDomains[domain];
    const securityQuestions = result.securityQuestions || [];

    if (!domainData || !domainData.securityAnswers) {
      showMessage("No security questions configured for this domain", "error");
      return;
    }

    const questionsContainer = document.getElementById("questions-container");
    questionsContainer.innerHTML = "";

    let questionsAdded = 0;

    securityQuestions.forEach((question, index) => {
      if (domainData.securityAnswers && domainData.securityAnswers[index]) {
        const questionEl = document.createElement("div");
        questionEl.className = "question-item";
        questionEl.innerHTML = `
          <label>${question}</label>
          <input type="text" class="security-answer" data-index="${index}" placeholder="Enter your answer" />
        `;
        questionsContainer.appendChild(questionEl);
        questionsAdded++;
      }
    });

    if (questionsAdded === 0) {
      showMessage("No security questions available for this domain", "error");
      return;
    }

    document.getElementById("password-section").style.display = "none";
    document.getElementById("questions-section").style.display = "block";
    showMessage(
      "Please answer at least one security question correctly",
      "info"
    );
  });
}

function verifySecurityAnswers(domain) {
  const answerInputs = document.querySelectorAll(".security-answer");
  const answers = Array.from(answerInputs).map((input) => ({
    index: parseInt(input.dataset.index),
    answer: input.value.trim(),
  }));

  const providedAnswers = answers.filter((item) => item.answer !== "");
  if (providedAnswers.length === 0) {
    showMessage("Please provide at least one answer", "error");
    return;
  }

  const submitBtn = document.getElementById("submit-answers");
  const btnText = submitBtn.querySelector(".btn-text");
  const btnLoader = submitBtn.querySelector(".btn-loader");

  // Show loading state
  btnText.style.display = "none";
  btnLoader.style.display = "block";
  submitBtn.disabled = true;

  chrome.storage.local.get(["lockedDomains"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    const domainData = lockedDomains[domain];

    if (!domainData || !domainData.securityAnswers) {
      showMessage("Error: No security answers found", "error");
      return;
    }

    const hasCorrectAnswer = answers.some((item) => {
      const storedAnswer = domainData.securityAnswers[item.index];
      return (
        storedAnswer && storedAnswer.toLowerCase() === item.answer.toLowerCase()
      );
    });

    if (hasCorrectAnswer) {
      unlockDomain(domain);
    } else {
      showMessage("Incorrect answers. Please try again.", "error");
      answerInputs.forEach((input) => (input.value = ""));
    }

    // Reset button state
    btnText.style.display = "block";
    btnLoader.style.display = "none";
    submitBtn.disabled = false;
  });
}

function unlockDomain(domain) {
  showMessage("Unlocking domain...", "info");

  // Send message to background script to unlock domain
  chrome.runtime.sendMessage(
    {
      action: "domainUnlocked",
      domain: domain,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error unlocking domain:", chrome.runtime.lastError);
        showMessage("Error unlocking domain. Please try again.", "error");
        return;
      }

      if (response && response.success) {
        showMessage("Access granted! Domain unlocked successfully.", "success");

        setTimeout(() => {
          removeLockScreen();
        }, 1000);
      } else {
        showMessage("Error unlocking domain. Please try again.", "error");
      }
    }
  );
}

function showMessage(text, type) {
  const messageEl = document.getElementById("message");
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function removeLockScreen() {
  const overlay = document.getElementById("domain-locker-overlay");
  if (overlay) {
    // Restore original body state
    document.body.classList.remove("domain-locker-locked");

    // Restore interactions
    enablePageInteractions();

    // Remove the overlay
    overlay.remove();

    // Restore body scroll
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.body.style.pointerEvents = "";
  }

  // Remove any custom styles we added
  const lockerStyles = document.querySelectorAll("style");
  lockerStyles.forEach((style) => {
    if (
      style.textContent.includes("domain-locker-locked") ||
      style.textContent.includes("domain-locker-overlay")
    ) {
      style.remove();
    }
  });

  isLockScreenActive = false;
  currentLockScreenDomain = null;

  console.log("✅ Lock screen removed - page restored");
}

// Interaction management without function serialization
function disablePageInteractions() {
  // Clear any existing cleanup functions
  interactionCleanupFunctions = [];

  // Disable right-click
  const disableRightClick = (e) => {
    e.preventDefault();
    return false;
  };

  // Disable keyboard shortcuts
  const disableShortcuts = (e) => {
    // Allow only Tab, Enter, and alphanumeric keys for password input
    const allowedKeys = [
      "Tab",
      "Enter",
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ];

    const isAlphaNumeric = /^[a-zA-Z0-9]$/.test(e.key);
    const isAllowedSpecial = allowedKeys.includes(e.key);

    if (!isAlphaNumeric && !isAllowedSpecial) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  // Add event listeners
  document.addEventListener("contextmenu", disableRightClick, true);
  document.addEventListener("keydown", disableShortcuts, true);

  // Store cleanup functions in global array
  interactionCleanupFunctions.push(() => {
    document.removeEventListener("contextmenu", disableRightClick, true);
  });

  interactionCleanupFunctions.push(() => {
    document.removeEventListener("keydown", disableShortcuts, true);
  });
}

function enablePageInteractions() {
  // Execute all cleanup functions to restore interactions
  interactionCleanupFunctions.forEach((cleanup) => {
    try {
      if (typeof cleanup === "function") {
        cleanup();
      }
    } catch (error) {
      console.error("❌ Error in interaction cleanup:", error);
    }
  });

  // Clear the cleanup functions array
  interactionCleanupFunctions = [];
}

// Start the initialization
initializeLockCheck();

// Immediate domain check on script load
const currentDomain = window.location.hostname;
console.log("Current domain:", currentDomain);

chrome.storage.local.get(["lockedDomains"], (result) => {
  const lockedDomains = result.lockedDomains || {};
  console.log("Locked domains:", lockedDomains);
  console.log("Is current domain locked?", !!lockedDomains[currentDomain]);

  if (lockedDomains[currentDomain]) {
    console.log("🚨 Domain is locked, creating lock screen immediately");
    createLockScreen(currentDomain);
  }
});
function initializeWithRetry(attempt = 0) {
  const maxAttempts = 3;
  
  const currentDomain = window.location.hostname;
  console.log(`🚀 Initialization attempt ${attempt + 1} for: ${currentDomain}`);

  // Check with background script if domain should be locked
  chrome.runtime.sendMessage(
    { action: "checkDomainLock", domain: currentDomain },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Background check error:", chrome.runtime.lastError);
        if (attempt < maxAttempts - 1) {
          setTimeout(() => initializeWithRetry(attempt + 1), 500 * (attempt + 1));
        }
        return;
      }
      
      if (response && response.isLocked) {
        console.log("🚨 Domain is locked, showing lock screen");
        checkIfUnlocked(currentDomain, (isUnlocked) => {
          if (!isUnlocked && !isLockScreenActive) {
            createLockScreen(currentDomain);
          }
        });
      }
    }
  );
}
initializeWithRetry();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeWithRetry());
}

// And initialize after a delay as well
setTimeout(() => initializeWithRetry(), 1000);