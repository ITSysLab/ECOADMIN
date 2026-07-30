document.addEventListener('DOMContentLoaded', () => {
  // Tabs logic
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });

  // Gemini UI elements
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('modelSelect');
  const toggleVisibilityBtn = document.getElementById('toggleVisibilityBtn');
  
  // Bitwarden UI elements
  const bwSsoIdInput = document.getElementById('bwSsoId');
  const bwLoginInput = document.getElementById('bwLogin');
  const bwPasswordInput = document.getElementById('bwPassword');
  const toggleBwPasswordBtn = document.getElementById('toggleBwPasswordBtn');
  const bwMasterPasswordInput = document.getElementById('bwMasterPassword');
  const toggleBwMasterBtn = document.getElementById('toggleBwMasterBtn');

  // Rules UI elements
  const collectionRulesContainer = document.getElementById('collectionRulesContainer');
  const addCollectionRuleBtn = document.getElementById('addCollectionRuleBtn');
  const defaultCollectionInput = document.getElementById('defaultCollection');

  // Global UI
  const saveBtn = document.getElementById('saveBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const statusMessage = document.getElementById('statusMessage');

  // Load existing settings
  chrome.storage.local.get([
    'geminiApiKey', 'geminiModel', 'bwSsoId', 'bwLogin', 'bwPassword', 'bwMasterPassword', 
    'collectionRules', 'defaultCollection'
  ], (items) => {
    if (items.geminiApiKey) apiKeyInput.value = items.geminiApiKey;
    if (items.geminiModel) modelSelect.value = items.geminiModel;
    if (items.bwSsoId) bwSsoIdInput.value = items.bwSsoId;
    if (items.bwLogin) bwLoginInput.value = items.bwLogin;
    if (items.bwPassword) bwPasswordInput.value = items.bwPassword;
    if (items.bwMasterPassword) bwMasterPasswordInput.value = items.bwMasterPassword;
    if (items.defaultCollection) defaultCollectionInput.value = items.defaultCollection;
    
    // Load rules
    if (items.collectionRules && items.collectionRules.length > 0) {
      items.collectionRules.forEach(rule => addRuleRow(rule.org, rule.col));
    } else {
      // Default initial rules
      addRuleRow('Евроокна', 'ЭкоОкна/AD/oknagc/eurookna.oknagc.ru');
      addRuleRow('Калева', 'ЭкоОкна/AD/oknagc/kaleva.oknagc.ru');
    }
  });

  // Dynamic Rule Rows Logic
  function addRuleRow(orgVal = '', colVal = '') {
    const row = document.createElement('div');
    row.className = 'rule-row';
    row.style = 'display: flex; gap: 8px; margin-bottom: 8px;';
    
    const orgInput = document.createElement('input');
    orgInput.type = 'text';
    orgInput.className = 'rule-org';
    orgInput.placeholder = 'Организация (слово)';
    orgInput.value = orgVal;
    orgInput.style.flex = '1';

    const colInput = document.createElement('input');
    colInput.type = 'text';
    colInput.className = 'rule-col';
    colInput.placeholder = 'Полный путь коллекции';
    colInput.value = colVal;
    colInput.style.flex = '2';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'secondary-btn';
    removeBtn.textContent = '❌';
    removeBtn.title = 'Удалить правило';
    removeBtn.onclick = () => row.remove();

    row.appendChild(orgInput);
    row.appendChild(colInput);
    row.appendChild(removeBtn);

    collectionRulesContainer.appendChild(row);
  }

  addCollectionRuleBtn.addEventListener('click', () => addRuleRow());

  // Toggle Password visibility for Gemini
  toggleVisibilityBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleVisibilityBtn.textContent = 'Скрыть';
    } else {
      apiKeyInput.type = 'password';
      toggleVisibilityBtn.textContent = 'Показать';
    }
  });

  // Toggle Password visibility for Bitwarden ADFS
  toggleBwPasswordBtn.addEventListener('click', () => {
    if (bwPasswordInput.type === 'password') {
      bwPasswordInput.type = 'text';
      toggleBwPasswordBtn.textContent = 'Скрыть';
    } else {
      bwPasswordInput.type = 'password';
      toggleBwPasswordBtn.textContent = 'Показать';
    }
  });

  // Toggle Password visibility for Master Password
  toggleBwMasterBtn.addEventListener('click', () => {
    if (bwMasterPasswordInput.type === 'password') {
      bwMasterPasswordInput.type = 'text';
      toggleBwMasterBtn.textContent = 'Скрыть';
    } else {
      bwMasterPasswordInput.type = 'password';
      toggleBwMasterBtn.textContent = 'Показать';
    }
  });

  // Save Settings
  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const bwSsoId = bwSsoIdInput.value.trim();
    const bwLogin = bwLoginInput.value.trim();
    const bwPassword = bwPasswordInput.value;
    const bwMasterPassword = bwMasterPasswordInput.value;
    
    // Save rules
    const rules = [];
    document.querySelectorAll('.rule-row').forEach(row => {
      const org = row.querySelector('.rule-org').value.trim();
      const col = row.querySelector('.rule-col').value.trim();
      if (org && col) rules.push({ org, col });
    });
    const defaultCollection = defaultCollectionInput.value.trim();
    
    chrome.storage.local.set({
      geminiApiKey: key,
      geminiModel: model,
      bwSsoId: bwSsoId,
      bwLogin: bwLogin,
      bwPassword: bwPassword,
      bwMasterPassword: bwMasterPassword,
      collectionRules: rules,
      defaultCollection: defaultCollection
    }, () => {
      showStatus('Настройки успешно сохранены!', 'success');
    });
  });

  // Export Settings
  exportBtn.addEventListener('click', () => {
    chrome.storage.local.get(null, (items) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "ecoadmin_settings.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      showStatus('Настройки экспортированы!', 'success');
    });
  });

  // Import Settings
  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        chrome.storage.local.set(json, () => {
          showStatus('Настройки импортированы! Перезагрузка...', 'success');
          setTimeout(() => location.reload(), 1500);
        });
      } catch (err) {
        showStatus('Ошибка при чтении файла', 'error');
      }
    };
    reader.readAsText(file);
    importFile.value = ''; // Reset input
  });

  function showStatus(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = `status-msg ${type}`;
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = 'status-msg';
    }, 3500);
  }
});
