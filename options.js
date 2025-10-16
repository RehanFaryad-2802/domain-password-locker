document.addEventListener("DOMContentLoaded", init);

function init() {
  loadDomains();
  loadSecurityQuestions();
  loadSettings();
  setupEventListeners();
  setupTabs();
  setupPasswordStrengthMeter();
}

function setupEventListeners() {
  document
    .getElementById("add-domain-btn")
    .addEventListener("click", addDomain);
  document
    .getElementById("toggle-password-btn")
    .addEventListener("click", togglePasswordVisibility);
  document
    .getElementById("search-domains")
    .addEventListener("input", filterDomains);
  document
    .getElementById("save-answers-btn")
    .addEventListener("click", saveSecurityAnswers);
  document
    .getElementById("save-settings-btn")
    .addEventListener("click", saveSettings);
}

function showNotification(message, type = "success") {
  const existingNotification = document.getElementById(
    "domain-locker-notification"
  );
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement("div");
  notification.id = "domain-locker-notification";
  notification.className = `notification ${type}`;
  notification.textContent = message;

  const styles = `
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideInRight 0.3s ease-out;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .notification.success {
      background: #4CAF50;
    }
    
    .notification.error {
      background: #f44336;
    }
    
    .notification.info {
      background: #2196F3;
    }
    
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;

  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease-in";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

const additionalStyles = `
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
const additionalStyleSheet = document.createElement("style");
additionalStyleSheet.textContent = additionalStyles;
document.head.appendChild(additionalStyleSheet);

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((content) => content.classList.remove("active"));

      button.classList.add("active");
      document
        .getElementById(`${button.dataset.tab}-tab`)
        .classList.add("active");
    });
  });
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById("password-input");
  const toggleBtn = document.getElementById("toggle-password-btn");

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    toggleBtn.textContent = "🙈";
  } else {
    passwordInput.type = "password";
    toggleBtn.textContent = "👁";
  }
}

function isValidDomain(domain) {
  const pattern =
    /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return pattern.test(domain);
}

function togglePasswordVisibilityForDomain(domain, button) {
  const row = button.closest("tr");
  const passwordDisplay = row.querySelector(".password-display-cell");

  if (passwordDisplay.textContent === "••••••••") {
    chrome.storage.local.get(["lockedDomains"], (result) => {
      const lockedDomains = result.lockedDomains || {};
      passwordDisplay.textContent = lockedDomains[domain].password;
      button.textContent = "Hide";
    });
  } else {
    passwordDisplay.textContent = "••••••••";
    button.textContent = "Show";
  }
}

function editDomain(domain) {
  chrome.storage.local.get(["lockedDomains"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    const domainData = lockedDomains[domain];

    const newPassword = prompt(
      `Enter new password for ${domain}:`,
      domainData.password
    );

    if (newPassword !== null) {
      lockedDomains[domain].password = newPassword;
      chrome.storage.local.set({ lockedDomains }, loadDomains);
    }
  });
}

function deleteDomain(domain) {
  if (confirm(`Are you sure you want to remove protection for ${domain}?`)) {
    chrome.storage.local.get(["lockedDomains"], (result) => {
      const lockedDomains = result.lockedDomains || {};
      delete lockedDomains[domain];
      chrome.storage.local.set({ lockedDomains }, loadDomains);
    });
  }
}

