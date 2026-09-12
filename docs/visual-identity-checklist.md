# Identidade visual — checklist das imagens

> **Estado (12/09/2026):** **P1, P2, P3, P5, P6 e P7 implementados** na branch
> `feature-identidade-visual`, cada peça em um commit, com teste antes e verificação na tela.
> Falta o **P4**, que espera as quatro imagens do agente, e o alto contraste do Windows, que
> nenhum teste alcança. Registrado em 10/09; logo e login escolhidos em 11/09.
>
> Cada peça abaixo termina com o que a implementação fechou, o que foi conferido na tela e o
> que ficou faltando.
>
> O logo e o login escolhidos estão em `docs/logo-and-login-ideas.md`. Este arquivo é o que
> fazer com eles, peça por peça, e onde mais a interface ganha imagem. As cores vêm da paleta
> que está em `development` desde `ed0785d`: se um token mudar, o raster muda junto; o SVG
> pintado por token, não.

---

## 1. Decisões antes de gerar qualquer imagem

- [x] **Logo e login.** Escolhidos em 11/09: a tiragem segurada na mão, com a gema como
      sigilo, e a mesa com a carta central já tirada (`docs/logo-and-login-ideas.md`).
- [x] **Paleta.** Mergeada em `development` (`ed0785d`), junto com as cores de raridade
      (`568bd98`).
- [x] **D1 — SVG ou raster, peça por peça: decidido em 11/09, peça a peça.** SVG em P1, P2,
      P3, P5 e P6; raster (do agente) só no P4; P7 sem arquivo novo. **Quem produz:** o agente
      de imagem gera só raster, então o SVG geométrico é escrito como código, e o agente fica
      com a mesa e a carta deitada do login, e com estudos de estilo que viram vetor à mão.
      SVG pedido a
      um gerador de imagem, ou vetorizado a partir do pixel, sai com centenas de nós e
      metadado de editor — reprova a §4.
- [x] **D2 — Como o SVG entra na página: rota A, máscara** (11/09). Ver §3.
- [x] **D3 — O verso segue o tema** (11/09). A arte real não muda com o tema, mas o verso
      não é arte: é o estado "sem imagem", e pelos tokens sai nos dois temas sem arquivo a
      mais. Ver P3.
- [x] **D4 — Onde os arquivos moram: `frontend/src/assets/`** (12/09), com uma exceção
      registrada: os três arquivos do P2 vão para `frontend/public/`, porque o navegador os
      pede pelo caminho da raiz. O motivo da pasta principal: ela é servida pelo
      `Alias /src`, que já manda `Cache-Control: no-cache` (`docker/app/apache.conf:92`).
      `frontend/public/` não manda nenhum, e o navegador aplica cache heurístico: troca-se a
      imagem, recarrega-se, e a antiga continua na tela, sem erro nenhum.
- [x] **Branch.** `feature-identidade-visual`, criada em 12/09 a partir de `development`
      (`568bd98`), que já tem a paleta e as cores de raridade.

## 2. SVG ou raster: a regra proposta

**SVG por padrão. Raster quando a imagem vive de textura, luz ou degradê.**

| SVG | Raster (WebP) |
|---|---|
| Desenho plano, até três tons | Textura (papel, relevo, brilho), luz, degradê rico |
| Cor vinda de token: troca de tema e sobrevive a mudança de paleta | Cor gravada no arquivo: uma versão por tema, refeita se a paleta mudar |
| Nítido em qualquer tamanho e densidade de tela, com um arquivo só | Um arquivo por densidade (1×, 2×, às vezes 3×) |
| Símbolo, ícone da aba, ícones, sigilo, verso no espaço reservado, ilustrações de estado | A mesa do login, uma por tema, com as cartas deitadas na própria cena |

**A carta virada fica dividida, e o motivo é o tamanho.**

- **No espaço reservado da galeria, SVG.** A mesma carta vai de 176 a 367px de largura (§5),
  passa de 700px com a fonte do navegador em 200%, e num celular de tela 3× com uma coluna só
  pede até ~1.100px físicos. Em raster seriam três arquivos por tema para cobrir a faixa; em
  SVG, um. Ela também se repete na grade, leva o nome da carta por cima e precisa continuar
  parecendo "falta imagem" ao lado da arte real — desenho plano ajuda nas três coisas.
- **No login, raster é uma boa escolha**, se o verso ali tiver textura: o tamanho é conhecido,
  são poucas cópias, e é o momento em que a riqueza rende. É o mesmo desenho, em acabamento
  mais rico.

**Formato do raster:** WebP. Todo navegador atual lê, é menor que PNG e JPEG e tem
transparência. Entregar em **retângulo sem canto**: quem arredonda é o CSS, com o token de
raio, e a imagem dispensa transparência.

## 3. Como a imagem entra no código

Três restrições, achadas na leitura, decidem a forma de entrada:

- **A CSP** (`docker/app/apache.conf:33`). `img-src 'self' https: blob:` não aceita `data:`,
  então nada de imagem em URI de dado no CSS. `style-src 'self'` não tem `unsafe-inline`: SVG
  embutido na página não pode trazer `<style>` nem atributo `style`.
- **`el()` não cria SVG** (`frontend/src/shared/dom/elements.js:39`). Usa
  `document.createElement`, e SVG precisa de `createElementNS`. O projeto não tem nenhum
  `innerHTML`.
- **O tema tem três estados** (`tokens.css`: `:root`, o bloco
  `@media (prefers-color-scheme: dark)` e `[data-theme="dark"]`). `<picture>` com
  `media="(prefers-color-scheme: dark)"` segue o sistema operacional e **ignora o botão de
  tema** do Oráculo — não serve para imagem por tema.

**D2 — duas rotas para o SVG:**

- **A. Arquivo com máscara — decidida em 11/09.** Com o logo e os ícones numa cor só e o verso
  em três tons, nenhuma peça passa do teto da rota. O SVG vira `mask-image` de um elemento
  pintado com
  `background-color: var(--token)`. Acompanha o tema, inclusive pelo botão, sem uma linha de
  JavaScript e sem tocar o `el()`. Cada tom é uma camada: o fundo do próprio elemento, o
  `::before` e o `::after` dão **até três tons** num elemento só — o mesmo teto que a §2 já
  põe no SVG. Custo: no alto contraste do Windows o fundo é forçado para a cor da tela e o
  desenho some, então precisa de regra em `@media (forced-colors: active)`.
- **B. Auxiliar `svg()` em `shared/dom`**, com `createElementNS` e a mesma allowlist de
  atributos do `el()`, escrito com teste antes, como o `el()` tem. Aceita qualquer número de
  tons, por classe e `currentColor`, e o alto contraste funciona sozinho. Custo: mexe no
  módulo que protege o DOM, e cada desenho vira código (os traçados dentro de um `.js`) — o
  que o agente de imagem entregar precisa ser convertido.

