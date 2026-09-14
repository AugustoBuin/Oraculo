# Oráculo · Frontend — Relatório de Auditoria de Qualidade

**Data:** 2026-09-14 | **Branch:** `feature-identidade-visual` | **Commit:** `0460fa7` | **Escopo:** diff contra `88f76ce`
**Auditor:** frontend-quality-auditor

**Conjunto auditado:** `git diff --name-only 88f76ce...HEAD -- frontend/`, com 80 arquivos: 55 em
`frontend/src`, 21 em `frontend/tests` e 4 em `frontend/public`. **Raio de alcance incluído:** as
páginas que compõem os componentes compartilhados alterados (`feedback`, `modal`, `notifications`,
`pagination`, `cascade-select`, `app-header`, `theme-toggle`), e as suítes que os cobrem.
**Dimensões de segurança e sessão continuaram em `diff`.** O conjunto não toca
`shared/api/client.js`, `shared/api/csrf.js`, `shared/session/session.js` nem
`shared/router/router.js`.

## Limites desta auditoria

Registro isto antes dos achados, para que nada seja lido como verificado quando não foi:

- **A suíte do frontend (`/tests`) não foi executada por mim**, e o `validate.php` também não.
  Quem coordena as auditorias está rodando os dois agora e pediu que eu não os rodasse. Tudo o
  que depende do placar está marcado como **condicional** ao resultado dele.
- **A verificação de fronteiras foi feita só por grep.** Não rodei o `check-boundaries.php`.
- **Nenhum navegador foi aberto.** Não vi em tela nada do que se afirma aqui sobre geometria,
  foco, contraste e alto contraste. A seção "O que só a tela prova" lista o que ficou em aberto.
- **O hash da CSP foi recalculado localmente**, a partir do `frontend/public/index.html` da
  árvore de trabalho. Não foi conferido na resposta HTTP.

## Sumário executivo

| Severidade | Qtd. | Tempo estimado |
| ---------- | ---- | -------------- |
| CRÍTICO    | 0    | —              |
| ALTO       | 0    | —              |
| MÉDIO      | 2    | 2h15           |
| BAIXO      | 3    | 1h             |
| Convenção  | 2    | 20min          |

**Nenhum CRÍTICO e nenhum ALTO. Esta auditoria não bloqueia o merge em `development`.**

O diff é grande (6.003 linhas acrescentadas) e disciplinado. Nenhum dado externo vira HTML: os
componentes novos escrevem por `textContent`. Nenhuma chamada de rede escapa do cliente único.
Os 42 tokens `--color-*` existem com o mesmo nome nos três blocos de tema. O mapa de importação
ficou intacto, e o hash dele continua batendo com a CSP. As cinco leituras do OF-002 ganharam
cancelamento e guarda nos dois ramos.

Os dois MÉDIOS são de omissão:
- **MÉDIO 1:** sobrou na lista de `overflow-wrap: anywhere` um seletor que mira contêiner com
  botão dentro. É a mesma família do OF-004 e do OF-005, num estado que a rede de geometria não
  monta.
- **MÉDIO 2:** o cartão da galeria virou parada de tabulação sem papel interativo.

---

## CRÍTICO

Nenhum.

## ALTO

Nenhum.

---

## MÉDIO

### 1. "Cadastrar mesmo assim" herda `overflow-wrap: anywhere`: a lista mira um contêiner com botão dentro

- **Local:** `frontend/src/styles/components.css:36` (a entrada `.inline-message` da lista em
  `:27-39`) × `frontend/src/features/cards/components/card-form.js:268-280`
- **Evidência:**

  ```css
  /* components.css:21-25 — a regra que o próprio arquivo escreve */
  /* Toda linha desta lista mira o TEXTO, nunca o contêiner dele. `.card-table
   * td` já esteve aqui, e `overflow-wrap` é herdado: a regra descia para o botão ... */

  /* components.css:27-39 */
  .card-name, ..., .inline-message, .state-title, .state p {
    overflow-wrap: anywhere;
  }
  ```

  ```js
  // card-form.js:268-280 — o aviso de duplicata é um CONTÊINER .inline-message
  alertSlot.replaceChildren(
    el("div", {
      classes: ["inline-message", "inline-message-attention"],
      attrs: { role: "status" },
      children: [
        el("p", { text: `Já existe "${duplicate.nameEn}" ${onde}.` }),
        el("p", { text: "Impressões múltiplas na mesma edição são normais. ..." }),
        confirmar.node,            // <- o botão herda `anywhere`
      ],
    }),
  );
  ```

