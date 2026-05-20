// =============================================================================
// Chat Clipboard - Content Script
// =============================================================================
// Injeta um botão flutuante na página e extrai mensagens do chat ao clicar
// ou ao receber o atalho Ctrl+Shift+C (via background.js -> chrome.commands).
// =============================================================================


// =============================================================================
// >>> SELETORES CSS - AJUSTE AQUI <<<
// =============================================================================
// Inspecione a página do atendimento (DevTools - F12) e substitua os valores
// abaixo pelos seletores reais da plataforma que voce usa.
//
// Dicas:
//  - Quanto mais especifico o seletor, melhor (evita falsos positivos).
//  - Voce pode usar qualquer seletor CSS valido: classe, id, atributo, etc.
//    Exemplos: ".msg-cliente", "div[data-role='customer']", "#chat .out".
//  - Para testar um seletor no DevTools: document.querySelectorAll("seu-seletor")
// =============================================================================
const SELECTORS = {
  // Container que envolve todas as mensagens do chat.
  // Aceita uma lista separada por vírgula - usa o primeiro que existir no DOM.
  // Cobertura observada na plataforma Multilaser (invenit.cloud):
  //   - ".historic__container" — layout do Edge (com header completo).
  //   - "main"                  — layout do Chrome (apenas <main> direto).
  // Se nenhum match, o script faz fallback para o document inteiro (lento
  // mas funcional). Sempre pelo menos um dos dois existe no painel do chat.
  chatContainer: '.historic__container, main',

  // Mensagem enviada pelo CLIENTE (quem esta sendo atendido).
  // Na plataforma Multilaser: <section side="left"> = mensagens entrando.
  customerMessage: 'section[side="left"]',

  // Mensagem enviada pelo ATENDENTE (operador / agente / bot).
  // Na plataforma Multilaser: <section side="right"> = mensagens saindo.
  agentMessage: 'section[side="right"]',

  // Elemento de texto dentro de cada mensagem.
  // Se as mensagens nao tiverem um wrapper interno, deixe vazio ("") e
  // o script vai usar o texto direto do elemento da mensagem.
  messageText: '.message-card__text',

  // Elemento que contem a data/hora da mensagem (opcional).
  // Deixe vazio ("") se a plataforma nao mostrar timestamp por mensagem;
  // nesse caso, o output sai sem o prefixo de data.
  messageDate: '.message-card__date',
};
// =============================================================================
// >>> FIM DOS SELETORES <<<
// =============================================================================


// ID unico do botao flutuante (evita injetar duas vezes em caso de reload).
const BUTTON_ID = 'chat-clipboard-floating-btn';


/**
 * Limpa formatacoes "sujas" que vem como texto na mensagem:
 *  - Tags HTML escapadas (<b>, </b>, <strong>, etc) que viraram texto literal.
 *  - Markdown do WhatsApp: *negrito*, _italico_, ~tachado~.
 *  - Espacos multiplos e quebras de linha redundantes.
 */
function cleanMessageText(raw) {
  if (!raw) return '';
  return raw
    // Tags HTML que apareceram como texto literal (bug comum em bots).
    .replace(/<\/?\s*(b|strong|i|em|u|span|br)\s*\/?>/gi, '')
    // *negrito* do WhatsApp. Non-greedy para nao engolir varios pares.
    .replace(/\*([^\n*]+?)\*/g, '$1')
    // _italico_ do WhatsApp.
    .replace(/_([^\n_]+?)_/g, '$1')
    // ~tachado~ do WhatsApp.
    .replace(/~([^\n~]+?)~/g, '$1')
    // Normaliza espacos (mantem quebras de linha intencionais como espaco).
    .replace(/\s+/g, ' ')
    .trim();
}


// Mapa de meses em portugues (abreviado ou completo) -> numero do mes.
const MONTH_MAP = {
  jan: '01', fev: '02', mar: '03', abr: '04',
  mai: '05', jun: '06', jul: '07', ago: '08',
  set: '09', out: '10', nov: '11', dez: '12',
};


/**
 * Tenta converter a data crua da mensagem para "DD/MM/AAAA HH:mm".
 * Aceita formatos como:
 *   "13 de mai. de 2026, 13:08"
 *   "13 de maio de 2026 13:08"
 *   "13/05/2026 13:08"
 * Se nao conseguir parsear, retorna a string original (sem horario perdido).
 */