**Raster por tema vai por token no CSS**, nunca por `<picture>`.

**Endereço de imagem é token.** Todo `url()` de imagem vira `--image-*` no `tokens.css` (regra
8 do `docs/ENGENHARIA.md`: nenhum valor visual fora dele). O que muda com o tema é redefinido
nos dois blocos escuros, como as cores. Caminho absoluto a partir da raiz
(`url("/src/assets/…")`), para não depender de contra qual folha um endereço relativo dentro de
variável é resolvido.

## 4. Regras que valem para toda peça

- [ ] **Nenhum texto dentro da imagem.** Nome e frase ficam no HTML. Letra desenhada entra
      como traçado: SVG carregado como imagem não alcança fonte nenhuma, e o texto sairia com
      a fonte errada.
- [ ] **SVG é código, e passa por revisão como código.** Sem `<script>`, `<foreignObject>`,
      referência externa (fonte, imagem, `href` para fora) e metadados de editor. Com
      `viewBox`, sem `width`/`height` fixos. O upload de carta recusa SVG justamente por poder
      conter script (`frontend/src/features/cards/utils/image-signature.js:57`).
- [ ] **Cor pelo papel, não pela aparência.** `--color-brand` só no logotipo
      (`docs/design.md` §4). `--color-accent` é a voz de ação, ~10% da tela, e não entra em
      desenho que se repete. As pedras (perigo, atenção, sucesso, informação) e os materiais
      de raridade também não: cada um já significa algo na tela. O que sobra para arte:
      `--color-bg`, `--color-line`, `--color-accent-soft`, `--color-muted`. Tom novo é token
      novo, medido nos dois temas (`design.md` §8).
- [ ] **Decorativa se cala.** `aria-hidden="true"` ou `alt=""` quando o texto ao lado já diz
      tudo; imagem informativa tem nome acessível.
- [ ] **Espaço reservado antes de carregar**, por `aspect-ratio` ou `width`/`height`: a tela
      não pula quando a imagem chega.
- [ ] **Movimento:** nada acima de 400ms (`design.md` §5), sempre com caminho de movimento
      reduzido.
- [ ] **Peso (proposta, a confirmar na verificação):** ícone ≤ 2 KB, símbolo ≤ 5 KB, verso e
      ilustração em SVG ≤ 15 KB, raster ≤ 80 KB por arquivo em 2×.
- [ ] **Cor gravada tem origem anotada.** O ícone da aba e o raster guardam hex dentro do
      arquivo: anotar de qual token veio cada um, para refazer se a paleta mudar.

## 5. Tamanhos: faixas, não pontos de quebra

Este projeto não tem ponto de quebra por tela, de propósito: cada componente decide pela
largura **dele**, pelas primitivas ou por `@container` (`docs/design.md` §9 — a lição do
OF-004). Então cada peça tem uma **faixa de tamanho**, e o desenho precisa funcionar na faixa
inteira: com a fonte do navegador em 200%, que dobra tudo o que é `rem`, e em telas de
densidade 2× e 3×. Onde a composição tem de mudar (direção de arte), a troca é por
`@container` no componente; `@media (min-width…)` em `components.css` reprova.

| Peça | Quem define o tamanho | Faixa em CSS px | Com fonte em 200% |
|---|---|---|---|
| Símbolo no cabeçalho | `.app-brand`, texto de 18px | ~24–28 de altura | ~48–56 |
| Ícone da aba | aba do navegador | 16 e 32 | — |
| Verso na galeria | `.card-grid`, piso de 11rem | 176–367 de largura (245–511 de altura) | 352–~735 |
| Verso na pré-visualização | `--sidebar-side: 8rem` | 128 | 256 |
| Miniatura no modal | modal de 28rem | ~64 (proposta: 4rem) | ~128 |
| Ilustração de estado | `.state` | até 192 (`min(12rem, 100%)`); a gema da busca, 64 de altura | até 384; a gema, 128 |
| Ícones | 1em do texto ao lado | 14–16 | 28–32 |
| Login | a definir com a composição | cartão do formulário: 384 (24rem) | 768 |

**A virada da galeria fica perto de 400px de janela.** Com 399px, há uma coluna só, e a carta
tem 367px; com 400px, duas colunas de 176px. A faixa inteira acontece num pixel, e é essa a
largura que a verificação precisa cruzar.

## 6. As peças

Cada peça termina no que o agente de imagem precisa entregar.

### P1 — Símbolo e logotipo

**Onde:** cabeçalho (`frontend/src/shared/components/app-header.js:43`) e login, acima do
formulário. **Formato:** SVG, escrito como código — **detalhado e aprovado em 11/09**; não vai
para o agente de imagem. **Tema:** por token, numa cor só — `--color-brand`, pela máscara (rota
A). A carta central preenchida e as laterais em contorno fazem a hierarquia sem segundo tom
(`docs/logo-and-login-ideas.md`, "Logo").

**A geometria**, na grade de 48 unidades (`viewBox="0 0 48 48"`):

| Parte | Valor |
|---|---|
| Carta central | 22 × 30, topo em 8, raio 3 — proporção 0,73, a da carta de TCG |
| Laterais | 86% da central (18,92 × 25,8, raio 2,58), base em 38 antes de girar |
| Leque | ±18° em torno de um pivô só, no eixo e em y = 45 |
| Vão entre laterais e central | 2 — a central recorta as laterais com folga |
| Contorno das laterais | 3 |
| Gema (esmeralda, vista de cima) | octógono de 12 × 18 com chanfro 3,2; mesa de 4 × 8 com chanfro 1,8; oito facetas ligando os cantos; traço 1,4, vazado na carta central |

- [x] **Duas versões, e o limite foi medido.** `symbol.svg`, sem sigilo, abaixo de 64px; e
      `symbol-sigil.svg`, com a gema, de 64px em diante. A 48px as facetas se fundem, a 56px
      aparecem apertadas, a 64px se leem nos dois temas. O cabeçalho usa a pequena: 24px, e
      48px com a fonte em 200%.
- [x] **A pequena cai inteira no pixel.** O conjunto está deslocado 1 unidade (eixo em 23),
      para a carta central ficar entre 12 e 34: a 24px, as bordas passam direto da marca ao
      fundo; centrada (13 a 35), elas saíam com uma coluna de meio-tom de cada lado. A versão
      com sigilo fica centrada — acima de 48px a grade não coincide com o pixel de qualquer
      jeito.
- [x] Peso: 506 bytes e 1,2 KB (teto de 5 KB, §4).
- [x] O elemento é decorativo (`aria-hidden="true"`): o link continua se chamando "Oráculo".
      O endereço de cada arquivo é token (`--image-brand-mark`, `--image-brand-mark-sigil`),
      e a cor, `--color-brand`.
