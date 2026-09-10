# Design — Oráculo

Registro do sistema visual: as escalas, os papéis de cor, **a medição de contraste**
exigida pelo RNF-05 e os arranjos de layout. A fonte da verdade é `frontend/src/styles/tokens.css`; este documento
explica as decisões e guarda os números.

> **Por que a medição vem antes do primeiro componente.** O PRD §11 lista "contraste do tema
> escuro reprovar" como risco de probabilidade média e impacto médio, com a mitigação escrita
> assim: *"tokens medidos antes do primeiro componente, não depois"*. Corrigir contraste
> depois de cinco telas prontas não é ajustar uma variável — é reabrir cada decisão que foi
> tomada em cima da cor errada.

---

## 1. Método

Contraste calculado pela fórmula de luminância relativa da WCAG 2.1, com piso de **4,5:1**
para todo texto (nível AA, texto normal), **nos dois temas**.

Cada tinta é medida contra **todas** as superfícies em que ela pode aparecer — fundo,
superfície de cartão e, no caso dos estados, o preenchimento suave da própria etiqueta. Medir
só contra a superfície fácil é como a paleta de referência passou despercebida: no tema claro
o branco é mais generoso que o cinza do fundo, e no tema escuro a superfície do cartão é mais
clara que o fundo. **A superfície difícil é sempre a outra.**

---

## 2. De onde vem a paleta

A primeira paleta partiu do Anexo D do `frontend/PADROES-ENGENHARIA.md` — a história está no
Git. Em 10/09/2026 ela foi trocada pela do **molde novo da Liga**, o da LigaPokemon, lida do
próprio site: cor computada no DOM, com a extensão do Chrome, e não estimada de captura de
tela.

O motivo é de produto. Os portais da Liga trocam a cor da marca por jogo — laranja na Magic,
roxo na YuGiOh, vermelho na Pokemon — e compartilham o resto: neutros, texto, verde de ação,
vocabulário de componente. O Oráculo gerencia **todos** os jogos (PRD §1.1: o jogo é o
tenant), então veste o que é compartilhado, não a cor de um jogo só. Entre os dois moldes
que a Liga usa hoje, o autor escolheu o novo.

Medido par a par, o site reprova em três dos tons que usa como texto:

| Par no site                                   | Medido | O que foi feito                                  |
| --------------------------------------------- | ------ | ------------------------------------------------ |
| Branco sobre o vermelho da marca `#ef4036`    | 3,85:1 | Não entrou: a marca é violeta (item 2)           |
| Azul do interativo `#0085ff` sobre branco     | 3,62:1 | Fechado para `#0062cc`, e dado ao informativo    |
| Metadado `#797a7b` sobre o fundo `#f0f0f2`    | 3,78:1 | Metadado fechado para `#67686b` — 4,90:1         |

O que mais mudou, e por quê:

**1. A ação saiu do vermelho e ficou violeta.** O acento antigo era um vermelho-terracota
(`#bf3520`) quase igual ao de perigo (`#b91c1c`): "Nova carta" e "Excluir" disputavam o
mesmo sinal. A primeira versão seguiu o azul interativo do molde, e o azul caiu no matiz dos
azuis-padrão de biblioteca — 257° em OKLCH, contra 263° do Tailwind e 260° do Bootstrap. O
autor pediu identidade própria, e o azul foi girado para **290°**, violeta, com a mesma
luminosidade e o mesmo croma: o contraste até melhora (branco a 6,11:1).

Violeta e índigo são a cor do oráculo, da adivinhação, da ametista — a escolha vem do nome
do produto, não de um padrão. A faixa saiu por exclusão: 270–280° é o "blurple" que virou
padrão de SaaS, e acima de 310° o Oráculo leria como a LigaYuGiOh (317°), quando ele
gerencia todos os jogos.

**2. A marca é violeta, e vive num lugar só.** `--color-brand` é o violeta da ação, mais
profundo (`#492c9b`, 9,92:1 no cabeçalho branco), e só o logotipo "Oráculo" o usa. A
primeira versão trouxe o vermelho do logotipo da LigaPokemon; no escuro ele ficava a um passo
do vermelho de perigo. Com a marca no violeta, vermelho na tela quer dizer uma coisa só.

**3. O informativo ficou com o azul.** A ação em violeta deixou o azul livre, e azul para
informação é a convenção mais comum. Ele já estava medido: é o `#0062cc` que a ação usou na
primeira versão.