function parseMessageDate(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Formato "DD de MMM[mes...] [.] de AAAA[,] HH:mm"
  const ptMatch = trimmed.match(
    /(\d{1,2})\s+de\s+([a-zç]{3})[a-zç]*\.?\s+de\s+(\d{4})[,\s]+(\d{1,2}):(\d{2})/i
  );
  if (ptMatch) {
    const [, day, monAbbr, year, hour, min] = ptMatch;
    const month = MONTH_MAP[monAbbr.toLowerCase()];
    if (month) {
      return `${day.padStart(2, '0')}/${month}/${year} ${hour.padStart(2, '0')}:${min}`;
    }
  }

  // Formato "DD/MM/AAAA HH:mm" (ja pronto, normaliza padding).
  const slashMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})/);
  if (slashMatch) {
    const [, d, mo, y, h, mi] = slashMatch;
    return `${d.padStart(2,'0')}/${mo.padStart(2,'0')}/${y} ${h.padStart(2,'0')}:${mi}`;
  }

  // Fallback: retorna o texto cru (melhor algum timestamp do que nenhum).
  return trimmed;
}


/**
 * Extrai o texto de uma mensagem.
 * Se SELECTORS.messageText estiver definido, busca o elemento interno;
 * caso contrario, usa o textContent direto do elemento da mensagem.
 */
function extractMessageText(messageEl) {
  let textEl = messageEl;
  if (SELECTORS.messageText) {
    const inner = messageEl.querySelector(SELECTORS.messageText);
    if (inner) textEl = inner;
  }
  return cleanMessageText(textEl.textContent || '');
}


/**
 * Extrai a data/hora de uma mensagem, ja formatada como "DD/MM/AAAA HH:mm".
 * Retorna string vazia se SELECTORS.messageDate nao estiver configurado
 * ou se o elemento de data nao for encontrado.
 */
function extractMessageDate(messageEl) {
  if (!SELECTORS.messageDate) return '';
  const dateEl = messageEl.querySelector(SELECTORS.messageDate);
  if (!dateEl) return '';
  return parseMessageDate(dateEl.textContent || '');
}


/**
 * Percorre o DOM e extrai todas as mensagens na ordem visual em que aparecem.
 * Retorna array de: [{ role: 'Cliente' | 'Atendente', text, date }]
 */
function extractMessages() {
  // Procura o container do chat. Se nao encontrar, usa o document inteiro
  // como fallback (util quando a pagina nao tem um container especifico).
  const root = document.querySelector(SELECTORS.chatContainer) || document;

  // Seletor combinado: pega cliente E atendente de uma vez para preservar
  // a ordem em que aparecem no DOM (essencial para manter a conversa coerente).
  const combinedSelector = `${SELECTORS.customerMessage}, ${SELECTORS.agentMessage}`;
  const nodes = root.querySelectorAll(combinedSelector);

  const messages = [];
  nodes.forEach((node) => {
    // Decide o papel verificando contra qual seletor o elemento bate.
    const isCustomer = node.matches(SELECTORS.customerMessage);
    const isAgent = node.matches(SELECTORS.agentMessage);

    // Se um elemento bate nos dois (seletores sobrepostos), prioriza cliente.
    const role = isCustomer ? 'Cliente' : (isAgent ? 'Atendente' : null);
    if (!role) return;

    const text = extractMessageText(node);
    if (!text) return; // Mensagens so com imagem/anexo viram texto vazio - ignora.

    const date = extractMessageDate(node);
    messages.push({ role, text, date });
  });

  return messages;
}


/**
 * Formata o array de mensagens. Respeita as settings do usuario:
 *  - showDates: liga/desliga o prefixo [data hora]
 *  - includePrompt + customPrompt: opcionalmente adiciona o prompt no inicio
 *
 * Exemplo (com showDates ligado):
 *   [13/05/2026 13:08] Cliente: Bom dia
 *   [13/05/2026 13:08] Atendente: Ola, em que posso ajudar?
 */
function formatMessages(messages, settings) {
  const opts = settings || DEFAULT_SETTINGS;
  const lines = messages.map((m) => {
    const prefix = (opts.showDates && m.date) ? `[${m.date}] ` : '';
    return `${prefix}${m.role}: ${m.text}`;
  }).join('\n');

  if (opts.includePrompt && opts.customPrompt && opts.customPrompt.trim()) {
    return opts.customPrompt + lines;
  }
  return lines;
}