- [ ] Alto contraste do Windows: sem regra, o fundo forçado apaga o desenho. Na
      `@media (forced-colors: active)`, `forced-color-adjust: none` e a cor do sistema
      (`LinkText` no cabeçalho, onde o símbolo está dentro do link).
- [x] A palavra "Oráculo" continua texto HTML. Se ganhar desenho próprio, vira traçado, e o
      link continua se chamando "Oráculo" para o leitor de tela.
- [x] Um componente só, em `shared/components/`, usado pelo cabeçalho e pelo login: a marca
      continua num lugar só (`frontend/src/styles/components.css:265`).
- [x] Contraste: com `--color-brand` já passa — 9,92:1 sobre a superfície no claro e 8,66:1 no
      escuro (medido em 11/09). Tom novo, medir a 3:1.
- [x] Verificar o cabeçalho a 360px e com fonte em 200%: o `.cluster` quebra, e o símbolo não
      pode cortar "Sair". O cabeçalho já está na rede de geometria; o teste passa a montar o
      símbolo.
**Implementado em 12/09**, na `feature-identidade-visual`: os dois SVG em
`frontend/src/assets/brand/` (506 bytes e 1.169, extraídos deste arquivo sem retoque), o
componente `shared/components/brand-mark.js` com cinco testes escritos antes (suíte do
frontend de 305 para **310**, `validate OK`), os dois tokens `--image-brand-mark*`, a máscara e
a regra de `forced-colors` no `components.css`, o desenho no link do cabeçalho e a versão com
sigilo acima do formulário de entrada. **Conferido na tela, com o autor logado:** o cabeçalho nos três estados do botão de tema
(claro, escuro e sistema) — a marca troca de cor junto, que é o ponto da rota da máscara —, a
entrada no escuro com o sigilo a 64px, e o símbolo a 24px medido no pixel: a carta central
ocupa 11 colunas cheias, sem coluna de meio-tom de cada lado, como o deslocamento de uma
unidade prometia. As larguras com a fonte em 200% vêm da rede de geometria, que monta o
`appHeader` e por isso passou a cobrir o símbolo sem uma linha nova.
**Falta conferir, e é do autor:** o alto contraste do Windows — é a primeira regra de
`forced-colors` do projeto, e nenhum teste a alcança.

**Decidido pelo autor em 12/09:** os pontos soltos sob a marca a 16px ficam como estão.

- **Entregar:** `assets/brand/symbol.svg` e `assets/brand/symbol-sigil.svg`, cada um numa
  camada só. O código-fonte aprovado fica aqui até a implementação, que os grava como arquivo:

  ```svg
  <!-- symbol.svg — sem sigilo, abaixo de 64px -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><mask id="v"><rect width="48" height="48" fill="#fff"/><rect x="10" y="6" width="26" height="34" rx="5" fill="#000"/></mask></defs><g mask="url(#v)" fill="none" stroke="#000" stroke-width="3"><rect x="13.54" y="12.2" width="18.92" height="25.8" rx="2.58" transform="rotate(-18 23 45)"/><rect x="13.54" y="12.2" width="18.92" height="25.8" rx="2.58" transform="rotate(18 23 45)"/></g><rect x="12" y="8" width="22" height="30" rx="3"/></svg>
  ```

  ```svg
  <!-- symbol-sigil.svg — com a gema, de 64px em diante -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><mask id="v"><rect width="48" height="48" fill="#fff"/><rect x="11" y="6" width="26" height="34" rx="5" fill="#000"/></mask><mask id="s"><rect width="48" height="48" fill="#fff"/><g fill="none" stroke="#000" stroke-width="1.4" stroke-linejoin="round"><polygon points="21.2,14 26.8,14 30,17.2 30,28.8 26.8,32 21.2,32 18,28.8 18,17.2"/><polygon points="23.8,19 24.2,19 26,20.8 26,25.2 24.2,27 23.8,27 22,25.2 22,20.8"/><line x1="21.2" y1="14" x2="23.8" y2="19"/><line x1="26.8" y1="14" x2="24.2" y2="19"/><line x1="30" y1="17.2" x2="26" y2="20.8"/><line x1="30" y1="28.8" x2="26" y2="25.2"/><line x1="26.8" y1="32" x2="24.2" y2="27"/><line x1="21.2" y1="32" x2="23.8" y2="27"/><line x1="18" y1="28.8" x2="22" y2="25.2"/><line x1="18" y1="17.2" x2="22" y2="20.8"/></g></mask></defs><g mask="url(#v)" fill="none" stroke="#000" stroke-width="3"><rect x="14.54" y="12.2" width="18.92" height="25.8" rx="2.58" transform="rotate(-18 24 45)"/><rect x="14.54" y="12.2" width="18.92" height="25.8" rx="2.58" transform="rotate(18 24 45)"/></g><rect x="13" y="8" width="22" height="30" rx="3" mask="url(#s)"/></svg>
  ```

### P2 — Ícone da aba

**Onde:** `frontend/public/index.html`, que hoje não tem `<link rel="icon">`. O pedido
automático de `/favicon.ico` cai no redirecionamento da aplicação e recebe o `index.html`
(conferido em 11/09: `200`, com o HTML). **Detalhado e aprovado em 11/09**; escrito como
código, não vai para o agente de imagem. **Tema:** não segue o do Oráculo, só o do navegador
— por isso tem fundo próprio.

**Os formatos, e por quê:**

| Arquivo | Para quem | Por quê |
|---|---|---|
| `favicon.svg` | Chrome, Edge e Firefox, em todo tamanho | Grade de 16 unidades: a carta central e o quadrado caem inteiros no pixel a 16 e a 32px |
| `favicon.ico` (16 e 32) | Navegador antigo e o pedido automático de `/favicon.ico` | O pedido para de receber HTML. Com ele, o PNG de 32 separado ficou redundante |
| `apple-touch-icon.png` (180) | A tela inicial do iPhone | O iOS pede o arquivo sozinho. A 180px já cabe a versão com a gema |

- [x] **Fundo próprio, sem truque de tema.** Quadrado da marca com o símbolo branco: legível
      em barra de abas clara e escura, e funciona igual no `.ico` e no PNG. Um SVG que troca
      de cor com o tema do navegador dependeria de `<style>` dentro do arquivo, e a pasta
      servida manda CSP em toda resposta (`docker/app/apache.conf:125`).
- [x] **Desenhado à parte, com as laterais exageradas:** 92% e 24° (no símbolo, 86% e 18°),
      traço 1,2. Medido a 16px: 14 pixels das laterais passam de 60% de branco, contra 8 na
      versão fiel ao P1, em que elas viravam um halo lilás.
- [x] **Cor gravada, com a origem anotada:** fundo `#492c9b` (`--color-brand`, claro) e
      símbolo `#ffffff`, a 9,92:1. Se a marca mudar, os três arquivos se refazem.