**4. Neutros com névoa violeta, texto neutro.** Página `#f0eff5`, superfície branca, linha
`#dcdbe1`: o cinza do molde, com o matiz da ação e croma quase nulo — não se lê como cor,
lê-se como parte do mesmo lugar. O texto corrente `#4a4a4a` é o mesmo em todos os portais da
Liga. O creme e o texto amarronzado da paleta anterior saíram — eram, além de tudo, o
primeiro item da lista de clichês de design gerado que a revisão consultou.

**5. O escuro é noite, composta e não invertida.** Fundo índigo muito escuro (`#0f0f16`) em
vez de cinza, tinta clareada, e cada par medido de novo. O croma fica baixo de propósito: o
conteúdo da tela é arte de carta, e um entorno muito tingido mudaria a cor que o olho
percebe nas imagens.

**6. A sombra do que flutua ganhou três camadas**, como no molde: uma curta e marcada junto
da borda, duas longas e fracas. A cor é um violeta quase preto em vez de preto puro, e no
escuro a camada longa vira uma aura violeta fraca — é o que faz o modal existir sobre a
noite. Continua valendo só para o que flutua (§10.4).

**7. Os estados são as pedras do oráculo.** Rubi para perigo, topázio para atenção, jade
para sucesso, safira para informação — e ametista, a ação. Nenhum sai da convenção
(vermelho, âmbar, verde, azul); o que muda é o tom. A atenção deixou o marrom-alaranjado por
um dourado (`#915b00`), o complementar do violeta, e o sucesso deixou o verde de "menor
preço" da Liga por um jade (`#0b7643`). No escuro, sucesso e atenção desceram para a mesma
luminosidade dos outros estados — L 0,75 em OKLCH, contra 0,82 e 0,84 antes —, e nenhum
grita mais que os outros.

**O que não entrou:** a Roboto do site — a fonte continua a do sistema (RNF-01, ADR-001); a
sombra do cabeçalho, que no site existe com o cabeçalho parado e aqui contrariaria o §10.4; e
as cores de preço, porque o Oráculo não tem preço.

### O que a primeira paleta ensinou, e continua valendo

**Superfície e tinta são papéis diferentes.** O coral do Anexo D (`#f1543f`) servia de
preenchimento de botão e de cor de texto ao mesmo tempo, e reprovava nas duas — 3,45:1 com
branco em cima. Todo acento precisa servir aos dois papéis, e é medido nos dois.

**Branco não é tinta.** É o erro que o §10.2 descreve: *"quando a superfície clareia no tema
escuro, o branco reprova no contraste"*. No escuro, a superfície de acento clareia para
`#a290fa`, e branco em cima dela cai para **2,66:1**. A tinta troca junto com a superfície:
`--color-on-accent` é `#ffffff` no claro e `#110f1e` no escuro, a 7,12:1.

**Estado se redefine por tema.** O Anexo D declarava os quatro estados uma vez só, e cada um
reprovava em um dos temas. Todo estado tem valor próprio nos dois temas, mais um
preenchimento suave medido com a própria tinta em cima.

---

## 3. Contraste medido

48 pares. **Piso 4,5:1. Pior par: 4,75:1** — informativo sobre informativo suave, no tema claro.

**Componentes, a 3:1** (WCAG 1.4.11), no pior caso entre fundo e superfície: anel de foco a 5,35:1 no claro e 9,08:1 no escuro; borda de campo a 3,46:1 no claro e 3,73:1 no escuro. A linha decorativa não entra: não identifica controle nenhum.

> **A tela `/paleta` mede estes mesmos pares ao vivo.** Ela lê o `tokens.css` que o navegador
> carregou, mostra os dois temas lado a lado e calcula cada razão pela fórmula da WCAG — mais
> os dois pares do anel de foco, que pedem 3:1 e não 4,5. Fica fora do menu: é ferramenta
> para avaliar uma mudança de paleta, e se chega a ela pelo endereço. A tabela abaixo continua
> sendo o **registro**, e muda no mesmo commit que muda a cor.

### Tema claro

