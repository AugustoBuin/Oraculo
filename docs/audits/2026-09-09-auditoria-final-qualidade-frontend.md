# Oráculo · Frontend — Relatório de Auditoria de Qualidade

**Data:** 2026-09-09 | **Branch:** `development` | **Commit:** `88f76ce` | **Escopo:** full
**Auditor:** frontend-quality-auditor
**Contexto:** auditoria de fechamento da entrega (F-051), com o Épico 10 recém-integrado.

## Limites desta auditoria

Registrado antes dos achados, para que nada aqui seja lido como verificado quando não foi:

- **O runner autoral do frontend (`http://localhost:8080/tests`) NÃO foi executado nesta
  sessão** — não havia navegador conectado. O placar do frontend está **por verificar**.
  As 18 suítes do disco estão todas registradas em `frontend/tests/main.js:10-27`, então
  não há suíte órfã; o que falta é vê-las passar.
- `docker compose exec app php backend/bin/validate.php` **foi** executado: cadeia verde,
  **217 testes de backend passaram, 0 falharam**, e a verificação de fronteiras respondeu
  `Fronteiras de camada respeitadas (186 arquivos)`.
- Os cabeçalhos HTTP foram conferidos **na resposta real** do servidor (`curl -D`), não
  só no arquivo de configuração.
- Rolagem horizontal em 360px, contraste, ordem de tabulação e zoom de 200% **não foram
  vistos em tela**. O que está afirmado sobre eles vem de leitura de CSS e de
  `docs/design.md`, e está marcado assim em cada achado.

## Sumário executivo

| Severidade | Qtd. | Tempo estimado |
| ---------- | ---- | -------------- |
| CRÍTICO    | 0    | —              |
| ALTO       | 2    | 3h             |
| MÉDIO      | 4    | 3h             |
| BAIXO      | 7    | 1h30           |
| Convenção  | 1    | 10min          |

**Nenhum achado CRÍTICO. A entrega não está bloqueada por esta auditoria.**

O código é, de forma consistente, melhor do que a média do que se audita: a superfície de
XSS foi eliminada por construção em vez de por revisão (`shared/dom/elements.js`), a rede
tem um ponto único de verdade, o token CSRF nunca toca armazenamento, e a CSP de F-051 está
ligada, sem `unsafe-inline` e sem `unsafe-eval`, com o hash do mapa de importação
**conferido byte a byte** contra o arquivo servido. Os dois achados ALTO são de omissão, não
de erro: uma classe de leitura que ficou sem cancelamento e uma ação que só existe para o
mouse.

---

## CRÍTICO

Nenhum.

As sete dimensões críticas foram varridas e voltaram limpas. O detalhamento de cada uma
está na tabela da "Conferência final", com o comando e o local que servem de prova.

---

## ALTO

### 1. Cinco leituras remotas sem cancelamento — e uma delas ressuscita a tela depois de morta

- **Local:** `frontend/src/pages/catalogs/catalogs-page.js:89-106` (o caso grave)
  - `frontend/src/pages/cards/cards-filters.js:122-152`
  - `frontend/src/features/cards/components/card-form.js:343-376`
  - `frontend/src/features/catalogs/components/catalog-panel.js:47-51`
  - `frontend/src/features/catalogs/api/catalogs-api.js:95-96` (`listForAdmin` sequer
    aceita um `signal`)
- **Evidência:**

  ```js
  // catalogs-page.js:55 — a limpeza registrada ANTES
  life.add(() => panelsLife?.dispose());

  // catalogs-page.js:89-106
  async function loadGames() {
    panels.replaceChildren(loading("Carregando os jogos…"));

    try {
      const games = await listGames();          // <- sem signal, sem checagem de vida

      game.replaceChildren(
        ...games.map((item) => el("option", { text: item.name, attrs: { value: item.id } })),
      );

      game.value = games[0]?.id ?? "";
      renderPanels(game.value);                 // <- cria escopo NOVO, depois do dispose
  ```

  ```js
  // catalogs-page.js:57-59 — o escopo novo nasce sem ninguém para enterrá-lo
  function renderPanels(gameId) {
    panelsLife?.dispose();
    panelsLife = createScope();
  ```

  E, para comparação, o padrão que o próprio projeto já usa e que estas cinco leituras não
  seguem (`shared/dom/events.js:80-84`):

  ```js
  controller: () => {
    const controller = new AbortController();
    add(() => controller.abort());
    return controller;
  },
  ```

- **Problema:** `listGames()`, `listEditions()` e `listRarities()` **aceitam** `{ signal }`
  (`catalogs-api.js:44,54,64`) e nenhum destes cinco pontos passa um. Sair da tela enquanto a
  leitura está no ar não cancela nada. No caso de `catalogs-page.js`, é pior do que
  desperdício: a limpeza do escopo já rodou, `panelsLife` já foi disposto, e o `then` da
  promessa cria um `createScope()` **novo** — que nenhuma limpeza alcança, porque a única que
  o alcançaria (`life.add(() => panelsLife?.dispose())`, linha 55) já foi consumida. Esse
  escopo então monta dois `catalogPanel`, e cada um dispara o próprio `api.list(gameId)`
  (`catalog-panel.js:235` → `:51`). **Duas requisições novas partem depois de a tela ter
  morrido.**