- [x] **Transparência:** o favicon tem cantos arredondados, e o PNG sai com alfa — canto de
      32px 100% transparente, sem branco assado que apareceria na barra escura. O ícone do iOS
      é o contrário: quadrado cheio, sem canto e sem alfa, porque o iOS arredonda sozinho.
- [x] Os três na raiz, `frontend/public/`: o `.ico` e o PNG do iOS são pedidos lá pelo próprio
      navegador, e o SVG vai junto.
- [x] `<link rel="icon" href="/favicon.ico" sizes="32x32">`, `<link rel="icon"
      href="/favicon.svg" type="image/svg+xml">` e `<link rel="apple-touch-icon"
      href="/apple-touch-icon.png">` no `<head>`, **fora** do bloco do mapa de importação:
      qualquer mudança nele troca o hash da CSP, e a aplicação para de carregar
      (`docker/app/apache.conf:40`).
- [ ] Verificar no Chrome, no Edge e no Firefox, com o navegador no claro e no escuro, e que
      `/favicon.ico` e `/apple-touch-icon.png` respondem com a imagem, não com o HTML.
**Implementado em 12/09** (`12e7d4d`): os três em `frontend/public/` — `favicon.svg` (571
bytes), `favicon.ico` (1.367, com os PNG de 16 e 32 dentro) e `apple-touch-icon.png` (4.343,
já sem canal alfa, porque a arte cobre o quadrado) — mais o SVG que origina o PNG do iOS,
versionado em `frontend/src/assets/brand/apple-touch-icon.svg`. Os `<link>` no `<head>`, fora
do mapa de importação. **Conferido:** `/favicon.ico` responde `image/vnd.microsoft.icon` em
vez do HTML, o `.ico` foi lido entrada por entrada depois de gravado, e o ícone do iOS abre
com a gema no lugar. **Falta conferir:** Chrome, Edge e Firefox com o navegador no claro e no
escuro. **Como as fotos saíram:** Chrome sem janela em `--headless=old` — o `=new` travou
neste host, e o perfil precisa de caminho curto (`C:\Users\Public`), senão o cache de GPU falha.

**Anotado na revisão do pixel, para o autor decidir:** a 16px, o canto de baixo de cada carta
lateral escapa do vão da máscara e fica como dois pontos soltos sob a marca, a 55–58% de
branco. É a geometria aprovada — aparece no ícone de 180px como o canto das cartas de trás, e
lá se lê. A 16px lê como sujeira, para o meu olho. Não mexi.

- **Entregar:** `favicon.svg`, `favicon.ico` e `apple-touch-icon.png`. Os SVG aprovados ficam
  aqui até a implementação. **Como gerar o PNG e o `.ico`:** fotografar o SVG num navegador
  sem janela, em escala 1 e com fundo transparente (no Edge ou no Chrome:
  `--headless=new --force-device-scale-factor=1 --default-background-color=00000000`), e
  montar o `.ico` com os PNG de 16 e 32 dentro de cada entrada — cabeçalho de 6 bytes e 16
  por entrada —, sem reamostrar o de 16 a partir do de 32.

  ```svg
  <!-- favicon.svg -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><defs><mask id="v"><rect width="16" height="16" fill="#fff"/><rect x="4" y="3" width="8" height="10" rx="2" fill="#000"/></mask></defs><rect width="16" height="16" rx="3" fill="#492c9b"/><g mask="url(#v)" fill="none" stroke="#ffffff" stroke-width="1.2"><rect x="5.24" y="4.64" width="5.52" height="7.36" rx="0.92" transform="rotate(-24 8 12.8)"/><rect x="5.24" y="4.64" width="5.52" height="7.36" rx="0.92" transform="rotate(24 8 12.8)"/></g><rect x="5" y="4" width="6" height="8" rx="1" fill="#ffffff"/></svg>
  ```

  ```svg
  <!-- apple-touch-icon.svg — fonte do PNG de 180px; o símbolo com a gema, 2,5x no centro -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" fill="#492c9b"/><g transform="translate(30 30) scale(2.5)"><defs><mask id="v"><rect width="48" height="48" fill="#fff"/><rect x="11" y="6" width="26" height="34" rx="5" fill="#000"/></mask><mask id="s"><rect width="48" height="48" fill="#fff"/><g fill="none" stroke="#000" stroke-width="1.4" stroke-linejoin="round"><polygon points="21.2,14 26.8,14 30,17.2 30,28.8 26.8,32 21.2,32 18,28.8 18,17.2"/><polygon points="23.8,19 24.2,19 26,20.8 26,25.2 24.2,27 23.8,27 22,25.2 22,20.8"/><line x1="21.2" y1="14" x2="23.8" y2="19"/><line x1="26.8" y1="14" x2="24.2" y2="19"/><line x1="30" y1="17.2" x2="26" y2="20.8"/><line x1="30" y1="28.8" x2="26" y2="25.2"/><line x1="26.8" y1="32" x2="24.2" y2="27"/><line x1="21.2" y1="32" x2="23.8" y2="27"/><line x1="18" y1="28.8" x2="22" y2="25.2"/><line x1="18" y1="17.2" x2="22" y2="20.8"/></g></mask></defs><g mask="url(#v)" fill="none" stroke="#ffffff" stroke-width="3"><rect x="14.54" y="12.2" width="18.92" height="25.8" rx="2.58" transform="rotate(-18 24 45)"/><rect x="14.54" y="12.2" width="18.92" height="25.8" rx="2.58" transform="rotate(18 24 45)"/></g><rect x="13" y="8" width="22" height="30" rx="3" fill="#ffffff" mask="url(#s)"/></g></svg>
  ```

  Ao recolorir um SVG de máscara, trocar só as formas visíveis: o preto **dentro** das
  máscaras é o que recorta a gema e o vão. A primeira versão do ícone do iOS trocou os dois,
  e a gema sumiu.

### P3 — Verso da carta

**Onde:** espaço reservado da galeria
(`frontend/src/features/cards/components/card-tile.js:28`), pré-visualização vazia do
formulário (`card-image-field.js:120`), reserva da miniatura do modal (P7) e cartas do login
(P4). **Detalhado e aprovado em 11/09**; SVG escrito como código, não vai para o agente.
**Tema:** segue o do Oráculo (D3), pelos tokens — é estado de tela ("sem imagem"), não arte.
**Formato:** duas camadas de máscara (rota A) sobre o fundo do próprio elemento; o verso rico
do login não existe como arquivo — as cartas deitadas saem na cena do P4.

**A composição:** a moldura repete a lapidação esmeralda do logo — a borda chanfrada, um
degrau por dentro e as facetas nos quatro chanfros —, como se a carta inteira fosse uma pedra
vista de cima. A gema do logo fica acima, e o nome embaixo, em área lisa. Carta de costas é o
que "sem imagem" quer dizer: a face existe, só não está à vista.

**Os tons** — dois, e não três:

| Camada | Token | Claro | Escuro | Medida |
|---|---|---|---|---|
| Fundo | `--color-bg` (o de hoje) | `#f0eff5` | `#0f0f16` | — |
| Moldura e gema | `--color-line-art` (**novo**) | `#d1cfdf` | `#2b293f` | 1,34:1 e 1,36:1 sobre o fundo |
| Nome | `--color-muted` (o de hoje) | `#67686b` | `#9aa0a8` | 4,87:1 e 7,24:1 sobre o fundo |

- [x] **Por que um token novo** (`design.md` §8): o papel "linha de arte decorativa" não
      existia. Com os tokens de antes, a linha dava 1,20 no claro e 1,57 no escuro —
      apagada num tema, marcada no outro. E o acento suave ficou fora do fundo de propósito:
      ele significa **seleção** (`design.md` §4), e um verso violeta na grade seria lido como
      carta selecionada.
- [x] **A `/paleta` precisa aprender o nome.** Hoje ela só deixa de medir como tinta o nome
      exato `--color-line` (`frontend/src/shared/theme/palette.js:215`); `--color-line-art`
      entraria como texto, a 4,5:1, e reprovaria. A regra passa a "começa com
      `--color-line`", com teste antes em `palette.test.js`, e a tabela do `design.md` §3
      ganha a linha no mesmo commit.
- [x] Mais apagado que qualquer arte real, sem `--color-brand` nem `--color-accent` (§4).
- [x] **Nada encosta:** o nome mais longo do seed ("Blue-Eyes Alternative Ultimate Dragon")
      fica a ~40px da gema em 176px e a ~80px com a fonte em 200%. Texto sobre a linha
      cairia abaixo de 4,5:1 — por isso a gema sobe, em vez de o nome ficar por cima dela.
- [x] **As camadas no CSS:** o fundo do elemento é `--color-bg`; `::before` leva a moldura
      (`inset: 0`, máscara em `100% 100%`); `::after` leva a gema (34% da largura, centro a
      37% da altura), e o texto fica por cima das duas. Sem texto — a miniatura do modal
      (P7) —, a gema vai ao centro (50%) e cresce para 40%. O nome encosta embaixo: padding
      de 16% dos lados e 17% no pé.
- [ ] Alto contraste do Windows: as duas camadas somem com o fundo forçado; na
      `@media (forced-colors: active)`, `forced-color-adjust: none` e `GrayText` nelas.
- [x] Mantém o `role="img"` e o `aria-label` "Sem imagem para …" (`card-tile.js:31`).
- [ ] A imagem que falha ao carregar já cai no mesmo espaço reservado (`card-tile.js:65`):
      conferir que o verso aparece também ali.
- [x] Na pré-visualização, "Nenhuma imagem escolhida." continua visível sobre o verso.
- [x] Verificar a galeria nos dois temas, a 399 e a 400px, 752, 1424 e fonte em 200%. O seed
      tem cartas sem imagem de propósito (The One Ring, Spider-Man, Celebration Pikachu). A
      rede de geometria já monta cartas sem imagem na galeria; o teste passa a afirmar o verso.
**Implementado em 12/09** (`15d0a50`): os dois SVG em `frontend/src/assets/card-back/`, com
exatamente os 666 e 618 bytes previstos; `--color-line-art` nos três blocos de tema; as duas
camadas e a regra de `forced-colors` no `components.css`, divididas entre a galeria e a
pré-visualização vazia; a `/paleta` ensinada na família (`palette.js`), com teste antes; e a
tabela do `design.md` §3 com 1,34:1 e 1,36:1 **recalculados**, não copiados. Suíte 311,
`validate OK`. **Conferido na tela:** a galeria nos dois temas (The One Ring) e a
pré-visualização vazia com o texto legível sobre o verso. **Falta:** o alto contraste do
Windows (do autor), e ver o verso no lugar de uma imagem que falha ao carregar — o caminho
é o mesmo `imagePlaceholder`, então o desenho é o mesmo por construção, mas ninguém olhou.

**A rede de geometria ganhou 399 e 400px na galeria**, a virada de uma para duas colunas —
onde a carta muda de tamanho por um fator de dois de um pixel para o seguinte.

**Um defeito achado no caminho, e corrigido em commit próprio (`8d4a6f2`):** a galeria e a
paginação chamavam `.node` num componente que devolve o elemento, então nada era montado e
as duas linhas da rede mediam uma caixa vazia desde 10/09. Passavam sempre. Corrigidas, as
duas passam de verdade — não havia defeito de layout escondido.

- **Entregar:** `assets/card-back/frame.svg` (666 bytes) e `assets/card-back/gem.svg` (618
  bytes). O código aprovado fica aqui até a implementação:

  ```svg
  <!-- frame.svg — a moldura, na proporção da carta -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 680"><g fill="none" stroke="#000" stroke-linejoin="round"><polygon points="62,22 426,22 466,62 466,618 426,658 62,658 22,618 22,62" stroke-width="5"/><polygon points="70,44 418,44 444,70 444,610 418,636 70,636 44,610 44,70" stroke-width="2.5"/><g stroke-width="2.5"><line x1="62" y1="22" x2="70" y2="44"/><line x1="426" y1="22" x2="418" y2="44"/><line x1="466" y1="62" x2="444" y2="70"/><line x1="466" y1="618" x2="444" y2="610"/><line x1="426" y1="658" x2="418" y2="636"/><line x1="62" y1="658" x2="70" y2="636"/><line x1="22" y1="618" x2="44" y2="610"/><line x1="22" y1="62" x2="44" y2="70"/></g></g></svg>
  ```

  ```svg
  <!-- gem.svg — a gema do logo, sozinha, para o CSS posicionar -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 22"><g fill="none" stroke="#000" stroke-width="0.45" stroke-linejoin="round"><polygon points="5.2,2 10.8,2 14,5.2 14,16.8 10.8,20 5.2,20 2,16.8 2,5.2"/><polygon points="7.8,7 8.2,7 10,8.8 10,13.2 8.2,15 7.8,15 6,13.2 6,8.8"/><line x1="5.2" y1="2" x2="7.8" y2="7"/><line x1="10.8" y1="2" x2="8.2" y2="7"/><line x1="14" y1="5.2" x2="10" y2="8.8"/><line x1="14" y1="16.8" x2="10" y2="13.2"/><line x1="10.8" y1="20" x2="8.2" y2="15"/><line x1="5.2" y1="20" x2="7.8" y2="15"/><line x1="2" y1="16.8" x2="6" y2="13.2"/><line x1="2" y1="5.2" x2="6" y2="8.8"/></g></svg>
  ```

### P4 — Tela de login