| Papel                | Tinta     | Sobre                       | Medido      |
| -------------------- | --------- | --------------------------- | ----------- |
| Texto primário       | `#1b1c1c` | fundo `#f0eff5`             | **14,94:1** |
| Texto primário       | `#1b1c1c` | superfície `#ffffff`        | **17,08:1** |
| Texto corrente       | `#4a4a4a` | fundo `#f0eff5`             | **7,75:1**  |
| Texto corrente       | `#4a4a4a` | superfície `#ffffff`        | **8,86:1**  |
| Metadado             | `#67686b` | fundo `#f0eff5`             | **4,87:1**  |
| Metadado             | `#67686b` | superfície `#ffffff`        | **5,57:1**  |
| Marca (logotipo)     | `#492c9b` | fundo `#f0eff5`             | **8,68:1**  |
| Marca (logotipo)     | `#492c9b` | superfície `#ffffff`        | **9,92:1**  |
| Acento como texto    | `#6a4bc6` | fundo `#f0eff5`             | **5,35:1**  |
| Acento como texto    | `#6a4bc6` | superfície `#ffffff`        | **6,11:1**  |
| Tinta sobre o acento | `#ffffff` | acento `#6a4bc6`            | **6,11:1**  |
| Sucesso              | `#0b7643` | fundo `#f0eff5`             | **4,98:1**  |
| Sucesso              | `#0b7643` | superfície `#ffffff`        | **5,70:1**  |
| Sucesso              | `#0b7643` | sucesso suave `#ddf6e4`     | **4,98:1**  |
| Atenção              | `#915b00` | fundo `#f0eff5`             | **4,96:1**  |
| Atenção              | `#915b00` | superfície `#ffffff`        | **5,68:1**  |
| Atenção              | `#915b00` | atenção suave `#ffebd5`     | **4,89:1**  |
| Perigo               | `#c30010` | fundo `#f0eff5`             | **5,52:1**  |
| Perigo               | `#c30010` | superfície `#ffffff`        | **6,31:1**  |
| Perigo               | `#c30010` | perigo suave `#fde7e7`      | **5,34:1**  |
| Informativo          | `#0062cc` | fundo `#f0eff5`             | **5,08:1**  |
| Informativo          | `#0062cc` | superfície `#ffffff`        | **5,80:1**  |
| Informativo          | `#0062cc` | informativo suave `#ddeaf6` | **4,75:1**  |
| Acento em etiqueta   | `#6a4bc6` | acento suave `#e7e6f6`      | **4,96:1**  |

### Tema escuro

| Papel                | Tinta     | Sobre                       | Medido      |
| -------------------- | --------- | --------------------------- | ----------- |
| Texto primário       | `#eef0f3` | fundo `#0f0f16`             | **16,72:1** |
| Texto primário       | `#eef0f3` | superfície `#191920`        | **15,31:1** |
| Texto corrente       | `#c5c9cf` | fundo `#0f0f16`             | **11,48:1** |
| Texto corrente       | `#c5c9cf` | superfície `#191920`        | **10,51:1** |
| Metadado             | `#9aa0a8` | fundo `#0f0f16`             | **7,24:1**  |
| Metadado             | `#9aa0a8` | superfície `#191920`        | **6,63:1**  |
| Marca (logotipo)     | `#bab3ff` | fundo `#0f0f16`             | **9,98:1**  |
| Marca (logotipo)     | `#bab3ff` | superfície `#191920`        | **9,14:1**  |
| Acento como texto    | `#a290fa` | fundo `#0f0f16`             | **7,19:1**  |
| Acento como texto    | `#a290fa` | superfície `#191920`        | **6,58:1**  |
| Tinta sobre o acento | `#110f1e` | acento `#a290fa`            | **7,12:1**  |
| Sucesso              | `#42cb80` | fundo `#0f0f16`             | **9,17:1**  |
| Sucesso              | `#42cb80` | superfície `#191920`        | **8,40:1**  |
| Sucesso              | `#42cb80` | sucesso suave `#082313`     | **8,00:1**  |
| Atenção              | `#d9a514` | fundo `#0f0f16`             | **8,49:1**  |
| Atenção              | `#d9a514` | superfície `#191920`        | **7,78:1**  |
| Atenção              | `#d9a514` | atenção suave `#2a1903`     | **7,54:1**  |
| Perigo               | `#ff6b6b` | fundo `#0f0f16`             | **6,88:1**  |
| Perigo               | `#ff6b6b` | superfície `#191920`        | **6,30:1**  |
| Perigo               | `#ff6b6b` | perigo suave `#2d1616`      | **6,11:1**  |
| Informativo          | `#5ea4ff` | fundo `#0f0f16`             | **7,48:1**  |
| Informativo          | `#5ea4ff` | superfície `#191920`        | **6,85:1**  |
| Informativo          | `#5ea4ff` | informativo suave `#132437` | **6,16:1**  |
| Acento em etiqueta   | `#a290fa` | acento suave `#231f36`      | **5,99:1**  |

