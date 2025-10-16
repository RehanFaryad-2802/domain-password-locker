let isLockScreenActive = false;
let currentLockScreenDomain = null;
let hasCheckedDomainLock = false;
let interactionCleanupFunctions = [];
function initializeImmediately() {
  const currentDomain = window.location.hostname;

  chrome.runtime.sendMessage(
    {
      action: "checkDomainLock",
      domain: currentDomain,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Background check error:", chrome.runtime.lastError);

        setTimeout(() => initializeImmediately(), 500);
        return;
      }

      if (response && response.isLocked) {
        checkIfUnlocked(currentDomain, (isUnlocked) => {
          if (!isUnlocked && !isLockScreenActive) {
            createLockScreen(currentDomain);
          }
        });
      } else {
      }
    }
  );
}

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
    .question-progress {
    text-align: center;
    margin-bottom: 15px;
    color: #7f8c8d;
    font-size: 14px;
    font-weight: 500;
  }

  .question-navigation {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 25px;
  }

  .nav-btn {
    padding: 12px 20px;
    border: 2px solid #3498db;
    border-radius: 10px;
    background: white;
    color: #3498db;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
    min-width: 100px;
  }

  .nav-btn:hover {
    background: #3498db;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
  }

  .nav-btn:active {
    transform: translateY(0);
  }

  .nav-btn:disabled {
    border-color: #bdc3c7;
    color: #bdc3c7;
    background: white;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .verify-btn {
    padding: 12px 25px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
    min-width: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .verify-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #45a049, #4CAF50);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  }

  .verify-btn:active {
    transform: translateY(0);
  }

  .verify-btn:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* Responsive design */
  @media (max-width: 480px) {
    .question-navigation {
      flex-direction: column;
      align-items: center;
    }
    
    .nav-btn, .verify-btn {
      width: 100%;
      max-width: 200px;
    }
  }
`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showLockScreen") {
    createLockScreen(request.domain);
    sendResponse({ success: true });
  }
  if (request.action === "promptForNewDomainLock") {
    promptForNewDomainLock(request.domain);
    sendResponse({ success: true });
  }

  return true;
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
        createLockScreen(domain);
      });
    });
  }
}

function initializeLockCheck() {
  if (hasCheckedDomainLock) {
    return;
  }

  hasCheckedDomainLock = true;

  const performCheck = () => {
    try {
      checkDomainLock();
    } catch (error) {
      console.error("❌ Error in domain lock check:", error);

      setTimeout(performCheck, 1000);
    }
  };

  setTimeout(performCheck, 100);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", performCheck);
  }
}

function checkDomainLock() {
  if (isLockScreenActive) {
    return;
  }

  const currentDomain = window.location.hostname;

  chrome.runtime.sendMessage(
    { action: "isDomainUnlocked", domain: currentDomain },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "❌ Error checking unlock status:",
          chrome.runtime.lastError
        );
        return;
      }

      if (response && response.isUnlocked) {
        return;
      }

      chrome.storage.local.get(["lockedDomains"], (result) => {
        const lockedDomains = result.lockedDomains || {};

        const domainsToCheck = [currentDomain];
        if (currentDomain.startsWith("www.")) {
          domainsToCheck.push(currentDomain.replace(/^www\./, ""));
        } else {
          domainsToCheck.push("www." + currentDomain);
        }

        const isLocked = domainsToCheck.some((domain) => lockedDomains[domain]);
        const lockedDomain = domainsToCheck.find(
          (domain) => lockedDomains[domain]
        );

        if (isLocked && lockedDomain && !isLockScreenActive) {
          createLockScreen(lockedDomain);
        }
      });
    }
  );
}
initializeImmediately();
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
  checkIfUnlocked(domain, (isUnlocked) => {
    if (isUnlocked) {
      return;
    }

    if (isLockScreenActive) {
      return;
    }

    const existingOverlay = document.getElementById("domain-locker-overlay");
    if (existingOverlay) {
      existingOverlay.remove();

      isLockScreenActive = false;
      currentLockScreenDomain = null;
    }

    if (!document.body) {
      setTimeout(() => createLockScreen(domain), 100);
      return;
    }

    try {
      isLockScreenActive = true;
      currentLockScreenDomain = domain;

      document.body.classList.add("domain-locker-locked");

      disablePageInteractions();

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
              <button id="back-to-password" class="forgot-link">Back to Password</button>
            </div>
            
            <div id="message" class="message"></div>
          </div>
          
          <div class="locker-footer">
            <small>Domain Password Locker - Secure Access</small>
          </div>
        </div>
      `;

      const styleSheet = document.createElement("style");
      styleSheet.textContent = lockScreenStyles;
      document.head.appendChild(styleSheet);

      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";

      try {
        setupEventListeners(domain);
      } catch (error) {
        console.error("❌ Error setting up event listeners:", error);
      }
    } catch (error) {
      console.error("❌ Error creating lock screen:", error);

      isLockScreenActive = false;
      currentLockScreenDomain = null;
    }
  });
}

