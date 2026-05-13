// =============================================================================
// Chat Clipboard - Background Service Worker (MV3)
// =============================================================================
// Service worker minimalista. Responsabilidades:
//  1) Receber o evento do atalho Ctrl+Shift+C (registrado em manifest.json)
//     e repassar para o content script da aba ativa.
//  2) Permitir disparar a acao clicando no icone da extensao (action.onClicked).
// =============================================================================


/**
 * Envia mensagem para o content script da aba ativa pedindo a copia.
 * Como o chat pode estar dentro de um iframe (caso PureCloud + HeadsCX),
 * usamos chrome.scripting.executeScript com allFrames=true para disparar
 * a acao em TODOS os frames. O content script ignora a chamada em frames
 * que nao tem o chat.
 */
async function triggerCopyOnActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Dispara um CustomEvent em todos os frames. O content script (que tambem
    // roda em todos os frames com all_frames=true) escuta esse evento.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        window.dispatchEvent(new CustomEvent('chat-clipboard-copy'));
      },
    });
  } catch (err) {
    // Erros tipicos: aba protegida (chrome://, web store) ou content script
    // ainda nao carregado. Logamos e seguimos.
    console.warn('[Chat Clipboard] Nao foi possivel enviar mensagem:', err);
  }
}


// Atalho de teclado: o nome 'copy-chat' bate com o que esta em manifest.json.
chrome.commands.onCommand.addListener((command) => {
  if (command === 'copy-chat') {
    triggerCopyOnActiveTab();
  }
});


// Clique no icone da extensao tambem dispara a copia (atalho extra util).
chrome.action.onClicked.addListener(() => {
  triggerCopyOnActiveTab();
});
