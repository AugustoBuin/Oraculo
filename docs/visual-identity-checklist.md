# Identidade visual

> **Estado (14/09/2026):** as sete peças estão implementadas, cada uma em commit próprio, com
> teste antes onde o ADR-004 manda e verificação na tela — P1, P2, P3, P5, P6 e P7 em 12/09; o P4
> em duas partes, a cena em 12/09 e a virada em 13/09. **Conferido pelo autor na tela, em
> 14/09:** a virada da entrada com sessão de verdade, o arranjo largo e o ícone nas abas dos
> navegadores. **Não conferido:** o alto contraste do Windows. As regras de `forced-colors`
> existem, mas nenhum teste as alcança, e a verificação ficou fora desta entrega por decisão do
> autor.
>
> As escolhas e os motivos — o logo, o sigilo, a mesa com a carta já tirada — estão em
> `docs/logo-and-login-ideas.md`. Este arquivo registra **como cada peça foi feita** e as
> imagens geradas.

---

## 1. As decisões

- **Logo e tela de entrada** (11/09): a tiragem segurada na mão, com a gema como sigilo, e a
  mesa com a carta central já tirada.
- **D1 — SVG ou raster, peça a peça** (11/09). SVG escrito como código em P1, P2, P3, P5 e P6;
  raster só no P4, gerado com o Gemini; P7 sem arquivo novo. SVG pedido a um gerador de imagem,
  ou vetorizado a partir do pixel, sai com centenas de nós e metadado de editor — reprovaria a
  §4.
- **D2 — O SVG entra por máscara** (11/09). Ver §3.
- **D3 — O verso segue o tema** (11/09). A arte real de uma carta não muda com o tema, mas o
  verso não é arte: é o estado "sem imagem", e pelos tokens sai nos dois temas sem arquivo a
  mais.
- **D4 — Os arquivos moram em `frontend/src/assets/`** (12/09), servidos pelo `Alias /src`, que
  manda `Cache-Control: no-cache`. A exceção são os três arquivos do P2, em `frontend/public/`,
  porque o navegador os pede pelo caminho da raiz. `public/` não manda cabeçalho de cache, e
  uma imagem trocada continuaria velha na tela, sem erro nenhum.

## 2. SVG ou raster

**SVG por padrão. Raster quando a imagem vive de textura, luz ou degradê.**

| SVG | Raster (WebP) |
|---|---|
| Desenho plano, até três tons | Textura, luz, degradê rico |
| Cor vinda de token: troca de tema e sobrevive a mudança de paleta | Cor gravada no arquivo: uma versão por tema, refeita se a paleta mudar |
| Nítido em qualquer tamanho e densidade, com um arquivo só | Um arquivo por densidade |
| Símbolo, ícone da aba, ícones, verso, ilustrações de estado | A mesa e a carta deitada da tela de entrada |

**O verso da carta é SVG** porque a mesma carta vai de 176 a 367px de largura na galeria, passa
de 700px com a fonte do navegador em 200%, se repete na grade e leva o nome por cima. Em raster
seriam três arquivos por tema para cobrir a faixa.

## 3. Como a imagem entra no código

Três restrições decidiram a forma:

- **A CSP** (`docker/app/apache.conf`): `img-src 'self' https: blob:` não aceita `data:`, e
  `style-src 'self'` não tem `unsafe-inline` — SVG embutido na página não pode trazer `<style>`.
- **`el()` não cria SVG**: usa `document.createElement`, e SVG precisaria de
  `createElementNS`. O projeto não tem nenhum `innerHTML`.
- **O tema tem três estados.** `<picture>` com `media="(prefers-color-scheme: dark)"` seguiria o
  sistema operacional e ignoraria o botão de tema do Oráculo.

**A saída: máscara.** O SVG vira `mask-image` de um elemento pintado com
`background-color: var(--token)`. Acompanha o tema, inclusive pelo botão, sem uma linha de
JavaScript e sem tocar o `el()`. Cada tom é uma camada — o fundo do próprio elemento, o
`::before` e o `::after` —, então um elemento dá até três tons. O custo é o alto contraste do
Windows, que força o fundo para a cor da tela e apagaria o desenho: cada peça tem uma regra em
`@media (forced-colors: active)` que devolve o controle (`forced-color-adjust: none`) e pinta
com uma cor do sistema. A alternativa recusada era um auxiliar `svg()` com `createElementNS`:
mexeria no módulo que protege o DOM, e cada desenho viraria traçado dentro de um `.js`.