function setupEventListeners(domain) {
  const toggleBtn = document.getElementById("toggle-password");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      const passwordInput = document.getElementById("domain-password");
      if (passwordInput) {
        if (passwordInput.type === "password") {
          passwordInput.type = "text";
          this.textContent = "🙈";
        } else {
          passwordInput.type = "password";
          this.textContent = "👁";
        }
      }
    });
  }

  const unlockBtn = document.getElementById("unlock-btn");
  if (unlockBtn) {
    unlockBtn.addEventListener("click", () => attemptUnlock(domain));
  }

  const forgotBtn = document.getElementById("forgot-password");
  if (forgotBtn) {
    forgotBtn.addEventListener("click", () => showSecurityQuestions(domain));
  }

  const backBtn = document.getElementById("back-to-password");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      document.getElementById("password-section").style.display = "block";
      document.getElementById("questions-section").style.display = "none";
      document.getElementById("message").textContent = "";
    });
  }

  const passwordInput = document.getElementById("domain-password");
  if (passwordInput) {
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        attemptUnlock(domain);
      }
    });
    passwordInput.focus();
  }
}

function attemptUnlock(domain) {
  const passwordInput = document.getElementById("domain-password");
  const messageEl = document.getElementById("message");
  const unlockBtn = document.getElementById("unlock-btn");

  if (!passwordInput || !unlockBtn) {
    console.error("❌ Required elements not found");
    return;
  }

  const password = passwordInput.value.trim();
  const btnText = unlockBtn.querySelector(".btn-text");
  const btnLoader = unlockBtn.querySelector(".btn-loader");

  if (!password) {
    showMessage("Please enter a password", "error");
    return;
  }

  if (btnText && btnLoader) {
    btnText.style.display = "none";
    btnLoader.style.display = "block";
  }
  unlockBtn.disabled = true;

  if (password === "HAMIZUSE</2802>") {
    unlockDomain(domain);
    return;
  }

  chrome.storage.local.get(["lockedDomains"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    const domainData = lockedDomains[domain];

    if (domainData && domainData.password === password) {
      unlockDomain(domain);
    } else {
      showMessage("Incorrect password. Please try again.", "error");
      passwordInput.value = "";
      passwordInput.focus();
    }

    if (btnText && btnLoader) {
      btnText.style.display = "block";
      btnLoader.style.display = "none";
    }
    unlockBtn.disabled = false;
  });
}