**Onde:** `frontend/src/pages/login/login-page.js:27`. **Conceito:** a mesa, com a carta
central já tirada (`docs/logo-and-login-ideas.md`, "Login"). **Detalhado em 11/09; o pedido
ao agente está no fim desta seção.** **Formato:** raster em **camadas** — a mesa sozinha e uma
carta deitada transparente —, uma de cada por tema. **Material:** tecido na névoa violeta.

**Por que camadas, e não uma cena única.** A imagem de fundo cresce com a **janela**; o cartão
do formulário cresce com a **fonte**. Com a fonte em 200% o cartão tem 768px, e numa tela de
1366×768 as cartas de uma cena única ficariam a ±380px do centro — embaixo dele. Em camadas,
a carta deitada tem tamanho em `rem` e fica ao lado do cartão pelo arranjo: tudo cresce junto,
e as laterais somem quando não cabem. Provado no esboço de composição de 11/09 (1440px,
390px e fonte em 200%).

**Por que tecido.** A arte usa a família violeta e os neutros (§4). Madeira traria o marrom, um
matiz novo, vizinho do topázio da atenção.

- [ ] Arranjo estreito e largo: a 360px não cabem três cartas ao lado do formulário. A troca é
      por `@container` no `.login-layout`, não por `@media`. O login não tem nada fixo dentro
      dele, então a contenção não esbarra no aviso do `design.md` §9.
- [ ] Altura baixa também: celular deitado tem menos de 400px de altura, e a arte não pode
      empurrar o formulário para fora da tela.
- [ ] Logotipo (P1) acima do formulário.
- [ ] O campo de e-mail continua recebendo o foco ao abrir (`login-page.js:35`), e o
      formulário funciona antes de a arte chegar.
- [ ] Imagem do login sem `loading="lazy"`: é a primeira tela.
- [ ] O formulário já sobre a carta central ao abrir, sem botão antes, e como conteúdo da
      página (`<main>`), não como modal.
- [ ] A virada só depois da resposta do servidor: a carta vira (~350ms) e a aplicação entra
      por esmaecimento (~200ms), cada movimento abaixo de 400ms. Erro não vira a carta. Com
      movimento reduzido, só o esmaecimento. O foco do teclado não se perde no meio.
- [ ] A mesa: uma cena por tema, pelo token `--image-*`, para a virada não revelar a aplicação
      num tema diferente do da cena.
- [ ] O login **não** está na rede de geometria hoje. Entra, afirmando o estado com a arte.
- [ ] Verificar a 360, 500, 752 e 1424px, com fonte em 200%, nos dois temas e com o celular
      deitado. **Largura de celular não se testa no navegador sem janela**: ele tem piso de
      ~500px e recorta a foto — dentro de um `<iframe>` de 390px a medida é a real.
- [ ] **A carta em pé** é o cartão do formulário: fundo `--color-surface`, a moldura do P3 em
      `--color-line-art` e o logo com a gema (P1, 4rem) no topo. A gema solta do P3 não entra
      — o logo está no lugar dela.
- [ ] **A proporção de carta vale só no arranjo largo.** No estreito, a altura é a do
      conteúdo: presa à proporção, a 200% o cartão tinha 1.070px e empurrava o Entrar para
      fora da primeira tela. Se a moldura, esticada a outra proporção, deformar os chanfros
      visivelmente, fatiá-la em nove (cantos fixos, lados que esticam) — decidir medindo.
- [ ] **As laterais:** a mesma imagem nos dois lados, a da direita espelhada no CSS
      (`scale: -1 1`); largura em `rem`, ao lado do cartão e um pouco abaixo dele, "na mesa";
      aparecem por `@container` quando cabem inteiras (no esboço, a partir de 64rem) — cortadas
      pela borda, a rede de geometria acusaria.
- [ ] **A mesa** é o fundo do `.login-layout`: `background-size: cover`, centro no centro — ela
      não precisa se alinhar a nada, só as cartas precisam.
- [ ] Tokens: `--image-login-table` e `--image-login-card`, redefinidos nos três blocos de
      tema (§3); a carta com `image-set()` para 1× e 2×.
- **Entregar:** do agente, `login-table-light.webp` e `login-table-dark.webp` (1920×1080, sem
  alfa, até ~120 KB cada) e `login-card-light.webp`, `login-card-light@2x.webp`,
  `login-card-dark.webp` e `login-card-dark@2x.webp` (480×360 e 960×720, com alfa, até ~40 KB
  o 2×). A mesa não tem 2×: ela é desfocada de propósito, e o desfoque esconde a ampliação.

#### O pedido ao agente de imagem

**Referências para anexar** — em `docs/visual-identity-refs/` (fora do Git, como este
arquivo): `p3-verso-linhas.png` (a geometria do verso em traço preto, 976×1360),
`p3-verso-claro.png` e `p3-verso-escuro.png` (o verso nas cores reais) e
`p4-composicao-claro.png` e `p4-composicao-escuro.png` (o esboço: onde as cartas ficam e para
onde apontam).

**Imagem 1 — a mesa, uma por tema.** Só o tampo, sem nada em cima, visto por quem está sentado
(câmera a ~40° do plano da mesa). O tecido ocupa o quadro inteiro — sem borda de mesa nem
horizonte, para o recorte de `cover` não cortar nada que importe. Uma poça de luz suave no
centro, onde fica a carta em pé, caindo para as bordas; as bordas terminam na cor de fundo do
app, porque a aplicação entra por esmaecimento depois da virada. Foco raso: a trama aparece
no centro e desfoca em volta. Croma baixo — é o entorno do formulário, não o assunto.

```text
[dark] An empty tabletop covered with deep violet-black velvet, seen from the eye level of a
person seated at the table (camera about 40 degrees above the surface). The fabric fills the
entire frame, edge to edge: no table edge, no horizon, no objects. One soft, slightly warm
violet light from above makes a gentle pool of light at the center of the frame that falls
off smoothly into near-black #0f0f16 at the edges. Very shallow depth of field: the velvet
texture is visible only near the center, softly blurred elsewhere. Low saturation, calm,
premium, photographic. No text, no logos, no cards, no people, no hands, no candles, no
crystals, no wood. 1920x1080.

[light] The same composition with pale lavender-gray linen instead of velvet, under soft,
diffuse daylight from above: a gentle bright pool at the center falling off into very light
violet-gray #f0eff5 at the edges. Same camera, same shallow depth of field, same exclusions.
```

**Imagem 2 — a carta deitada, uma por tema.** Uma carta de costas, deitada na mesa, na mesma
perspectiva da imagem 1, do lado **esquerdo** da cena: girada ~14° no plano da mesa, com a
ponta de perto apontando para o centro e a de longe abrindo para fora — o leque do logo. O CSS
espelha para fazer a da direita, por isso nada assimétrico no desenho. O verso é o do P3
(`p3-verso-linhas.png`): moldura chanfrada, um degrau, as facetas nos chanfros e a gema no
terço de cima, em traço fino. Cartolina de carta: cantos arredondados, espessura leve na
borda, brilho acetinado discreto. Luz vinda de cima e da direita — do centro da cena. Fundo
transparente, com a sombra de contato suave dentro do arquivo e nada da mesa.