---

## 4. Papéis de cor

Cada matiz tem um significado registrado e **não é reaproveitado fora dele**. Usar verde
"porque ficou bonito" quebra a leitura de quem já aprendeu o código.

| Token               | Papel                                                       |
| ------------------- | ----------------------------------------------------------- |
| `--color-bg`        | O fundo da página                                           |
| `--color-surface`   | Cartão, painel, modal — o que se levanta do fundo           |
| `--color-ink`       | Texto primário: título, nome de carta                       |
| `--color-body`      | Texto corrente                                              |
| `--color-muted`     | Metadado: data, contagem, rótulo secundário                 |
| `--color-line`      | Linha decorativa: divisória, borda de cartão e de tabela    |
| `--color-border`    | Borda de campo — o limite que identifica o controle, a 3:1  |
| `--color-brand`     | A marca. Só o logotipo "Oráculo" — em nenhum outro lugar    |
| `--color-accent`    | **A voz única de ação**, em violeta. Uma ação primária por contexto |
| `--color-on-accent` | A tinta que vai sobre o acento. Troca de tema junto com ele |
| `--color-success`   | Operação concluída                                          |
| `--color-attention` | Aviso que não impede — duplicidade de nome (RN-04)          |
| `--color-danger`    | Exclusão e erro que bloqueia                                |
| `--color-info`      | Informação neutra — o azul que a ação deixou livre          |
| `--color-focus`     | O anel de foco                                              |

**A cor de acento ocupa no máximo ~10% da tela.** Se duas coisas clicáveis estão com a cor de
acento na mesma tela, uma está errada — a raridade é o mecanismo que faz o usuário saber onde
apertar sem ler.

**A seleção leva o violeta suave.** O item atual do menu e a opção ativa do alternador usam
`--color-accent-soft`, com o texto primário por cima (13,87:1 no claro, 13,93:1 no escuro):
é a cor do produto marcando onde a pessoa está. O suave não conta para os ~10% do acento —
ele não chama para a ação, só situa.

**A regra dos dois sinais.** Nenhum estado depende só de cor: sempre cor **mais** rótulo,
ícone ou forma. Cor sozinha exclui daltônicos, morre em impressão e some sob sol forte. É por
isso que `.badge` no `utilities.css` sempre carrega texto.

---

## 5. Escalas fechadas

Não se inventa valor intermediário. Se a escala não atende, a discussão é sobre mudar a
escala — não sobre um valor arbitrário naquele componente.

**Tipografia** — 12 · 13 · 14 · 16 · 18 · 25px. O piso de 12px é absoluto (§9.5).
Nenhum tamanho é fixado no `<html>`, para que o rem respeite a configuração do navegador e o
zoom de 200% funcione sem perda de conteúdo.

**Espaço** — 4 · 8 · 12 · 16 · 24 · 32px.

**Raio** — 4px · 8px · pílula.

**Profundidade** — vem de tom e borda. Sombra é reservada ao que flutua de verdade: modal,
popover, menu. **Cartão em repouso não tem sombra.**

**Movimento** — 120 · 200 · 320ms, com `cubic-bezier(0.2, 0, 0, 1)`. Nada acima de 400ms,
exceto indicador de progresso.

---

## 6. Tema: como a troca funciona

Três estados, e o padrão não é "claro" — é **acompanhar o sistema**.

| Preferência       | `data-theme` no `<html>` | Quem decide                                          |
| ----------------- | ------------------------ | ---------------------------------------------------- |
| `system` (padrão) | ausente                  | A media query `prefers-color-scheme`, sem JavaScript |
| `light`           | `"light"`                | O usuário, vencendo o sistema                        |
| `dark`            | `"dark"`                 | O usuário, vencendo o sistema                        |

`system` **remove** o atributo em vez de escrever um valor. Escrever `data-theme="system"`
deixaria as duas regras do CSS sem efeito e travaria a página no tema claro.