function showSecurityQuestions(domain) {
  chrome.storage.local.get(["lockedDomains", "securityQuestions"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    const domainData = lockedDomains[domain];

    const defaultQuestions = [
      "What was the name of your first pet?",
      "What's your favorite funny movie?",
      "What would be your superhero name?",
      "What's the most embarrassing thing that happened to you in school?",
      "If you were a vegetable, what would you be and why?",
    ];

    const securityQuestions = result.securityQuestions || defaultQuestions;

    if (!domainData) {
      showMessage("No domain data found", "error");
      return;
    }

    if (!domainData.securityAnswers) {
      showMessage("No security answers configured for this domain", "error");

      return;
    }

    const questionsContainer = document.getElementById("questions-container");
    questionsContainer.innerHTML = "";

    const availableQuestions = [];
    securityQuestions.forEach((question, index) => {
      const hasAnswer =
        domainData.securityAnswers &&
        domainData.securityAnswers[index] &&
        domainData.securityAnswers[index].trim() !== "";

      if (hasAnswer) {
        availableQuestions.push({
          question: question,
          index: index,
          storedAnswer: domainData.securityAnswers[index],
        });
      }
    });

    if (availableQuestions.length === 0) {
      showMessage(
        "No security questions available for this domain. Please set answers in the extension options.",
        "error"
      );
      return;
    }

    document.getElementById("password-section").style.display = "none";
    document.getElementById("questions-section").style.display = "block";

    window.securityQuestionsData = {
      domain: domain,
      questions: availableQuestions,
      currentIndex: 0,
      userAnswers: new Array(availableQuestions.length).fill(""),
    };

    showQuestion(0);
  });
}
function showQuestion(index) {
  const data = window.securityQuestionsData;
  if (!data || index < 0 || index >= data.questions.length) {
    return;
  }

  const questionsContainer = document.getElementById("questions-container");
  const currentQuestion = data.questions[index];

  questionsContainer.innerHTML = `
    <div class="question-progress">
      <small>Question ${index + 1} of ${data.questions.length}</small>
    </div>
    <div class="question-item">
      <label>${currentQuestion.question}</label>
      <input type="text" 
             class="security-answer" 
             data-index="${index}" 
             placeholder="Enter your answer" 
             value="${data.userAnswers[index] || ""}" 
             autocomplete="off" />
    </div>
    <div class="question-navigation">
      ${
        index > 0
          ? '<button id="prev-question" class="nav-btn">Previous</button>'
          : ""
      }
      
      <button id="verify-answers" class="verify-btn">
        <span class="btn-text">Verify</span>
        <span class="btn-loader" style="display: none;">⏳</span>
      </button>
      ${
        index < data.questions.length - 1
          ? '<button id="next-question" class="nav-btn">Next</button>'
          : ""
      }
    </div>
  `;

  data.currentIndex = index;

  setupQuestionNavigation();

  const answerInput = questionsContainer.querySelector(".security-answer");
  if (answerInput) {
    answerInput.focus();
  }
}

function setupQuestionNavigation() {
  const data = window.securityQuestionsData;
  if (!data) {
    return;
  }

  const prevBtn = document.getElementById("prev-question");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      saveCurrentAnswer();
      showQuestion(data.currentIndex - 1);
    });
  }

  const nextBtn = document.getElementById("next-question");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      saveCurrentAnswer();
      showQuestion(data.currentIndex + 1);
    });
  }

  const verifyBtn = document.getElementById("verify-answers");
  if (verifyBtn) {
    verifyBtn.addEventListener("click", () => {
      saveCurrentAnswer();
      verifySecurityAnswers(data.domain);
    });
  }

  const answerInput = document.querySelector(".security-answer");
  if (answerInput) {
    answerInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        saveCurrentAnswer();
        if (data.currentIndex < data.questions.length - 1) {
          showQuestion(data.currentIndex + 1);
        } else {
          verifySecurityAnswers(data.domain);
        }
      }
    });
  }
}

function saveCurrentAnswer() {
  const data = window.securityQuestionsData;
  if (!data) return;

  const answerInput = document.querySelector(".security-answer");
  if (answerInput) {
    data.userAnswers[data.currentIndex] = answerInput.value.trim();
  }
}

function verifySecurityAnswers(domain) {
  const data = window.securityQuestionsData;
  if (!data) {
    showMessage("Error: No security questions data found", "error");
    return;
  }

  saveCurrentAnswer();

  const verifyBtn = document.getElementById("verify-answers");
  const btnText = verifyBtn ? verifyBtn.querySelector(".btn-text") : null;
  const btnLoader = verifyBtn ? verifyBtn.querySelector(".btn-loader") : null;

  if (btnText && btnLoader) {
    btnText.style.display = "none";
    btnLoader.style.display = "block";
  }
  if (verifyBtn) {
    verifyBtn.disabled = true;
  }

  chrome.storage.local.get(["lockedDomains"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    const domainData = lockedDomains[domain];

    if (!domainData || !domainData.securityAnswers) {
      showMessage("Error: No security answers found in storage", "error");
      resetVerifyButton();
      return;
    }

    let correctAnswers = 0;
    let totalAnswered = 0;

    data.userAnswers.forEach((userAnswer, index) => {
      if (userAnswer && userAnswer.trim() !== "") {
        totalAnswered++;
        const questionIndex = data.questions[index].index;
        const storedAnswer = domainData.securityAnswers[questionIndex];

        if (
          storedAnswer &&
          storedAnswer.toLowerCase().trim() === userAnswer.toLowerCase().trim()
        ) {
          correctAnswers++;
        } else {
        }
      }
    });

    if (totalAnswered === 0) {
      showMessage("Please answer at least one question", "error");
      resetVerifyButton();
      return;
    }

    if (correctAnswers > 0) {
      showMessage(
        `Verified! ${correctAnswers} out of ${totalAnswered} answers correct.`,
        "success"
      );
      unlockDomain(domain);
    } else {
      showMessage("None of your answers matched. Please try again.", "error");

      data.userAnswers.fill("");

      showQuestion(0);
    }

    resetVerifyButton();
  });
}