```text
[dark] A single blank playing card (63x88 mm proportions) lying flat on a table, seen from the
eye level of a person seated at the table (camera about 40 degrees above the surface),
isolated on a transparent background with only its soft contact shadow. The card sits on the
LEFT side of the scene, rotated about 14 degrees in the table plane so its near edge points
toward the right (the center of the scene) and its far edge leans outward to the left. The
card back reproduces the attached line drawing exactly: a chamfered octagonal frame
(emerald-cut outline), a thinner inner step line, short facet lines across the four chamfered
corners, and an emerald-cut gem outline in the upper third, all in fine lines. Card stock
#1e1e25 with lines in a slightly lighter violet-gray (#2b293f, raised just enough to read under
the light). Rounded corners, subtle edge thickness, faint satin sheen, light from the upper
right. Perfectly symmetric design: no text, no numbers, no logos, no game artwork. PNG or WebP
with alpha, 960x720, the card occupying about 70% of the canvas width.

[light] The same card and pose with white card stock #ffffff and lines in #d1cfdf, soft
daylight shadow.
```

**Ao receber:** conferir a proporção (63:88), a simetria do verso (espelhado, a da direita não
pode denunciar), o alfa limpo nas bordas e a sombra — sobre as duas mesas, nos dois temas.

### P5 — Ilustrações de estado

**Onde:** página não encontrada (`frontend/src/pages/app-shell/app-shell.js:151`) e catálogo
sem nenhuma carta (`frontend/src/pages/cards/cards-page.js:304`). "Nenhuma carta encontrada"
(`cards-page.js:287`) leva um símbolo pequeno. **Detalhado e aprovado em 11/09.**
**Formato:** SVG geométrico escrito como código, por token — e **não** ilustração do agente:
as duas cenas se dizem com as cartas e a gema que o logo e o verso já estabeleceram;
ilustração rica viraria raster, com uma versão por tema e peso numa tela de erro; e estado
vazio em sistema de trabalho é para ser discreto.

**As três telas:**

| Estado | Desenho | Tamanho |
|---|---|---|
| Página não encontrada | O leque do logo com a **carta do meio faltando**, tracejada: a carta que se pediu não está na tiragem | `min(12rem, 100%)` |
| Catálogo vazio | **Uma carta só, tracejada** — o lugar da primeira carta, que é o que a descrição promete | `min(12rem, 100%)` |
| Busca sem resultado | **A gema sozinha** (`back-gem.svg`, do P3 — sem arquivo novo), bem menor: o estado é frequente e já tem a ação de limpar filtros | 4rem de altura |

- [x] **Um segundo token de arte: `--color-line-art-strong`** — `#a9a6bd` no claro e `#474461`
      no escuro, medidos a 2,07:1 e 2,06:1 sobre o fundo. O tom do verso (1,34:1) foi
      calibrado para ficar **atrás de texto**; aqui a ilustração está sozinha e na frente, e
      naquele tom ela vira fantasma no claro. Como o nome começa com `--color-line`, ele sai
      da conta de tinta da `/paleta` junto com o outro (ver P3).
- [x] Pesos: 414 e 224 bytes.
- [x] `empty()` (`frontend/src/shared/components/feedback.js:46`) ganha a imagem como opção;
      os outros usos (painel de catálogo, histórico) continuam sem ela.
- [x] Decorativa (`aria-hidden`): o título e a descrição continuam dizendo tudo.
- [ ] Alto contraste do Windows: `forced-color-adjust: none` e `GrayText`, como no verso.
- [x] Os estados vazios não estão na rede de geometria; entram junto com a ilustração.
- [ ] Verificar nos dois temas, a 360px e com fonte em 200%.
**Implementado em 12/09** (`317fd23`): os dois SVG em `frontend/src/assets/states/`, com os
414 e 224 bytes previstos; `--color-line-art-strong` nos três blocos de tema, com 2,07:1 e
2,06:1 **recalculados**; `empty()` com a opção `image` e conjunto fechado que lança em nome
errado; e os três estados ligados (404, catálogo vazio, busca sem resultado). Os estados
vazios entraram na rede de geometria, que não os cobria. Suíte **340**, `validate OK`.

**Conferido na tela, nos dois temas:** a página não encontrada com o leque tracejado e a
busca sem resultado com a gema de 4rem. **Não conferido em execução:** o catálogo vazio —
exige o banco sem nenhuma carta; fica coberto pela suíte, montado nas dezoito configurações
da rede. E o alto contraste do Windows, que é do autor.

- **Entregar:** `assets/states/not-found.svg` e `assets/states/empty-catalog.svg`; a busca usa
  `assets/card-back/gem.svg`. O código aprovado:

  ```svg
  <!-- not-found.svg -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="21.34 37 197.33 172.33"><g fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"><rect x="72.7" y="61" width="94.6" height="129" rx="12.9" transform="rotate(-18 120 225)"/><rect x="72.7" y="61" width="94.6" height="129" rx="12.9" transform="rotate(18 120 225)"/><rect x="65" y="40" width="110" height="150" rx="15" stroke-dasharray="14 10"/></g></svg>
  <!-- empty-catalog.svg -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="62 37 116 156"><g fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"><rect x="65" y="40" width="110" height="150" rx="15" stroke-dasharray="14 10"/></g></svg>
  ```

### P6 — Ícones

**Onde:** aviso `⚠` (`feedback.js:76`), cadeado `🔒` (`feedback.js:107`) e sistema, claro e
escuro `◐ ☀ ☾` (`frontend/src/shared/components/theme-toggle.js:21`). Hoje são caracteres de
fonte: o `🔒` sai como emoji colorido, fora da paleta, e os outros mudam de desenho com o
sistema. **Detalhado e aprovado em 11/09**; SVG escrito como código. **Formato:** SVG de
traço, máscara pintada com `currentColor` (rota A) — o ícone tem a cor do texto ao lado,
vermelho no erro e tinta no botão, sem arquivo por cor.

- [x] **Uma família:** grade de 24, traço 2, pontas e junções redondas — as do logo. As
      formas são as universais (triângulo, cadeado, meio círculo de "automático", sol, lua):
      reinventar um sinal de aviso custa reconhecimento, e a identidade fica no traço.
- [x] Pesos: de 229 a 431 bytes cada.
- [x] **Um caractere, não uma caixa flex.** Mensagem de erro pode quebrar em duas linhas, e o
      ícone tem de ficar preso ao início do texto: `display: inline-block`, `1em` × `1em`,
      `vertical-align: -0.125em`. Num contêiner flex centrado ele ficaria no meio das linhas.
- [x] O endereço de cada um é token (`--image-icon-warning` e os outros quatro), e a cor é
      `currentColor`.