**Endereço de imagem é token** (`--image-*`, `docs/design.md` §8 e §11), com caminho absoluto a
partir da raiz. O que muda com o tema é redefinido nos dois blocos escuros, como as cores.

## 4. Regras que valeram para toda peça

- **Nenhum texto dentro da imagem.** Nome e frase ficam no HTML.
- **SVG é código, e passa por revisão como código:** sem `<script>`, `<foreignObject>`,
  referência externa ou metadado de editor; com `viewBox` e sem tamanho fixo. A auditoria de
  segurança de 14/09 conferiu os treze SVG: nenhum conteúdo ativo.
- **Cor pelo papel, não pela aparência.** `--color-brand` só na marca; o acento, as pedras dos
  estados e os materiais de raridade ficam fora da arte. Tom novo é token novo, medido nos dois
  temas.
- **Decorativa se cala** (`aria-hidden="true"` ou `alt=""`); informativa tem nome acessível.
- **Espaço reservado antes de carregar**, por `aspect-ratio` ou tamanho declarado.
- **Movimento abaixo de 400ms**, com caminho de movimento reduzido.
- **Peso:** ícones de 229 a 431 bytes; símbolos de 506 bytes e 1,2 KB; verso de 666 e 618
  bytes; ilustrações de 414 e 224 bytes. No raster, a carta deitada fica entre 7,6 e 19 KB, e a
  mesa, sem versão 2×, em 100 e 112 KB — dentro dos cerca de 120 KB pedidos para ela.
- **Cor gravada tem origem anotada:** o ícone da aba no `<head>` do `index.html`; o raster na
  §7.

## 5. Tamanhos: faixas, não pontos de quebra

Cada componente decide pela largura dele (`docs/design.md` §9), então cada peça tem uma faixa
de tamanho, e o desenho funciona na faixa inteira — com a fonte em 200% e em telas de densidade
2× e 3×.

| Peça | Quem define o tamanho | Faixa em CSS px | Com fonte em 200% |
|---|---|---|---|
| Símbolo no cabeçalho | `.app-brand` | 24 | 48 |
| Símbolo na entrada | cartão do formulário | 64 | 128 |
| Ícone da aba | aba do navegador | 16 e 32 | — |
| Verso na galeria | `.card-grid`, piso de 11rem | 176–367 de largura | 352–~735 |
| Verso na pré-visualização | `--sidebar-side: 8rem` | 128 | 256 |
| Miniatura no modal | `--sidebar-side: 4rem` | 64 | 128 |
| Ilustração de estado | `.state` | até 192; a gema da busca, 64 de altura | até 384; a gema, 128 |
| Ícones | 1em do texto ao lado | 14–16 | 28–32 |
| Tela de entrada | `.login-layout` | cartão de 384 (24rem); cartas deitadas de 224 (14rem), a partir de 1024 de layout | cartão de 768 |

**A galeria vira entre 399 e 400px de janela:** com 399 há uma coluna, e a carta tem 367px; com
400, duas colunas de 176px. A rede de geometria mede as duas larguras.

---

## 6. As peças

### P1 — Símbolo e logotipo

**Onde:** o link do cabeçalho e o topo do cartão de entrada. **Arquivos:**
`frontend/src/assets/brand/symbol.svg` e `symbol-sigil.svg`. **Tokens:** `--image-brand-mark`,
`--image-brand-mark-sigil`, pintados com `--color-brand`. **Componente:**
`shared/components/brand-mark.js`, um só para os dois lugares.

**A geometria**, na grade de 48 unidades:

| Parte | Valor |
|---|---|
| Carta central | 22 × 30, raio 3 — proporção 0,73, a da carta de TCG |
| Laterais | 86% da central, em contorno de 3 |
| Leque | ±18° em torno de um pivô só, no eixo e em y = 45 |
| Vão entre laterais e central | 2 |
| Gema (esmeralda, vista de cima) | octógono de 12 × 18, mesa de 4 × 8 e oito facetas, em traço de 1,4, vazada na carta central |