/**
 * Le as configuracoes do chrome.storage.sync.
 * Fallback gracioso para DEFAULT_SETTINGS se a API nao estiver disponivel
 * (ex: testando em file:// sem extension context).
 */
async function loadSettings() {
  if (!chrome || !chrome.storage || !chrome.storage.sync) {
    return DEFAULT_SETTINGS;
  }
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => resolve(items));
  });
}


/**
 * Copia uma string para o clipboard.
 * Usa a Clipboard API quando disponivel (contexto seguro / https) e cai
 * para o metodo antigo (execCommand) como fallback.
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // Cai no fallback abaixo.
    console.warn('[Chat Clipboard] Clipboard API falhou, usando fallback:', err);
  }

  // Fallback: textarea temporario + execCommand('copy').
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (err) {
    console.error('[Chat Clipboard] Fallback execCommand falhou:', err);
  }
  document.body.removeChild(textarea);
  return ok;
}


/**
 * Acao principal: extrai, formata, copia e da feedback visual no botao.
 */
async function handleCopyAction() {
  const btn = document.getElementById(BUTTON_ID);
  const messages = extractMessages();

  if (messages.length === 0) {
    setButtonState(btn, 'Nenhuma mensagem', ICON_ERROR, GRADIENT_ERROR);
    // Diagnostico detalhado: mostra quais seletores estao casando (ou nao).
    // Se algum count for 0, e ali que voce precisa ajustar o seletor.
    console.warn('[Chat Clipboard] Nenhuma mensagem encontrada. Diagnostico:', {
      chatContainer: SELECTORS.chatContainer,
      chatContainerEncontrado: !!document.querySelector(SELECTORS.chatContainer),
      customerMessage: SELECTORS.customerMessage,
      customerCount: document.querySelectorAll(SELECTORS.customerMessage).length,
      agentMessage: SELECTORS.agentMessage,
      agentCount: document.querySelectorAll(SELECTORS.agentMessage).length,
      messageText: SELECTORS.messageText,
      messageTextCount: document.querySelectorAll(SELECTORS.messageText).length,
      dica: 'Abra o DevTools (F12) e teste: document.querySelectorAll("section[side=\\"left\\"]").length',
    });
    setTimeout(() => resetButton(btn), 2000);
    return;
  }

  const settings = await loadSettings();
  const formatted = formatMessages(messages, settings);
  const ok = await copyToClipboard(formatted);

  if (ok) {
    setButtonState(btn, 'Copiado!', ICON_CHECK, GRADIENT_SUCCESS);
  } else {
    setButtonState(btn, 'Erro ao copiar', ICON_ERROR, GRADIENT_ERROR);
  }
  setTimeout(() => resetButton(btn), 2000);
}


// ---------------------------------------------------------------------------
// Icones SVG (inline) e gradientes usados no botao flutuante.
// As cores batem com o icone da extensao (indigo -> roxo).
// ---------------------------------------------------------------------------
const ICON_BUBBLE =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4 4v-4H6a2 2 0 0 1-2-2V5z" fill="currentColor"/>' +
  '</svg>';

const ICON_CHECK =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

const ICON_ERROR =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

const GRADIENT_DEFAULT = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
const GRADIENT_SUCCESS = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
const GRADIENT_ERROR   = 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';


/**
 * Atualiza o conteudo do botao (icone + texto) e o fundo.
 * Re-renderiza o innerHTML mantendo a estrutura icon+label.
 */
function setButtonState(btn, label, iconSvg, bg) {
  if (!btn) return;
  btn.innerHTML = `<span class="cc-icon">${iconSvg}</span><span class="cc-label">${label}</span>`;
  btn.style.setProperty('background', bg, 'important');
}


/**
 * Restaura o botao ao estado original (balao + "Copiar chat" + gradiente padrao).
 */
function resetButton(btn) {
  setButtonState(btn, 'Copiar chat', ICON_BUBBLE, GRADIENT_DEFAULT);
}


/**
 * Cria e injeta o botao flutuante no canto inferior direito.
 * Estilos sao inline para evitar conflito com o CSS da plataforma.
 */
