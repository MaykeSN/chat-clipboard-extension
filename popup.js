// =============================================================================
// popup.js — UI do popup de configuracoes
// =============================================================================
// Carregado apos defaults.js (que expoe DEFAULT_PROMPT e DEFAULT_SETTINGS).
// =============================================================================

const $ = (id) => document.getElementById(id);


/**
 * Le as configuracoes salvas no chrome.storage.sync.
 * Se nao tiver nada salvo, devolve os valores padroes de DEFAULT_SETTINGS.
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, resolve);
  });
}


/**
 * Grava um subconjunto de configuracoes no chrome.storage.sync.
 * Outras chaves nao mencionadas ficam intactas.
 */
async function saveSettings(partial) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(partial, resolve);
  });
}


/**
 * Mostra uma mensagem efemera no canto inferior do popup.
 * Reseta o timer a cada chamada (evita sobreposicao).
 */
function showStatus(text, duration = 1500) {
  const el = $('status');
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    el.classList.remove('visible');
  }, duration);
}


/**
 * Dispara a acao de copiar no content script da aba ativa.
 * Usa chrome.scripting.executeScript com allFrames=true para alcancar
 * iframes (caso do PureCloud + HeadsCX).
 */
async function triggerCopy() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.dispatchEvent(new CustomEvent('chat-clipboard-copy')),
    });
    // Fecha o popup apos disparar (UX mais natural).
    window.close();
  } catch (err) {
    console.warn('[Chat Clipboard] triggerCopy falhou:', err);
    showStatus('Erro ao disparar', 2500);
  }
}


/**
 * Inicializa o popup: carrega settings, vincula eventos.
 */
async function init() {
  const settings = await loadSettings();

  // Estado inicial dos controles.
  $('include-prompt').checked = !!settings.includePrompt;
  $('show-dates').checked = !!settings.showDates;
  $('custom-prompt').value = settings.customPrompt || DEFAULT_PROMPT;

  // Toggles: salvam imediatamente ao mudar.
  $('include-prompt').addEventListener('change', async (e) => {
    await saveSettings({ includePrompt: e.target.checked });
    showStatus('Salvo');
  });

  $('show-dates').addEventListener('change', async (e) => {
    await saveSettings({ showDates: e.target.checked });
    showStatus('Salvo');
  });

  // Textarea do prompt: debounce de 600ms pra nao gravar a cada tecla.
  let promptTimer;
  $('custom-prompt').addEventListener('input', (e) => {
    clearTimeout(promptTimer);
    promptTimer = setTimeout(async () => {
      await saveSettings({ customPrompt: e.target.value });
      showStatus('Prompt salvo');
    }, 600);
  });

  // Restaurar padrao.
  $('reset-prompt').addEventListener('click', async () => {
    $('custom-prompt').value = DEFAULT_PROMPT;
    await saveSettings({ customPrompt: DEFAULT_PROMPT });
    showStatus('Prompt restaurado');
  });

  // Botao "Copiar agora".
  $('copy-now').addEventListener('click', triggerCopy);
}

init();