function filterDomains() {
  const searchTerm = document
    .getElementById("search-domains")
    .value.toLowerCase();
  const domainRows = document.querySelectorAll("#domains-list tr");

  domainRows.forEach((row) => {
    if (row.classList.contains("no-domains")) return;

    const domainName = row
      .querySelector(".domain-name-cell")
      .textContent.toLowerCase();
    if (domainName.includes(searchTerm)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

function loadSecurityQuestions() {
  const defaultQuestions = [
    "What was the name of your first pet?",
    "What's your favorite funny movie?",
    "What would be your superhero name?",
    "What's the most embarrassing thing that happened to you in school?",
    "If you were a vegetable, what would you be and why?",
  ];

  chrome.storage.local.get(["securityQuestions", "lockedDomains"], (result) => {
    let securityQuestions = result.securityQuestions || defaultQuestions;
    const lockedDomains = result.lockedDomains || {};
    const questionsList = document.getElementById("security-questions-list");

    if (!result.securityQuestions) {
      chrome.storage.local.set(
        { securityQuestions: defaultQuestions },
        () => {}
      );
    }

    questionsList.innerHTML = "";

    securityQuestions.forEach((question, index) => {
      const questionEl = document.createElement("div");
      questionEl.className = "security-question-item";
      questionEl.innerHTML = `
        <label>${question}</label>
        <input type="text" class="security-answer-input" data-index="${index}" placeholder="Your answer">
      `;
      questionsList.appendChild(questionEl);
    });

    loadExistingAnswers();

    // Object.keys(lockedDomains).forEach((domain) => {
    //   if (lockedDomains[domain].securityAnswers) {

    //   }
    // });
  });
}

function loadExistingAnswers() {
  chrome.storage.local.get(["lockedDomains"], (result) => {
    const lockedDomains = result.lockedDomains || {};

    if (Object.keys(lockedDomains).length === 0) return;

    const domainWithAnswers = Object.keys(lockedDomains).find(
      (domain) =>
        lockedDomains[domain].securityAnswers &&
        lockedDomains[domain].securityAnswers.length > 0
    );

    if (domainWithAnswers) {
      const answers = lockedDomains[domainWithAnswers].securityAnswers;
      answers.forEach((answer, index) => {
        const input = document.querySelector(
          `.security-answer-input[data-index="${index}"]`
        );
        if (input && answer) {
          input.value = answer;
        }
      });
    }
  });
}

function saveSecurityAnswers() {
  const answerInputs = document.querySelectorAll(".security-answer-input");
  const answers = Array.from(answerInputs).map((input) => ({
    index: parseInt(input.dataset.index),
    answer: input.value.trim(),
  }));

  const providedAnswers = answers.filter((item) => item.answer !== "");

  if (providedAnswers.length === 0) {
    showNotification(
      "Please provide answers to at least one security question",
      "error"
    );
    return;
  }

  chrome.storage.local.get(["lockedDomains", "securityQuestions"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    let securityQuestions = result.securityQuestions || [
      "What was the name of your first pet?",
      "What's your favorite funny movie?",
      "What would be your superhero name?",
      "What's the most embarrassing thing that happened to you in school?",
      "If you were a vegetable, what would you be and why?",
    ];

    if (Object.keys(lockedDomains).length === 0) {
      showNotification(
        "No domains protected yet. Please add a domain first.",
        "error"
      );
      return;
    }

    Object.keys(lockedDomains).forEach((domain) => {
      if (!lockedDomains[domain].securityAnswers) {
        lockedDomains[domain].securityAnswers = new Array(
          securityQuestions.length
        ).fill("");
      }

      providedAnswers.forEach((item) => {
        lockedDomains[domain].securityAnswers[item.index] = item.answer;
      });
    });

    chrome.storage.local.set(
      {
        lockedDomains: lockedDomains,
        securityQuestions: securityQuestions,
      },
      () => {
        if (chrome.runtime.lastError) {
          showNotification(
            "Error saving security answers: " +
              chrome.runtime.lastError.message,
            "error"
          );
          return;
        }
        showNotification(
          "Security answers saved successfully for all domains!"
        );

        // chrome.storage.local.get(
        //   ["lockedDomains", "securityQuestions"],
        //   (result) => {

        //   }
        // );
      }
    );
  });
}

function loadSettings() {
  chrome.storage.local.get(["settings"], (result) => {
    const settings = result.settings || {
      reaskOnNavigation: false,
      autoLockAfterTime: false,
      autoLockMinutes: 30,
    };

    document.getElementById("reask-on-navigation").checked =
      settings.reaskOnNavigation;
    document.getElementById("auto-lock-after-time").checked =
      settings.autoLockAfterTime;
    document.getElementById("auto-lock-minutes").value =
      settings.autoLockMinutes || 30;

    const autoLockSettings = document.getElementById("auto-lock-settings");
    autoLockSettings.style.display = settings.autoLockAfterTime
      ? "block"
      : "none";

    document
      .getElementById("auto-lock-after-time")
      .addEventListener("change", function () {
        autoLockSettings.style.display = this.checked ? "block" : "none";
      });
  });
}

function saveSettings() {
  const settings = {
    reaskOnNavigation: document.getElementById("reask-on-navigation").checked,
    autoLockAfterTime: document.getElementById("auto-lock-after-time").checked,
    autoLockMinutes:
      parseInt(document.getElementById("auto-lock-minutes").value) || 30,
  };

  chrome.storage.local.set({ settings }, () => {
    showNotification("Settings saved successfully!");
  });
}

function setupPasswordStrengthMeter() {
  const passwordInput = document.getElementById("password-input");
  const strengthBar = document.createElement("div");
  strengthBar.className = "password-strength";
  strengthBar.innerHTML =
    '<div class="strength-bar"></div><div class="strength-text"></div>';

  passwordInput.parentNode.insertBefore(strengthBar, passwordInput.nextSibling);

  passwordInput.addEventListener("input", function () {
    updatePasswordStrength(this.value, strengthBar);
  });
}

function updatePasswordStrength(password, strengthBar) {
  const bar = strengthBar.querySelector(".strength-bar");
  const text = strengthBar.querySelector(".strength-text");

  let strength = 0;
  let feedback = "";

  if (password.length > 0) {
    if (password.length < 6) {
      strength = 25;
      feedback = "Weak";
      bar.className = "strength-bar strength-weak";
    } else if (password.length < 9) {
      strength = 50;
      feedback = "Fair";
      bar.className = "strength-bar strength-fair";
    } else if (password.length < 12) {
      strength = 75;
      feedback = "Good";
      bar.className = "strength-bar strength-good";
    } else {
      strength = 100;
      feedback = "Strong";
      bar.className = "strength-bar strength-strong";
    }
  } else {
    bar.className = "strength-bar";
    feedback = "";
  }

  text.textContent = feedback;
}

function addDomain() {
  const domainInput = document.getElementById("domain-input");
  const passwordInput = document.getElementById("password-input");

  const domain = domainInput.value.trim();
  const password = passwordInput.value;

  if (!domain) {
    showNotification("Please enter a domain", "info");
    return;
  }

  if (!password) {
    showNotification("Please enter a password");
    return;
  }

  const normalizedDomain = domain.replace(/^www\./, "");

  chrome.storage.local.get(["lockedDomains"], (result) => {
    const lockedDomains = result.lockedDomains || {};

    const existingDomain = Object.keys(lockedDomains).find(
      (d) =>
        d === normalizedDomain ||
        d === "www." + normalizedDomain ||
        normalizedDomain === "www." + d
    );

    if (existingDomain) {
      if (
        !confirm(
          `Domain "${existingDomain}" is already protected. Do you want to update the password?`
        )
      ) {
        return;
      }
    }

    lockedDomains[normalizedDomain] = {
      password: password,
      securityAnswers: lockedDomains[normalizedDomain]
        ? lockedDomains[normalizedDomain].securityAnswers
        : [],
    };

    chrome.storage.local.set({ lockedDomains }, () => {
      domainInput.value = "";
      passwordInput.value = "";
      loadDomains();
      showNotification(`Domain "${normalizedDomain}" has been protected!`);
    });
  });
}

function loadDomains() {
  chrome.storage.local.get(["lockedDomains"], (result) => {
    const lockedDomains = result.lockedDomains || {};
    const domainsList = document.getElementById("domains-list");

    if (Object.keys(lockedDomains).length === 0) {
      domainsList.innerHTML =
        '<tr><td colspan="3" class="no-domains">No domains protected yet.</td></tr>';
      return;
    }

    domainsList.innerHTML = "";

    Object.keys(lockedDomains).forEach((domain) => {
      const domainData = lockedDomains[domain];
      const domainEl = document.createElement("tr");
      domainEl.innerHTML = `
        <td class="domain-name-cell">${domain}</td>
        <td class="password-display-cell">••••••••</td>
        <td class="domain-actions-cell">
        <button class="btn-show-password" data-domain="${domain}">Show</button>
        <button class="btn-edit" data-domain="${domain}">Edit</button>
        <button class="btn-delete" data-domain="${domain}">Delete</button>
        <button class="btn-open-domain" data-domain="${domain}" title="Open Domain">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
          </svg>
        </button>
        </td>
      `;
      domainsList.appendChild(domainEl);
    });

    document.querySelectorAll(".btn-show-password").forEach((btn) => {
      btn.addEventListener("click", function () {
        togglePasswordVisibilityForDomain(this.dataset.domain, this);
      });
    });

    document.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", function () {
        editDomain(this.dataset.domain);
      });
    });

    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", function () {
        deleteDomain(this.dataset.domain);
      });
    });

    document.querySelectorAll(".btn-open-domain").forEach((btn) => {
      btn.addEventListener("click", function () {
        openDomain(this.dataset.domain);
      });
    });
  });
}

function openDomain(domain) {
  let url = domain;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  chrome.tabs.create({ url: url }, (tab) => {});
}
