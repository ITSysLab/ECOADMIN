document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const analyzeTabBtn = document.getElementById('analyzeTabBtn');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  const loadingView = document.getElementById('loadingView');
  const loadingText = document.getElementById('loadingText');

  const alertBox = document.getElementById('alertBox');
  const alertIcon = document.getElementById('alertIcon');
  const alertTitle = document.getElementById('alertTitle');
  const alertMessage = document.getElementById('alertMessage');

  const resultsSection = document.getElementById('resultsSection');
  const fullNameInput = document.getElementById('fullNameInput');
  const organizationInput = document.getElementById('organizationInput');
  const positionInput = document.getElementById('positionInput');
  const departmentInput = document.getElementById('departmentInput');
  const emailDomainInput = document.getElementById('emailDomainInput');

  const bitwardenBtn = document.getElementById('bitwardenBtn'); // [NEW]
  const createAdUserBtn = document.getElementById('createAdUserBtn');
  const bwUserCreatedCheckbox = document.getElementById('bwUserCreatedCheckbox');
  const resetDataBtn = document.getElementById('resetDataBtn'); // [NEW]

  // Generated Credentials Elements
  const generatedCredentialsSection = document.getElementById('generatedCredentialsSection');
  const generatedUsernameInput = document.getElementById('generatedUsernameInput');
  const generatedPasswordInput = document.getElementById('generatedPasswordInput');

  let currentExtractedData = null;

  // Load saved state on open
  loadState();

  // Attach input listeners for live saving
  [fullNameInput, organizationInput, positionInput, departmentInput, emailDomainInput].forEach(input => {
    input.addEventListener('input', () => {
      if (currentExtractedData) {
        currentExtractedData.fullName = fullNameInput.value;
        currentExtractedData.organization = organizationInput.value;
        currentExtractedData.position = positionInput.value;
        currentExtractedData.department = departmentInput.value;
        currentExtractedData.emailDomain = emailDomainInput.value;
        validateAndUpdateAlerts();
        saveState();
      }
    });
  });

  // Open Options Page
  openSettingsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  // DropZone & File Selection Setup
  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Analyze Active Tab PDF
  analyzeTabBtn.addEventListener('click', async () => {
    try {
      showLoading(true, 'Получение PDF из активной вкладки...');
      hideAlert();
      resultsSection.classList.add('hidden');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('Не удалось найти активную вкладку.');
      }

      if (!tab.url || (!tab.url.endsWith('.pdf') && !tab.url.includes('.pdf') && !tab.url.startsWith('file://'))) {
        throw new Error('Активная вкладка не содержит открытый PDF файл. Воспользуйтесь перетаскиванием (Drag & Drop) файла.');
      }

      // Fetch PDF bytes
      const response = await fetch(tab.url);
      if (!response.ok) {
        throw new Error(`Не удалось загрузить PDF со страницы (Статус ${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      await processPdfBuffer(arrayBuffer);

    } catch (err) {
      showLoading(false);
      showAlert('danger', '❌ Ошибка', err.message);
    }
  });

  // Process File Object
  function handleFile(file) {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      showAlert('danger', '❌ Неверный формат', 'Пожалуйста, выберите файл в формате PDF.');
      return;
    }

    showLoading(true, 'Чтение PDF файла...');
    hideAlert();
    resultsSection.classList.add('hidden');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await processPdfBuffer(e.target.result);
      } catch (err) {
        showLoading(false);
        showAlert('danger', '❌ Ошибка анализа', err.message);
      }
    };
    reader.onerror = () => {
      showLoading(false);
      showAlert('danger', '❌ Ошибка чтения', 'Не удалось прочитать выбранный файл.');
    };
    reader.readAsArrayBuffer(file);
  }

  // Core Processing Pipeline
  async function processPdfBuffer(arrayBuffer) {
    showLoading(true, 'Извлечение текста из PDF...');
    const pdfData = await extractTextFromPdfArrayBuffer(arrayBuffer);

    if (!pdfData.fullText || pdfData.fullText.trim().length === 0) {
      throw new Error('PDF файл не содержит распознаваемого текста (возможно файл является отсканированным изображением).');
    }

    showLoading(true, 'Анализ документа через Gemini 3.5 Flash Lite...');
    const result = await analyzePdfWithGemini(pdfData.fullText);

    showLoading(false);
    displayResults(result);
  }

  // Display Extraction Results & Handle Validation Alerts
  function displayResults(result) {
    currentExtractedData = result;

    // Show Results Section
    resultsSection.classList.remove('hidden');

    // Populate Fields
    fullNameInput.value = result.fullName || '';
    organizationInput.value = result.organization || '';
    positionInput.value = result.position || '';
    departmentInput.value = result.department || '';
    emailDomainInput.value = result.emailDomain || '@ecookna.ru';

    validateAndUpdateAlerts();
    saveState();
  }

  function validateAndUpdateAlerts() {
    const result = currentExtractedData;
    if (!result) return;

    // 1. Template Validation Check
    if (!result.isValidTemplate) {
      showAlert(
        'danger',
        '🚫 Неверный шаблон документа',
        result.validationMessage || 'Загруженный документ не является шаблоном "ЗАПРОС НА ДОСТУП К КОРПОРАТИВНЫМ СЕРВИСАМ".'
      );
      return;
    }

    // 2. Missing Fields Validation Check based on actual input values
    const actualMissingFields = [];
    if (!fullNameInput.value.trim()) actualMissingFields.push('Ф.И.О. сотрудника');
    if (!organizationInput.value.trim()) actualMissingFields.push('Организация');
    if (!positionInput.value.trim()) actualMissingFields.push('Должность');

    if (actualMissingFields.length > 0) {
      const missingListStr = actualMissingFields.join(', ');
      showAlert(
        'warning',
        '⚠️ Не заполнены обязательные поля',
        `В документе не удалось найти следующие обязательные поля: ${missingListStr}. Пожалуйста, дозаполните их вручную.`
      );
      return;
    }

    // 3. Perfect Validation
    showAlert(
      'success',
      '✅ Документ подтверждён',
      'Документ успешно распознан. Все необходимые поля заполнены и готовы к отправке.'
    );
  }

  // State Management
  function saveState() {
    if (currentExtractedData) {
      chrome.storage.local.set({ savedExtractedData: currentExtractedData });
    }
  }

  function loadState() {
    chrome.storage.local.get(['savedExtractedData', 'generatedCredentials'], (data) => {
      if (data.savedExtractedData) {
        displayResults(data.savedExtractedData);
      }
      if (data.generatedCredentials) {
        displayGeneratedCredentials(data.generatedCredentials);
      }
    });
  }

  // Display Generated Credentials
  function displayGeneratedCredentials(creds) {
    if (creds && creds.username && creds.password) {
      generatedUsernameInput.value = creds.username;
      generatedPasswordInput.value = creds.password;
      generatedCredentialsSection.classList.remove('hidden');
    }
  }

  // Setup click-to-copy for credentials
  if (generatedUsernameInput) {
    generatedUsernameInput.addEventListener('click', () => copyToClipboard(generatedUsernameInput.value, 'Логин скопирован!'));
  }
  if (generatedPasswordInput) {
    generatedPasswordInput.addEventListener('click', () => copyToClipboard(generatedPasswordInput.value, 'Пароль скопирован!'));
  }

  function copyToClipboard(text, successMessage) {
    navigator.clipboard.writeText(text).then(() => {
      alert(successMessage);
    });
  }

  // Listen for storage changes to update credentials live if popup is open
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.generatedCredentials && changes.generatedCredentials.newValue) {
      displayGeneratedCredentials(changes.generatedCredentials.newValue);
    }
  });

  // Reset Data Handler
  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
      currentExtractedData = null;
      chrome.storage.local.remove(['savedExtractedData', 'generatedCredentials']);
      resultsSection.classList.add('hidden');
      generatedCredentialsSection.classList.add('hidden');
      generatedUsernameInput.value = '';
      generatedPasswordInput.value = '';
      hideAlert();
      fullNameInput.value = '';
      organizationInput.value = '';
      positionInput.value = '';
      departmentInput.value = '';
    });
  }


  // Open Bitwarden (Stage 2)
  if (bitwardenBtn) {
    bitwardenBtn.addEventListener('click', () => {
      chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
        if (isAllowed) {
          chrome.windows.create({ url: 'https://bitwarden.oknagc.ru/#/login', incognito: true });
        } else {
          alert('ВНИМАНИЕ: Для запуска автоматизации в режиме инкогнито, вам необходимо разрешить плагину работать в этом режиме.\n\nПожалуйста, включите ползунок "Разрешить использование в режиме инкогнито" на странице управления расширением, которая сейчас откроется.');
          chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
        }
      });
    });
  }

  // Toggle Stage 3 Button
  if (bwUserCreatedCheckbox && createAdUserBtn) {
    bwUserCreatedCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        createAdUserBtn.disabled = false;
        createAdUserBtn.style.opacity = '1';
        createAdUserBtn.style.cursor = 'pointer';
        createAdUserBtn.style.filter = 'none';
      } else {
        createAdUserBtn.disabled = true;
        createAdUserBtn.style.opacity = '0.5';
        createAdUserBtn.style.cursor = 'not-allowed';
        createAdUserBtn.style.filter = 'grayscale(100%)';
      }
    });
  }

  // Create AD User Button (Phase 3 Preview)
  createAdUserBtn.addEventListener('click', () => {
    const name = fullNameInput.value.trim();
    const org = organizationInput.value.trim();
    const pos = positionInput.value.trim();

    if (!name || !org || !pos) {
      alert('Ошибка: Заполните обязательные поля (ФИО, Организация, Должность) перед созданием пользователя.');
      return;
    }

    alert(
      `[ЭТАП 1 ЗАВЕРШЁН С УСПЕХОМ!]\n\n` +
      `Данные готовы к передаче в Active Directory:\n` +
      `• ФИО: ${name}\n` +
      `• Организация: ${org}\n` +
      `• Должность: ${pos}\n\n` +
      `На Этапе 3 эта кнопка автоматически отправит запрос на ваш Windows Server для создания пользователя через New-ADUser!`
    );
  });

  // Helpers
  function showLoading(show, text = 'Обработка...') {
    if (show) {
      loadingText.textContent = text;
      loadingView.classList.remove('hidden');
    } else {
      loadingView.classList.add('hidden');
    }
  }

  function showAlert(type, title, message) {
    alertBox.className = `alert-box ${type}`;
    alertIcon.textContent = type === 'danger' ? '🚫' : (type === 'warning' ? '⚠️' : '✅');
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    alertBox.classList.remove('hidden');
  }

  function hideAlert() {
    alertBox.classList.add('hidden');
  }
});