**Sobre a piscada de tema.** Quem nunca escolheu não vê nenhuma: o CSS resolve o padrão
sozinho, antes de qualquer script rodar. Só quem escolheu explicitamente um tema diferente do
sistema pode ver um quadro com o tema anterior, porque o atributo é escrito por um módulo ES,
que é adiado por natureza. A alternativa seria um script inline no `<head>`, e a
Content-Security-Policy sem `unsafe-inline` (RNF-08) o recusa. **A piscada de um quadro para
uma minoria é o preço da CSP** — e é uma troca deliberada, não um esquecimento.

---

## 7. Movimento reduzido

`prefers-reduced-motion: reduce` pede **menos movimento, não menos informação**.

Mudança de cor, opacidade e sombra **não é movimento**: é o retorno que confirma o clique.
Matá-la trocaria um problema de acessibilidade por outro. O que se desliga é deslocamento,
escala e altura.

Dois detalhes que parecem preciosismo e não são:

- `animation-duration: 1ms`, nunca `0`. O evento de fim de animação ainda dispara, então quem
  espera por ele não trava.
- Toda animação termina em estado **visível**. Uma que termina oculta desapareceria de vez
  quando o movimento fosse desligado.

---

## 8. Quando um token novo entra

1. Ele tem um papel semântico que nenhum token existente cobre? Se não, use o que existe.
2. É cor de texto? **Meça** contra fundo, superfície e qualquer preenchimento em que apareça,
   **nos dois temas**, antes de escrever a primeira regra que o consome. A tela `/paleta` faz a
   conta sozinha para todo token que siga a convenção de nome (`-soft`, `on-`, `surface`).
3. Existe nos dois temas? Todo token de cor existe nos dois ou não existe.
4. A tabela da §3 é atualizada no **mesmo commit** que introduz o token.

---

## 9. Layout: primitivas, não pontos de quebra

**Nenhuma regra de `components.css` pergunta a largura da janela.** Uma `@media` mede o
viewport, e componente nenhum deste portal ocupa o viewport: o formulário vive numa coluna de
40rem, os cartões da conta dividem a página, o painel de catálogo divide isso de novo. Quando
a regra pergunta uma largura e o componente tem outra, a resposta certa chega no lugar
errado. Foi o OF-004: a grade de duas colunas do campo de imagem entrava pela largura da
janela dentro de um formulário estreito, e a coluna dos controles ficou com um caractere.

A pergunta que se fazia era se não seria melhor fixar tamanhos por componente, por tela, por
ponto de quebra. Não é, e o próprio defeito mostra por quê: a pré-visualização **tinha**
tamanho fixo, obedeceu a ele, e o layout quebrou do mesmo jeito — quem errou foi a trilha da
grade ao redor dela. A matriz "componente × tela" também cresce combinatoriamente e quebra sob
o que não é viewport: fonte do navegador, zoom, conteúdo longo.

### As quatro primitivas (`utilities.css`)

| Primitiva | O que resolve | Onde |
|---|---|---|
| `.stack` | Espaço vertical entre irmãos | Formulários, cartões, páginas |
| `.cluster` | Linha de itens que **quebra** quando não cabe | Cabeçalho, barras de ação, paginação, linhas de catálogo e de histórico, avisos |
| `.sidebar` | Conteúdo flexível + barra de largura fixa que desce quando o conteúdo não alcança o mínimo | Campo de imagem |
| `.switcher` | Colunas que viram pilha abaixo de um limiar — sem media query | Conta, painéis de catálogo |

A família vem do *Every Layout* (Heydon Pickering e Andy Bell). Cada primitiva decide pelo
espaço que **ela** tem — `flex-wrap` nas linhas, `flex-basis` calculado nas colunas — e é
ajustada por custom property declarada na regra do componente (`--cluster-gap`,
`--sidebar-side`, `--switcher-threshold`), não por variante nova. O componente compõe a
primitiva na lista de classes, como já fazia com `.stack` e `.scroll-x`:
`["cluster", "cluster-end", "form-actions"]`.

`flex-wrap: wrap` morar no `.cluster` é a parte que mais importa: com a fonte em 200%, uma
linha sem quebra desenhava "Sair" como "S / ai / r". Com a quebra na primitiva, a próxima
barra que alguém escrever não tem como esquecê-la.

### Quando o componente precisa perguntar a própria largura