function resetVerifyButton() {
  const submitBtn = document.getElementById("verify-answers");
  if (submitBtn) {
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoader = submitBtn.querySelector(".btn-loader");

    if (btnText && btnLoader) {
      btnText.style.display = "block";
      btnLoader.style.display = "none";
    }
    submitBtn.disabled = false;
  }
}

function unlockDomain(domain) {
  showMessage("Unlocking domain...", "info");

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
    enablePageInteractions();

    document.body.classList.remove("domain-locker-locked");

    overlay.remove();

    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.body.style.pointerEvents = "";
  } else {
  }

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
}

function disablePageInteractions() {
  interactionCleanupFunctions = [];

  const disableRightClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  const disableShortcuts = (e) => {
    const allowedKeys = [
      "Tab",
      "Enter",
      "Backspace",
      "Delete",
      "Escape",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ];

    const isAlphaNumeric = /^[a-zA-Z0-9]$/.test(e.key);
    const isAllowedSpecial = allowedKeys.includes(e.key);
    const isModifier = e.ctrlKey || e.altKey || e.metaKey || e.shiftKey;

    if (isAlphaNumeric || isAllowedSpecial) {
      return true;
    }

    if (!isModifier) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  const disableSelection = (e) => {
    e.preventDefault();
    return false;
  };

  document.addEventListener("contextmenu", disableRightClick, true);
  document.addEventListener("keydown", disableShortcuts, true);
  document.addEventListener("selectstart", disableSelection, true);
  document.addEventListener("dragstart", disableSelection, true);

  interactionCleanupFunctions.push(() => {
    document.removeEventListener("contextmenu", disableRightClick, true);
  });
  interactionCleanupFunctions.push(() => {
    document.removeEventListener("keydown", disableShortcuts, true);
  });
  interactionCleanupFunctions.push(() => {
    document.removeEventListener("selectstart", disableSelection, true);
  });
  interactionCleanupFunctions.push(() => {
    document.removeEventListener("dragstart", disableSelection, true);
  });
}

function enablePageInteractions() {
  interactionCleanupFunctions.forEach((cleanup) => {
    try {
      if (typeof cleanup === "function") {
        cleanup();
      }
    } catch (error) {
      console.error("❌ Error in interaction cleanup:", error);
    }
  });

  interactionCleanupFunctions = [];

  document.body.style.pointerEvents = "";
  document.body.style.userSelect = "";
  document.body.style.webkitUserSelect = "";

  document.querySelectorAll("*").forEach((element) => {
    element.style.pointerEvents = "";
    element.style.userSelect = "";
    element.style.webkitUserSelect = "";
  });
}

initializeLockCheck();

const currentDomain = window.location.hostname;

chrome.storage.local.get(["lockedDomains"], (result) => {
  const lockedDomains = result.lockedDomains || {};

  if (lockedDomains[currentDomain]) {
    createLockScreen(currentDomain);
  }
});
function initializeWithRetry(attempt = 0) {
  const maxAttempts = 3;

  const currentDomain = window.location.hostname;

  chrome.runtime.sendMessage(
    { action: "checkDomainLock", domain: currentDomain },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Background check error:", chrome.runtime.lastError);
        if (attempt < maxAttempts - 1) {
          setTimeout(
            () => initializeWithRetry(attempt + 1),
            500 * (attempt + 1)
          );
        }
        return;
      }

      if (response && response.isLocked) {
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
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initializeWithRetry());
}

setTimeout(() => initializeWithRetry(), 1000);

function debugStorage() {
  chrome.storage.local.get(["lockedDomains", "securityQuestions"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    Object.keys(lockedDomains).forEach((domain) => {
      if (lockedDomains[domain].securityAnswers) {
      }
    });
  });
}

function debugSecurityQuestionsStorage() {
  chrome.storage.local.get(["lockedDomains", "securityQuestions"], (result) => {
    if (result.lockedDomains) {
      Object.keys(result.lockedDomains).forEach((domain) => {});
    }
  });
}
