# Backlog do Frontend — Oráculo

**Janela planejada:** 07/09 a 10/09 · **Realizado:** 07 a 09/09, e o refinamento de 10 a 14/09 · **Estimativa total:** 47 pontos
**Referências obrigatórias:** `docs/ENGENHARIA.md` · `docs/api-contract.md` · `docs/PRD.md` ·
`docs/decisions/` · `frontend/PADROES-ENGENHARIA.md`

> Continuação de `docs/backlog-backend.md`. A numeração de épicos segue a mesma sequência do
> projeto: o backend fechou no Épico 4, o frontend abre no Épico 5. As tarefas usam o prefixo
> `F-` para que um commit nunca fique ambíguo entre as duas metades.

---

## Estado em 14/09/2026

**Todas as tarefas foram entregues, e nenhuma foi cortada.** As datas dos épicos são as reais,
tiradas do histórico do Git. As caixas de aceite foram marcadas na revisão de 14/09, com esta
base:

- a suíte do frontend verde (353 testes), também com movimento reduzido;
- a auditoria completa de 09/09 e a auditoria do que mudou, de 14/09, sem achado crítico;
- a verificação em tela de 09/09, e a de cada entrega seguinte.

Onde a execução mudou o que o critério pedia, a linha leva **Mudou:** e o que foi entregue no
lugar. O Épico 11 foi registrado depois de implementado, e está marcado como **retroativo**.

---

## Como usar este backlog

Cada tarefa é **autocontida**: quem implementa não precisa perguntar nada para começar.
Contém o objetivo, o que entregar, os critérios de aceite e como se verifica.

**Regras que valem para todas as tarefas, sem repetição:**

1. **Nenhuma dependência de terceiros** (ADR-001). Nem framework, nem biblioteca, nem CDN,
   nem fonte remota, nem Node no fluxo de trabalho (ADR-002). HTML5, CSS3 e JavaScript
   vanilla com módulos ES nativos — é o que o enunciado exige e o que o avaliador verifica
   primeiro.
2. **Dado externo nunca vira HTML.** `textContent` e `document.createElement`; `innerHTML`
   só com literal do próprio código (`PADROES-ENGENHARIA.md` §8.3).
3. **Toda função de montagem devolve uma função de limpeza**, e quem monta guarda. Listener,
   timer, observador e requisição pendente são cancelados quando a tela morre (§12.4).
4. **Nenhuma chamada de rede fora do cliente único** e nenhuma URL de API literal fora do
   mapa de endpoints (§5.1, §4.3).
5. **Nenhum valor visual fora de `tokens.css`.** Todo token de cor existe nos dois temas ou
   não existe (§10.1).
6. **Toda tela desenha os cinco estados:** carregando · vazio · erro · sucesso · sem
   permissão (§7.4). Componente que só desenha o caminho feliz está incompleto.
7. **Permissão no cliente só mostra ou esconde.** A decisão é sempre do servidor (§8.1).
   Nada de checar nível logo antes de chamar a mutação — é TOCTOU e não protege nada.
8. **O token CSRF vive em memória.** Nunca em `localStorage`, nunca em cookie lido por JS.
   Ao recarregar, é rebuscado por `GET /api/auth/session` (`api-contract.md` §3.1).
9. Identificadores, arquivos e pastas em inglês; texto de usuário, mensagens de erro,
   comentários e nomes de teste em **português** (§3.1).
10. **Testes onde o ADR-004 manda.** A lógica pura (validação, formatação, montagem de
    requisição, guardas de corrida) entra no runner de F-004. Renderização de DOM fica fora,
    verificada pelo roteiro manual — decisão registrada, não omissão.
11. `php bin/validate.php` verde antes de considerar a tarefa concluída. Ele já varre
    `frontend/src/**/*.js` para fronteiras de camada — hoje pula porque o diretório não
    existe.

**Escala de pontos** (`PADROES-ENGENHARIA.md` §14.3): 1 = meio dia · 2 = 1 dia ·
3 = 1–2 dias · 5 = 3 dias. Nenhuma tarefa aqui passa de 3.

**A regra de corte** (PRD §10): se o dia 08 chegar ao fim sem a cascata de F-030 impecável,
corta-se qualquer outra coisa. As duas primeiras a cair estão marcadas com ✂ na própria
tarefa. **Não precisou ser usada:** as duas entraram.

---

# Épico 5 — Fundação do frontend · 13 pontos · 07/09

> Nenhuma tela neste épico, pelo mesmo motivo do Épico 0: retrofitar tokens, cliente HTTP e
> limpeza de listener depois de cinco telas prontas custa mais do que construí-los agora
> (ADR-002). O Anexo E do `PADROES-ENGENHARIA.md` chama isso de Fase 1 e Fase 2.

---

### F-001 · Estrutura de camadas, importmap e config validada · 2 pontos
**Depende de:** —

**Objetivo:** a fundação que o `bin/check-boundaries.php` já espera encontrar.

**Entregar:** `frontend/src/{shared,features,pages,styles}/`; `index.html` com
`<script type="importmap">` mapeando `@/` para `/src/` e um único `<script type="module">`
apontando para `main.js`; `shared/config/` com ponto único de configuração — `API_ENDPOINTS`,
`DEFAULT_PAGE_SIZE`, `REQUEST_TIMEOUT_MS`, `PERMISSION_LEVELS` — validado no boot com erro
que nomeia a chave ausente.