- **Problema:** existem dois usos de `.inline-message`.
  - `inlineMessage()` (`feedback.js:155-161`) devolve um `<p>` só com texto. Esse uso está certo.
  - `showDuplicate` usa a mesma classe num `<div>` que contém o botão "Cadastrar mesmo assim".
    `overflow-wrap` é herdado, então o botão computa `anywhere`.

  É exatamente o que o `design.md` §9 proíbe ("Toda linha dessa lista mira o TEXTO, nunca o
  contêiner dele"). É também o que a invariante 4 da rede existe para barrar
  (`tests/support/layout.js`, `assertControlsKeepWords`, que acusa `button` e `.button` com
  `anywhere`). **Nenhuma suíte monta esse estado:** o grep por `cardForm`, `showDuplicate`,
  `inline-message` e "mesmo assim" em `frontend/tests/suites/` voltou vazio.
- **Impacto:** hoje o defeito é **latente**. O aviso vive em fluxo de bloco (`.form-alert` dentro
  do `.stack` do formulário), a largura do botão é a disponível, e o rótulo quebra entre palavras
  antes de rachar uma delas. Por isso ele não entra como ALTO. Mas é a terceira aparição da
  família que já rendeu duas linhas `HIGH` no ledger. A proteção depende de o contêiner continuar
  sendo bloco, e este mesmo diff converteu uma dúzia de contêineres em `.cluster` (flex com
  quebra). No dia em que o aviso virar `.cluster`, o botão perde o piso de min-content e sai
  "Cadas / trar", e nenhum teste reclama.
- **Verificado por:** grep (`"inline-message"` em `frontend/src`: dois usos, um deles contêiner)
  e leitura da lista, de `card-form.js`, de `feedback.js`, de `layout.js` e da suíte de geometria.
  **Não** reproduzido em tela.
- **Correção:** a regra mira o texto nos dois formatos, e o estado entra na rede.

  ```css
  /* antes — components.css:36 */
  .inline-message,

  /* depois: o <p> de inlineMessage() e os <p> de dentro do aviso; nunca o contêiner */
  p.inline-message,
  .inline-message > p,
  ```

  Para a rede alcançar o estado, basta repetir o que já se fez com `deleteCardPreview`
  (`delete-card-dialog.js`, "Exportado para a rede de geometria"). Extrair o nó do aviso para uma
  função exportada (`duplicateNotice({ duplicate, onConfirm, scope })`) e passá-lo por
  `assertLayoutInvariants` nas larguras da suíte. Com a correção de CSS **ausente**, esse teste
  tem de nascer vermelho na invariante 4. É o que prova que ele mede.

### 2. O cartão da galeria é parada de tabulação sem papel interativo

- **Local:** `frontend/src/features/cards/components/card-tile.js:133`;
  `frontend/src/features/cards/components/card-gallery.js:29` e `:72-83`
- **Evidência:**

  ```js
  // card-gallery.js:29 — o papel exposto é o de item de lista
  tile.setAttribute("role", "listitem");

  // card-tile.js:114-135 — foco, e nenhum papel de controle
  return el("article", {
    classes: ["card-tile"],
    attrs: { "data-card-id": card.id, ...(canOpen ? { tabindex: "0" } : {}) },
    children: [media, el("div", { classes: ["card-body"], children: body })],
  });

  // card-gallery.js:72 — Enter e Espaço agem, por handler escrito à mão
  scope.on(grid, "keydown", (event) => { ... act(event.target); });
  ```

- **Problema:** a correção do OF-003 resolveu o que o achado pedia, e o teclado agora abre a
  carta. Mas ela resolveu com um `listitem` focável, e esse papel não diz que o elemento **faz**
  alguma coisa. Quem usa leitor de tela chega ao cartão pelo Tab e ouve o conteúdo inteiro, sem
  "link" nem "botão". Não há `aria-describedby` nem instrução que indique que Enter abre a edição.
  Isso contraria `PADROES-ENGENHARIA.md` §9.1 ("semântica primeiro") e a WCAG 4.1.2 (nome, papel
  e valor de todo componente de interface). O relatório de 09/09 já apontava o caminho nativo como
  "o mais barato e mais correto", e o `tabindex` como alternativa mínima. A alternativa mínima foi
  a escolhida, e a escolha está registrada só nas notas do ledger, **não num ADR**. Por isso ela
  entra aqui como achado.
- **Impacto:** o fluxo principal do produto (achar a carta e abri-la) funciona pelo teclado, mas é
  descoberto por tentativa por quem não enxerga a tela. Nada quebra para quem usa mouse ou teclado
  com visão.
- **Verificado por:** leitura de `card-tile.js`, `card-gallery.js` e do CSS de foco
  (`base.css:151-155`). **Não** verificado com leitor de tela.
- **Correção:** o nome da carta vira link, com o endereço injetado por quem compõe. A feature não
  pode importar `ROUTES` de `pages/` (§3). O roteador já intercepta clique em link interno.

  ```js
  // cards-page.js — quem compõe injeta o endereço
  cardGallery({ cards, onOpen, onDelete, scope, hrefOf: (id) => ROUTES.editCard(id) });

  // card-tile.js — antes
  el("h2", { text: card.nameEn, classes: ["card-name"] }),
  // ... e `tabindex: "0"` no article

  // depois — o link recebe foco, Enter, papel e menu de contexto de graça
  el("h2", {
    classes: ["card-name"],
    children: [hrefOf === undefined
      ? el("span", { text: card.nameEn })
      : el("a", { text: card.nameEn, attrs: { href: hrefOf(card.id) } })],
  }),
  // ... e o article perde o `tabindex`; o `keydown` da grade deixa de ser necessário
  ```

  Se o link for recusado, o mínimo é a instrução: um `<p class="sr-only" id="card-open-hint">`
  único na grade ("Enter abre a carta para edição") e `aria-describedby="card-open-hint"` em cada
  cartão focável. O porquê da decisão vai para o `design.md` ou para um ADR.

---

## BAIXO

### 3. O painel de catálogo não substitui a leitura anterior: duas respostas podem chegar fora de ordem

- **Local:** `frontend/src/features/catalogs/components/catalog-panel.js:69-84`, chamada em
  `:169`, `:196`, `:310`, `:390` e `:406`
- **Evidência:**

  ```js
  async function load(focusSelector) {
    renderInto(() => loading(`Carregando ${title.toLowerCase()}…`));
    const controller = scope.controller();      // novo a cada chamada; o anterior segue no ar
    try {
      const fresh = await api.list(gameId, { signal: controller.signal });
      if (controller.signal.aborted) { return; }
      items = fresh;                             // a última a CHEGAR vence, não a última pedida
  ```

- **Problema:** cancelar com a tela ficou certo (OF-002). **Substituir** não ficou. O formulário de
  criação fica fora do `body` que o `renderInto` troca, então ele continua habilitado enquanto a
  leitura corre (`:351-390`, com `load()` sem `await`). Duas criações em sequência disparam duas
  leituras. Se a primeira voltar por último, `items` recebe a lista sem o segundo item. Além disso,
  cada chamada empilha mais uma limpeza no escopo do painel, que é a mesma família do BAIXO 11 de
  09/09.
- **Impacto:** a janela é a latência de um `GET` contra o tempo de preencher código e nome de
  novo, então na prática é quase inalcançável. Se acontecer, o item criado some da lista até a
  próxima leitura, e uma nova tentativa recebe `409`.
- **Verificado por:** leitura de `catalog-panel.js` e de `scope().controller` (`events.js:80-84`).
- **Correção:** o padrão que `cards-page.js:195-199` já usa.

  ```js
  let inFlight = null;
  scope.add(() => inFlight?.abort());

  async function load(focusSelector) {
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    renderInto(() => loading(`Carregando ${title.toLowerCase()}…`));
    // ... o resto igual, com as mesmas duas guardas de `controller.signal.aborted`
  ```

### 4. Item sem `ref` nasce com o editor aberto

- **Local:** `frontend/src/features/catalogs/components/catalog-panel.js:48` e `:130`;
  `frontend/src/features/catalogs/api/catalogs-api.js:116`
- **Evidência:**

  ```js
  // catalogs-api.js:116 — o item fora do contrato é mantido, com ref nula
  ref: typeof raw.ref === "number" ? raw.ref : null,

  // catalog-panel.js:48 e :130
  let editingRef = null;
  ...
  if (item.ref === editingRef) { return editor(item, life); }   // null === null
  ```

- **Problema:** "nenhum item em edição" e "item sem referência" são o mesmo `null`. Um item cujo
  `ref` não veio numérico é desenhado como editor aberto a cada render. Se forem vários, nascem
  vários editores com o mesmo `id` (`raridade-nome-null`), e o Salvar deles faz `PUT` em
  `/…/null`.
- **Impacto:** só aparece com o contrato violado. O `api-contract.md:208-214` garante `ref` na
  listagem de administração. É defesa, não defeito observável.
- **Verificado por:** leitura.
- **Correção:**

  ```js
  // catalog-panel.js:130 — antes
  if (item.ref === editingRef) {
  // depois
  if (editingRef !== null && item.ref === editingRef) {
  ```

  Ou, na borda, descartar em `listForAdmin` o item sem `ref`: sem ele, nenhuma escrita o alcança.

### 5. Se montar o portal falhar, a raiz fica com opacidade zero

- **Local:** `frontend/src/pages/login/login-page.js:70-75`
- **Evidência:**

  ```js
  root.classList.add("enter-fade", "enter-fade-start");   // opacity: 0 na raiz
  onAuthenticated(user);                                   // se lançar, as duas linhas abaixo não rodam
  root.getBoundingClientRect();
  root.classList.remove("enter-fade-start");
  ```

- **Problema:** uma exceção ao montar o `appShell` sobe até o `catch` do `loginForm`, que mostra o
  aviso num formulário que agora está **invisível** (`utilities.css`, `.enter-fade-start`). Antes
  do diff, a mesma exceção aparecia no formulário visível. É uma regressão de falha contida
  (§7.3), num caminho alcançável só por erro de programação.
- **Impacto:** tela em branco em vez de mensagem, e só quando algo já está quebrado.
- **Verificado por:** leitura de `login-page.js`, `login-form.js:141-170` e `main.js:80-90`.
- **Correção:**

  ```js
  root.classList.add("enter-fade", "enter-fade-start");
  try {
    onAuthenticated(user);
    root.getBoundingClientRect();
  } finally {
    root.classList.remove("enter-fade-start");
  }
  ```

---

## Convenções

### 6. Cinco identificadores novos em português

- **Local:** `frontend/src/features/cards/components/card-back.js:28` (`decorativo`);
  `frontend/src/features/cards/components/delete-card-dialog.js:49` (`verso`), `:50`
  (`miniatura`), `:70` (`trocar`); `frontend/src/pages/login/login-page.js:118` (`deitada`)
- **Regra:** `ENGENHARIA.md` §6 e `PADROES-ENGENHARIA.md` §3.1: identificador em inglês;
  português fica para comentário, nome de teste e texto de tela.
- **Correção:** `decorativo` → `decorative`; `verso` → `makeBack`; `miniatura` → `thumbnail`;
  `trocar` → `swapForBack`; `deitada` → `sideCard`. Os três de 09/09 (`onde` e `confirmar` em
  `card-form.js:255,258`, e `onde` em `delete-card-dialog.js:156`) continuam de pé. Ver
  "Persistentes".

### 7. O `design.md` §9 diz que toda `@media` do projeto é de preferência, e já não é

- **Local:** `frontend/src/styles/components.css:450` × `docs/design.md` §9, "Quando um arranjo
  novo entra", item 3
- **Evidência:** o `design.md` diz "As que existem no projeto são de preferência do usuário — tema,
  movimento, ponteiro —, não de largura". O `components.css:450` declara
  `@media (max-height: 32rem)`, que mede o viewport.
- **Regra:** `ENGENHARIA.md`, preâmbulo: "Quando o código divergir daqui, um dos dois está
  errado". A regra de §5 (nenhuma `@media (min-width…)`) **não** é violada. A consulta é de altura,
  e está certa para a entrada, que ocupa a janela (`min-height: 100svh`). O que ficou falso é a
  frase do documento normativo.
- **Correção:** registrar a exceção no item 3. Por exemplo: "…e uma de altura na tela de entrada,
  a única que ocupa o viewport inteiro".

**Conferido e conforme:**
- Os arquivos novos estão em `kebab-case`, `@2x` incluído. O grep de nomes fora do padrão voltou
  vazio.
- Os atributos de dado estão em `data-kebab-case`: `data-edit-ref`, `data-state`,
  `dataset.resolvedTheme`.
- Nenhum evento customizado novo.
- As constantes de `shared/theme/rarity-colors.js` estão em `UPPER_SNAKE_CASE`
  (`RARITY_COLORS`, `DEFAULT_RARITY_COLOR`).
- A branch `feature-identidade-visual` usa hífen (ADR-010).
- Os commits seguem Conventional Commits em português.

---

## Persistentes do relatório de 09/09, no código que este diff tocou

Não entram na contagem, porque não são novos. Ficam listados porque o arquivo de cada um passou
por este diff e o achado continuou de pé. Isso ainda não é piora.

| Achado de 09/09 | Onde continua | Conferido por |
|---|---|---|
| MÉDIO 3: a pré-visualização remota dispara por tecla | `card-image-field.js:289` (`scope.on(url, "input", applyUrl)`) | grep |
| MÉDIO 4: edição e raridade inválidas sem mensagem | `card-form.js:194`, `:199` (só `aria-invalid`) | grep + leitura |
| MÉDIO 6: catálogos confundem 403 com erro | `catalogs-page.js:133`; `catalog-panel.js:104-114` (sem ramo `isForbidden`) | grep |
| BAIXO 8: valores crus fora de `tokens.css` | `components.css:247` (`800ms`), `:667` (`rgb(0 0 0 / 0.5)`) | grep |
| BAIXO 12: o seletor de jogos fica mudo na falha | `catalogs-page.js:126-134` (só `panels` recebe a falha) | leitura |
| Convenção 14: identificadores em português | `card-form.js:255`, `:258`; `delete-card-dialog.js:156` | grep |

---

## Conferência final (as dez perguntas)

As respostas se referem ao conjunto do diff e ao raio de alcance dele.

| # | Pergunta | Resposta | Evidência |
|---|---|---|---|
| 1 | Dado externo virando HTML? `innerHTML`, `insertAdjacentHTML`, `eval`? | **Não** | O grep de `innerHTML\|insertAdjacentHTML\|outerHTML\|document.write\|eval(\|new Function(\|srcdoc\|javascript:` nos arquivos alterados deu dois acertos, os dois comentários (`brand-mark.js:12`, `card-image-field.js:274`). Os componentes novos escrevem dado editável por `text`: `card-back.js:37`, `rarity-badge.js:27`, o editor de `catalog-panel.js`. A `/paleta` pinta por CSSOM (`palette-page.js:46-52`) valores lidos da própria folha, não de dado externo. Os 13 SVGs novos têm **zero** ocorrências de `<script`, atributo `on*`, `href`, `xlink:href`, `foreignObject` ou `url(http`. |
| 2 | Chamada de rede fora do cliente único, ou URL de API literal? | **Não** | O grep de `fetch(\|XMLHttpRequest\|navigator.sendBeacon` e de `'/api/` nos arquivos alterados voltou vazio. `listForAdmin` passa o `signal` pelo `api.get` (`catalogs-api.js:96-97`). Os corpos de `POST`/`PUT` são montados campo a campo (`:150-151`, `:173-174`); o `...extra` só leva `{ color }`. |
| 3 | Decisão de permissão no cliente que não seja mostrar/esconder? | **Não** | A rota `/paleta` declara `requires: "VIEWER"` (`app-shell.js:93-99`), o mesmo guarda de exibição das outras. O Salvar do editor de catálogo vai direto a `api.update`, sem checar nível antes da escrita (`catalog-panel.js:280-310`): não há TOCTOU. |
| 4 | `role === "…"` ou nível numérico fora de `hasLevel()`? | **Não** | Os acertos são `app-shell.js:125,204`, `navigation.js:44-45` e `cards-page.js:73`, todos por `hasLevel`, e o comentário `app-header.js:5`, que proíbe a comparação. O grep por nível numérico voltou vazio. |
| 5 | Listener, timer ou requisição sem cancelamento? | **Não há vazamento novo.** Resta a substituição (BAIXO 3). | Todo listener novo passa por escopo: `card-gallery.js:72`, `delete-card-dialog.js` (`life.on(..., { once: true })`), `catalog-panel.js` (`life.on` no editor). `loginPage` e `palettePage` devolvem limpeza (`login-page.js:147`, `palette-page.js:325`). A espera da virada tem guarda de `life.isDisposed` (`login-page.js:46-54`). **As cinco leituras do OF-002 têm controller e guarda depois do `await` e no `catch`:** `catalogs-page.js:101,114,129`; `cards-filters.js:126,131,157`; `card-form.js:350,355,384`; `catalog-panel.js:74,79,100`; `catalogs-api.js:96-97`. |
| 6 | Tela sem os cinco estados? | **Sem regressão**; o MÉDIO 6 de 09/09 continua | A `/paleta` não faz leitura remota e desenha vazio quando a folha não declara tokens (`palette-page.js:311`). O editor de catálogo mostra o erro no próprio formulário (`catalog-panel.js`, `alert` + `userMessage`). `cards-page` ganhou ilustrações nos dois vazios, sem mudar os estados. |
| 7 | Valor visual fora de `tokens.css`, ou token em um tema só? | **Token: não. Valor cru novo: não.** | Script de comparação sobre `tokens.css`: `--color-*` com **42 / 42 / 42** nomes idênticos no claro, na `@media` escura e em `[data-theme="dark"]`; `--shadow-overlay` nos três. Os `--image-*` são 13 no claro; os dois da cena da entrada são redefinidos nos dois blocos escuros; os outros 11 são máscara sem cor, e o arquivo registra isso ("não mudam com o tema: são máscara"). Os valores novos de `components.css` são proporção de desenho (`aspect-ratio` do `viewBox`, `padding: 17% 16%` da moldura) e cores de sistema dentro de `forced-colors`; nenhuma cor nem duração crua nova. Os dois crus antigos persistem (BAIXO 8 de 09/09). Contraste: **lido, não medido em tela.** |
| 8 | Leitura remota sem política de validade declarada? | **Não** | Os usos de `cache.` no diff são `cards-api.js:209,248` e `catalogs-api.js:46,56,66`, todos `fetchOnce` com TTL. A listagem de administração passa ao largo do cache de propósito, e o motivo está escrito (`catalogs-api.js:88-95`). |
| 9 | Mensagem técnica alcançável pelo usuário? | **Não** | O grep de `error.message\|err.message\|String(error)\|${error}` nos arquivos alterados voltou vazio. `icon()` (`icon.js:44`) e `stateImage()` (`feedback.js`) lançam `TypeError` com texto técnico, mas o nome vem sempre de literal do código, nunca de dado. É erro de programação, não caminho do usuário. |
| 10 | Segredo, token ou dado pessoal em `localStorage`, URL ou log? | **Não** | O grep de `localStorage\|sessionStorage\|document.cookie` e de `csrf\|token` com storage/url/console nos arquivos alterados voltou vazio. O único log novo (`cards-api.js:50-52`) registra o objeto da raridade (`id`, `name`, `color`), sem dado pessoal. |

### Verificações extras

**CSP e mapa de importação.** O diff acrescenta três `<link rel="icon">` ao `index.html`, fora do
bloco do mapa. O conteúdo do `<script type="importmap">` foi recalculado na árvore de trabalho:
64 bytes, sem CR, `sha256-uBe61TLOgUZyopiIimcIToVknvqJ+W5vLpBrThdXkaA=`. É **idêntico** ao de
`CSP_APP` em `docker/app/apache.conf:43`. As imagens novas são de mesma origem (`/src/assets/…`,
`/favicon.*`), cobertas por `img-src 'self'`. `mask-image` e `image-set()` passam pela mesma
diretiva. A `/paleta` pinta por `style.setProperty`, e CSSOM não passa pela CSP.

**Fronteiras (ADR-002), por grep.** `shared/` não importa de `features/` nem de `pages/` (vazio).
Nenhuma feature importa outra (vazio). O encontro entre catálogos e o selo compartilhado acontece
na página (`catalogs-page.js`, `RARITY_APPEARANCE`). `card-back.js` fica dentro de
`features/cards` e só é usado ali. `brand-mark`, `icon` e `rarity-badge` subiram para `shared/`,
e nenhum deles conhece domínio.

**`@media` em `components.css`.** Nenhuma `min-width`. As que existem são quatro de
`forced-colors` e uma de `max-height` (Convenção 7). As duas trocas de arranjo por largura são
`@container` (`filters`, `login`).

**Suítes.** As suítes em `frontend/tests/suites/` estão todas registradas em
`frontend/tests/main.js`. A varredura por arquivo ausente do registro voltou vazia. O placar está
**por confirmar** com o resultado do run em andamento.

**ADR-004.** A renderização de DOM continua fora do TDD estrito. A cobertura não uniforme do diff
(ex.: `showDuplicate` sem suíte) não é achado por isso. O MÉDIO 1 fala da **rede de geometria**,
que o `ENGENHARIA.md` §5 torna obrigatória para layout, e não de TDD.

## O que só a tela prova, e ficou em aberto

1. **O item não marcado do P4** (`docs/visual-identity-checklist.md`): 360, 500, 752 e 1424px, com
   fonte em 200%, nos dois temas e com o celular deitado. Isso inclui o arranjo largo
   (`@container login (min-width: 64rem)`), que o checklist registra como nunca visto (janela de
   643px).
2. **Alto contraste do Windows.** As regras de `forced-colors` da marca, dos ícones, do verso e das
   ilustrações de estado estão escritas, mas não foram vistas. Em especial: se `currentcolor`
   dentro de `.icon` com `forced-color-adjust: none` herda a cor de sistema do texto ao lado.
3. **O anel de foco no `<main>` depois de entrar pelo teclado.** `login-page.js:86` foca
   `#conteudo` (`tabindex="-1"`, `app-shell.js:49`). O `:focus-visible` global (`base.css:151-155`)
   não tem exceção para `tabindex="-1"`, e depois de um Enter o Chrome costuma casar
   `:focus-visible` em foco programático. Pode sair um contorno em volta do conteúdo inteiro. Não
   é achado sem ver.
4. **A virada com movimento reduzido.** Pela leitura, a animação dura 1ms (`tokens.css:474`), e o
   esmaecimento sobrevive graças ao `transition-property: none !important` de
   `.enter-fade-start`. Não visto.
5. **O nome da carta sobre o verso.** `.card-image-empty-text` fica em `--color-muted` sobre
   `--color-bg` (4,87:1 no claro, pelo token). Falta confirmar que o traço da moldura não passa sob
   o texto em 176px e na coluna larga.

---

## Fora de escopo — notado

- **A moldura do cartão de entrada: não discordo da decisão de 14/09.** Noto só um comentário que
  a contradiz. O `components.css`, na regra `.image-preview-empty { margin: calc(var(--space-2) * -1) }`
  (`:1336`, com o comentário logo acima), justifica a margem negativa dizendo que "a máscara
  esticaria numa proporção 4% diferente da carta, e a moldura sairia achatada". A medição do P4
  mostrou o contrário: com `mask-size: 100% 100%`, o `preserveAspectRatio` padrão do SVG vence e o
  desenho não estica. A margem continua útil (o fundo do verso preenche a caixa), mas o motivo
  escrito é o que a medição derrubou.
- **A linha da visão tabela** (`card-table.js:91`, `tr` com `tabindex="0"`, anterior à base) tem a
  mesma ausência de papel interativo do MÉDIO 2.
- **Identificadores em português nas suítes novas** (`layout-geometry.test.js`: `edicoes`,
  `raridades`, `cartao`, `deitada`). É infraestrutura de teste, fora da contagem.
- **A classe `enter-fade` fica na raiz para sempre** (`login-page.js:60-62`, decisão comentada).
  Inofensiva hoje: não muda nada sem o `-start`. Registro só para quem um dia puser outra
  transição de opacidade na raiz.

---

## Recomendações

1. **Antes do merge, e barato:** corrigir o MÉDIO 1 (duas linhas de CSS) e pôr o aviso de duplicata
   na rede de geometria. É a terceira vez que a mesma propriedade aparece, e das duas primeiras
   ninguém a pegou lendo código.
2. **Antes do merge, na tela:** fechar os cinco itens de "O que só a tela prova", começando pelo
   item não marcado do P4. Nenhum deles é alcançável por leitura, e o histórico do ledger (OF-004 e
   OF-005) mostra que é na tela que esta família de defeito aparece.
3. **Decidir o MÉDIO 2 com registro.** O link no nome resolve a galeria e a tabela juntas. Se a
   escolha for manter o `tabindex`, o mínimo é a instrução para leitor de tela, e o porquê vai para
   um documento versionado, não só para as notas do ledger.
4. **Aproveitar a passagem:** os MÉDIOS 4 e 6 de 09/09 moram em arquivos que este diff já abriu, e
   cada um é uma função de poucas linhas.
5. **Atualizar o `design.md` §9** (Convenção 7) no mesmo commit que tocar a entrada de novo.

---

## Para consolidar

### (a) Ledger — `docs/audits/open-findings.md`

**Nenhuma linha nova.** Esta auditoria não tem `CRITICAL` nem `HIGH`, então não há `OF-NOVO-*`.

**Atualizações de status propostas** (`fixed` → `verified`):

| ID | Proposta | Base |
|---|---|---|
| OF-002 | `fixed` → `verified` | Lidas as cinco leituras: `scope.controller()`/`life.controller()`, `{ signal }` propagado e guarda de `signal.aborted` depois do `await` e dentro do `catch`, em `catalogs-page.js:101,114,129`; `cards-filters.js:126,131,157`; `card-form.js:350,355,384`; `catalog-panel.js:74,79,100`. `listForAdmin` aceita e repassa o `signal` (`catalogs-api.js:96-97`). O `renderPanels` de `catalogs-page` não roda mais depois do `dispose`. Resíduo **não** coberto pelo achado original: BAIXO 3 (substituição). |
| OF-003 | `fixed` → `verified` | `tabindex` condicionado a `onOpen` (`card-tile.js:133`); `keydown` na grade com Enter/Espaço e saída antecipada no botão de excluir (`card-gallery.js:72-83`). O critério do achado (abrir uma carta só pelo teclado na galeria) está atendido. A semântica do alvo segue como MÉDIO 2 **deste** relatório, que não reabre o OF-003. |
| OF-004 | `fixed` → `verified` **se** o placar em andamento vier verde em `image-field-layout.test.js` e em `layout-geometry.test.js` ("o campo de imagem cruza os pontos de quebra…", `:281`); do contrário, fica `fixed` | Por leitura: não há `overflow-wrap` no `body` (`base.css:53`, comentário); o campo de imagem é `.sidebar` (`card-image-field.js`, `.image-field-body`); não há `@media (min-width…)` em `components.css`. |
| OF-005 | `fixed` → `verified` **se** o placar vier verde em `layout-geometry.test.js` ("a tabela de cartas rola no próprio eixo…", `:414`); do contrário, fica `fixed` | Por leitura: `.card-table td` saiu da lista (`components.css:27-39`); `wrap-anywhere` só nas células de dado (`card-table.js:69`); a invariante 4 existe e cobre `button` e `.button` (`tests/support/layout.js`, `assertControlsKeepWords`). |

**Nota sugerida** para a seção "Notas" do ledger (opcional, porque MÉDIO não vira linha):
"`.inline-message` na lista de `anywhere` mira também o contêiner do aviso de duplicata, com o
botão 'Cadastrar mesmo assim' dentro (`card-form.js:268-280`). Terceira aparição da família do
OF-004 e do OF-005, latente porque o aviso vive em fluxo de bloco, e fora da rede de geometria.
`MEDIUM`, relatório `2026-09-14_feature-identidade-visual_frontend_0c-0h-2m-3l_diff.md`."

### (b) Métrica — `docs/audits/audit-metrics.jsonl`

```json
{"date":"2026-09-14","agent":"frontend-quality-auditor","model":"opus","scope":"diff","branch":"feature-identidade-visual","duration_ms":null,"output_tokens":null,"tool_uses":30,"critical":0,"high":0,"medium":2,"low":3,"marker":"CLEAN","report":"docs/audits/2026-09-14_feature-identidade-visual_frontend_0c-0h-2m-3l_diff.md"}
```

CLEAN
