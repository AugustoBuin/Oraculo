# Logo e tela de entrada

> **Estado (14/09/2026):** implementados. O logo entrou em 12/09; a tela de entrada, em duas
> partes — a cena em 12/09 e a virada em 13/09. Este documento guarda **o que foi escolhido e
> por quê**. As peças, os arquivos, os tokens, as imagens geradas e a verificação estão em
> `docs/visual-identity-checklist.md`.

---

## Princípios

- **Logo vetorial (SVG), capaz de funcionar numa cor só.** Pintado por token, ele troca de tema
  sozinho, funciona sobre qualquer fundo da paleta e vira favicon. Um PNG precisaria de uma
  versão por tema.
- **Nenhuma arte de jogo.** Nem o verso das cartas de Magic, nem Pokébola, nem o redemoinho do
  Yu-Gi-Oh!, nem o Olho do Milênio. É um portal da LigaMagic, mas a entrega precisa ser arte
  nossa: propriedade intelectual de terceiro num projeto de avaliação é risco à toa.
- **Texto nunca dentro da imagem.** Nomes e frases ficam no HTML, por acessibilidade. A palavra
  "Oráculo" continua texto; se um dia ganhar desenho de letra próprio, entra no SVG como
  traçado, não como fonte (RNF-01, ADR-001).
- **A arte usa a família violeta e os neutros, e só.** Cada pedra da paleta já significa algo
  (`docs/design.md` §4): rubi é perigo, topázio é atenção, jade é sucesso, safira é informação.
  Um detalhe verde no logo ensinaria ao olho que verde é marca, e o "salvo com sucesso" perderia
  a força. Os dez materiais de raridade também ficam fora: são dado, e só aparecem no selo.

## A paleta de referência

Os papéis que interessam para logo e imagem. A fonte da verdade é o `tokens.css`, e a `/paleta`
mostra os valores ao vivo, nos dois temas.

| Papel | Token | Claro | Escuro |
|---|---|---|---|
| Marca (logotipo) | `--color-brand` | `#492c9b` | `#bab3ff` |
| Acento suave | `--color-accent-soft` | `#e7e6f6` | `#292440` |
| Fundo da página | `--color-bg` | `#f0eff5` | `#0f0f16` |
| Superfície | `--color-surface` | `#ffffff` | `#1e1e25` |
| Traço de arte (o verso) | `--color-line-art` | `#d1cfdf` | `#2b293f` |
| Texto primário | `--color-ink` | `#1b1c1c` | `#e4e4ea` |

A marca passa com folga sobre a superfície: 9,92:1 no claro e 8,66:1 no escuro. A ação
(`--color-accent`) fica **fora** da arte: é a voz única de ação, cerca de 10% da tela, e o logo
aparece em todas elas.

---

## Logo — a tiragem segurada na mão

Três cartas em leque, como uma mão de cartas: o gesto de quem joga TCG, com uma escolhida.

- **A carta central** é a maior, **em pé no eixo vertical** e **preenchida** com a cor da marca.
  Vertical é o que a mantém nítida a 16px: um retângulo reto cai na grade de pixels.
- **As duas laterais** têm 86% da central, **só em contorno**, e inclinam 18° com a parte de
  baixo em direção à central. Os números saíram da comparação de três variantes em 11/09.
- **Um pivô só.** As laterais giram em torno do mesmo ponto, abaixo do centro, onde o polegar
  seguraria. Cada uma girando em torno do próprio centro parece arrumado, não segurado.
- **Um vão entre as laterais e a central.** Contornos que se cruzam viram emaranhado a 16–32px.
  A central, preenchida, cobre o que está atrás dela, e o vão separa as formas.
- **Preenchida é a escolhida; contorno são as outras.** É a mesma linguagem do rádio do seletor
  de cor da raridade, e é o que deixa o logo funcionar numa cor só.

**Na tela:** `symbol.svg` e `symbol-sigil.svg`, em `frontend/src/assets/brand/`, pintados com
`--color-brand` pela máscara. O cabeçalho usa a versão sem sigilo, a 24px (48px com a fonte em
200%); a entrada usa a com sigilo, a 64px, acima do formulário.

### O sigilo

Uma gema em **lapidação esmeralda, vista de cima**, vazada no centro da carta central: um
octógono em degraus que repete o retângulo da carta. Ela liga o logo ao vocabulário que o
sistema já tem — as pedras dos estados e os materiais das raridades. A lapidação brilhante, de
perfil, foi comparada e ficou de fora: lê na hora, mas é o diamante que qualquer produto usa.

- **Duas versões do logo, e só duas:** com o sigilo e sem ele. O sigilo entra a partir de
  **64px** — medido em 11/09: a 48px as facetas se fundem, a 64px se leem nos dois temas.
- **O sigilo é também o centro do verso da carta.** O logo grande, o espaço vazio da galeria e a
  carta da entrada contam a mesma história.
- **Sem olho.** Foi considerado e recusado, por três motivos: é o símbolo mais gasto do tema (o
  olho que tudo vê); o Olho de Wdjat é o dos Itens do Milênio do Yu-Gi-Oh!, e um olho num verso
  de carta é a associação que "nenhuma arte de jogo" quer evitar; e, num portal que registra
  quem alterou o quê, um olho em toda aba pode ser lido como vigilância.

### O favicon