**Aceite:**
- [x] `php bin/validate.php` passa a varrer `frontend/src` e reporta a contagem de arquivos.
- [x] Todo import usa o prefixo `@/`; `grep -rn "\.\./\.\./" frontend/src` volta vazio.
- [x] Nenhuma URL de API escrita fora de `API_ENDPOINTS`.
- [x] O único `<script>` inline é o mapa de importação: o §2.7 o prescreve, ele não carrega
      comportamento e não existe versão externa suportada pelos navegadores. Entra na CSP de
      F-051 por hash. Nenhum outro script inline, nenhum `style=` inline.
- [x] `shared/` não importa de `features/` nem de `pages/`; nenhuma `feature` importa de outra.
- [x] Nenhum segredo no cliente. O que está no config é público de verdade (§8.2).

**Verificação:** `bin/validate.php` verde; a página carrega em `http://localhost:8080` sem
uma linha no console.

---

### F-002 · Tokens de design e os dois temas · 3 pontos
**Depende de:** F-001

**Objetivo:** o sistema visual **antes** do primeiro componente. Medir contraste depois de
pronto é descobrir a reprovação depois de pronto — é o risco nomeado no PRD §11.

**Entregar:** `styles/tokens.css` (cor por papel semântico, escala tipográfica fechada,
espaço, raio, sombra, duração e curva), `styles/base.css` (reset + elementos),
`styles/utilities.css`; tema por `[data-theme]` com a preferência do sistema como padrão e a
escolha do usuário lembrada; bloco `prefers-reduced-motion`; `docs/design.md` com a tabela de
contraste **medida**, par a par, nos dois temas.

**Aceite:**
- [x] Todo texto atinge 4,5:1 nos dois temas, medido e registrado em `docs/design.md` (RNF-05).
- [x] Todo token de cor existe nos dois temas.
- [x] Nenhum valor visual cru fora de `tokens.css`; nenhum tamanho intermediário inventado
      fora da escala (§10.3).
- [x] A cor de acento marca **uma** ação primária por contexto e não passa de ~10% da tela.
- [x] Toda superfície de ação declara sua tinta; nenhum branco fixo sobre superfície que
      clareia no tema escuro (§10.2).
- [x] `prefers-reduced-motion: reduce` zera a duração de animação **sem** matar transição de
      cor, opacidade e sombra (§11.3); `animation-duration: 1ms`, nunca `0`.
- [x] Nenhuma animação acima de 400ms, exceto indicador de progresso.
- [x] Nenhuma regra de layout depende de largura fixa em pixel; a página não rola na
      horizontal em 360px (RNF-04).

**Verificação:** tabela de contraste em `docs/design.md`; alternância de tema sem recarregar;
inspeção em 360, 768 e 1440px.

---

### F-003 · Utilitários de DOM seguros por construção · 1 ponto
**Depende de:** F-001

**Objetivo:** tornar o XSS difícil **por construção**, não por disciplina. Quem monta o DOM à
mão perde essa proteção de graça, e uma revisão que depende de lembrar não é proteção
(§8.3, Anexo C).

**Entregar:** `shared/dom/` com `el()`, `isSafeUrl()` e `on()` na assinatura do Anexo C, mais
`mount()`, que compõe montagem e devolve a função de limpeza acumulada.

**Aceite:**
- [x] `el()` nunca aceita HTML: texto vai por `textContent`.
- [x] `el()` lança ao receber atributo de evento (`onclick`) e obriga o uso de `on()`.
- [x] `href` e `src` passam por `isSafeUrl`; `javascript:`, `data:`, `vbscript:` e `file:`
      são descartados sem quebrar a renderização.
- [x] `on()` devolve a função que remove o listener; `mount()` acumula e devolve todas.
- [x] `grep -rn "innerHTML\|insertAdjacentHTML\|eval(\|new Function" frontend/src` só retorna
      literais do próprio código, e cada ocorrência é justificada em comentário.
- [x] Link com `target="_blank"` sempre com `rel="noopener noreferrer"`.

**Testes:** em F-004 — `isSafeUrl` aceita `http`/`https`, recusa `javascript:`, `data:`,
`vbscript:` e string malformada; `el()` com texto contendo `<img onerror>` produz nó de texto,
não elemento.

---

### F-004 · Runner de testes autoral no navegador · 1 ponto
**Depende de:** F-001

**Objetivo:** dar ao frontend a mesma evidência que o backend tem, sem introduzir Node — que
seria dependência de fluxo de trabalho num projeto que se apresenta como zero dependência
(ADR-001, ADR-002).

**Entregar:** `frontend/tests/index.html` e um runner de ~40 linhas em JS puro, **sem
framework e sem biblioteca**, que importa os módulos reais por `@/`, executa as suítes e
imprime nome, esperado e recebido de cada falha; `assertSame`, `assertTrue`, `assertThrows` e
`assertRejects`, espelhando os nomes de `backend/bin/test.php`. Suítes espelham `src/`.

**Aceite:**
- [x] Abrir `http://localhost:8080/tests/` roda tudo e mostra o placar; nenhum passo de build.
- [x] Teste que falha aparece com nome em português, valor esperado e valor recebido.
- [x] Exceção dentro de um teste vira falha, não derruba o runner.
- [x] Um teste não interfere no outro; nenhum depende de ordem ou de tempo real.
- [x] O runner não é servido como parte da aplicação — `tests/` fica fora de `src/`.
- [x] Zero import de fora do projeto.

**Verificação:** o placar verde é item do roteiro manual do README (F-051).