- **Duas versões, com o limite medido:** sem sigilo abaixo de 64px, com a gema de 64px em diante.
  A 48px as facetas se fundem; a 64px se leem nos dois temas.
- **A pequena cai inteira no pixel:** o conjunto está deslocado uma unidade, e a 24px a carta
  central ocupa onze colunas cheias, sem meio-tom nas bordas — medido no pixel.
- **Contraste:** 9,92:1 sobre a superfície no claro e 8,66:1 no escuro.
- **Alto contraste:** `LinkText` no cabeçalho, `CanvasText` fora dele.
- **Conferido na tela:** o cabeçalho nos três estados do botão de tema, e a entrada com o sigilo.
  A fonte em 200% vem da rede de geometria, que monta o cabeçalho.
- **Decidido pelo autor em 12/09:** a 16px, os cantos de baixo das laterais aparecem como dois
  pontos soltos sob a marca, e ficam — é a geometria aprovada.

### P2 — Ícone da aba

**Arquivos**, em `frontend/public/`:

| Arquivo | Para quem |
|---|---|
| `favicon.svg` (571 bytes) | Chrome, Edge e Firefox, em todo tamanho — grade de 16, que cai inteira no pixel a 16 e a 32px |
| `favicon.ico` (1,4 KB, com PNG de 16 e 32 dentro) | Navegador antigo e o pedido automático de `/favicon.ico`, que antes recebia o HTML da aplicação |
| `apple-touch-icon.png` (4,3 KB, 180px) | A tela inicial do iPhone, já com a gema |

- **Fundo próprio:** o quadrado da marca com o símbolo branco, a 9,92:1. A barra de abas é do
  navegador e não segue o tema do Oráculo, e um SVG que trocasse de cor precisaria de `<style>`,
  que a CSP recusa.
- **Desenhado à parte:** laterais de 92% e 24°, traço 1,2. Medido a 16px: 14 pixels das laterais
  passam de 60% de branco, contra 8 na versão fiel ao P1, que virava um halo lilás.
- **Cor gravada:** `#492c9b`, o `--color-brand` do tema claro. Se a marca mudar, os três
  arquivos se refazem; o SVG que origina o PNG do iOS está em `src/assets/brand/`.
- **Os `<link>` ficam fora do mapa de importação:** qualquer mudança nele troca o hash da CSP.
- **Conferido:** `/favicon.ico` responde `image/vnd.microsoft.icon`, o `.ico` foi lido entrada por
  entrada, e o autor viu o ícone nas abas dos navegadores.
- **Para refazer o PNG e o `.ico`:** fotografar o SVG num Chrome sem janela, em escala 1 e fundo
  transparente, e montar o `.ico` com os PNG de 16 e 32 dentro, sem reamostrar o de 16 a partir
  do de 32. Ao recolorir um SVG de máscara, trocar só as formas visíveis: o preto dentro da
  máscara é o que recorta a gema.

### P3 — Verso da carta

**Onde:** o espaço reservado da galeria, a pré-visualização vazia do formulário, a miniatura do
modal (P7) e a moldura do cartão de entrada (P4). **Arquivos:**
`frontend/src/assets/card-back/frame.svg` e `gem.svg`. **Componente:**
`features/cards/components/card-back.js`.

A moldura repete a lapidação esmeralda do logo — borda chanfrada, um degrau por dentro e facetas
nos quatro chanfros —, como se a carta inteira fosse uma pedra vista de cima. A gema fica acima,
e o nome embaixo, em área lisa.

| Camada | Token | Claro | Escuro | Medida |
|---|---|---|---|---|
| Fundo | `--color-bg` | `#f0eff5` | `#0f0f16` | — |
| Moldura e gema | `--color-line-art` | `#d1cfdf` | `#2b293f` | 1,34:1 e 1,36:1 sobre o fundo |
| Nome | `--color-muted` | `#67686b` | `#9aa0a8` | 4,87:1 e 7,24:1 |

