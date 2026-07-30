// content/bitwarden.js
console.log("ECOADMIN: Bitwarden content script loaded");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const cyrillicToLatinMap = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
};

function transliterate(text) {
  return text.toLowerCase().split('').map(char => cyrillicToLatinMap[char] || char).join('');
}

function generateUsername(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().toLowerCase().split(/\s+/);
  const lastName = parts[0] || '';
  const firstName = parts[1] || '';
  if (!firstName || !lastName) return transliterate(lastName || firstName);
  const initial = firstName.charAt(0);
  return transliterate(`${initial}.${lastName}`);
}

// Агрессивная функция вставки текста, работающая с большинством SPA (Angular/React)
function fillInput(input, value) {
  console.log("ECOADMIN: Начинаем вставку текста...");
  input.focus();
  
  // 1. Обычное присваивание (часто достаточно для Angular)
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  
  // 2. React/Angular-hack (на всякий случай)
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      console.log("ECOADMIN: Использован native setter.");
    }
  } catch (e) {
    console.log("ECOADMIN: Ошибка при использовании native setter:", e);
  }
  
  // 3. Имитация нажатия клавиш
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
  
  input.blur();
  console.log("ECOADMIN: Вставка завершена. Текущее значение поля: " + input.value);
}

async function runAutomation() {
  const items = await chrome.storage.local.get(['bwSsoId', 'bwMasterPassword']);
  // Используем сохраненный ID, либо значение по умолчанию 'oknagc'
  const ssoId = items.bwSsoId || "oknagc"; 
  const masterPassword = items.bwMasterPassword;

  // Бесконечный цикл для отслеживания изменений URL в SPA
  while (true) {
    const hash = window.location.hash;

    if (hash.includes('#/login')) {
      const buttons = document.querySelectorAll('button');
      const ssoBtn = Array.from(buttons).find(btn => 
        btn.textContent && (btn.textContent.toLowerCase().includes('единый вход') || btn.textContent.toLowerCase().includes('sso'))
      );
      
      if (ssoBtn && ssoBtn.offsetParent !== null) {
        console.log("ECOADMIN: Нажимаем кнопку единого входа...");
        ssoBtn.click();
        await sleep(1500); // Даем больше времени на роутинг
      }
    } 
    else if (hash.includes('#/sso')) {
      // Ищем ПЕРВОЕ ВИДИМОЕ текстовое поле ввода на странице. На странице SSO оно одно.
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
      let inputField = null;
      for (const input of inputs) {
        if (input.offsetParent !== null) {
          inputField = input;
          break;
        }
      }

      const buttons = document.querySelectorAll('button');
      const continueBtn = Array.from(buttons).find(btn => 
        btn.textContent && (btn.textContent.toLowerCase().includes('продолжить') || btn.textContent.toLowerCase().includes('continue'))
      );

      // Проверяем, видимо ли поле
      if (inputField && continueBtn && inputField.offsetParent !== null) {
        // Если поле пустое, заполняем
        if (!inputField.value) {
          console.log("ECOADMIN: Вводим SSO идентификатор: " + ssoId);
          fillInput(inputField, ssoId);
          
          await sleep(800); // Даем фреймворку обработать события и убрать ошибку
          
          // Проверяем, принялось ли значение
          if (inputField.value) {
            console.log("ECOADMIN: Нажимаем Продолжить...");
            continueBtn.click();
            await sleep(4000); // Ждем редиректа на ADFS
          }
        }
      }
    }
    else if (hash.includes('#/lock') || hash.includes('#/unlock')) {
      // Страница разблокировки (ввод мастер-пароля)
      if (!masterPassword) {
        console.log("ECOADMIN: Мастер-пароль не задан в настройках.");
        await sleep(2000);
        continue;
      }

      // Ищем ПЕРВОЕ ВИДИМОЕ поле ввода пароля (иногда на странице есть скрытые поля)
      const pwInputs = document.querySelectorAll('input[type="password"]');
      let passwordInput = null;
      for (const input of pwInputs) {
        if (input.offsetParent !== null) {
          passwordInput = input;
          break;
        }
      }

      const buttons = document.querySelectorAll('button');
      const unlockBtn = Array.from(buttons).find(btn => 
        btn.textContent && (btn.textContent.toLowerCase().includes('разблокировать') || btn.textContent.toLowerCase().includes('unlock'))
      );

      if (!passwordInput) {
        console.log("ECOADMIN: Поле ввода пароля не найдено или скрыто.");
      }
      
      if (!unlockBtn) {
        console.log("ECOADMIN: Кнопка 'Разблокировать' не найдена.");
      }

      if (passwordInput && unlockBtn && passwordInput.offsetParent !== null) {
        if (!passwordInput.value) {
          console.log("ECOADMIN: Вводим мастер-пароль...");
          fillInput(passwordInput, masterPassword);
          
          await sleep(800);
          
          if (passwordInput.value) {
            console.log("ECOADMIN: Нажимаем Разблокировать...");
            unlockBtn.click();
            await sleep(5000); // Даем время на вход
          } else {
            console.log("ECOADMIN: ОШИБКА: Мастер-пароль не был вставлен в поле.");
          }
        } else {
           // Если поле уже заполнено, но мы всё ещё тут - возможно кнопка заблокирована, ждём.
        }
      }
    }
    else if (hash.includes('#/vault')) {
      // 1. Проверяем, открыто ли модальное окно "Новый логин"
      const allHeaders = document.querySelectorAll('h1, h2, h3, h4, h5, h6, span, div, p');
      const isModalOpen = Array.from(allHeaders).some(h => 
        h.textContent && h.textContent.trim().toLowerCase() === 'новый логин' && h.offsetParent !== null
      );
      
      const currentData = await chrome.storage.local.get(['savedExtractedData', 'collectionRules', 'defaultCollection']);
      const extracted = currentData.savedExtractedData;
      
      if (isModalOpen) {
        // Окно уже открыто.
        
        // Получаем актуальные извлеченные данные и правила коллекций
        const rules = currentData.collectionRules || [
          {org: 'Евроокна', col: 'ЭкоОкна/AD/oknagc/eurookna.oknagc.ru'},
          {org: 'Калева', col: 'ЭкоОкна/AD/oknagc/kaleva.oknagc.ru'}
        ];
        const defaultCol = currentData.defaultCollection || 'ЭкоОкна/AD/oknagc/ecookna.oknagc.ru';

        if (extracted && extracted.fullName) {
          // Ищем инпут "Название элемента"
          const allLabels = document.querySelectorAll('label');
          const nameLabel = Array.from(allLabels).find(label => 
            label.textContent.toLowerCase().includes('название элемента') && label.offsetParent !== null
          );

          let nameInput = null;
          if (nameLabel) {
            const forId = nameLabel.getAttribute('for');
            if (forId) nameInput = document.getElementById(forId);
          }

          // Запасной вариант поиска
          if (!nameInput) {
            nameInput = document.querySelector('input[name="name"], input[aria-label*="Название"]');
          }

          if (nameInput && nameInput.offsetParent !== null) {
            // Флаг dataset, чтобы заполнять поле только один раз и не спамить
            if (!nameInput.dataset.ecoFilled) {
              console.log("ECOADMIN: Заполняем поле 'Название элемента'...");
              fillInput(nameInput, extracted.fullName);
              nameInput.dataset.ecoFilled = 'true';
              
              // ==========================================
              // ЛОГИКА ЗАПОЛНЕНИЯ КОЛЛЕКЦИИ
              // ==========================================
              let targetCollection = defaultCol;
              if (extracted.organization) {
                const orgLower = extracted.organization.toLowerCase();
                for (const rule of rules) {
                  if (orgLower.includes(rule.org.toLowerCase())) {
                    targetCollection = rule.col;
                    break;
                  }
                }
              }
              console.log("ECOADMIN: Определена коллекция для выбора: " + targetCollection);
              
              // 1. Ищем лейбл "Коллекции"
              const colLabel = Array.from(allLabels).find(label => 
                label.textContent.toLowerCase().includes('коллекции') && label.offsetParent !== null
              );
              
              if (colLabel) {
                 console.log("ECOADMIN: Найден лейбл Коллекции. Кликаем по контейнеру...");
                 
                 // Кликаем на элемент рядом с лейблом
                 const dropdownElement = colLabel.nextElementSibling || colLabel.parentElement;
                 if (dropdownElement) dropdownElement.click();
                 
                 // Также пробуем кликнуть по тексту плейсхолдера
                 const filterTexts = document.querySelectorAll('span, div, p');
                 const triggerText = Array.from(filterTexts).find(el => 
                    el.textContent && el.textContent.includes('фильтрац') && el.offsetParent !== null && el.children.length === 0
                 );
                 if (triggerText) triggerText.click();
                 
                 await sleep(800); // Ждем открытия списка
                 
                 // 2. Ищем инпут для фильтрации
                 let searchInput = document.activeElement;
                 if (!searchInput || searchInput.tagName !== 'INPUT') {
                    // Ищем видимый текстовый инпут на странице, который не является именем
                    const allInputs = document.querySelectorAll('input[type="text"]');
                    searchInput = Array.from(allInputs).find(i => i.offsetParent !== null && !i.dataset.ecoFilled);
                 }
                 
                 if (searchInput && searchInput.tagName === 'INPUT') {
                    console.log("ECOADMIN: Заполняем фильтр коллекций...");
                    fillInput(searchInput, targetCollection);
                    await sleep(1000); // Ждем 1 секунду, пока отфильтруется выпадающий список
                 } else {
                    console.log("ECOADMIN: ВНИМАНИЕ: Поле фильтрации не найдено, пробуем найти опцию без фильтрации.");
                 }
                 
                 // 3. Ищем элемент выпадающего списка
                 const options = document.querySelectorAll('li, .dropdown-item, .ng-option, [role="option"], p-dropdownitem li, span');
                 const optionToClick = Array.from(options).find(opt => {
                    const text = opt.textContent ? opt.textContent.trim() : '';
                    return text.includes(targetCollection) && opt.offsetParent !== null && !opt.classList.contains('filter-option');
                 });
                 
                 if (optionToClick) {
                    console.log("ECOADMIN: Нажимаем на подходящую коллекцию в списке...", optionToClick);
                    optionToClick.click();
                 } else {
                    console.log("ECOADMIN: ОШИБКА: Опция коллекции не найдена в списке. Доступные видимые элементы li/option:");
                    Array.from(options).filter(o => o.offsetParent !== null).forEach(o => console.log(o.textContent.trim()));
                 }
              } else {
                console.log("ECOADMIN: ОШИБКА: Лейбл 'Коллекции' не найден на странице.");
              }

              // ==========================================
              // ЛОГИКА ЗАПОЛНЕНИЯ ЛОГИНА (Имя пользователя)
              // ==========================================
              const username = generateUsername(extracted.fullName);
              
              const usernameLabel = Array.from(allLabels).find(label => 
                label.textContent.toLowerCase().includes('имя пользователя') && label.offsetParent !== null
              );
              
              let usernameInput = null;
              if (usernameLabel) {
                 const forId = usernameLabel.getAttribute('for');
                 if (forId) usernameInput = document.getElementById(forId);
              }
              
              if (!usernameInput) {
                 // Запасной поиск
                 usernameInput = document.querySelector('input[name="username"], input[autocomplete="username"], input[aria-label*="Имя пользователя"]');
              }
              
              if (usernameInput && usernameInput.offsetParent !== null) {
                 console.log("ECOADMIN: Заполняем логин: " + username);
                 fillInput(usernameInput, username);
              } else {
                 console.log("ECOADMIN: ОШИБКА: Поле 'Имя пользователя' не найдено.");
              }

              // ==========================================
              // ЛОГИКА ЗАПОЛНЕНИЯ ПАРОЛЯ
              // ==========================================
              const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
              const generatedPassword = 'W*' + randomDigits;
              
              const pwLabel = Array.from(allLabels).find(label => 
                label.textContent.toLowerCase().trim() === 'пароль' && label.offsetParent !== null
              );
              
              let pwInput = null;
              if (pwLabel) {
                 const forId = pwLabel.getAttribute('for');
                 if (forId) pwInput = document.getElementById(forId);
              }
              
              if (!pwInput) {
                 // Ищем инпуты типа password или по имени
                 const modal = document.querySelector('.modal-content, .modal-dialog, mat-dialog-container, .dialog') || document.body;
                 const pwInputs = modal.querySelectorAll('input[type="password"], input[name="password"], input[aria-label*="Пароль"]');
                 pwInput = Array.from(pwInputs).find(i => i.offsetParent !== null && !i.dataset.ecoFilled);
              }
              
              if (pwInput && pwInput.offsetParent !== null) {
                 console.log("ECOADMIN: Заполняем пароль: " + generatedPassword);
                 fillInput(pwInput, generatedPassword);
                 pwInput.dataset.ecoFilled = 'true';
              } else {
                 console.log("ECOADMIN: ОШИБКА: Поле 'Пароль' не найдено.");
              }
              
              // ==========================================
              // ЛОГИКА ЗАПОЛНЕНИЯ ЗАМЕТОК
              // ==========================================
              const departmentText = extracted.department || '-';
              const positionText = extracted.position || '-';
              const notesText = `Подразделение: ${departmentText}\nДолжность: ${positionText}`;
              
              const notesLabel = Array.from(allLabels).find(label => 
                label.textContent.toLowerCase().includes('заметки') && label.offsetParent !== null
              );
              
              let notesInput = null;
              if (notesLabel) {
                 const forId = notesLabel.getAttribute('for');
                 if (forId) notesInput = document.getElementById(forId);
              }
              
              if (!notesInput) {
                 const modal = document.querySelector('.modal-content, .modal-dialog, mat-dialog-container, .dialog') || document.body;
                 notesInput = modal.querySelector('textarea[name="notes"], textarea[aria-label*="Заметки"]');
              }
              
              if (notesInput && notesInput.offsetParent !== null && !notesInput.dataset.ecoFilled) {
                 console.log("ECOADMIN: Заполняем заметки...");
                 fillInput(notesInput, notesText);
                 notesInput.dataset.ecoFilled = 'true';
              } else if (!notesInput) {
                 console.log("ECOADMIN: ОШИБКА: Поле 'Заметки' не найдено.");
              }
              
              // Сохраняем сгенерированные данные для всплывающего окна (popup)
              chrome.storage.local.set({ 
                 generatedCredentials: { 
                     username: username, 
                     password: generatedPassword 
                 } 
              });
              console.log("ECOADMIN: Сгенерированные данные (Логин/Пароль) сохранены в storage.");

              // ==========================================
              // СОХРАНЕНИЕ
              // ==========================================
              const buttons = document.querySelectorAll('button');
              const saveBtn = Array.from(buttons).find(btn => 
                btn.textContent && btn.textContent.toLowerCase().includes('сохранить') && btn.offsetParent !== null
              );
              
              if (saveBtn) {
                 console.log("ECOADMIN: Нажимаем кнопку Сохранить...");
                 saveBtn.click();
                 window.hasSavedItem = true;
                 // Ждем закрытия окна
                 await sleep(2000);
              } else {
                 console.log("ECOADMIN: ОШИБКА: Кнопка 'Сохранить' не найдена.");
              }
            }
          }
        }

        // Обязательно ждем перед continue, иначе будет бесконечный цикл, вешающий вкладку!
        await sleep(500);
        continue;
      }
      
      // Если мы завершили автоматизацию - останавливаем цикл
      if (window.automationFinished) {
         console.log("ECOADMIN: Автоматизация успешно завершена. Цикл остановлен.");
         return; // Полностью выходим из функции
      }

      // 2. Окна нет. Мы в хранилище. Проверяем дубликаты!
      if (extracted && extracted.fullName && !window.hasSearchedDuplicate) {
         const searchInput = document.querySelector('input[placeholder*="Поиск"], input[placeholder*="Search"]');
         if (searchInput && searchInput.offsetParent !== null) {
            console.log("ECOADMIN: Выполняем поиск дубликатов по ФИО: " + extracted.fullName);
            fillInput(searchInput, extracted.fullName);
            window.hasSearchedDuplicate = true;
            
            // Ждем загрузки результатов (Bitwarden ищет с задержкой)
            await sleep(2500);
            
            const emptyStateTexts = ['нет элементов', 'нечего отображать', 'ничего не найдено', 'no items'];
            const pageText = document.body.innerText.toLowerCase();
            const isEmpty = emptyStateTexts.some(t => pageText.includes(t));
            
            // Ищем элементы списка
            const listItems = document.querySelectorAll('tbody tr, cdk-row, mat-row, .item-list .item, .vault-list-item');
            
            // Разбиваем ФИО на части. Обычно формат: Фамилия Имя Отчество
            const nameParts = extracted.fullName.trim().toLowerCase().split(/\s+/);
            const lastName = nameParts[0] || '';
            const firstName = nameParts[1] || '';
            
            let isDuplicateFound = false;
            
            Array.from(listItems).forEach(item => {
               const text = item.textContent.toLowerCase();
               
               // Игнорируем пустые строки и сообщения об отсутствии элементов
               if (text.trim().length === 0 || emptyStateTexts.some(t => text.includes(t))) return;
               
               // Разбиваем текст строки на отдельные слова, чтобы "Иванов" не находилось внутри "Иванович"
               const textWords = text.split(/[\s,.-]+/);
               
               const hasLastName = textWords.includes(lastName);
               const hasFirstName = textWords.includes(firstName);
               
               // Проверяем, содержит ли строка И Фамилию И Имя (как отдельные слова)
               if (lastName && firstName) {
                   if (hasLastName && hasFirstName) {
                       isDuplicateFound = true;
                   }
               } else if (lastName) {
                   // Если в ФИО всего одно слово
                   if (hasLastName) {
                       isDuplicateFound = true;
                   }
               }
            });
            
            if (isDuplicateFound) {
               console.log("ECOADMIN: ВНИМАНИЕ! Найдено совпадение по Фамилии и Имени в результатах поиска.");
               window.userAlreadyExists = true;
               alert("ECOADMIN: Внимание! Пользователь '" + extracted.fullName + "' (или его однофамилец/тезка) уже существует в Bitwarden.\n\nПроверьте результаты на экране.\nАвтоматическое нажатие '+ Новый' отменено.\nЕсли всё равно хотите создать, нажмите кнопку '+ Новый' вручную.");
            } else {
               console.log("ECOADMIN: Дубликатов не найдено (или найдены только частичные совпадения). Продолжаем создание.");
            }
         } else {
            console.log("ECOADMIN: Поле поиска не найдено, ждем появления...");
         }
         await sleep(500);
         continue;
      } else if (extracted && extracted.fullName && window.hasSavedItem && !window.hasVerifiedCreation) {
         // 2.5 После сохранения проверяем успешность создания
         const searchInput = document.querySelector('input[placeholder*="Поиск"], input[placeholder*="Search"]');
         if (searchInput && searchInput.offsetParent !== null) {
            console.log("ECOADMIN: Проверяем успешность создания по ФИО: " + extracted.fullName);
            
            // Сбрасываем поиск и ищем заново
            fillInput(searchInput, "");
            await sleep(800);
            fillInput(searchInput, extracted.fullName);
            window.hasVerifiedCreation = true;
            
            // Ждем результатов
            await sleep(2500);
            
            const listItems = document.querySelectorAll('tbody tr, cdk-row, mat-row, .item-list .item, .vault-list-item');
            const emptyStateTexts = ['нет элементов', 'нечего отображать', 'ничего не найдено', 'no items'];
            const pageText = document.body.innerText.toLowerCase();
            const isEmpty = emptyStateTexts.some(t => pageText.includes(t));
            
            if (listItems.length > 0 && !isEmpty) {
                alert("ECOADMIN: ЭТАП 2 УСПЕШНО ЗАВЕРШЕН! 🎉\n\nУчетная запись '" + extracted.fullName + "' создана в Bitwarden.\nЛогин и пароль сохранены в плагине.\nВы можете переходить к Этапу 3 (Создание в AD).");
            } else {
                alert("ECOADMIN: ОШИБКА!\nЗапись '" + extracted.fullName + "' не найдена в поиске после сохранения. Возможно, Bitwarden не успел синхронизироваться или произошла ошибка при сохранении.");
            }
            window.automationFinished = true; // Завершаем цикл в любом случае
         }
         await sleep(500);
         continue;
      }

      if (window.userAlreadyExists) {
         // Автоматизация создания отменена из-за дубликатов. Ждем ручных действий.
         await sleep(1000);
         continue;
      }
      
      // 3. Дубликатов нет. Проверяем, открыто ли выпадающее меню "+ Новый"
      // Ищем элементы с текстом "Логин"
      const clickableElements = document.querySelectorAll('button, a, div[role="menuitem"], div[role="button"], li, span');
      const allLoginElements = Array.from(clickableElements).filter(el => 
        el.textContent && el.textContent.trim().toLowerCase() === 'логин' && el.offsetParent !== null
      );
      
      // Выбираем только те, которые справа, чтобы исключить левое меню
      const dropdownLoginOption = allLoginElements.find(el => {
        const rect = el.getBoundingClientRect();
        // Сайдбар обычно не шире 300px. Элемент "Логин" из выпадающего меню будет сильно правее
        return rect.left > 400 && rect.width > 0 && !el.classList.contains('filter-option');
      });

      if (dropdownLoginOption) {
        console.log("ECOADMIN: Найдена опция 'Логин' в меню, нажимаем...", dropdownLoginOption);
        dropdownLoginOption.click();
        await sleep(1500);
      } else {
        // 4. Выпадающего меню нет. Ищем кнопку "+ Новый"
        const potentialNewBtns = Array.from(clickableElements).filter(el => {
           const text = el.textContent ? el.textContent.trim().toLowerCase() : '';
           return (text === '+ новый' || text === 'новый' || text.includes('новый')) && el.offsetParent !== null;
        });
        
        // Кнопка "+ Новый" тоже должна быть справа
        const newBtn = potentialNewBtns.find(el => {
          const rect = el.getBoundingClientRect();
          return rect.left > 400 && rect.width > 0;
        });
        
        if (newBtn) {
          console.log("ECOADMIN: Нажимаем кнопку '+ Новый'...", newBtn);
          newBtn.click();
          await sleep(1500); 
        } else {
          console.log("ECOADMIN: ОШИБКА: Не могу найти ни окно, ни опцию 'Логин', ни кнопку '+ Новый'.");
        }
      }
    }
    
    // Проверяем DOM каждые 500мс
    await sleep(500);
  }
}

// Запускаем автоматизацию с обработкой ошибок (например, при обновлении плагина)
runAutomation().catch(e => {
  if (e.message && e.message.includes('Extension context invalidated')) {
    console.log("ECOADMIN: Плагин был обновлен. Старый процесс остановлен. Пожалуйста, обновите страницу (F5).");
  } else {
    console.error("ECOADMIN: Произошла ошибка в автоматизации:", e);
  }
});