---

### F-005 · Cliente HTTP único, CSRF e mapa de mensagens · 3 pontos
**Depende de:** F-001, F-004

**Objetivo:** o ponto único por onde toda a rede passa. É o que permite acrescentar
cancelamento, telemetria ou tratamento de sessão depois sem varrer o projeto (§5.1).

**Entregar:** `shared/api/client.js` com `request()` — montagem de URL a partir de endpoint
nomeado + parâmetros, `credentials: "same-origin"`, `X-CSRF-Token` em toda escrita, timeout
por `AbortController`, `signal` externo aceito, desserialização protegida e tradução de falha
de transporte em `ApiError` tipada com `status`; `shared/api/messages.js`, o mapa único de
mensagens por status; `shared/api/csrf.js`, guardando o token **em memória**.

**Aceite:**
- [x] Toda escrita (`POST`, `PUT`, `DELETE`) envia `X-CSRF-Token`; o login não envia.
- [x] O token CSRF não aparece em `localStorage`, `sessionStorage`, cookie lido por JS,
      URL ou log.
- [x] Corpo malformado ou vazio não quebra: `204` devolve `null`, não `JSON.parse` estourado.
- [x] Toda mensagem exibida vem do mapa. `undefined`, `null`, `[object Object]`, stack trace
      e nome de coluna nunca chegam à tela (§7.1).
- [x] O `message` do servidor é exibido quando existe — ele já é seguro por contrato
      (`api-contract.md` §1.3); o mapa é a reserva por status.
- [x] `errors` por campo é preservado para o formulário ancorar a mensagem no input certo.
- [x] Timeout aborta e produz mensagem de rede, não erro cru.
- [x] Requisição pendente é abortável por quem a pediu.

**Testes:** montagem de query string omite parâmetro vazio e escapa acento; `ApiError`
carrega o status; mapa de mensagens cobre 400, 401, 403, 404, 409, 413, 415, 429 e 500 e
nenhuma resposta vaza detalhe técnico; `204` não tenta desserializar.

---

### F-006 · Store observável, sessão em memória e roteador · 3 pontos
**Depende de:** F-005

**Objetivo:** uma fonte de verdade por dado e uma navegação que não recarrega a página — os
dois lugares onde aplicação sem framework costuma criar duas verdades e vazar listener
(§5.5, §6, §12.4).

**Entregar:** `shared/store/` com `{ getState, setState, subscribe }` e `fetchOnce(key,
loader)` que deduplica chamadas em voo devolvendo a mesma `Promise`, com política de validade
declarada por chave; `shared/session/` guardando usuário e token CSRF em memória, com
`hasLevel()` derivado do nível numérico; `shared/router/` sobre a History API, casando com o
fallback de SPA que o Apache já serve.

**Aceite:**
- [x] A chave de cache é composta de primitivos, nunca de objeto recriado (§5.4).
- [x] Duas telas pedindo o mesmo dado geram **uma** requisição.
- [x] Cada leitura declara por quanto tempo serve: sessão até logout ou 401; catálogos longo;
      lista de cartas curto, revalidada ao voltar à tela.
- [x] Invalidação após mutação atinge o escopo mínimo — alterar uma carta não derruba o cache
      de catálogos.
- [x] Trocar de rota executa a limpeza da tela anterior: nenhum listener, timer ou requisição
      sobrevive (RNF-07).
- [x] `subscribe` devolve a função de cancelamento, e o roteador a chama.
- [x] Nenhum dado de servidor é copiado para estado local "para editar"; rascunho de
      formulário é explícito e descartado ao confirmar (§6.1).
- [x] `hasLevel()` é a única forma de comparar nível. Nenhum `role === "ADMIN"` espalhado
      (§4.3 — achado CRÍTICO em auditoria).

**Testes:** `fetchOnce` chamado duas vezes em paralelo dispara um loader só; cache vencido
recarrega; `hasLevel` cobre nível suficiente, insuficiente e hierarquia (ADMIN alcança VIEWER);
navegar de A para B executa a limpeza de A.

---

# Épico 6 — Acesso · 6 pontos · 07/09

---

### F-010 · Tela de login · 2 pontos
**Depende de:** F-002, F-005, F-006

**Objetivo:** RF-01 a RF-03 na tela.

**Entregar:** `pages/login/` compondo `features/auth/`; `POST /api/auth/login`; guarda do
usuário e do token CSRF na sessão em memória; redirecionamento para a listagem.

**Aceite:**
- [x] Credencial inválida e usuário inativo mostram **a mesma** mensagem (RF-02); a tela não
      distingue os casos nem pelo texto nem pelo tempo.
- [x] `429` mostra a mensagem de limite de tentativas, não um erro genérico (RF-03).
- [x] Botão desabilitado e estado de carregando enquanto a requisição corre; nenhum envio
      duplo por clique repetido.
- [x] Senha nunca em log, em URL ou em atributo do DOM.
- [x] `label` associado a cada campo; erro anunciado por `aria-invalid` e `aria-describedby`.
- [x] Enter no formulário submete; foco inicial no campo de e-mail.
- [x] Os cinco estados desenhados.

**Verificação:** roteiro manual com os três perfis do seed.

---

### F-011 · Shell da aplicação e navegação por nível · 2 pontos
**Depende de:** F-010

**Objetivo:** a moldura que toda tela habita, e o único lugar onde permissão decide o que
aparece.

