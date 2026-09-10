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
o branco é mais generoso que o creme do fundo, e no tema escuro a superfície do cartão é mais
clara que o fundo. **A superfície difícil é sempre a outra.**

---

## 2. O que mudou em relação à paleta de referência

O Anexo D do `frontend/PADROES-ENGENHARIA.md` foi o ponto de partida. Medido par a par,
**reprovou em seis**:

| Par                                | Medido | Problema                                         |
| ---------------------------------- | ------ | ------------------------------------------------ |
| Branco sobre o acento `#f1543f`    | 3,45:1 | O coral é claro demais para receber tinta branca |
| Acento como texto, tema claro      | 3,07:1 | Mesmo tom, agora como tinta sobre o creme        |
| Sucesso `#16a34a`, tema claro      | 3,30:1 | Verde de etiqueta usado como texto               |
| Atenção `#ca8a04`, tema claro      | 2,94:1 | O pior de todos — âmbar sobre branco             |
| Perigo `#dc2626`, tema escuro      | 3,57:1 | Vermelho não redefinido para o tema escuro       |
| Informativo `#2563eb`, tema escuro | 3,33:1 | Azul não redefinido para o tema escuro           |

As três causas, e o que foi feito:

**1. Superfície e tinta tratadas como a mesma coisa.** `#f1543f` servia ao mesmo tempo de
preenchimento de botão e de cor de texto. São papéis diferentes com exigências opostas: como
superfície precisa ser escura o bastante para aceitar tinta clara; como texto precisa ser
escura o bastante para se destacar do fundo claro. O acento foi fechado para `#bf3520`, que
faz as duas coisas — aceita branco a 5,61:1 e passa como texto a 4,99:1.

**2. Branco fixo como tinta.** É o caso que o §10.2 descreve textualmente: *"quando a
superfície clareia no tema escuro, o branco reprova no contraste"*. No tema escuro a
superfície de acento clareia para `#f4705e`, e branco em cima dela cai para **2,87:1**. A
correção é a que o padrão manda: **a tinta troca junto com a superfície**. `--color-on-accent`
é `#ffffff` no tema claro e `#14100e` no escuro.

**3. Cores de estado não redefinidas por tema.** O Anexo D declara os quatro estados só uma
vez. Verde e âmbar reprovavam no tema claro; vermelho e azul, no escuro. Cada estado passou a
ter valor próprio nos dois temas, mais um preenchimento suave medido com a própria tinta em
cima.

---

## 3. Contraste medido

44 pares. **Piso 4,5:1. Pior par: 4,71:1.**

### Tema claro

| Papel                | Tinta     | Sobre                       | Medido      |
| -------------------- | --------- | --------------------------- | ----------- |
| Texto primário       | `#26201e` | fundo `#f6f1ea`             | **14,29:1** |
| Texto primário       | `#26201e` | superfície `#ffffff`        | **16,06:1** |
| Texto corrente       | `#5c504a` | fundo `#f6f1ea`             | **6,92:1**  |
| Texto corrente       | `#5c504a` | superfície `#ffffff`        | **7,77:1**  |
| Metadado             | `#6d5d52` | fundo `#f6f1ea`             | **5,60:1**  |
| Metadado             | `#6d5d52` | superfície `#ffffff`        | **6,29:1**  |
| Acento como texto    | `#bf3520` | fundo `#f6f1ea`             | **4,99:1**  |
| Acento como texto    | `#bf3520` | superfície `#ffffff`        | **5,61:1**  |
| Tinta sobre o acento | `#ffffff` | acento `#bf3520`            | **5,61:1**  |
| Sucesso              | `#166534` | fundo `#f6f1ea`             | **6,35:1**  |
| Sucesso              | `#166534` | superfície `#ffffff`        | **7,13:1**  |
| Sucesso              | `#166534` | sucesso suave `#e3f2e7`     | **6,15:1**  |
| Atenção              | `#854d0e` | fundo `#f6f1ea`             | **6,10:1**  |
| Atenção              | `#854d0e` | superfície `#ffffff`        | **6,85:1**  |
| Atenção              | `#854d0e` | atenção suave `#f7eddb`     | **5,90:1**  |
| Perigo               | `#b91c1c` | fundo `#f6f1ea`             | **5,76:1**  |
| Perigo               | `#b91c1c` | superfície `#ffffff`        | **6,47:1**  |
| Perigo               | `#b91c1c` | perigo suave `#fbe6e6`      | **5,41:1**  |
| Informativo          | `#1d4ed8` | fundo `#f6f1ea`             | **5,96:1**  |
| Informativo          | `#1d4ed8` | superfície `#ffffff`        | **6,70:1**  |
| Informativo          | `#1d4ed8` | informativo suave `#e4eafb` | **5,57:1**  |
| Acento em etiqueta   | `#bf3520` | acento suave `#fbe7e2`      | **4,71:1**  |