- **Um token novo**, porque o papel "traço de arte" não existia: com os tokens de antes a linha
  dava 1,20 no claro e 1,57 no escuro, apagada num tema e marcada no outro. O acento suave ficou
  fora de propósito: ele significa seleção, e um verso violeta seria lido como carta selecionada.
- **A `/paleta` aprendeu a família:** todo token que começa com `--color-line` fica fora das
  tintas, com teste.
- **As camadas:** `::before` leva a moldura; `::after` leva a gema, a 34% da largura e centro a
  37% da altura; o texto fica por cima. Sem texto, por `:empty`, a gema vai ao centro e cresce
  para 40%.
- **A acessibilidade muda com o lugar:** na galeria o verso se apresenta (`role="img"`, "Sem
  imagem para …"); no modal ele cala, porque o título já nomeia a carta.
- **Alto contraste:** `GrayText`.
- **Conferido na tela:** a galeria nos dois temas e a pré-visualização vazia. A rede de geometria
  ganhou 399 e 400px na galeria.
- **Achado no caminho, em commit próprio:** a galeria e a paginação eram montadas do jeito errado
  na rede de geometria, que media uma caixa vazia desde 10/09. Os testes passavam sem verificar
  nada; corrigidos, passam de verdade.

### P4 — Tela de entrada

**Onde:** `pages/login/`. **Arquivos:** `frontend/src/assets/login/`, as imagens da §7.
**Tokens:** `--image-login-table` e `--image-login-card`, redefinidos nos três blocos de tema,
a carta com `image-set()` de 1× e 2×.

**A cena** (12/09) é feita em camadas, não numa imagem só:

- **A mesa** é o fundo do `.login-layout`, em `cover`: ela não precisa se alinhar a nada.
- **A carta em pé é o próprio cartão do formulário:** fundo `--color-surface`, a moldura do P3
  atrás em `--color-line-art` e a marca com o sigilo no topo. A gema solta do verso não entra — a
  marca está no lugar dela.
- **As duas cartas deitadas** são a mesma imagem, com 14rem de largura, a da direita espelhada
  (`scale: -1 1`), um pouco abaixo do cartão, "na mesa". Elas só aparecem quando cabem inteiras:
  `@container login (min-width: 64rem)`. Com o celular deitado, abaixo de 32rem de altura, saem
  para não empurrar o formulário para fora da tela.
- **A rede de geometria achou dois defeitos assim que a tela entrou nela:** a 320px com a fonte
  em 200% o cartão rachava o próprio título, corrigido com `padding: min(var(--space-5), 9%)`; e
  a moldura, pseudoelemento posicionado, pintava por cima do formulário, corrigido com
  `position: relative` nos filhos do cartão.
- **A moldura não estica:** o SVG mantém a proporção da carta e fica centrado no cartão, e o
  traço passa por baixo do texto. Medido no cartão real em 14/09 — a 1280px sobram 45px de cada
  lado —, e **aceito pelo autor** como está. Fatiar a moldura em nove funcionou, mas não tirava o
  traço de baixo do texto.

**A virada** (13/09):

- **Só depois da resposta do servidor.** Virar antes seria prometer uma entrada que o 401 ainda
  pode desmentir. Erro não vira a carta: a mensagem aparece, o e-mail fica, e a senha é limpa e
  recebe o foco.
- **Meia volta:** `data-state="turning"` no cartão dispara `leave-flip`, de 0 a 90° em
  `--duration-slow`, com perspectiva no palco. A 90° a carta está de perfil e some; a face que
  ela revela é a aplicação.
- **A página espera a animação terminar por `getAnimations()`**, não pelo evento: sem folha de
  estilo a lista vem vazia e a entrada acontece na hora, em vez de prender a pessoa esperando um
  evento que não vem. O formulário espera a virada inteira, e o botão não destrava no meio.
- **Duas curvas.** A virada usa `--ease-in-out`, token novo. Medido: com `--ease-out` a carta
  chegava a 80° — já invisível — com 51% do tempo, e sobravam 156ms de tela parada; com a curva
  simétrica, com 77%.
- **A aplicação entra por transição de opacidade**, que sobrevive ao movimento reduzido. A suíte
  pegou dois defeitos nela: declarar a transição junto com o estado invisível fazia a tela
  esmaecer **para** invisível; e, com movimento reduzido, a regra global do `tokens.css` pedia um
  `transition-property: none !important` no estado de chegada.
- **O foco vai para o conteúdo da tela que entrou.**
- **Conferido:** a cena congelada em 0, 35, 50, 70 e 80% da animação; a suíte verde também com
  movimento reduzido; o caminho do erro na tela; e, pelo autor, a virada com sessão e o arranjo
  largo numa janela grande.

### P5 — Ilustrações de estado

**Arquivos:** `frontend/src/assets/states/not-found.svg` (414 bytes) e `empty-catalog.svg`
(224 bytes). **Token de cor:** `--color-line-art-strong`.

| Estado | Desenho | Tamanho |
|---|---|---|
| Página não encontrada | O leque do logo com a carta do meio faltando, tracejada | `min(12rem, 100%)` |
| Catálogo vazio | Uma carta só, tracejada: o lugar da primeira carta | `min(12rem, 100%)` |
| Busca sem resultado | A gema do verso, sozinha e menor — o estado é frequente | 4rem de altura |

- **Um segundo tom de arte**, `#a9a6bd` no claro e `#474461` no escuro, a 2,07:1 e 2,06:1 sobre o
  fundo. O tom do verso foi calibrado para ficar atrás de texto; aqui a ilustração está sozinha e
  na frente, e naquele tom viraria fantasma no claro.
- **`empty()` ganhou a opção `image`**, com conjunto fechado: nome fora dele lança.
- **Alto contraste:** `GrayText`.
- **Conferido na tela, nos dois temas:** a página não encontrada e a busca sem resultado. O
  catálogo vazio, que exige o banco sem cartas, é coberto pela rede de geometria.

### P6 — Ícones

**Arquivos:** `frontend/src/assets/icons/` — `warning.svg`, `lock.svg`, `theme-system.svg`,
`theme-light.svg` e `theme-dark.svg`, de 229 a 431 bytes. **Tokens:** `--image-icon-*`.
**Componente:** `shared/components/icon.js`, com conjunto fechado.

- **Substituíram caracteres de fonte:** o cadeado saía emoji colorido, fora da paleta, e o sol, a
  lua e o meio círculo mudavam de desenho com o sistema operacional.
- **Uma família:** grade de 24, traço 2, pontas e junções redondas — as do logo —, com as formas
  universais. A identidade fica no traço.
- **A cor é a do texto ao lado**, pela máscara pintada com `currentColor`: vermelho no erro, tinta
  no botão, sem arquivo por cor.
- **Um caractere, não uma caixa flex:** `inline-block` de 1em e `vertical-align: -0.125em`, para
  o ícone ficar preso ao início de uma mensagem que quebra em duas linhas.
- **Conferido na tela:** o aviso vermelho em "Carta não encontrada" e os três desenhos do botão
  de tema. O botão de tema ganhou suíte própria, e um teste monta o ícone na página e lê o estilo
  computado — o único jeito de pegar um token com erro de digitação.

### P7 — Miniatura no modal de exclusão

**Onde:** o modal que pergunta se a carta vai embora. **Nenhum arquivo novo:** a imagem da
própria carta e, sem ela ou com falha, o verso do P3.

- **A miniatura fica à esquerda do texto**, pela primitiva `.sidebar` (4rem ao lado de um texto
  com piso de 14rem): a leitura vira título, carta, explicação. Numa tela estreita, a miniatura
  sobe para a linha de cima em vez de espremer a explicação.
- **4rem de largura, na proporção da carta**, com `object-fit: cover`: a proporção reserva o
  espaço, e o modal não salta com a imagem chegando.
- **O verso entra sem o nome**, com a gema ao centro, e `alt=""`: o título já nomeia a carta.
- **O conteúdo do modal virou função exportada** para entrar na rede de geometria; o modal em si
  prende a caixa ao `document.body`, e a largura dele vem da janela.
- **Conferido na tela:** com carta sem imagem e com arte real, abrindo pela galeria e pela
  tabela.

---

## 7. As imagens geradas

**As duas únicas imagens raster da interface foram geradas com o Gemini**, a partir dos pedidos
abaixo. Todo o resto — a marca, o ícone da aba, o verso, os ícones e as ilustrações — é SVG
escrito como código.

### O que foi entregue

| Arquivo | Dimensão | Alfa | Peso |
|---|---|---|---|
| `table-light.webp` | 1920 × 1080 | não | 112 KB |
| `table-dark.webp` | 1920 × 1080 | não | 100 KB |
| `card-light.webp` · `card-light@2x.webp` | 480 × 360 · 960 × 720 | sim | 8,9 KB · 19 KB |
| `card-dark.webp` · `card-dark@2x.webp` | 480 × 360 · 960 × 720 | sim | 7,6 KB · 13,7 KB |

**A mesa não tem versão 2×:** ela é desfocada de propósito, e o desfoque esconde a ampliação.

**Por que em camadas, e não uma cena única:** uma imagem com as cartas desenhadas poria as
cartas embaixo do formulário com a fonte em 200%. Com a mesa sozinha e a carta com fundo
transparente, o CSS posiciona, espelha e tira as cartas conforme o espaço.

### Os pedidos

Anexados a eles foram o desenho do verso em traço preto e dois esboços da composição, um por
tema, fotografados a partir dos SVG do P3. Esses anexos ficaram numa pasta local, fora do Git.

**A mesa**, uma por tema. Só o tampo, visto por quem está sentado; o tecido ocupa o quadro
inteiro, sem borda de mesa nem horizonte, para o recorte de `cover` não cortar nada que importe.
As bordas terminam na cor de fundo da aplicação, que entra por esmaecimento depois da virada.

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

**A carta deitada**, uma por tema. Uma carta de costas, na mesma perspectiva da mesa, do lado
esquerdo da cena, girada cerca de 14° no plano da mesa — o leque do logo. O CSS espelha para
fazer a da direita, por isso nada assimétrico no desenho.

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

### O que foi conferido ao receber

A primeira entrega veio com dois problemas, e foi pedida de novo com as correções:

- **O traço da carta clara tinha perdido o violeta:** o azul passava o vermelho por 2 pontos, e
  a linha lia cinza. Na versão final, passa por 14.
- **A face da carta escura sumia na mesa:** 6 pontos de luminância acima dela. Na versão final,
  47 contra 27 — 20 pontos de separação.

E, na versão final, medido no pixel: nenhum halo no canal alfa, a mesma pose nos dois temas, e a
proporção da carta a 0,714, contra 0,716 de uma carta real.

### Se for preciso refazer

A cor está gravada nos arquivos: se a paleta mudar, as quatro imagens de carta e as duas mesas
precisam ser geradas de novo, com os valores novos nos pedidos. Os nomes dos arquivos são os que
os tokens esperam.

---

## 8. Fora, e por quê

- **Logo dos jogos:** propriedade de terceiros, e o Oráculo é de todos os jogos.
- **Fundo ilustrado nas telas de trabalho:** disputaria com a arte das cartas; o escuro já tem
  croma baixo por esse motivo (`design.md` §2).
- **Foto em "Minha conta":** o sistema não tem foto de usuário.
- **Imagem no carregamento inicial:** dura uma fração de segundo.
- **Falha de boot:** continua sem depender de nada, de propósito.
- **Os tokens `--image-*` na `/paleta`:** ela lê cores, raios e sombras; mostrar as imagens nos
  dois temas lado a lado ficou como ideia.

## 9. A verificação de cada peça

- [x] Nenhum valor visual fora do `tokens.css`, endereço de imagem incluído.
- [x] Os dois temas conferidos na tela, pelo sistema e pelo botão.
- [x] As larguras que cruzam a faixa da peça (§5), com a fonte em 200% — pela rede de geometria,
      e na tela onde a peça pedia.
- [x] Console sem violação de CSP.
- [x] Movimento reduzido — a suíte roda verde nos dois modos.
- [ ] Alto contraste do Windows — não conferido, por decisão do autor.
- [x] Rede de geometria atualizada quando a peça muda uma tela.
- [x] `docs/design.md` atualizado no mesmo commit, com os tokens novos e o contraste medido.
- [x] Um commit por peça — o P4 em dois, a cena e a virada.