**Entregar:** `shared/components/` com cabeçalho, navegação, botão de tema, indicador de
carregamento, notificação (`aria-live`) e modal genérico; `pages/app-shell/` compondo tudo;
boot por `GET /api/auth/session` decidindo entre login e aplicação.

**Aceite:**
- [x] `401` no boot é caminho normal: leva ao login sem mensagem de erro (`api-contract.md` §3.2).
- [x] O token CSRF é rebuscado no boot — recarregar a página não quebra a próxima escrita.
- [x] Item de menu de `EDITOR` não aparece para `VIEWER`; o de `ADMIN` não aparece para
      `EDITOR`. Esconder é conveniência visual — o servidor recusa de qualquer forma.
- [x] Modal: foco entra ao abrir, fica preso enquanto aberto, `Esc` fecha e o foco volta para
      quem abriu (§9.2).
- [x] O anel de foco nunca é removido; substituir por um anel visível é permitido.
- [x] Alvo de toque de 44px na base mobile.
- [x] Um componente global não contém `if` sobre regra de negócio (§2.3).
- [x] Logout chama `DELETE /api/auth/session` e limpa **tudo**: usuário, token, cache em
      memória e preferências de sessão (§8.4).

**Verificação:** navegação completa por teclado; logout seguido de voltar no navegador não
mostra dado do usuário anterior.

---

### F-012 · Sessão expirada, 403 e troca de senha · 2 pontos
**Depende de:** F-011

**Objetivo:** RF-08 e RF-05 — os dois fluxos que separam "vá para o login" de "você não pode
isto" (ADR-007).

**Entregar:** tratamento central de `401` e `403` no cliente HTTP; tela de troca de senha
(`PUT /api/auth/password`); preservação da intenção do usuário quando possível.

**Aceite:**
- [x] `401` durante o uso leva ao login com aviso claro, preservando para onde o usuário ia
      (RF-08); a limpeza é total, não parcial.
- [x] `403` **não** desloga: mostra "sem permissão" na própria tela (ADR-007).
- [x] Várias requisições em voo que recebem `401` produzem **um** redirecionamento, não N.
- [x] Depois da troca de senha, a aplicação vai ao login — o servidor já revogou todas as
      sessões e expirou o cookie (RF-05).
- [x] Nova senha com menos de 8 caracteres e nova senha igual à atual mostram a mensagem do
      campo certo, vinda de `errors`.
- [x] Senha atual incorreta mostra a mensagem do servidor, sem revelar mais nada.

**Verificação:** derrubar a sessão pelo banco com a tela aberta e agir; trocar a senha em uma
aba e conferir que a outra cai no login.

---

# Épico 7 — Catálogo de cartas · 8 pontos · 07/09

---

### F-020 · Galeria paginada com os cinco estados · 3 pontos
**Depende de:** F-006, F-011

**Objetivo:** RF-10 e a Decisão de UX nº 3 — carta é objeto visual, e quem opera o catálogo
reconhece pela arte antes de ler o nome.

**Entregar:** `features/cards/` com api, componentes e tipos; `pages/cards/`; cartão de carta
mostrando imagem, nome, jogo, edição e raridade; paginação sobre o envelope
`{data, pagination}`.

**Aceite:**
- [x] A resposta é validada na borda, uma vez; nenhum `if (r && r.data && r.data[0])`
      espalhado pela UI (§5.2).
- [x] `perPage` vem de `DEFAULT_PAGE_SIZE`, nunca de número solto.
- [x] Carta sem imagem mostra espaço reservado legível — nunca ícone de imagem quebrada
      (RF-34). `onerror` cai no mesmo espaço reservado.
- [x] Imagem com `width`/`height` declarados e `loading="lazy"` fora da dobra; a lista não
      desloca ao carregar (§12.2).
- [x] `imageUrl` passa por `isSafeUrl` antes de virar `src`.
- [x] Nome de carta vai por `textContent` — o catálogo é dado editável por usuário.
- [x] Um listener no contêiner, não um por cartão (§12.3).
- [x] Os cinco estados desenhados, o vazio com texto útil, e o erro com ação de tentar de novo.
- [x] Trocar de página cancela a requisição anterior.

**Verificação:** roteiro manual com console aberto; navegar 20 vezes entre telas e conferir
que listeners não acumulam (RNF-07).

---

### F-021 · Busca e filtros encadeados, refletidos na URL · 3 pontos
**Depende de:** F-020

**Objetivo:** RF-11 e RF-12 — buscar por nome em inglês ou português e combinar jogo, edição
e raridade.

**Entregar:** barra de busca com atraso de digitação e cancelamento; filtros de jogo, edição e
raridade que se encadeiam entre si; ordenação pela allowlist `recent | name | game`; estado
espelhado na query string.

**Aceite:**
- [x] `edition` e `rarity` só são enviados junto de `game` — é o que o contrato aceita.
- [x] Trocar o jogo no filtro reseta edição e raridade, como no formulário.
- [x] `sort` só assume valor da allowlist; nada do cliente chega perto de nome de coluna.
- [x] Cada tecla digitada não vira uma requisição: há atraso, e a requisição anterior é
      **cancelada**, não ignorada.
- [x] Filtro alterado volta para a página 1.
- [x] A URL carrega o estado: recarregar mantém busca, filtros, ordenação e página.
- [x] A query string é lida como dado hostil — valor fora da allowlist é descartado, não
      repassado (§8.5).
- [x] Filtro vazio não vira parâmetro na URL.

