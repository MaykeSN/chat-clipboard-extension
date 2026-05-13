# Chat Clipboard

Extensão de navegador (Manifest V3, compatível com **Microsoft Edge** e Google Chrome) que extrai o histórico de mensagens de um chat de atendimento ao cliente, formata com data/hora e copia para a área de transferência.

Pensada para a plataforma **PureCloud (Genesys Cloud) + HeadsCX/Blip** (`*.invenit.cloud`), mas adaptável a outras via ajuste dos seletores CSS.

## Download

Baixe o `.zip` mais recente na **[página de Releases](https://github.com/MaykeSN/chat-clipboard-extension/releases)** e siga o passo a passo de [Como instalar](#como-instalar-modo-desenvolvedor) abaixo.

## Funcionalidades

- **Botão flutuante** fixo no canto inferior direito do painel do chat (gradiente roxo/azul, design moderno em pílula).
- **Atalho de teclado** `Ctrl+Shift+C` (configurável em `edge://extensions/shortcuts`).
- **Clique no ícone** da extensão na barra do navegador também copia.
- **Feedback visual** instantâneo: botão muda para `Copiado!` (verde) por 2 s. Estado de erro também tem cor própria.
- **Limpeza automática**: remove tags HTML literais (`<b>`, `<strong>`...) e markdown do WhatsApp (`*negrito*`, `_itálico_`, `~tachado~`) que vêm do bot.
- **Datas padronizadas**: converte timestamps tipo `13 de mai. de 2026, 13:08` para `[13/05/2026 13:08]`.

## Formato de saída

```
[13/05/2026 13:08] Cliente: Olá, preciso de ajuda com o pedido 1234.
[13/05/2026 13:08] Atendente: Olá! Claro, vou verificar agora.
[13/05/2026 13:09] Cliente: Obrigado.
[13/05/2026 13:09] Atendente: Encontrei aqui, o pedido está em rota de entrega.
```

## Privacidade

A extensão **não envia nada para nenhum servidor**. Tudo é processado localmente no seu navegador. Detalhes em [PRIVACY POLICY](https://maykesn.github.io/chat-clipboard-extension/privacy.html).

## Estrutura do projeto

```
chat-clipboard/
├── manifest.json          MV3 — declara permissões, content script, atalho
├── background.js          Service worker — escuta atalho e clique no ícone
├── content_script.js      Injeta o botão flutuante e extrai o DOM
├── icons/                 Placeholders 1x1 (substitua pelos seus)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Como instalar (modo desenvolvedor)

1. Abra o Chrome e acesse `chrome://extensions/`.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar expandida** (em versões antigas do Chrome: "Carregar sem compactação").
4. Selecione a pasta `chat-clipboard` deste projeto.
5. A extensão aparece na lista — fixe o ícone na barra se quiser acesso rápido.

Recarregue a página de atendimento depois de instalar. O botão flutuante `Copiar chat` aparece no canto inferior direito.

## Ajustando os seletores CSS

Os seletores padrão do `content_script.js` são **placeholders genéricos**. Você precisa ajustá-los para a plataforma de atendimento que usa.

Abra [content_script.js](content_script.js) e edite o bloco:

```js
const SELECTORS = {
  chatContainer:   '.chat-container',      // SUBSTITUIR
  customerMessage: '.message.customer',    // SUBSTITUIR
  agentMessage:    '.message.agent',       // SUBSTITUIR
  messageText:     '.message-text',        // SUBSTITUIR (ou '' se não houver wrapper)
};
```

### Como descobrir os seletores certos

1. Na página do atendimento, abra o **DevTools** (`F12`).
2. Clique no ícone de **inspetor** (seta no canto superior esquerdo do DevTools) e clique numa mensagem do **cliente**.
3. Veja a classe / atributo da `div` da mensagem no painel **Elements**.
4. Repita para uma mensagem do **atendente** e para o **container** que envolve todas as mensagens.
5. Teste cada seletor no console do DevTools antes de salvar:
   ```js
   document.querySelectorAll('.sua-classe-aqui')
   ```
   Deve retornar exatamente as mensagens esperadas.

### Dicas

- Use seletores **específicos**. Classes genéricas como `.message` podem pegar lixo.
- Se a plataforma usa atributos `data-*`, prefira eles: `div[data-role="customer"]` é mais estável que classes que mudam em redeploys.
- Se as mensagens **não tiverem** um elemento de texto interno, defina `messageText: ''` — o script usa o `textContent` direto da mensagem.
- Se o `chatContainer` não existir ou for difícil de identificar, deixe um valor inválido — o script faz fallback para o `document` inteiro.

## Recarregando após editar

Depois de mexer no `content_script.js`:

1. Vá em `chrome://extensions/`.
2. Clique no ícone de **recarregar** (↻) no card da extensão.
3. **Recarregue a aba** do atendimento (`F5`).

## Trocando o atalho

`chrome://extensions/shortcuts` — encontre `Chat Clipboard` e edite a tecla.

## Substituindo os ícones

Os arquivos em `icons/` são placeholders transparentes de 1×1 px. Substitua pelos seus PNGs nos tamanhos 16, 48 e 128 mantendo os mesmos nomes.

## Limitações

- A extensão **não funciona em páginas internas do Chrome** (`chrome://`, Web Store, etc.) — o Chrome bloqueia content scripts ali.
- Se o chat usa Shadow DOM, os seletores `querySelectorAll` não atravessam o shadow root automaticamente. Nesse caso, é preciso ajustar o script para entrar no shadow (`element.shadowRoot.querySelectorAll(...)`).