- **Impacto:** RNF-07 diz "nenhuma requisição, listener ou timer sobrevive à tela que o
  criou", e aqui cinco sobrevivem. O dano imediato é modesto — são `GET`, o DOM alvo está
  destacado e é coletável —, mas é exatamente o vazamento que o §12.4 chama de "o que não
  quebra nada, só degrada a cada tela visitada": abrir `/catalogos` e sair antes de os jogos
  carregarem dispara requisições para uma tela que não existe, e faz isso toda vez.
- **Verificado por:** grep (`AbortController`, `signal`) + leitura das cinco funções e do
  ciclo de vida de `scope()`. Não reproduzido em navegador.
- **Correção:**

  ```js
  // antes — catalogs-page.js:89-102
  async function loadGames() {
    panels.replaceChildren(loading("Carregando os jogos…"));
    try {
      const games = await listGames();
      ...
      renderPanels(game.value);

  // depois
  async function loadGames() {
    panels.replaceChildren(loading("Carregando os jogos…"));
    const controller = life.controller();      // já se cancela com a tela

    try {
      const games = await listGames({ signal: controller.signal });

      if (controller.signal.aborted || life.isDisposed) {
        return;                                 // a tela morreu: não desenha, não monta
      }
      ...
      renderPanels(game.value);
  ```

  O mesmo par (`life.controller()` + guarda depois do `await`) resolve `cards-filters.js`,
  `card-form.js` e `catalog-panel.js`. Para `catalog-panel.js` é preciso primeiro dar um
  `{ signal }` a `listForAdmin` (`catalogs-api.js:95`) e propagá-lo pelos quatro membros do
  objeto `api` que a página injeta.

### 2. Na galeria — a visão padrão — abrir uma carta é ação exclusiva de mouse

- **Local:** `frontend/src/features/cards/components/card-tile.js:117-123` e
  `frontend/src/features/cards/components/card-gallery.js:30-55`
- **Evidência:**

  ```js
  // card-tile.js:117-123 — o cartão inteiro é o alvo do clique, e não é focável
  return el("article", {
    classes: ["card-tile"],
    attrs: { "data-card-id": card.id },
    children: [media, el("div", { classes: ["card-body"], children: body })],
  });
  ```

  ```js
  // card-gallery.js:31 — só clique; não há handler de teclado
  scope.on(grid, "click", (event) => {
    const tile = event.target.closest?.("[data-card-id]");
    ...
    onOpen?.(id);
  });
  ```

  A tabela, na mesma tela, faz o certo (`card-table.js:77` e `:120-129`):

  ```js
  attrs: { "data-card-id": card.id, tabindex: "0" },
  ...
  scope.on(body, "keydown", (event) => {
    ...
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      act(event.target);
    }
  });
  ```

- **Problema:** o `article` do cartão não é `button`, não é link e não tem `tabindex`. Os
  únicos elementos focáveis dentro da grade são os botões "Excluir". Quem navega por teclado
  **não tem como abrir uma carta para edição na visão de galeria** — e a galeria é o padrão
  (`constants.js:166`, `DEFAULT_CARD_VIEW = CARD_VIEWS.GALLERY`). O CSS confirma que o
  cartão se anuncia como clicável (`components.css:432`, `.card-tile:hover` muda a borda),
  o que torna a ausência mais confusa, não menos.
- **Impacto:** contraria RNF-06 ("tudo que se faz com o mouse se faz com o teclado") e o
  primeiro critério de aceite de F-050 ("a aplicação inteira é operável só pelo teclado"),
  que é a tarefa que acabou de entrar. A saída existe — trocar para a visão de tabela — mas
  ela é descoberta por acaso, e não é o que a entrega promete.
- **Verificado por:** leitura de `card-tile.js`, `card-gallery.js`, `card-table.js` e do CSS
  correspondente; comparação entre as duas visões da mesma tela. **Não** verificado
  percorrendo a tela sem mouse — essa verificação continua pendente e é a que fecha F-050.
- **Correção:** o caminho mais barato e mais correto é fazer o nome da carta ser o alvo, em
  vez de dar `tabindex` ao `article` (um `article` focável com `Enter` reimplementa à mão o
  que o elemento nativo já dá, que é o argumento escrito em `button.js:4-6`):

  ```js
  // antes — card-tile.js:79
  el("h2", { text: card.nameEn, classes: ["card-name"] }),

  // depois — o link recebe foco, Enter e menu de contexto de graça;
  // a delegação de clique da grade continua valendo para o resto do cartão.
  el("h2", {
    classes: ["card-name"],
    children: [
      el("a", {
        text: card.nameEn,
        classes: ["card-name-link"],
        attrs: { href: ROUTES.editCard(card.id) },   // injetado por quem chama
      }),
    ],
  }),
  ```

  Como o roteador já intercepta clique em link interno (`router.js:162-193`), a navegação
  continua sem recarregar a página. Alternativa mínima, se o link for indesejado: replicar
  em `card-gallery.js` o par `tabindex: "0"` + `keydown` que `card-table.js:77,120-129` já
  tem, e acrescentar `cursor: pointer` ao `.card-tile`.