**Testes:** montagem de parâmetros omite vazios, recusa `sort` fora da allowlist e nunca envia
`edition` sem `game`; leitura da query string descarta valor inválido.

---

### F-022 · Visão tabela e preferência lembrada · 2 pontos ✂ *primeiro a cair — não caiu*
**Depende de:** F-021

**Objetivo:** RF-13 e a segunda metade da Decisão de UX nº 3 — quem trabalha em volume precisa
comparar campos lado a lado.

**Entregar:** visão tabela alternando com a galeria; preferência lembrada no navegador.

**Aceite:**
- [x] A galeria é o padrão na primeira visita.
- [x] A preferência sobrevive ao recarregamento; valor inválido no armazenamento cai no padrão
      sem quebrar (§8.5).
- [x] Nenhum dado pessoal e nenhum dado de carta vão para `localStorage` — só a preferência
      (§8.7).
- [x] A tabela rola no próprio eixo; a página não rola na horizontal (RNF-04).
- [x] `table` com `th` e escopo correto; a tabela é navegável por teclado.
- [x] Alternar a visão não refaz a requisição — é o mesmo dado, outra apresentação.

**Verificação:** inspeção em 360px; alternância com o console aberto.

---

# Épico 8 — Cadastro de cartas · 12 pontos · 07/09

> **É o épico que decide a entrega.** F-030 é o requisito que o desafio detalhou em quatro
> subitens; F-033 é a Decisão de UX nº 2. Se faltar tempo, cai tudo antes destes dois.

---

### F-030 · A cascata Jogo → Edição → Raridade · 3 pontos
**Depende de:** F-006, F-011

**Objetivo:** RF-20 a RF-27, e a Decisão de UX nº 1 — a raridade se comporta exatamente como
a edição, porque raridade é específica de cada TCG e campo livre deixaria cadastrar uma carta
de Magic como *Secret Rare*.

**Entregar:** `features/catalogs/` consumindo `GET /api/games`,
`GET /api/games/{gameId}/editions` e `GET /api/games/{gameId}/rarities`; um componente de
select em cascata, **um só**, usado pelas duas pontas — uma segunda implementação divergiria,
e a raridade passaria a aceitar o que a edição recusa.

**Aceite:**
- [x] Edição e Raridade iniciam **desabilitadas** (RF-20, RF-27).
- [x] Selecionar o jogo dispara as duas requisições (RF-21).
- [x] Durante a requisição o campo mostra **carregando** e permanece desabilitado (RF-22).
- [x] Concluída, o `select` é populado e habilitado (RF-23).
- [x] Trocar o jogo **recarrega** a lista e **reseta** a seleção anterior (RF-24).
- [x] **RF-25 — o requisito invisível:** trocar Magic → Pokémon → Yu-Gi-Oh! em sequência
      rápida nunca deixa a lista errada na tela. Toda requisição em voo é **abortada** quando
      outra começa; resposta atrasada de jogo já trocado é **descartada**, mesmo que chegue.
- [x] Falha mostra estado de erro com "tentar novamente", sem travar o formulário (RF-26).
- [x] Limpar o jogo devolve os dois campos ao estado inicial desabilitado.
- [x] Catálogo com cache longo, mas a troca de jogo nunca serve lista de outro jogo.
- [x] O componente devolve função de limpeza que aborta o que estiver em voo.

**Testes:** a guarda de corrida isolada da UI — dado um token de requisição por seleção, a
resposta cujo token não é o corrente é descartada; abortar não vira erro exibido ao usuário.

**Verificação manual obrigatória, no README:** trocar o jogo cinco vezes em menos de um
segundo, com a aba de rede aberta, e conferir que a lista final é a do último jogo escolhido e
que as requisições anteriores aparecem canceladas.

---

### F-031 · Formulário de carta: criação e edição · 3 pontos
**Depende de:** F-030

**Objetivo:** RF-14, RF-15 e a Decisão de UX nº 5.

**Entregar:** formulário único para criar e editar, consumindo `POST /api/cards` e
`PUT /api/cards/{id}`; ancoragem de `errors` por campo; fluxo de duplicidade.

**Aceite:**
- [x] `nameEn` obrigatório; `namePt` **opcional** — ausente ou nulo é válido (RN-03).
- [x] O corpo é montado campo a campo; `id`, `createdBy` e `createdAt` nunca são enviados.
- [x] `errors` do servidor ancora a mensagem no input certo, com `aria-invalid` e
      `aria-describedby`.
- [x] Validação no cliente é feedback rápido, não barreira — a validação real é a do servidor
      (§8.5).
- [x] **Duplicidade avisa, não bloqueia** (RN-04): `409` mostra a carta existente e oferece
      "cadastrar mesmo assim", que reenvia com `confirmDuplicate: true`.
- [x] Editar carrega os valores atuais e dispara a cascata já com jogo, edição e raridade
      selecionados.
- [x] Envio duplo por clique repetido é impossível.
- [x] Sair com alterações não salvas avisa antes de descartar.
- [x] Após salvar, o cache da listagem é invalidado no escopo mínimo.

**Verificação:** cadastrar duas cartas de mesmo nome na mesma edição e confirmar a segunda;
editar carta trocando o jogo e conferir que edição e raridade resetam.

---

### F-032 · Imagem: upload com pré-visualização e URL alternativa · 3 pontos
**Depende de:** F-031

**Objetivo:** RF-30 a RF-34 e a Decisão de UX nº 4 — pedir uma URL a quem não é técnico é
transferir trabalho de engenharia para o usuário.