function injectFloatingButton() {
  if (document.getElementById(BUTTON_ID)) return; // Ja injetado.

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.type = 'button';
  btn.title = 'Copiar chat para o clipboard (Ctrl+Shift+C)';
  btn.innerHTML = `<span class="cc-icon">${ICON_BUBBLE}</span><span class="cc-label">Copiar chat</span>`;

  // Estilos inline com !important para sobrescrever CSS agressivo da pagina.
  const styles = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647', // Maior z-index possivel.
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 18px',
    background: GRADIENT_DEFAULT,
    color: '#ffffff',
    border: 'none',
    borderRadius: '999px', // pill / capsule
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.2px',
    lineHeight: '1',
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(99, 102, 241, 0.35), 0 2px 4px rgba(0, 0, 0, 0.12)',
    transition: 'transform 0.15s ease, box-shadow 0.2s ease, filter 0.2s ease',
    userSelect: 'none',
    WebkitFontSmoothing: 'antialiased',
  };
  Object.entries(styles).forEach(([prop, value]) => {
    btn.style.setProperty(
      prop.replace(/([A-Z])/g, '-$1').toLowerCase(),
      value,
      'important'
    );
  });

  // Hover: levanta levemente e intensifica o shadow.
  btn.addEventListener('mouseenter', () => {
    btn.style.setProperty('transform', 'translateY(-2px)', 'important');
    btn.style.setProperty(
      'box-shadow',
      '0 10px 24px rgba(99, 102, 241, 0.45), 0 4px 8px rgba(0, 0, 0, 0.15)',
      'important'
    );
    btn.style.setProperty('filter', 'brightness(1.05)', 'important');
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.setProperty('transform', 'translateY(0)', 'important');
    btn.style.setProperty(
      'box-shadow',
      '0 6px 18px rgba(99, 102, 241, 0.35), 0 2px 4px rgba(0, 0, 0, 0.12)',
      'important'
    );
    btn.style.setProperty('filter', 'none', 'important');
  });
  // Pressed: efeito de "afunda" rapido.
  btn.addEventListener('mousedown', () => {
    btn.style.setProperty('transform', 'translateY(0) scale(0.98)', 'important');
  });
  btn.addEventListener('mouseup', () => {
    btn.style.setProperty('transform', 'translateY(-2px)', 'important');
  });
  btn.addEventListener('click', handleCopyAction);

  document.body.appendChild(btn);
}


// ---------------------------------------------------------------------------
// Deteccao: este frame tem o chat?
// ---------------------------------------------------------------------------
// Com all_frames=true no manifest, o content script roda em TODOS os iframes
// da pagina (telemetria, ads, painel principal, painel do chat...). So queremos
// injetar o botao no frame que de fato tem as mensagens.
function hasChatInDOM() {
  return !!(
    (SELECTORS.chatContainer && document.querySelector(SELECTORS.chatContainer)) ||
    document.querySelector(SELECTORS.customerMessage) ||
    document.querySelector(SELECTORS.agentMessage)
  );
}


function tryInjectButton() {
  if (document.getElementById(BUTTON_ID)) return true;
  if (!hasChatInDOM()) return false;
  injectFloatingButton();
  return true;
}


// ---------------------------------------------------------------------------
// Inicializacao
// ---------------------------------------------------------------------------
// Tenta injetar imediatamente; se o chat ainda nao estiver no DOM (SPA renderiza
// async), usa MutationObserver para esperar. Para de observar apos 60s para
// nao manter overhead em frames que nunca vao ter chat.
function startInjection() {
  if (tryInjectButton()) return;

  const observer = new MutationObserver(() => {
    if (tryInjectButton()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 60000);
}

if (document.body) {
  startInjection();
} else {
  document.addEventListener('DOMContentLoaded', startInjection, { once: true });
}


// ---------------------------------------------------------------------------
// Atalho de teclado: o atalho Ctrl+Shift+C e registrado em manifest.json
// (commands). O background.js recebe o evento e envia uma mensagem para os
// frames da aba. Como a mensagem chega em TODOS os frames, ignoramos a
// mensagem em frames que nao tem o chat (evita "Nenhuma mensagem" em iframes
// nao relacionados).
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'COPY_CHAT') {
    // Se este frame nao tem o botao injetado, nao tem o chat - ignora.
    if (!document.getElementById(BUTTON_ID)) {
      sendResponse({ ok: false, reason: 'frame sem chat' });
      return true;
    }
    handleCopyAction();
    sendResponse({ ok: true });
  }
  return true;
});

// O background usa chrome.scripting.executeScript para disparar um CustomEvent
// em todos os frames (forma confiavel de atingir iframes). Este listener
// reage so se este frame tem o chat injetado.
window.addEventListener('chat-clipboard-copy', () => {
  if (document.getElementById(BUTTON_ID)) {
    handleCopyAction();
  }
});
