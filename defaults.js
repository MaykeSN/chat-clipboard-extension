// =============================================================================
// defaults.js — constantes compartilhadas entre popup e content_script
// =============================================================================
// Carregado primeiro tanto na popup (via <script src="defaults.js"></script>)
// quanto no content script (ordem em manifest.content_scripts[0].js).
// Como ambos rodam em "isolated worlds" diferentes, e seguro definir como
// globals - cada contexto tem seu proprio escopo.
// =============================================================================

const DEFAULT_PROMPT = `Voce e um assistente que ajuda atendentes de suporte ao cliente.

Analise o historico de atendimento abaixo e gere um resumo curto pro atendente humano, contendo:

1. Cliente: nome (se mencionado) e produto envolvido (modelo, data de compra)
2. Problema: o que o cliente relata
3. O que o bot ja perguntou/respondeu (sintetico, sem repetir cada pergunta)
4. Quando o atendente humano assumiu (se ja assumiu)
5. Status atual e proximo passo sugerido

Seja direto, sem rodeios. Use portugues do Brasil. Maximo 5 linhas.

---

`;

const DEFAULT_SETTINGS = {
  customPrompt: DEFAULT_PROMPT,
  includePrompt: true,
  showDates: true,
};
