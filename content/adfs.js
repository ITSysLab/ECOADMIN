// content/adfs.js
console.log("ECOADMIN: ADFS content script loaded");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoLoginAdfs() {
  // Получаем настройки
  const items = await chrome.storage.local.get(['bwLogin', 'bwPassword']);
  if (!items.bwLogin || !items.bwPassword) {
    console.log("ECOADMIN: Логин или пароль ADFS не заданы в настройках.");
    return;
  }

  // Ожидаем появления формы ADFS
  for (let i = 0; i < 10; i++) {
    // Обычно на ADFS поля имеют id="userNameInput" и "passwordInput"
    // Но мы также ищем по типу
    const loginInput = document.querySelector('input[name="UserName"], input[id="userNameInput"], input[type="email"], input[type="text"]');
    const passwordInput = document.querySelector('input[name="Password"], input[id="passwordInput"], input[type="password"]');
    const submitBtn = document.querySelector('span#submitButton, button#submitButton, input[type="submit"], button[type="submit"], button');

    if (loginInput && passwordInput && submitBtn) {
      console.log("ECOADMIN: Найдена форма ADFS, заполняем...");
      
      loginInput.value = items.bwLogin;
      loginInput.dispatchEvent(new Event('input', { bubbles: true }));
      loginInput.dispatchEvent(new Event('change', { bubbles: true }));

      passwordInput.value = items.bwPassword;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

      await sleep(200);
      
      // Ищем кнопку "Вход" (Sign in / Вход) по тексту, если submitBtn это просто первая попавшаяся кнопка
      const allButtons = document.querySelectorAll('button, input[type="submit"], span.submit');
      let targetBtn = submitBtn;
      for (const btn of allButtons) {
        if (btn.textContent && (btn.textContent.trim().toLowerCase().includes('вход') || btn.textContent.trim().toLowerCase().includes('sign in'))) {
          targetBtn = btn;
          break;
        } else if (btn.value && (btn.value.trim().toLowerCase().includes('вход') || btn.value.trim().toLowerCase().includes('sign in'))) {
          targetBtn = btn;
          break;
        }
      }

      console.log("ECOADMIN: Нажимаем кнопку Вход...");
      targetBtn.click();
      
      // Иногда нужно вызвать submit у формы
      // if (loginInput.form) { loginInput.form.submit(); }
      
      break;
    }
    
    await sleep(500);
  }
}

// Запускаем
setTimeout(autoLoginAdfs, 500);
