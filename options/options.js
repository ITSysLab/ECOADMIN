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
  
  const copyUpdateCmdBtn = document.getElementById('copyUpdateCmdBtn');

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
      items.collectionRules.forEach(rule => addRuleRow(rule.org, rule.col, rule.domain || ''));
    } else {
      // Default initial rules
      addRuleRow('ЗСК ГЛАСССПРОМ', '', '');
      addRuleRow('АО ЗМУ', '', '');
      addRuleRow('ЕВРООКНА', 'ЭкоОкна/AD/oknagc/eurookna.oknagc.ru', '@eurookna.ru');
      addRuleRow('КАЛЕВА', 'ЭкоОкна/AD/oknagc/kaleva.oknagc.ru', '@kaleva.ru');
      addRuleRow('ОКНА РОСТА ДОМ', '', '');
      addRuleRow('ОКОННАЯ МАНУФАКТУРА', '', '');
      addRuleRow('РАМСТВОР', '', '');
      addRuleRow('ФОТОТЕХ', '', '@phototech.ru');
      addRuleRow('КОМПАНИЯ ФОТОТЕХ', '', '@phototech.ru');
      addRuleRow('ЭКООКНА', 'ЭкоОкна/AD/oknagc/ecookna.oknagc.ru', '@ecookna.ru');
      addRuleRow('ЭКООКНА МАРКЕТ', '', '@ecookna.ru');
      addRuleRow('ЭКООКНА СИТИ', '', '@ecookna.ru');
      addRuleRow('MarkGlass', '', '');
    }
  });

  // Dynamic Rule Rows Logic
  function addRuleRow(orgVal = '', colVal = '', domainVal = '') {
    const row = document.createElement('div');
    row.className = 'rule-row';
    row.style = 'display: flex; gap: 8px; margin-bottom: 8px;';
    
    const orgInput = document.createElement('input');
    orgInput.type = 'text';
    orgInput.className = 'rule-org';
    orgInput.placeholder = 'Организация (слово)';
    orgInput.value = orgVal;
    orgInput.style.flex = '1.2';

    const colInput = document.createElement('input');
    colInput.type = 'text';
    colInput.className = 'rule-col';
    colInput.placeholder = 'Полный путь коллекции';
    colInput.value = colVal;
    colInput.style.flex = '1.5';
    
    const domainInput = document.createElement('input');
    domainInput.type = 'text';
    domainInput.className = 'rule-domain';
    domainInput.placeholder = '@домен.ru';
    domainInput.value = domainVal;
    domainInput.style.flex = '1';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'secondary-btn';
    removeBtn.textContent = '❌';
    removeBtn.title = 'Удалить правило';
    removeBtn.onclick = () => row.remove();

    row.appendChild(orgInput);
    row.appendChild(colInput);
    row.appendChild(domainInput);
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
      const domain = row.querySelector('.rule-domain').value.trim();
      if (org) rules.push({ org, col, domain });
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

  // Copy Update Command
  if (copyUpdateCmdBtn) {
    copyUpdateCmdBtn.addEventListener('click', () => {
      const cmd = `irm "https://raw.githubusercontent.com/ITSysLab/ECOADMIN/master/install.ps1" | Out-File "$env:TEMP\\install.ps1" -Encoding utf8; & "$env:TEMP\\install.ps1"`;
      navigator.clipboard.writeText(cmd).then(() => {
        const originalText = copyUpdateCmdBtn.textContent;
        copyUpdateCmdBtn.textContent = '✓ Скопировано!';
        copyUpdateCmdBtn.style.backgroundColor = 'var(--success)';
        copyUpdateCmdBtn.style.color = '#fff';
        copyUpdateCmdBtn.style.borderColor = 'var(--success)';
        
        setTimeout(() => {
          copyUpdateCmdBtn.textContent = originalText;
          copyUpdateCmdBtn.style.backgroundColor = '';
          copyUpdateCmdBtn.style.color = '';
          copyUpdateCmdBtn.style.borderColor = '';
        }, 2500);
      });
    });
  }

  function showStatus(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = `status-msg ${type}`;
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = 'status-msg';
    }, 3500);
  }
});