---

## MÉDIO

### 3. A pré-visualização de imagem remota dispara uma requisição por tecla digitada

- **Local:** `frontend/src/features/cards/components/card-image-field.js:289-290`,
  com `showPreview` em `:134-154`
- **Evidência:**

  ```js
  scope.on(url, "input", applyUrl);
  scope.on(url, "blur", applyUrl);
  ```

  ```js
  function showPreview(source, { local = false } = {}) {
    const image = el("img", { ..., attrs: { src: source, ... } });

    scope.on(image, "error", () => { ... }, { once: true });

    preview.replaceChildren(image);
  }
  ```

- **Problema:** `applyUrl` roda a cada caractere. Assim que o texto digitado vira uma URL
  aceita por `isSafeUrl` — o que acontece já em `https://e` —, cada tecla seguinte cria um
  `<img>` novo, dispara o carregamento daquele endereço parcial e registra mais um teardown
  no escopo do formulário. Digitar um endereço de 40 caracteres produz dezenas de
  requisições a hosts inexistentes, dezenas de listeners registrados no escopo (o
  `{ once: true }` remove o listener, mas a limpeza correspondente fica na lista até a tela
  morrer) e uma mensagem de erro que pisca e some a cada letra ("Não foi possível carregar a
  imagem deste endereço.", `:147`).
- **Impacto:** trabalho caro repetido no caminho de desenho (§17.1, MÉDIO) e ruído de rede
  visível na aba de rede. Nada quebra, mas o campo se comporta de forma nervosa justamente
  no fluxo que a Decisão de UX nº 4 descreve como secundário e técnico.
- **Verificado por:** leitura de `card-image-field.js` e de `safe-url.js:29-42` (confirmando
  que `https://e` passa). Não reproduzido em navegador.
- **Correção:** o projeto já tem a peça e a constante — `scope.timeout` e
  `SEARCH_DEBOUNCE_MS` (`constants.js:73`), usados do mesmo jeito em
  `cards-filters.js:98-101`:

  ```js
  // antes
  scope.on(url, "input", applyUrl);
  scope.on(url, "blur", applyUrl);

  // depois
  let previewDebounce = null;

  scope.on(url, "input", () => {
    window.clearTimeout(previewDebounce);
    previewDebounce = scope.timeout(applyUrl, SEARCH_DEBOUNCE_MS);
  });

  scope.on(url, "blur", () => {
    window.clearTimeout(previewDebounce);
    applyUrl();
  });
  ```

### 4. Edição e raridade inválidas ficam vermelhas sem dizer o que está errado

- **Local:** `frontend/src/features/cards/components/card-form.js:190-198`
- **Evidência:**

  ```js
  if (edition.value === "") {
    edition.select.setAttribute("aria-invalid", "true");
    valid = false;
  }

  if (rarity.value === "") {
    rarity.select.setAttribute("aria-invalid", "true");
    valid = false;
  }
  ```

  Compare com o que os outros campos do mesmo formulário fazem (`:172-188`):
  `nameEn.setError("O nome em inglês é obrigatório.")`, `setGameError("Escolha o jogo da
  carta.")`.
- **Problema:** `aria-invalid="true"` sozinho pinta a borda (`components.css:108-110`) e
  **não anuncia nada**: não há texto de erro, e o `aria-describedby` do campo continua
  apontando para a dica ("Escolha antes o item anterior."), que descreve outro estado. O
  foco vai para esse campo (`:291`), então a pessoa é levada até um controle vermelho sem
  explicação. É a falha dos dois sinais (§9.4) e do §9.1, no formulário mais importante do
  produto.
- **Impacto:** quem usa leitor de tela ouve "inválido" e nenhum motivo; quem enxerga vê uma
  borda vermelha sem texto. O erro é recuperável — basta escolher — mas o formulário deixa
  de explicar exatamente onde ele mais precisa.
- **Verificado por:** leitura de `card-form.js`, `cascade-select.js:100-114` e
  `components.css:108,551-561`. Não verificado com leitor de tela.
- **Correção:** `cascadeSelect` já mantém uma linha de status própria (`status`, com
  `id="${id}-status"`, e `aria-describedby` apontando para ela). Basta expor um `setError`
  que escreva nela e marque o estado:

  ```js
  // cascade-select.js — acrescentar ao objeto devolvido
  setError(message) {
    select.setAttribute("aria-invalid", "true");
    status.textContent = message;
    wrapper.dataset.error = "true";
  },

  // card-form.js:190-198 — antes
  if (edition.value === "") {
    edition.select.setAttribute("aria-invalid", "true");
    valid = false;
  }

  // depois
  if (edition.value === "") {
    edition.setError("Escolha a edição da carta.");
    valid = false;
  }
  ```

### 5. A CSP entregue é mais estreita que a allowlist de URL do cliente: imagem `http://` nunca aparece

- **Local:** `docker/app/apache.conf` (definição `CSP_COMUM`) × `frontend/src/shared/dom/safe-url.js:18`
- **Evidência:**

  ```apache
  Define CSP_COMUM "img-src 'self' https: blob:; style-src 'self'; ..."
  ```

  ```js
  // safe-url.js:18
  const ALLOWED_PROTOCOLS = ["http:", "https:"];
  ```

  E o contrato, `docs/api-contract.md` §5, linha 372 da tabela de validação:
  `| 6 | Imagem: ... remote só com esquema http/https ... |`

- **Problema:** o cliente aceita `http://`, o servidor aceita `http://`, e a CSP **bloqueia**
  `http://` externo (`img-src` só admite `'self'`, `https:` e `blob:`). Uma carta cadastrada
  com endereço `http://` é salva com sucesso e depois nunca renderiza: na listagem cai no
  espaço reservado do RF-34, e no formulário o campo mostra "Não foi possível carregar a
  imagem deste endereço" — mensagem que atribui ao endereço uma falha que é da política.
- **Impacto:** dois. Primeiro, um fluxo suportado pelo contrato que não funciona na
  aplicação entregue. Segundo, e mais direto para a entrega: **todo bloqueio de CSP é
  registrado como erro no console do navegador**, e "nenhum erro no console em nenhum fluxo"
  é critério de aceite de F-051 e o RNF-03.
- **Verificado por:** `curl -D - http://localhost:8080/` (cabeçalho real, transcrito abaixo)
  + leitura de `safe-url.js` e do contrato. O bloqueio em si não foi observado em navegador.

  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-uBe61TLOgUZyopiIimcIToVknvqJ+W5vLpBrThdXkaA='; img-src 'self' https: blob:; style-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
  ```

- **Correção:** alinhar o cliente à política, e não o contrário — afrouxar `img-src` para
  `http:` devolveria conteúdo misto a uma aplicação que hoje não tem nenhum. O ponto exato é
  a allowlist da borda:

  ```js
  // antes — safe-url.js:18
  const ALLOWED_PROTOCOLS = ["http:", "https:"];

  // depois
  // `http:` sai porque a CSP do documento recusa imagem http externa (F-051):
  // aceitá-la aqui só produziria carta cadastrada que nunca aparece.
  const ALLOWED_PROTOCOLS = ["https:"];
  ```

  Isso muda a mensagem do campo de imagem (`card-image-field.js:280`) para "Informe um
  endereço que comece com https://" e exige alinhar a linha 6 da tabela de validação de
  `docs/api-contract.md` §5 e a validação equivalente do backend — **é mudança coordenada,
  não unilateral do frontend.** Enquanto ela não acontece, a alternativa honesta é o campo
  avisar, na dica, que apenas `https://` é exibível.

### 6. A tela de catálogos não distingue "sem permissão" de "deu erro"

- **Local:** `frontend/src/pages/catalogs/catalogs-page.js:103-105` e
  `frontend/src/features/catalogs/components/catalog-panel.js:64-76`
- **Evidência:**

  ```js
  } catch (error) {
    panels.replaceChildren(failure({ message: userMessage(error) }));
  }
  ```

  O padrão correto está a dois arquivos de distância (`cards-page.js:234-237`):

  ```js
  if (error instanceof ApiError && error.isForbidden) {
    renderInto(() => forbidden("Você não tem permissão para ver o catálogo."));
    return;
  }
  ```

- **Problema:** o quinto estado existe na rota (`app-shell.js:114-127` desenha
  `forbidden()` quando `hasLevel("ADMIN")` é falso), mas não existe no caminho em que a
  recusa vem do **servidor** — sessão válida cujo nível mudou desde o login. Aí o 403 cai no
  estado de erro genérico: ícone de alerta, cor de perigo e `role="alert"`, para uma
  situação que ADR-007 define como "não é falha do usuário e não desloga ninguém".
- **Impacto:** o texto exibido continua correto (vem do mapa por status, "Você não tem
  permissão para esta operação"), então não há vazamento técnico. O que se perde é o tom: a
  tela acusa uma falha onde houve uma recusa. §7.4 pede os cinco estados por tela, e aqui
  quatro estão desenhados e o quinto está conflado com o de erro.
- **Verificado por:** leitura das quatro telas, comparando o tratamento de `isForbidden` em
  cada uma (`cards-page.js:234`, `card-form-page.js:101`, `card-history.js:161` têm; as duas
  de catálogos não têm).
- **Correção:** repetir em `catalogs-page.js` e em `catalog-panel.js` o ramo que as outras
  três telas já têm:

  ```js
  // depois
  } catch (error) {
    if (error instanceof ApiError && error.isForbidden) {
      panels.replaceChildren(forbidden("Você não tem permissão para administrar catálogos."));
      return;
    }

    panels.replaceChildren(failure({ message: userMessage(error) }));
  }
  ```

---

## BAIXO

### 7. `.image-field` é declarado duas vezes, e as duas media queries dizem a mesma coisa

- **Local:** `frontend/src/styles/components.css:677-687` e `:725-763`
- **Evidência:** o bloco de `:682-687` (`@media (min-width: 36rem) { .image-field {
  grid-template-columns: 1fr auto; align-items: start; } }`) é reescrito em `:752-763`, que
  acrescenta `gap` e a regra do `legend`. O primeiro par é redundante por inteiro.
- **Problema:** regra duplicada em arquivo sem build é a que sobrevive a uma edição e
  contradiz a outra seis meses depois.
- **Verificado por:** leitura integral de `components.css`.
- **Correção:** apagar `:677-687` e manter só a declaração de `:725-763`, que é a completa.

### 8. Dois valores visuais crus fora de `tokens.css`

- **Local:** `frontend/src/styles/components.css:293` e `:154`
- **Evidência:**

  ```css
  .modal-backdrop { ... background-color: rgb(0 0 0 / 0.5); }
  .spinner { ... animation: spin 800ms linear infinite; }
  ```

- **Problema:** §10.1 é literal — cor e **duração** só existem como token. `800ms` também
  está fora da escala fechada de movimento (`--duration-fast/base/slow`, 120/200/320ms),
  que o §10.3 fecha de propósito.
- **Verificado por:** leitura de `tokens.css` inteiro e varredura de valores literais em
  `components.css`.
- **Correção:** criar `--color-scrim: rgb(0 0 0 / 0.5)` (nos dois temas — o tema escuro
  provavelmente quer um véu mais denso, como já acontece com `--shadow-overlay`) e
  `--duration-spin: 800ms`, e consumi-los por nome.

### 9. `subscribeToSession` não tem consumidor em produção

- **Local:** `frontend/src/shared/session/session.js:27`
- **Evidência:** `export const subscribeToSession = store.subscribe;` — as únicas chamadas
  em todo o repositório estão em `frontend/tests/suites/session.test.js:103,117`.
- **Problema:** o shell redesenha o cabeçalho a cada navegação (`app-shell.js:136-142`) em
  vez de assinar a sessão, o que é uma decisão defensável — mas deixa a assinatura como API
  pública sem uso. Código sem chamador é código sem prova de que continua certo.
- **Verificado por:** grep por `subscribeToSession` e `.subscribe(` em `frontend/src/` e
  `frontend/tests/`.
- **Correção:** ou remover o export (e o teste que só existe para ele), ou usá-lo onde ele
  faria diferença. **Não** é para decidir agora, às vésperas da entrega: fica anotado.

### 10. A busca acumula uma limpeza por tecla digitada

- **Local:** `frontend/src/pages/cards/cards-filters.js:96-101`
- **Evidência:**

  ```js
  let debounce = null;

  scope.on(search, "input", () => {
    window.clearTimeout(debounce);
    debounce = scope.timeout(emit, SEARCH_DEBOUNCE_MS);
  });
  ```

- **Problema:** `scope.timeout` registra um teardown novo a cada chamada
  (`events.js:61-65`), e o `clearTimeout` manual não o remove da lista. O array de limpezas
  do escopo da tela cresce um item por caractere digitado. Nada vaza para além da tela — o
  `dispose` roda todos —, mas é crescimento sem teto dentro da vida da listagem.
- **Verificado por:** leitura de `scope()` em `events.js:34-110` e do uso em
  `cards-filters.js`.
- **Correção:** usar `window.setTimeout` direto e registrar **uma** limpeza no escopo:

  ```js
  let debounce = null;
  scope.add(() => window.clearTimeout(debounce));

  scope.on(search, "input", () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(emit, SEARCH_DEBOUNCE_MS);
  });
  ```

### 11. Cada "tentar novamente" registra mais um `abort` no escopo da tela

- **Local:** `frontend/src/features/cards/components/card-history.js:134-135` e
  `frontend/src/pages/cards/card-form-page.js:85-86`
- **Evidência:**

  ```js
  const controller = new AbortController();
  scope.add(() => controller.abort());
  ```

  dentro de `load()`, que é rechamado pelo botão "Tentar novamente" (`card-history.js:173`).
- **Problema:** mesma família do achado 10 — a lista de limpezas cresce a cada tentativa, e
  os controllers antigos ficam referenciados até a tela morrer. Limitado pelo número de
  cliques, portanto pequeno.
- **Verificado por:** leitura.
- **Correção:** guardar o controller em uma variável do componente, abortar o anterior no
  início de `load()` e registrar **uma** limpeza — é exatamente o que `cards-page.js:147-149`
  já faz com `inFlight`.

### 12. Falha ao carregar os jogos deixa o seletor de catálogos mudo

- **Local:** `frontend/src/pages/catalogs/catalogs-page.js:103-105`
- **Evidência:** no `catch`, só `panels` recebe o estado de falha; o `<select>` de jogos
  (`:49`) permanece exatamente como nasceu — **sem nenhuma `option`**.
- **Problema:** a barra de filtros da listagem, no mesmo cenário, escreve "Não foi possível
  carregar" dentro do próprio select (`cards-filters.js:149`). Aqui o controle fica vazio e
  em silêncio, o que parece um jogo inexistente em vez de uma falha de rede.
- **Verificado por:** leitura comparada das duas telas.
- **Correção:** repetir o padrão de `cards-filters.js:149` — uma `option` de texto explícito
  e `game.disabled = true`.

### 13. A página de testes é servida sem três dos cabeçalhos de segurança da aplicação

- **Local:** `docker/app/apache.conf`, bloco `<Directory /var/www/frontend/tests>`
- **Evidência:** `curl -D - http://localhost:8080/tests/` devolve `Content-Security-Policy`
  (a variante `CSP_TESTES`), mas **não** devolve `X-Content-Type-Options`,
  `X-Frame-Options` nem `Referrer-Policy`, que o bloco de `frontend/public` define.
- **Problema:** o próprio comentário do arquivo diz que a página de testes "roda sob CSP
  igual à da aplicação — se ela precisasse de uma folga que a aplicação não tem, a suíte
  estaria exercitando um ambiente que não existe". O raciocínio vale para os outros três
  cabeçalhos, que ficaram de fora. O risco prático é baixo (`frame-ancestors 'none'` já
  cobre o clickjacking, e a página não recebe entrada), mas a divergência entre os dois
  ambientes é o que o comentário pretendia evitar.
- **Verificado por:** comparação dos cabeçalhos reais das duas respostas.
- **Correção:** mover os três `Header always set` para uma definição comum e aplicá-la nos
  dois blocos `<Directory>`.

---

## Convenções

### 14. Três identificadores em português

- **Local:** `frontend/src/features/cards/components/card-form.js:252` e `:255`;
  `frontend/src/features/cards/components/delete-card-dialog.js:93`
- **Evidência:**

  ```js
  const onde = duplicate.editionName === null ? "nesta edição" : `em ${duplicate.editionName}`;
  const confirmar = button({ label: "Cadastrar mesmo assim", ... });
  const onde = card.edition?.name;
  ```

- **Regra:** `ENGENHARIA.md` §6 e `PADROES-ENGENHARIA.md` §3.1 — identificador em **inglês**;
  português fica para comentário, nome de teste e texto de tela. O resto do repositório
  obedece: a varredura por identificadores em português voltou só estas três linhas.
- **Correção:** `onde` → `where` ou, melhor, `editionLabel`; `confirmar` → `confirmButton`.

**O que foi conferido e está conforme:** nome de arquivo e classe CSS em `kebab-case` (a
varredura por arquivo fora do padrão voltou vazia); atributo de dado em `data-kebab-case`
(`data-card-id`, `data-action`, `data-theme`, `dataset.resolvedTheme`); constantes de
`shared/config/` em `UPPER_SNAKE_CASE` (grep por `export const` minúsculo voltou vazio);
nenhum evento customizado no projeto, então `dominio:acao` não se aplica; branch
`development`, com hífen e dentro do padrão do ADR-010.

---

## Conferência final (as dez perguntas)

| # | Pergunta | Resposta | Evidência |
|---|---|---|---|
| 1 | Dado externo virando HTML? `innerHTML`, `insertAdjacentHTML`, `eval`? | **Não** | `grep -rn "innerHTML\|insertAdjacentHTML\|outerHTML\|document.write\|eval(\|new Function("` em `frontend/src/` devolve **três linhas, todas comentário** (`elements.js:5,42,118`). `el()` escreve por `textContent` (`elements.js:45`), recusa `srcdoc`/`formaction`/`style` (`:25,83`) e **lança** em qualquer atributo `on*` (`:77-81`). URL passa por allowlist de esquema em `safe-url.js:18`. |
| 2 | Chamada de rede fora do cliente único, ou URL de API literal? | **Não** | `grep "fetch(\|XMLHttpRequest\|navigator.sendBeacon"` fora de `shared/api/client.js`: vazio. `grep "'/api/\|\"/api/"` fora de `shared/api/endpoints.js`: vazio. As rotas do contrato estão nomeadas em `endpoints.js:31-58`, com `encodeURIComponent` em todo segmento dinâmico (`:29`). |
| 3 | Decisão de permissão no cliente que não seja mostrar/esconder? | **Não** | `app-shell.js:114-127` desenha `forbidden()` para explicar a recusa, com o comentário registrando que não é barreira; `cards-page.js:73-84` só decide quais botões existem. Nenhuma checagem de nível imediatamente antes de uma escrita (TOCTOU): `handleSubmit` de `card-form.js:281` e o `onClick` de `delete-card-dialog.js:47` vão direto ao servidor. |
| 4 | Algum `role === "…"` ou nível numérico comparado fora de `hasLevel()`? | **Não** | Os acertos de `grep -rn "hasLevel\|role ===\|\.level"` são: a comparação única em `session.js:93`, a leitura de contrato em `auth-api.js:47-48,57`, o rótulo por mapa em `account-page.js:49` — e **três comentários** que citam `user.role === "ADMIN"` para proibi-lo (`app-header.js:5`, `constants.js:6`, `session.js:72`). Os níveis moram em `constants.js:35-39` e a ordem deles é validada no boot (`env.js:105-116`). |
| 5 | Listener, timer ou requisição sem cancelamento? | **Sim — ALTO 1**, mais BAIXO 10 e 11 | Cinco leituras sem `signal` (`catalogs-page.js:93`, `cards-filters.js:127`, `card-form.js:348`, `catalog-panel.js:51`, `catalogs-api.js:96`); em `catalogs-page.js` um escopo chega a nascer **depois** do `dispose`. Do lado certo: `router.js:99` limpa antes de montar, `client.js:213-216` remove o listener de `abort` no `finally`, `notifications.js:98` prende o prazo do aviso ao escopo dele, e `card-image-field.js:52-59` revoga a URL de objeto. |
| 6 | Alguma tela sem os cinco estados? | **Parcial — MÉDIO 6** | `/` tem os cinco (`cards-page.js:201,219-226,234,239`); `/cartas/:id` tem quatro e não tem vazio, que não se aplica a formulário (`card-form-page.js:83,101,106`); `/catalogos` tem quatro e confunde 403 com erro; `/conta` lê da memória e não faz leitura remota; o login **documenta por escrito** por que vazio e sem-permissão não se aplicam (`login-form.js:4-9`); 404 desenha `empty({ as: "h1" })` (`app-shell.js:143-155`). |
| 7 | Valor visual fora de `tokens.css`, ou token que só existe em um tema? | **Token: não. Valor cru: sim — BAIXO 8** | Diff nome a nome dos três blocos de `tokens.css` (`:14-125` claro, `:138-174` media query, `:176-202` `[data-theme="dark"]`): as listas de `--color-*` são **idênticas**, e `--shadow-overlay` aparece nos três. Fora dos tokens sobraram dois valores: `rgb(0 0 0 / 0.5)` (`components.css:293`) e `800ms` (`:154`). Contraste medido par a par em `docs/design.md` §3: 44 pares, pior par 4,71:1, acima do piso de 4,5:1 (RNF-05) — **lido, não remedido nesta auditoria**. |
| 8 | Leitura remota sem política de validade declarada? | **Não** | Toda leitura cacheada declara `ttlMs`: `cards-api.js:200,227` e `catalogs-api.js:48,58,68`, com os valores e o porquê de cada um em `constants.js:111-126`. `cache.fetchOnce` **lança** quando a política falta (`cache.js:66-70`), então a regra é executável, não documental. A listagem de administração não passa pelo cache, e o motivo está escrito (`catalogs-api.js:90-93`). |
| 9 | Mensagem técnica alcançável pelo usuário? | **Não** | `userMessage()` é o único caminho para a tela e só devolve mensagem de `ApiError` — qualquer outra coisa vira a reserva genérica, com o detalhe no console (`errors.js:114-121`). O `message` do servidor tem precedência porque é seguro por contrato (`client.js:227-235`, `api-contract.md` §1.3). Corpo malformado vira `MALFORMED_MESSAGE` (`client.js:206-208`); `204` devolve `null` sem estourar `JSON.parse` (`:123-132`); data inválida vira o texto cru em vez de "Invalid Date" (`card-history.js:51`). |
| 10 | Segredo, token ou dado pessoal em `localStorage`, URL ou log? | **Não** | O token CSRF é uma variável de módulo (`csrf.js:15`) e some no logout (`:32-34`). O armazenamento guarda duas chaves, ambas de preferência de interface (`constants.js:148-151`), lidas e escritas sob allowlist e try/catch (`preference.js:22-49`). Nenhum `console.log`/`console.debug` em `frontend/src/` (grep vazio); os `console.error`/`warn` restantes registram objeto de erro ou dado fora de contrato, nunca credencial. A query string carrega só busca, filtros, página e ordem (`card-query.js:48-78`). |

### Verificações extras desta auditoria de fechamento

**F-051 — CSP.** Conferida na resposta real, não só no arquivo. `/` e `/tests` respondem com
política sem `unsafe-inline` e sem `unsafe-eval`. Os dois hashes do cabeçalho foram
**recalculados a partir dos arquivos servidos** e batem exatamente:

| Documento | Hash no `apache.conf` | Hash calculado do arquivo |
|---|---|---|
| `frontend/public/index.html` | `sha256-uBe61TLOgUZyopiIimcIToVknvqJ+W5vLpBrThdXkaA=` | idêntico (64 bytes, sem CR) |
| `frontend/tests/index.html` | `sha256-1ZXl6zUZKdHuAFAQSI6ao8S/QDCbF4P46LbHBo8Fg/k=` | idêntico (89 bytes, sem CR) |

O `.gitattributes` força `*.html text eol=lf`, que é o que impede o hash de quebrar em um
clone no Windows — a armadilha silenciosa desse desenho, e ela está fechada.

O que a CSP implica para o código do frontend foi varrido item a item: nenhum `<style>` e
nenhum atributo `style` (o `el()` recusa por construção, `elements.js:25`); os dois únicos
usos de `.style` são `document.body.style.setProperty/removeProperty` no modal
(`modal.js:76,143`), e CSSOM não passa pela CSP; nenhum manipulador inline (o `el()` lança);
nenhum `eval` nem `new Function`; toda requisição é de mesma origem (`connect-src 'self'`);
`blob:` está liberado porque a pré-visualização usa `URL.createObjectURL`
(`card-image-field.js:213`). **A única implicação não fechada é o achado MÉDIO 5**
(`img-src` sem `http:`).

**F-050 — acessibilidade.** `h1` presente e único em toda tela, sem salto de nível: `/`
(`cards-page.js:117` + `h2` dos cartões em `card-tile.js:79`), `/cartas/*`
(`card-form-page.js:41`), `/catalogos` (`catalogs-page.js:112` + `h2` dos painéis),
`/conta` (`account-page.js:32` + dois `h2`), login (`login-form.js:51`), e os estados que
**são** a tela recebem `as: "h1"` (`app-shell.js:121,150`). O roteador deixa passar âncora
da própria página (`router.js:184-190`) e o alvo do "Pular para o conteúdo" existe com
`tabindex="-1"` (`app-shell.js:48,204`). Foco nunca removido, só substituído
(`base.css:141-145`). Modal com foco que entra, fica preso, sai no `Esc` e volta para quem
abriu (`modal.js:97-133,81-83`). Alvo de 44px na base de toque (`base.css:149-157`,
`--target-min`). Grades com `minmax(min(11rem, 100%), 1fr)` e
`minmax(min(12rem, 100%), 1fr)` (`components.css:417,522`) — o padrão certo, com o mínimo
protegido pelo `min()`. Nenhuma largura fixa em pixel no CSS (a varredura devolveu só o
`width: 1px` do `.sr-only`). **Nada disso foi visto em tela**: as duas coisas que a leitura
não fecha — rolagem horizontal em 360px e reflow a 200% — continuam pendentes de inspeção, e
o achado ALTO 2 mostra que a leitura pega o que a suíte não pegaria.

**RNF-01 — zero dependências.** `grep -rniE "react|vue|jquery|bootstrap|tailwind|node_modules"`
em `frontend/src/` e `frontend/public/`: vazio. Nenhum `import` de URL externa, nenhuma fonte
remota, nenhum CSS de CDN.

**Fronteiras (ADR-002).** `check-boundaries.php` responde
`Fronteiras de camada respeitadas (186 arquivos)`. `shared/` não importa de `features/` nem
de `pages/` (grep vazio). Nenhuma feature importa outra: os três acertos aparentes
(`card-form.js:26`, `card-gallery.js:10`, `card-image-field.js:24`) são imports **dentro**
de `features/cards/`. O encontro entre cartas e catálogos acontece onde deve — na página
(`card-form-page.js:1-24`), com os carregadores injetados.

**Item de entrega ainda em aberto (não é achado de código):** `docs/audits/open-findings.md`
continua com a linha `OF-001 | _(nenhum achado ainda — projeto em fase de fundação)_`, que
o critério de aceite de F-051 manda substituir. Esta auditoria **não** editou o ledger — a
consolidação das três auditorias de hoje é serial e feita por quem as coordenou; os achados
ALTO 1 e ALTO 2 são as duas linhas que ela precisa receber.

---

## Recomendações

1. **Antes da entrega, nesta ordem:** abrir `http://localhost:8080/tests` e confirmar o
   placar — é a única verificação de aceite de F-051 que ninguém fez ainda —, e percorrer o
   roteiro do README sem mouse. O achado ALTO 2 foi encontrado por leitura; um percurso de
   teclado o teria encontrado em trinta segundos, e é o que dá confiança sobre o que a
   leitura não alcança.
2. **Corrigir os dois ALTO.** O ALTO 2 é o mais visível para quem avalia (é o critério de
   aceite literal de F-050) e o mais barato: um link no nome da carta. O ALTO 1 é maior em
   número de arquivos, mas é sempre o mesmo par de linhas — `life.controller()` e uma guarda
   depois do `await`.
3. **Decidir o MÉDIO 5 com o backend junto.** Estreitar a allowlist para `https:` toca
   `safe-url.js`, o contrato e a validação do servidor. É a correção certa, mas não é
   unilateral do frontend, e às vésperas da entrega a alternativa aceitável é documentar a
   limitação no README.
4. **Não mexer no bloco `<script type="importmap">` de nenhum dos dois HTML** sem recalcular
   o hash da CSP. Um espaço a mais e a aplicação para de carregar. O `apache.conf` já avisa
   — vale repetir aqui, porque quem corrigir os achados vai passar perto.
5. **Depois da entrega**, revisitar os BAIXO 9 e 10: são os dois que revelam padrão, não
   descuido. O primeiro pergunta se o store observável de sessão precisa existir; o segundo
   sugere que `scope.timeout` merece uma variante que substitua o timer anterior em vez de
   empilhar, já que é assim que os dois usos reais do projeto o consomem.

HIGH_ONLY
