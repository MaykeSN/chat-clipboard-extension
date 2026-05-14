# Chat Clipboard

Extensão de navegador (Manifest V3, compatível com **Microsoft Edge** e Google Chrome) que extrai o histórico de mensagens de um chat de atendimento ao cliente, formata com data/hora e copia para a área de transferência — pronto pra colar num ticket, anotação ou jogar em IA pra resumir.

Pensada para a plataforma **PureCloud (Genesys Cloud) + HeadsCX/Blip** (`*.invenit.cloud`), mas adaptável a outras via ajuste dos seletores CSS.

## Download

Baixe o `.zip` mais recente na **[página de Releases](https://github.com/MaykeSN/chat-clipboard-extension/releases)** e siga o passo a passo de [Como instalar](#como-instalar-modo-desenvolvedor) abaixo.

## Funcionalidades

- **Botão flutuante** fixo no canto inferior direito do painel do chat (gradiente roxo/azul, design moderno em pílula).
- **Atalho de teclado** `Ctrl+Shift+C` (configurável em `edge://extensions/shortcuts`).
- **Popup de configurações** ao clicar no ícone da extensão na barra: editar prompt, ligar/desligar prefixo de data, disparar cópia manual.
- **Prompt customizável pra IA**: deixe um prompt salvo (ex: "resuma esse atendimento") e ele é colado no início do clipboard junto com a conversa. Cola direto na ChatGPT/Claude/Gemini.
- **Feedback visual** instantâneo: botão muda para `Copiado!` (verde) por 2 s. Estado de erro também tem cor própria.
- **Limpeza automática**: remove tags HTML literais (`<b>`, `<strong>`...) e markdown do WhatsApp (`*negrito*`, `_itálico_`, `~tachado~`) que vêm do bot.
- **Datas padronizadas**: converte timestamps tipo `13 de mai. de 2026, 13:08` para `[13/05/2026 13:08]`.

## Formato de saída

Sem prompt (toggle "Incluir prompt" desligado):

```
[13/05/2026 13:08] Cliente: Olá, preciso de ajuda com o pedido 1234.
[13/05/2026 13:08] Atendente: Olá! Claro, vou verificar agora.
[13/05/2026 13:09] Cliente: Obrigado.
[13/05/2026 13:09] Atendente: Encontrei aqui, o pedido está em rota de entrega.
```

Com prompt (toggle ligado):

```
Você é um assistente que ajuda atendentes de suporte ao cliente.
Analise o histórico de atendimento abaixo e gere um resumo curto pro atendente humano...
[restante do prompt]

---

[13/05/2026 13:08] Cliente: Olá, preciso de ajuda com o pedido 1234.
[13/05/2026 13:08] Atendente: Olá! Claro, vou verificar agora.
...
```

## Usando com IA pra resumir atendimentos

O fluxo típico pra quando você assume um atendimento herdado e precisa entender o contexto rápido:

1. Clica no ícone da extensão → abre o popup
2. Garante que **"Incluir prompt no início"** está ligado
3. Ajusta o prompt se quiser (ex: trocar idioma, mudar formato do resumo, adicionar instruções específicas da sua área)
4. Clica em **"Copiar chat agora"** (ou usa o botão flutuante, ou `Ctrl+Shift+C`)
5. Cola na ChatGPT/Claude/Gemini/Copilot
6. A IA gera o resumo em segundos

O prompt padrão pede um resumo em até 5 linhas com: cliente, produto, problema, o que o bot já fez, status atual. Você pode editar pra refletir o que faz mais sentido pro seu trabalho.

> **Atenção:** a extensão **não chama IA sozinha** — você é quem cola o conteúdo onde quiser. Isso te dá controle total sobre privacidade (escolhe quando e onde compartilhar) e evita custos de API.

## Privacidade

- A extensão **não envia nada para servidor algum**. Não tem analytics, telemetria ou tracking.
- O prompt customizado e as preferências ficam salvas via `chrome.storage.sync` — sincronizado **pela sua conta do navegador** (Microsoft/Google) entre seus dispositivos. Quem gerencia esse sync é o próprio Edge/Chrome, não a extensão.
- Detalhes completos: [política de privacidade](https://maykesn.github.io/chat-clipboard-extension/privacy.html).

## Estrutura do projeto

```
chat-clipboard/
├── manifest.json              MV3 — permissões, popup, content scripts
├── background.js              Service worker — atalho de teclado
├── content_script.js          Extração do DOM + injeção do botão flutuante
├── defaults.js                Constantes compartilhadas (prompt padrão, settings)
├── popup.html                 UI do popup de configurações
├── popup.css                  Estilo do popup (gradiente, layout)
├── popup.js                   Lógica do popup (storage, save, copy)
├── icons/                     Ícones da extensão (16, 48, 128 px)
├── store-assets/              Assets pra publicação em loja (logo 300×300)
├── tools/
│   └── generate-icons.ps1     Gerador dos ícones via PowerShell + System.Drawing
├── test-chat.html             Página de teste local (espelha a estrutura do invenit.cloud)
├── privacy.html               Política de privacidade (hospedada em GitHub Pages)
├── .github/workflows/
│   └── release.yml            CI: build automático ao taggear vX.Y.Z
├── LICENSE                    MIT
└── README.md                  Este arquivo
```

## Como instalar (modo desenvolvedor)

1. Abra o **Microsoft Edge** (ou Chrome) e acesse `edge://extensions/` (ou `chrome://extensions/`).
2. Ative o **Modo do desenvolvedor** (canto inferior esquerdo ou superior direito, depende da versão).
3. Clique em **Carregar expandida** (em versões antigas: "Carregar sem compactação").
4. Selecione a pasta `chat-clipboard` que você baixou e descompactou.
5. A extensão aparece na lista. Fixe o ícone na barra (clica no ícone de quebra-cabeça → alfinete) pra acesso rápido.

Recarregue a página de atendimento depois de instalar. O botão flutuante aparece no canto inferior direito do painel do chat.

## Configurando a extensão

A maior parte das configurações fica no **popup** (clique no ícone da extensão):

- **Incluir prompt no início**: liga/desliga o prompt salvo ser colado junto com o chat.
- **Mostrar data/hora em cada mensagem**: liga/desliga o prefixo `[DD/MM/AAAA HH:mm]`.
- **Prompt padrão**: textarea editável. Auto-salva 600 ms após você parar de digitar. Botão "Restaurar padrão" volta ao texto inicial.

Para configurações mais avançadas (seletores CSS, atalho de teclado, ícones), veja as seções abaixo.

## Adaptando para outra plataforma de chat

Os seletores estão no topo do [content_script.js](content_script.js), no bloco `SELECTORS`. O valor padrão aponta pro `*.invenit.cloud` (HeadsCX/Blip):

```js
const SELECTORS = {
  chatContainer:   '.historic__container',
  customerMessage: 'section[side="left"]',
  agentMessage:    'section[side="right"]',
  messageText:     '.message-card__text',
  messageDate:     '.message-card__date',
};
```

### Como descobrir os seletores certos numa nova plataforma

1. Na página do atendimento, abra o **DevTools** (`F12`).
2. Clique no ícone de **inspetor** (seta no canto superior esquerdo do DevTools) e clique numa mensagem do **cliente**.
3. Veja a classe ou atributo da `<div>`/`<section>` da mensagem no painel **Elements**.
4. Repita pra uma mensagem do **atendente** e pro container que envolve todas as mensagens.
5. Teste cada seletor no console:
   ```js
   document.querySelectorAll('.sua-classe-aqui').length
   ```
   Tem que retornar o número certo de mensagens.

### Dicas

- Use seletores **específicos e estáveis**. Atributos `data-*` ou classes BEM (`.message-card__text`) costumam ser mais estáveis que classes hash de styled-components (`.sc-xyz123`).
- Se as mensagens **não tiverem** elemento de texto interno, defina `messageText: ''` — o script usa o `textContent` direto da mensagem.
- Se o chat estiver dentro de um **iframe**, a extensão já lida com isso (`all_frames: true` no manifest).

## Recarregando após editar código

1. `edge://extensions/`
2. Clica no ícone de **recarregar** (↻) no card da Chat Clipboard
3. **Recarregue a aba** do atendimento (`F5`) — content scripts só são re-injetados em pages novas

## Trocando o atalho

`edge://extensions/shortcuts` — encontra `Chat Clipboard` e edita a combinação de teclas. Padrão: `Ctrl+Shift+C`.

## Substituindo / regerando os ícones

Os ícones em `icons/` são gerados via PowerShell. Pra trocar cores ou estilo:

1. Edita as variáveis no topo de [tools/generate-icons.ps1](tools/generate-icons.ps1):
   ```powershell
   $ColorStart = "#6366f1"   # canto superior esquerdo do gradiente
   $ColorEnd   = "#8b5cf6"   # canto inferior direito
   ```
2. Roda:
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\generate-icons.ps1
   ```
3. Recarrega a extensão.

O script gera tanto os ícones da extensão (16/48/128) quanto o logo da loja (300×300 em `store-assets/`).

## Publicando uma nova versão (auto-deploy)

O repositório tem um **GitHub Action** que empacota o `.zip` e cria um Release automaticamente quando você empurra uma tag no formato `vX.Y.Z`.

### Passo a passo

1. **Atualize a versão** em [manifest.json](manifest.json):
   ```json
   "version": "1.1.0"
   ```
2. Faça commit das mudanças:
   ```bash
   git add .
   git commit -m "Release v1.1.0: <descrição curta>"
   git push
   ```
3. **Crie e empurre a tag**:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
4. **Aguarde 1–2 min**. O GitHub Action ([release.yml](.github/workflows/release.yml)) vai:
   - Empacotar o `.zip` com os arquivos de produção
   - Sincronizar a versão no manifest com a tag
   - Criar um Release com o `.zip` anexado
   - Auto-gerar notas baseadas nos commits da versão
5. **Verifique** em https://github.com/MaykeSN/chat-clipboard-extension/releases

A URL de download permanente da última versão fica em:

```
https://github.com/MaykeSN/chat-clipboard-extension/releases/latest/download/chat-clipboard-vX.Y.Z.zip
```

## Limitações

- A extensão **não funciona em páginas internas do Edge/Chrome** (`edge://`, `chrome://`, Web Store, etc.) — o navegador bloqueia content scripts ali por segurança.
- Se a empresa do colega tem **política bloqueando "Modo de desenvolvedor"** no Edge, a instalação manual fica inviável. Solução: pedir liberação pra TI ou ir pelo caminho de allowlist corporativo.

## Licença

[MIT](LICENSE) — Copyright (c) 2026 Mayke de Souza Nogueira.