**Entregar:** campo de imagem com as duas formas; upload por `POST /api/uploads/card-image`
(`multipart/form-data`, campo `file`) com pré-visualização imediata; campo de URL com
pré-visualização; envio da `reference` devolvida no corpo da carta.

**Aceite:**
- [x] Pré-visualização aparece **antes** de salvar a carta, nas duas formas.
- [x] Tipo e tamanho conferidos no cliente para feedback rápido, e novamente no servidor
      (RF-32). O cliente é conveniência; o servidor é a autoridade.
- [x] SVG recusado com mensagem clara; `415` do servidor tratado.
- [x] `413` mostra o limite em texto legível, não o número cru.
- [x] URL aceita apenas `http` e `https` (RF-33), por `isSafeUrl`.
- [x] O nome do arquivo enviado é tratado como dado hostil ao exibir — vai por `textContent`
      (§8.5).
- [x] A URL de objeto criada para a pré-visualização é revogada ao trocar de arquivo e ao
      desmontar (§12.4).
- [x] Trocar de upload para URL, e vice-versa, limpa a forma anterior — a carta tem uma imagem
      só.
- [x] Sem imagem é válido: a carta salva e a listagem mostra o espaço reservado (RF-34).

**Verificação:** subir um `.jpg` cujo conteúdo é PHP e conferir a recusa; subir acima do
limite; informar `javascript:alert(1)` no campo de URL.

---

### F-033 · Exclusão reversível: confirmação nomeada e desfazer · 2 pontos
**Depende de:** F-031

**Objetivo:** RF-16, RF-17 e a Decisão de UX nº 2 — a proteção real não é a confirmação, é a
reversibilidade. Erro humano é inevitável; o que se projeta é quanto ele custa.

**Entregar:** modal de confirmação que **escreve o nome da carta e a edição**; `DELETE
/api/cards/{id}`; notificação com **Desfazer** por alguns segundos, chamando
`POST /api/cards/{id}/restore`.

**Aceite:**
- [x] O modal diz *"Excluir **Black Lotus** de Dominaria?"* — nunca "Tem certeza?".
- [x] O nome da carta no modal vai por `textContent`.
- [x] A carta some da listagem imediatamente após a exclusão (RN-05).
- [x] Desfazer restaura e a carta reaparece na mesma posição de leitura.
- [x] O prazo do desfazer vem de constante nomeada, não de número solto.
- [x] Sair da tela cancela o timer do desfazer (§12.4).
- [x] `409` ao restaurar carta que não está excluída é tratado com mensagem, não com erro cru.
- [x] O modal cumpre as regras de foco de F-011.
- [x] O botão de excluir não aparece para `VIEWER` — e o servidor recusa de qualquer forma.

**Verificação:** excluir e desfazer; excluir, sair da tela e voltar; excluir e deixar o prazo
vencer.

---

### F-034 · Histórico de alterações da carta · 1 ponto
**Depende de:** F-031

**Objetivo:** RF-18 — quem, o quê e quando.

**Entregar:** painel de histórico consumindo `GET /api/cards/{id}/history` (`EDITOR`).

**Aceite:**
- [x] Mostra ação, autor, horário e o `changes` já apresentável — o backend não manda id
      interno.
- [x] Data formatada por `Intl`, nunca por biblioteca ou concatenação manual (§8.6).
- [x] Carta sem histórico mostra estado vazio, não erro.
- [x] `VIEWER` não vê o painel; `403` é tratado como "sem permissão" na própria tela.
- [x] Carregado sob demanda, não junto da listagem (§12.2).

**Verificação:** editar uma carta duas vezes e conferir que só os campos alterados aparecem.

---

# Épico 9 — Catálogos pela interface · 3 pontos · 07/09 (o F-041 em 11/09)

---

### F-040 · Administração de jogos, edições e raridades · 3 pontos ✂ *segundo a cair — não caiu*
**Depende de:** F-030

**Objetivo:** RF-40 a RF-43, pela UI. Sem esta tarefa os catálogos continuam administráveis
pela API — é por isso que ela é a segunda a cair, não a primeira.

**Entregar:** `pages/catalogs/` consumindo as **seis** rotas de escrita de
`api-contract.md` §4, todas `ADMIN`.

> **Correção do backlog.** Este item dizia "nove rotas", número herdado de um fragmento
> desatualizado do contrato que listava gestão de jogos. Ela **não existe nesta API**, por
> decisão registrada no próprio §4: criar um jogo sem raridades deixaria o sistema num
> estado pior do que não ter o botão. São seis rotas — três de edição, três de raridade.

**Aceite:**
- [x] A tela inteira só aparece para `ADMIN`; `EDITOR` que chega pela URL vê "sem permissão",
      não uma tela quebrada.
- [x] `code` de edição e raridade é **imutável** na edição — o campo nem é oferecido.
- [x] `409` de código duplicado no mesmo jogo mostra mensagem clara; o mesmo código em
      jogos diferentes é aceito.
- [x] `DELETE` **desativa e nunca falha**: devolve `wasInUse`, e a tela usa isso para dizer
      que as cartas que usam o item continuam como estão (RF-43).
- [x] Reativar é um `PUT` com o registro inteiro — mandar só `active` devolve `400`.
- [x] Item desativado some dos cadastros novos e continua exibido nas cartas que já o usam.
- [x] Alterar um catálogo invalida o cache da cascata — o formulário não pode seguir
      oferecendo uma edição recém-desativada.
- [x] Os cinco estados desenhados.

