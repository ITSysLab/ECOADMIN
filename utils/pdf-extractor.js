/**
 * PDF Text & AcroForm Field Extraction Utility using PDF.js & pdf-lib
 */

// Set worker path relative to extension root for PDF.js
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
}

/**
 * Decodes Windows-1251 mojibake (e.g. Áàëàãóðîâ) back to Russian Cyrillic (Балагуров).
 * pdf-lib assumes Latin-1 encoding for non-UTF16 strings, which corrupts Russian PDF forms.
 */
function decodeWin1251(str) {
  if (!str) return str;
  // If already contains Cyrillic, it's decoded properly (e.g. UTF-16)
  if (/[А-Яа-яЁё]/.test(str)) return str;
  
  const bytes = new Uint8Array(str.length);
  let isMojibake = false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) & 0xFF;
    bytes[i] = code;
    if (code >= 192 && code <= 255) {
      isMojibake = true;
    }
  }
  
  if (isMojibake) {
    try {
      const decoded = new TextDecoder('windows-1251').decode(bytes);
      if (/[А-Яа-яЁё]/.test(decoded)) {
        return decoded;
      }
    } catch(e) {}
  }
  return str;
}

/**
 * Extracts raw text and interactive AcroForm field values from a PDF ArrayBuffer.
 * Uses pdf.js for static text and pdf-lib for 100% robust AcroForm field value extraction.
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<{fullText: string, pageCount: number, formFields: Array<{name: string, value: any}>}>}
 */
async function extractTextFromPdfArrayBuffer(arrayBuffer) {
  if (typeof pdfjsLib === 'undefined' || typeof PDFLib === 'undefined') {
    throw new Error('Библиотеки PDF.js или pdf-lib не загружены.');
  }

  const pagesText = [];
  const extractedFormFields = [];
  const formValuesStr = [];

  // 1. Extract Form Fields flawlessly using pdf-lib
  try {
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer.slice(0));
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    for (const field of fields) {
      try {
        const name = decodeWin1251(field.getName());
        let value = '';

        if (field instanceof PDFLib.PDFTextField) {
          try {
            value = field.getText() || '';
          } catch (e) {
            // Bypass "Reading rich text fields is not supported"
            const valObj = field.acroField.getValue();
            if (valObj && valObj.decodeText) {
              value = valObj.decodeText() || '';
            }
          }
        } else if (field instanceof PDFLib.PDFDropdown) {
          const opts = field.getSelected();
          value = (opts && Array.isArray(opts)) ? opts.join(', ') : (opts || '');
        } else if (field instanceof PDFLib.PDFOptionList) {
          const opts = field.getSelected();
          value = (opts && Array.isArray(opts)) ? opts.join(', ') : (opts || '');
        } else if (field instanceof PDFLib.PDFCheckBox) {
          value = field.isChecked() ? 'Да/Checked' : '';
        } else if (field instanceof PDFLib.PDFRadioGroup) {
          value = field.getSelected() || '';
        }

        if (value && value.trim() !== '') {
          const decodedValue = decodeWin1251(value.trim());
          extractedFormFields.push({ name, value: decodedValue });
          formValuesStr.push(`[Поле формы "${name}"]: "${decodedValue}"`);
        }
      } catch (fieldErr) {
        console.warn('Ошибка при чтении поля:', fieldErr);
      }
    }

    if (formValuesStr.length > 0) {
      pagesText.push(`--- ИЗВЛЕЧЕННЫЕ ПОЛЯ ФОРМЫ (AcroForm) ---\n${formValuesStr.join('\n')}\n`);
    }
  } catch (pdfLibErr) {
    console.error('Ошибка pdf-lib при извлечении полей:', pdfLibErr);
  }

  // 2. Extract Static Text using PDF.js
  let pageCount = 0;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDocument = await loadingTask.promise;
    pageCount = pdfDocument.numPages;

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      
      // Extract static text
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map(item => item.str);
      const pageText = pageStrings.join(' ');
      
      // Extract annotations (Form Fields) using PDF.js
      let annotationsText = '';
      try {
        const annotations = await page.getAnnotations();
        const annoValues = [];
        for (const anno of annotations) {
          if (anno.fieldName) {
            const val = anno.fieldValue || anno.buttonValue || '';
            if (val && String(val).trim() !== '') {
              annoValues.push(`[Аннотация "${anno.fieldName}"]: "${String(val).trim()}"`);
            }
          }
        }
        if (annoValues.length > 0) {
          annotationsText = `\n--- ПОЛЯ ФОРМЫ (PDF.js Аннотации) ---\n${annoValues.join('\n')}\n`;
        }
      } catch (e) {
        console.warn('Ошибка pdf.js при чтении аннотаций:', e);
      }

      pagesText.push(`--- СТРАНИЦА ${pageNum} ---\n${pageText}${annotationsText}`);
    }
  } catch (pdfjsErr) {
    console.error('Ошибка pdf.js при извлечении текста:', pdfjsErr);
    if (pagesText.length === 0) {
      throw new Error('Не удалось прочитать ни текст, ни форму PDF файла.');
    }
  }

  const fullText = pagesText.join('\n\n');

  return {
    fullText,
    pageCount,
    formFields: extractedFormFields
  };
}