- [x] Continuam `aria-hidden`: o rótulo ao lado diz o estado (regra dos dois sinais).
- [x] O botão de tema monta ícone mais rótulo (`theme-toggle.js:52`, hoje `textContent`): o
      ícone vira elemento, e o `aria-label` do botão não muda.
- [ ] Alto contraste do Windows: `forced-color-adjust: none` no ícone. Ele herda a cor de
      sistema do texto, e `currentColor` pinta com ela.
**Implementado em 12/09** (`da07770`): os cinco em `frontend/src/assets/icons/`, com os
mesmos 229 a 431 bytes previstos; `shared/components/icon.js` com o conjunto FECHADO (nome
fora dele lança); os cinco tokens; a regra `.icon` com `currentColor`, `inline-block` de 1em
e `vertical-align: -0.125em`; e as duas ligações (`feedback.js` e `theme-toggle.js`). O botão
de tema ganhou suíte própria — não tinha nenhuma —, e um dos testes do ícone MONTA na página
e lê o estilo computado, que é o único jeito de pegar um token com typo. Suíte 324,
`validate OK`.

**Conferido na tela:** o aviso vermelho em "Carta não encontrada" (a cor vem do texto, como
`currentColor` promete) e os três desenhos do botão de tema, um por clique. **Falta:** o
cadeado em execução (pede um 403, e eu não entro com outra conta), a quebra da mensagem de
erro em duas linhas com o ícone preso à primeira — é por construção, não por medida —, e o
alto contraste do Windows.

- **Entregar:** `assets/icons/warning.svg`, `lock.svg`, `theme-system.svg`, `theme-light.svg`
  e `theme-dark.svg`. O código aprovado:

  ```svg
  <!-- warning.svg -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20.3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4.5"/><path d="M12 17h.01"/></g></svg>
  <!-- lock.svg -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></g></svg>
  <!-- theme-system.svg -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="#000"/></g></svg>
  <!-- theme-light.svg -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M19 12L21.5 12"/><path d="M16.95 16.95L18.72 18.72"/><path d="M12 19L12 21.5"/><path d="M7.05 16.95L5.28 18.72"/><path d="M5 12L2.5 12"/><path d="M7.05 7.05L5.28 5.28"/><path d="M12 5L12 2.5"/><path d="M16.95 7.05L18.72 5.28"/></g></svg>
  <!-- theme-dark.svg -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/></g></svg>
  ```

### P7 — Miniatura no modal de exclusão

**Onde:** `frontend/src/features/cards/components/delete-card-dialog.js:95`. **Detalhado e
aprovado em 11/09.** **Nenhuma arte nova, e nenhum arquivo novo:** usa a imagem da própria
carta (`card.imageUrl`) e, sem ela ou com falha, o verso do P3 — as duas máscaras que aquela
peça já entrega.

- [x] **A miniatura fica à esquerda do texto**, pela primitiva `.sidebar`
      (`--sidebar-side: 4rem`, `--sidebar-content-min: 14rem`): a leitura vira título, carta,
      explicação. No modal de 28rem sobra espaço (4 + 1 + 14 = 19rem no vão de 25rem); a
      360px de tela o texto perde o piso e a miniatura sobe para a linha de cima, em vez de
      espremer a explicação.
- [x] **Tamanho:** 4rem de largura (64px, 128px com a fonte em 200%), na proporção 488:680,
      com `object-fit: cover` e o raio pequeno. A proporção reserva o espaço antes de a
      imagem chegar: o modal não pode dar um salto com ele já aberto.
- [x] **O verso entra sem o nome**, com a gema no centro (a variante sem texto do P3): o
      título do modal já nomeia a carta.
- [x] **A imagem que falha** cai no verso, como na galeria (`card-tile.js:65`) — o mesmo
      tratamento, não um ícone quebrado.
- [x] `alt=""`: o título já nomeia a carta, e repetir faria o leitor de tela dizer duas vezes.
- [x] O modal não está na rede de geometria; entra, com nome longo, nos dois arranjos.
- [ ] Verificar a 360px e com fonte em 200%, abrindo pela galeria e pela tabela.

**Implementado em 12/09** (`bf938f1`). O verso ganhou nome — `cardBack`, em
`features/cards/components/` —, porque a decisão que muda de um uso para o outro é de
acessibilidade: na galeria ele se apresenta e leva o nome; no modal, o título já nomeia a
carta e ele cala. O `card-tile` passou a usá-lo, com o mesmo DOM. A variante sem texto sai
por `:empty` (gema ao centro, 40%), e a divisória de baixo virou do cartão da grade. O
conteúdo do modal virou função exportada para entrar na rede de geometria — o modal em si
não entra, porque o `openModal` prende a caixa ao `document.body` e a largura vem da janela.
Suíte **331**, `validate OK`.

**Conferido na tela:** o modal com carta sem imagem (verso, gema ao centro, sem nome), com
arte real, e pelos dois caminhos que o abrem — galeria e tabela. Nada foi excluído: os dois
modais foram fechados com Esc. **Falta:** 360px com a fonte em 200% (pede a barra de
dispositivo, que é do autor).

## 7. Fora, e por quê

- **Logo dos jogos:** propriedade de terceiros, e o Oráculo é de todos os jogos.
- **Fundo ilustrado nas telas de trabalho:** disputa com a arte das cartas; o escuro já tem
  croma baixo por esse motivo (`design.md` §2).
- **Foto em "Minha conta":** o sistema não tem foto de usuário.
- **Imagem no carregamento inicial** (`frontend/src/main.js:109`): dura uma fração de segundo.
- **Falha de boot** (`main.js:37`): continua sem depender de nada, de propósito.

## 8. Ordem sugerida

1. As decisões da §1.
2. P1, e P2 logo depois, porque sai do símbolo.
3. P3: galeria e pré-visualização.
4. P6: pequeno e independente.
5. P4: usa P1 e P3.
6. P7 e P5.

Com P1, P2 e P3 prontos, as telas que se veem primeiro já mudaram de cara.

## 9. Pronto, para cada peça

- [ ] Nenhum valor visual fora do `tokens.css`, endereço de imagem incluído.
- [ ] Os dois temas conferidos na tela, pelo sistema **e** pelo botão.
- [ ] As larguras que cruzam a faixa da peça (§5), com fonte em 200% e com zoom em 200%.
- [ ] Console sem violação de CSP.
- [ ] Movimento reduzido e alto contraste do Windows.
- [ ] Rede de geometria atualizada quando a peça muda uma tela.
- [ ] `docs/design.md` atualizado no mesmo commit, com os tokens novos e o contraste medido.
- [ ] Um commit por peça (`docs/ENGENHARIA.md` §7).
- [ ] Opcional: a `/paleta` mostrar os tokens `--image-*` nos dois temas, lado a lado. Hoje ela
      lê cores, raios e sombras.