**Verificação:** com o perfil `EDITOR`, tentar alcançar a rota pela URL; desativar uma edição
em uso e conferir a carta que a usa.

---

### F-041 · Cor da raridade na tela · 3 pontos
**Depende de:** F-040, B-022 · **Plano:** `docs/rarity-colors-plan.md`

**Objetivo:** RF-44 pela UI — e o "editar" de RF-41 e RF-42, que a tela de catálogos nunca
ofereceu.

**Entregar:** os dez pares de token medidos na `/paleta`, o selo de raridade, o seletor de
cor no formulário da raridade e o **Editar** por linha no painel de catálogo.

**Aceite:**
- [x] Os dez materiais existem nos dois temas, e a `/paleta` mede cada tinta sobre o próprio fundo (76 medidas, nenhuma reprova).
- [x] O selo de raridade tem a marca que os selos de estado não têm, e o nome sempre escrito.
- [x] Galeria e tabela mostram o mesmo selo.
- [x] Reativar manda o registro inteiro: a ordem e a cor não se perdem.
- [x] O seletor é um grupo de rádio nativo, e cada opção é o próprio selo, com o nome.
- [x] Cada linha do painel tem Editar: nome e, na raridade, cor; o código aparece e não muda.
- [x] O seletor e a edição entram na rede de geometria.
- [x] Verificado na tela: dois temas, 200%, teclado no grupo de rádio, `EDITOR` pela URL.

**Testes:** a paleta do cliente, o selo, os parsers de carta e de catálogo, a regra da
`/paleta` para fundo de selo, e o cartão com o selo.

---

# Épico 10 — Acabamento e entrega · 5 pontos · 08 e 09/09

---

### F-050 · Responsivo, teclado e acessibilidade · 2 pontos
**Depende de:** Épicos 6 a 9

**Objetivo:** RNF-04 e RNF-06 verificados, não presumidos.

**Entregar:** passagem de acessibilidade em toda tela; ajuste de densidade por breakpoint;
correções de contraste que a medição de F-002 não pegou nos componentes. **Mudou:** o ajuste por
ponto de quebra saiu em 10/09, com o layout em primitivas (F-060).

**Aceite:**
- [x] A aplicação inteira é operável só pelo teclado; a ordem de foco segue a ordem visual.
- [x] Nenhuma rolagem horizontal em 360, 768 e 1440px.
- [x] Zoom de 200% sem perda de conteúdo.
- [x] Hierarquia de cabeçalhos correta; `nav`, `main` e regiões nomeadas.
- [x] Nenhum status depende só de cor — sempre cor **mais** rótulo, ícone ou forma (§9.4).
- [x] Toda imagem informativa com `alt` descritivo; decorativa com `alt=""`.
- [x] Nada abaixo de 12px; alvo de 44px na base mobile.
- [x] Mudança dinâmica importante anunciada por região viva.

**Verificação:** percorrer o roteiro inteiro sem mouse; inspeção nas três larguras.

---

### F-051 · CSP, auditoria final e README de entrega · 3 pontos
**Depende de:** F-050

**Objetivo:** fechar a Definition of Done do PRD §9.

**Entregar:** `Content-Security-Policy` no Apache sem `unsafe-inline` e sem `unsafe-eval`;
auditoria `full` de qualidade e segurança do frontend, com relatório datado em `docs/audits/`
e as linhas `CRITICAL`/`HIGH` refletidas em `open-findings.md`; README de entrega completo.

**Aceite:**
- [x] CSP ativa, sem `unsafe-inline` e sem `unsafe-eval`; nenhuma tela quebra com ela ligada
      (RNF-08).
- [x] Busca por `react|vue|jquery|bootstrap|tailwind|vendor/|node_modules/` no repositório
      volta vazia (RNF-01).
- [x] Nenhum erro no console do navegador em nenhum fluxo (RNF-03).
- [x] `php bin/validate.php` verde; runner de F-004 verde.
- [x] Nenhum achado `CRITICAL` aberto.
- [x] README com: como rodar, credenciais dos três perfis, as cinco decisões de produto
      justificadas, roteiro de teste manual e o que ficou fora com o motivo.
- [x] O roteiro cobre, no mínimo: os três perfis, os cinco estados de cada tela, a cascata com
      troca rápida (RF-25), o desfazer da exclusão e os dois temas (ADR-004).
- [x] `docs/audits/open-findings.md` deixa de dizer "projeto em fase de fundação".

**Verificação:** um avaliador clona, roda `docker compose up`, abre o navegador e loga — sem
nenhum passo manual adicional (RNF-02).

---

# Épico 11 — Refinamento · 10 a 14/09 · retroativo

> Registrado em 14/09, depois de implementado. O escopo planejado fechou com o Épico 10; o que
> segue foi refinamento, com teste antes onde o ADR-004 manda e verificação na tela.

---

### F-052 · Correções da auditoria de entrega (OF-002 a OF-005) · retroativa
**Entregue em:** 09/09 e 12/09.

- **OF-002:** cinco leituras remotas sem cancelamento. Hoje toda leitura recebe o `signal` do
  escopo da tela, e nenhuma sobrevive a ela.
- **OF-003:** a galeria só abria carta com mouse. O cartão ficou focável, e Enter e Espaço abrem.
- **OF-004:** o campo de imagem ficava inutilizável no desktop, pela trilha `auto` da grade.
  Achado na tela pelo autor.
