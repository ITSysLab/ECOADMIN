/**
 * Google AI Studio Gemini API Integration Client
 */

/**
 * Sends PDF extracted text to Google AI Studio Gemini API for extraction and validation.
 * @param {string} pdfText - Raw text extracted from PDF
 * @param {string} [apiKey] - Google AI Studio API key (if null, will read from chrome.storage.local)
 * @returns {Promise<{
 *   isValidTemplate: boolean,
 *   documentTitle: string,
 *   missingFields: string[],
 *   fullName: string,
 *   organization: string,
 *   position: string,
 *   department: string,
 *   emailDomain: string,
 *   rawResponse?: any
 * }>}
 */
async function analyzePdfWithGemini(pdfText, apiKeyOverride = null, onProgress = null) {
  let apiKey = apiKeyOverride;

  if (!apiKey) {
    const storage = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);
    apiKey = storage.geminiApiKey;
    if (!apiKey) {
      throw new Error('API Key Google AI Studio не настроен. Пожалуйста, укажите API Key в Настройках (значок шестеренки).');
    }
  }

  const storage = await chrome.storage.local.get(['geminiModel']);
  let chosenModel = storage.geminiModel || 'gemini-3.6-flash';

  // Fallback chain prioritizing user model, then 3.x, then official working 2.0/1.5 models
  const availableFallbacks = [
    'gemini-3.6-flash'
  ];
  const modelChain = [chosenModel, ...availableFallbacks.filter(m => m !== chosenModel)];

  const systemPrompt = `
Вы — специальный AI-аналитик корпоративных документов компании. 
Вам передан извлеченный текст PDF-файла, который может содержать как обычный статичный текст страницы, так и интерактиные поля интерактивной формы AcroForm в формате [Поле формы "..."]: "...".

ВАША ЗАДАЧА:
1. Проверить, является ли данный документ шаблоном "ЗАПРОС НА ДОСТУП К КОРПОРАТИВНЫМ СЕРВИСАМ" (или близким по названию заявлением на доступ).
2. Найти и извлечь значения из раздела "1. ОБЩАЯ ИНФОРМАЦИЯ ПО СОТРУДНИКУ" (проверяя как текстовые строки, так и занесенные поля формы AcroForm):
   - "organization": Организация (например: "ФОТОТЕХ", "ЗСК ГЛАСС ПРОМ", "ЭкоОкна" и т.д.)
   - "department": Подразделение (например: "Монтажный отдел")
   - "position": Должность (например: "Монтажник")
   - "fullName": Ф.И.О. сотрудника (например: "Балагуров Дмитрий Анатольевич")
   - "emailDomain": Почтовый домен (например: "@phototech.ru", "@ecookna.ru")
3. КРИТЕРИЙ ПОЛНОТЫ:
   - Если значение поля заполнено (в тексте или в интерактивной форме), оно считаются ЗАПОЛНЕННЫМ.
   - Игнорируйте технические подписи-подсказки вроде "Фамилия Имя Отчество - обязательно полные!", "для Замерщиков...", "Укажите ФИО...".
   - Только если поле ДЕЙСТВИТЕЛЬНО не содержит реальных пользовательских данных (пустое или содержит только подсказку) — укажите название этого поля ("fullName", "organization" или "position") в массиве "missingFields".

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (ТОЛЬКО ЧИСТЫЙ JSON БЕЗ МАРКДАУН РАЗМЕТКИ):
{
  "isValidTemplate": true,
  "documentTitle": "ЗАПРОС НА ДОСТУП К КОРПОРАТИВНЫМ СЕРВИСАМ",
  "organization": "ФОТОТЕХ",
  "department": "Монтажный отдел",
  "position": "Монтажник",
  "fullName": "Балагуров Дмитрий Анатольевич",
  "emailDomain": "@phototech.ru",
  "missingFields": [],
  "validationMessage": "Документ корректен и содержит все необходимые данные."
}

Если документ НЕ является запросом на доступ к корпоративным сервисам, установите:
"isValidTemplate": false,
"validationMessage": "Ошибка: Загруженный файл не является шаблоном 'Запрос на доступ к корпоративным сервисам'".
`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          { text: `--- ИЗВЛЕЧЕННЫЙ ТЕКСТ PDF ДОКУМЕНТА ---\n${pdfText}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  let lastError = null;

  for (let mIdx = 0; mIdx < modelChain.length; mIdx++) {
    const currentModel = modelChain[mIdx];
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (typeof onProgress === 'function') {
          if (attempt > 1) {
            onProgress(`Высокая нагрузка на модель ${currentModel}. Повторная попытка (${attempt}/${maxRetries})...`);
          } else if (mIdx > 0) {
            onProgress(`Переключение на модель ${currentModel}...`);
          } else {
            onProgress(`Анализ документа через Gemini (${currentModel})...`);
          }
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errMessage = String(errorData.error?.message || `Ошибка сервера Gemini (Статус ${response.status})`);
          lastError = new Error(`Ошибка Gemini API (${currentModel}): ${errMessage}`);

          const isNotFound =
            response.status === 404 ||
            errorData.error?.status === 'NOT_FOUND' ||
            /not found for API version|not supported for generateContent|is not found/i.test(errMessage);

          const isHighDemandOrRateLimit =
            response.status === 503 ||
            response.status === 429 ||
            response.status === 500 ||
            response.status === 504 ||
            /demand|overload|rate limit|quota|temporarily|try again|experiencing/i.test(errMessage);

          if (isNotFound) {
            console.warn(`Model ${currentModel} is not supported on Gemini API (${errMessage}), switching to fallback model.`);
            break; // Skip retries for un-supported/not-found model, proceed immediately to next model in modelChain
          } else if (isHighDemandOrRateLimit) {
            if (attempt < maxRetries) {
              const backoffMs = attempt * 1500;
              await new Promise(res => setTimeout(res, backoffMs));
              continue;
            } else {
              break; // Switch to next fallback model
            }
          } else {
            throw lastError;
          }
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          throw new Error('Пустой ответ от Gemini API.');
        }

        let cleanJsonStr = rawText.trim();
        if (cleanJsonStr.startsWith('```json')) {
          cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        } else if (cleanJsonStr.startsWith('```')) {
          cleanJsonStr = cleanJsonStr.replace(/^```\s*/, '').replace(/```$/, '').trim();
        }

        try {
          const parsed = JSON.parse(cleanJsonStr);
          return parsed;
        } catch (err) {
          console.error('Failed to parse Gemini JSON response:', rawText);
          throw new Error('Ошибка обработки ответа AI: невалидный формат JSON');
        }
      } catch (err) {
        lastError = err;
        if (err.message.includes('API Key') || err.message.includes('невалидный формат JSON')) {
          throw err;
        }
        if (attempt < maxRetries) {
          const backoffMs = attempt * 1500;
          await new Promise(res => setTimeout(res, backoffMs));
        }
      }
    }
  }

  throw lastError || new Error('Не удалось получить ответ от Gemini API после нескольких попыток.');
}