Desenhado à parte, e não o logo grande encolhido: diferença sutil de tamanho e de ângulo some a
16px. No favicon as laterais têm 92% e inclinam 24°, sem sigilo, num quadrado da cor da marca
com o símbolo branco — a barra de abas é do navegador e não segue o tema do Oráculo. Três
arquivos, em `frontend/public/`: `favicon.svg`, `favicon.ico` (16 e 32px) e
`apple-touch-icon.png` (180px, este com a gema).

---

## Tela de entrada — a mesa, com a carta já tirada

1. **Ao abrir:** uma mesa vista por quem está sentado. A carta central já está **em pé,
   voltada para você e de costas**: é o próprio cartão do formulário, com a moldura do verso
   atrás e a marca com o sigilo no topo. Quando o espaço cabe, duas cartas deitadas aparecem ao
   lado, a da direita espelhada. O foco vai para o e-mail, e o preenchimento automático de senha
   age na hora.
2. **Ao clicar em Entrar:** o botão mostra "Entrando…". Se der erro, a carta não vira: a
   mensagem aparece, o e-mail fica, e a senha é limpa e recebe o foco.
3. **Com o login aceito:** a carta dá **meia volta** e some de perfil, e a aplicação entra por
   esmaecimento atrás dela. O foco vai para o conteúdo da tela que entrou.

**Por que a carta já começa tirada, e não com um botão antes.** O login não aparece uma vez só:
sempre que a sessão vence, ele volta com "Sua sessão expirou". Um botão antes do formulário poria
um clique e uma animação em cada entrada, inclusive no meio de uma tarefa; tiraria o foco do
e-mail; e deixaria o preenchimento automático esperando o clique, porque antes dele os campos não
existiriam. O clique que importa é o Entrar, e é ele que dispara a virada.

**Por que meia volta, e não uma volta com a frente da carta.** O conceito previa a carta virar e
mostrar a frente — o símbolo, ou "Bem-vindo". A 90° a carta já está de perfil e some sozinha, e a
face que ela revela é a própria aplicação. Uma volta inteira mostraria o formulário espelhado,
porque o cartão não tem uma segunda face desenhada.

As regras que vieram junto:

- **O formulário é a página, não um modal.** Modal é caixa sobre um conteúdo para onde se volta,
  com Esc, foco preso e anúncio de diálogo; na entrada não há para onde voltar. É o `<main>`,
  desenhado como a face da carta.
- **A moldura do verso fica atrás do formulário**, em `--color-line-art`, abaixo de qualquer
  piso de contraste, para não disputar com os campos. Ela não estica: o SVG mantém a proporção
  da carta e fica centrado no cartão, e o traço passa por baixo do texto. Medido e aceito em
  14/09 (checklist, P4).
- **Só as cartas deitadas ficam em perspectiva.** Texto em plano inclinado lê mal; a carta do
  formulário é frontal.
- **Em tela estreita**, o formulário fica sozinho, e as deitadas só aparecem quando cabem
  inteiras — a partir de 64rem de `.login-layout`, por `@container`, não pela janela. **Com o
  celular deitado**, abaixo de 32rem de altura, as deitadas saem para a cena não empurrar o
  formulário para fora da tela.
- **A virada acontece depois da resposta do servidor**, nunca no clique: virar antes seria
  prometer uma entrada que o 401 ainda pode desmentir. A virada e o esmaecimento são dois
  movimentos, cada um abaixo dos 400ms do `docs/design.md` §5.
- **Movimento reduzido:** a virada dura 1ms, e sobra o esmaecimento (`docs/design.md` §7).
- **"Entrar", nunca "Logar".** É como o sistema inteiro fala: o botão, "Entrar no Oráculo",
  "Sair", "Entre novamente".
- **A mesa existe nos dois temas**, uma cena por tema, pelo token `--image-login-table`. Mesa fixa
  no escuro faria quem usa o claro sair de uma cena noturna para uma aplicação clara no instante
  da virada — um clarão bem no momento que devia encantar.
- **De tecido, na névoa violeta** — linho claro no claro, veludo quase preto no escuro — e **em
  camadas**: a mesa sozinha e uma carta deitada com fundo transparente, que o CSS posiciona e
  espelha. Uma cena única poria as cartas embaixo do formulário com a fonte em 200%.
- **As duas imagens foram geradas com o Gemini**, a partir dos pedidos registrados no checklist
  (P4). São as únicas imagens raster da interface.
- **É a primeira tela:** a cena em WebP, sem `loading="lazy"`, e o formulário funcionando antes
  de a imagem chegar.

---

## Os outros conceitos, e o que ficou deles

Registrados em 10/09 e avaliados na escolha de 11/09.

| Conceito | Destino |
|---|---|
| Logo 2 — O verso do Oráculo | O sigilo virou o centro do verso da carta e o detalhe do logo grande |
| Logo 3 — A carta que vê | Recusado: o olho (ver "O sigilo") |
| Logo 4 — O "O" lapidado | A gema virou o sigilo |
| Logo 5 — O acento que brilha | Fora: não funciona sozinho, e o logo já tem símbolo |
| Login B — O formulário é uma carta | Absorvido: o formulário é a carta central |
| Login C — Tela dividida com ilustração | Fora: formato comum; dele ficou só a cena em imagem, que virou a mesa |
| Login D — A atual, com assinatura | Fora: o menor ganho |