- **OF-005:** "Excluir" rachava ao meio na visão tabela, por `overflow-wrap: anywhere` herdado da
  célula. Achado na tela pelo autor.

**Aceite:**
- [x] Cada correção entrou com o teste que reproduz o defeito (ADR-004).
- [x] As quatro passaram a `verified` no ledger em 14/09.

---

### F-060 · Layout em primitivas, sem media query de largura · retroativa
**Entregue em:** 10/09.

**Objetivo:** cada componente decide pela largura dele, não pela da janela — a lição do OF-004
(`design.md` §9).

**Entregue:** as primitivas `.stack`, `.cluster`, `.sidebar` e `.switcher` em `utilities.css`;
`@container` onde o componente muda os próprios filhos; `overflow-wrap: anywhere` escopado ao
texto de fora; e a rede de geometria (`layout-geometry.test.js`), que mede as telas em larguras
que cercam cada ponto de quebra, também com a fonte da raiz dobrada.

**Aceite:**
- [x] Nenhuma `@media (min-width…)` em `components.css`.
- [x] Toda tela entra na rede afirmando o estado com dado.
- [x] Verificado na tela: 360, 500, 752 e 1424px, e fonte em 200%.

---

### F-061 · A tela `/paleta` · retroativa
**Entregue em:** 10/09.

**Objetivo:** avaliar uma mudança de paleta medindo, não olhando.

**Entregue:** `pages/palette/`, fora do menu: lê o `tokens.css` carregado, mostra os dois temas
lado a lado e mede cada par pela fórmula da WCAG, com os pares de foco a 3:1.

**Aceite:**
- [x] Toda tinta é medida contra as superfícies em que aparece, nos dois temas.
- [x] Os selos de raridade são medidos sobre o próprio fundo.

---

### F-062 · A paleta do molde novo da Liga · retroativa
**Entregue em:** 10/09.

**Entregue:** a paleta lida da LigaPokemon, com a identidade violeta — a ação em violeta, a marca
num lugar só, os estados como pedras e o escuro como noite (`design.md` §2).

**Aceite:**
- [x] Todo texto a 4,5:1 nos dois temas, e a tabela da `design.md` §3 conferida contra o
      `tokens.css` em 14/09.
- [x] Borda de campo e anel de foco a 3:1.

---

### F-070 · Identidade visual · retroativa
**Entregue em:** 12 e 13/09 · **Detalhe:** `docs/visual-identity-checklist.md`.

**Entregue:** sete peças — a marca no cabeçalho e na entrada (P1), o ícone da aba (P2), o verso
da carta no lugar de "sem imagem" (P3), a cena e a virada da tela de entrada (P4), as
ilustrações dos estados vazios (P5), cinco ícones de traço (P6) e a carta no modal de exclusão
(P7).

**Aceite:**
- [x] Todo endereço de imagem é token (`--image-*`), e todo desenho SVG é pintado por token, pela
      máscara.
- [x] As imagens raster da entrada existem nos dois temas.
- [x] A virada acontece só depois da resposta do servidor, e com movimento reduzido sobra o
      esmaecimento.
- [x] As telas novas entraram na rede de geometria.
- [x] Verificado na tela pelo autor: a virada com sessão, o arranjo largo e o ícone nas abas.
- [ ] Alto contraste do Windows — não conferido; ficou fora desta entrega por decisão do autor.

---

## Sequenciamento e paralelismo

```
F-001 ─┬─ F-002 ──────────────────────────────┐
       ├─ F-003 ─┐                            │
       ├─ F-004 ─┴─ F-005 ─ F-006 ─┬─ F-010 ─ F-011 ─┬─ F-012
       │                           │                 ├─ F-020 ─ F-021 ─ F-022 ✂
       │                           └─ F-030 ─┬─ F-031 ─┬─ F-032
       │                                     │         ├─ F-033
       │                                     │         └─ F-034
       └───────────────────────────────────  └─ F-040 ✂
                                     F-050 ─ F-051
```

**O caminho crítico é `F-001 → F-005 → F-006 → F-011 → F-030 → F-031`.** Tudo que importa na
avaliação passa por ele.

**F-030 é a dependência que não pode escorregar.** É o requisito que o desafio detalhou em
quatro subitens e o único cuja falha reprova sozinha. Se o dia 08 começar com ele em risco,
corta-se F-022 e F-040 na hora, não no fim do dia.

---

## Conferência final do frontend

Antes de declarar a entrega pronta, rodar a auditoria contra estas dez perguntas
(`PADROES-ENGENHARIA.md` §17.1 e §19):

**Respondidas em 09/09 e 14/09** pelas auditorias de qualidade e de segurança, sem nenhuma
resposta que reprove.

- [x] Existe algum dado externo virando HTML? `innerHTML`, `insertAdjacentHTML`, `eval`?
- [x] Existe alguma chamada de rede fora do cliente único, ou URL de API literal?
- [x] Existe alguma decisão de permissão tomada no cliente que não seja mostrar/esconder?
- [x] Existe algum `role === "…"` ou nível numérico comparado fora de `hasLevel()`?
- [x] Existe algum listener, timer ou requisição sem cancelamento?
- [x] Existe alguma tela sem os cinco estados?
- [x] Existe algum valor visual fora de `tokens.css`, ou token que só existe em um tema?
- [x] Existe alguma leitura remota sem política de validade declarada?
- [x] Existe alguma mensagem técnica alcançável pelo usuário?
- [x] Existe algum segredo, token ou dado pessoal em `localStorage`, URL ou log?