Uma primitiva não consegue mudar a grade **dos filhos** de um componente pela largura dele.
Para isso existe `@container`, que é CSS nativo e não esbarra no ADR-001. Há um caso, a barra
de filtros: a busca vale por dois campos quando a barra passa de 48rem. Como `@media`, com a
janela larga e a barra estreita, a regra pedia duas trilhas a uma grade que o `auto-fit` tinha
resolvido com uma, e a segunda nascia implícita, larga, empurrando a barra para fora do
contêiner. Hoje a barra ocupa a página e o caso não aparecia — mas a regra estava certa só
por acidente de onde o componente mora.

`container-type: inline-size` contém só o eixo horizontal, então a altura continua vindo do
conteúdo. E contenção de layout torna o contêiner o bloco de referência de quem tem
`position: fixed` dentro dele — por isso ela fica na barra, e não no `<main>`: o modal e os
avisos são fixos e precisam medir contra a janela.

### O piso de min-content

- **`1fr` é `minmax(auto, 1fr)`**, e esse `auto` é o min-content do item: a trilha se recusa a
  ficar menor que a maior palavra. Trilha que precisa encolher declara `minmax(0, 1fr)`.
- **Item de flex nasce com `min-width: auto`.** Quem cresce com `flex: 1` e mostra texto de
  fora declara `min-width: 0` (`.notification-text`).
- **Piso em `rem` vira `min(…, 100%)`.** `9rem` são 288px com a fonte em 200%; numa coluna
  de 320px, dentro do cartão do histórico, isso passava 43px da borda e o excedente era
  cortado (`.history-field`). O `min()` deixa o piso ceder quando o contêiner é menor que ele.

### `overflow-wrap: anywhere` tem escopo

Ele já foi global, no `body`, e resolvia o e-mail que passava da tela a 200%. O preço:
`anywhere` zera a contribuição de min-content de **todo** texto que o herda, e essa
contribuição é justamente a proteção do navegador contra o colapso de coluna. Com ela zerada
na página inteira, o mínimo de qualquer coluna era um caractere — e foi assim que o OF-004
virou "uma letra por linha" em vez de "coluna estreita".

Agora ele vale só no texto que pode chegar sem espaço onde quebrar: nome de carta e de edição,
código de catálogo, mensagem com nome de arquivo, valor do histórico, e-mail. A lista está no
topo de `components.css`; quem não tem classe própria usa `.wrap-anywhere`.

### A rede de geometria

`frontend/tests/support/layout.js` monta as telas numa caixa de largura conhecida e **mede**,
com três invariantes: nada passa da borda do contêiner; toda palavra cabe inteira na caixa
que a mostra, salvo onde a quebra foi pedida; nada é cortado por uma caixa que esconde o
excedente. As nove larguras **cercam** cada ponto de quebra por fora e por dentro — medir só
as extremas foi o que deixou o OF-004 passar — e cada uma roda também com a fonte da raiz
dobrada.

Duas coisas que a rede não faz, registradas para ninguém confiar nela além da conta:

- **Dobrar a raiz por script não dobra a `@media`.** `rem` numa media query é resolvido contra
  o valor inicial, não contra o que a folha declarou. O teste fica mais severo que a
  realidade — conteúdo dobrado, fronteira parada —, mas não substitui a verificação em tela
  com a fonte do navegador em 200%.
- **A rede é testada, porque asserção que não falha não protege.** A primeira versão da
  terceira invariante comparava `scrollWidth` com `clientWidth` num elemento de overflow
  visível, e por especificação os dois saem iguais; a da palavra inteira pulava a página
  toda enquanto `anywhere` era herdado do `body`. As duas só foram descobertas porque cada
  invariante é provada contra um caso sabidamente ruim.

### Quando um arranjo novo entra

1. Uma das quatro primitivas resolve? Componha-a. Arranjo novo é exceção que se justifica.
2. O componente precisa mudar os próprios filhos pela própria largura? `@container` nele — e
   nunca num ancestral que tenha `position: fixed` dentro.
3. `@media (min-width…)` em `components.css` é reprovação. As que existem no projeto são de
   preferência do usuário — tema, movimento, ponteiro —, não de largura.
4. A tela nova entra em `layout-geometry.test.js`, e o teste **afirma** que o estado medido é o
   estado com dado, não o de carregamento.