### Tema escuro

| Papel                | Tinta     | Sobre                       | Medido      |
| -------------------- | --------- | --------------------------- | ----------- |
| Texto primário       | `#f3ece4` | fundo `#14100e`             | **16,15:1** |
| Texto primário       | `#f3ece4` | superfície `#1f1a17`        | **14,72:1** |
| Texto corrente       | `#c9bdb2` | fundo `#14100e`             | **10,27:1** |
| Texto corrente       | `#c9bdb2` | superfície `#1f1a17`        | **9,36:1**  |
| Metadado             | `#9e9189` | fundo `#14100e`             | **6,18:1**  |
| Metadado             | `#9e9189` | superfície `#1f1a17`        | **5,63:1**  |
| Acento como texto    | `#f4705e` | fundo `#14100e`             | **6,60:1**  |
| Acento como texto    | `#f4705e` | superfície `#1f1a17`        | **6,01:1**  |
| Tinta sobre o acento | `#14100e` | acento `#f4705e`            | **6,60:1**  |
| Sucesso              | `#4ade80` | fundo `#14100e`             | **10,86:1** |
| Sucesso              | `#4ade80` | superfície `#1f1a17`        | **9,89:1**  |
| Sucesso              | `#4ade80` | sucesso suave `#12251a`     | **9,23:1**  |
| Atenção              | `#fbbf24` | fundo `#14100e`             | **11,33:1** |
| Atenção              | `#fbbf24` | superfície `#1f1a17`        | **10,32:1** |
| Atenção              | `#fbbf24` | atenção suave `#2a2009`     | **9,61:1**  |
| Perigo               | `#f87171` | fundo `#14100e`             | **6,84:1**  |
| Perigo               | `#f87171` | superfície `#1f1a17`        | **6,23:1**  |
| Perigo               | `#f87171` | perigo suave `#2b1414`      | **6,26:1**  |
| Informativo          | `#60a5fa` | fundo `#14100e`             | **7,44:1**  |
| Informativo          | `#60a5fa` | superfície `#1f1a17`        | **6,78:1**  |
| Informativo          | `#60a5fa` | informativo suave `#141d2e` | **6,63:1**  |
| Acento em etiqueta   | `#f4705e` | acento suave `#2b1512`      | **6,01:1**  |

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
| `--color-line`      | Borda e divisória                                           |
| `--color-accent`    | **A voz única de ação.** Uma ação primária por contexto     |
| `--color-on-accent` | A tinta que vai sobre o acento. Troca de tema junto com ele |
| `--color-success`   | Operação concluída                                          |
| `--color-attention` | Aviso que não impede — duplicidade de nome (RN-04)          |
| `--color-danger`    | Exclusão e erro que bloqueia                                |
| `--color-info`      | Informação neutra                                           |
| `--color-focus`     | O anel de foco                                              |

**A cor de acento ocupa no máximo ~10% da tela.** Se duas coisas clicáveis estão com a cor de
acento na mesma tela, uma está errada — a raridade é o mecanismo que faz o usuário saber onde
apertar sem ler.

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
   **nos dois temas**, antes de escrever a primeira regra que o consome.
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
