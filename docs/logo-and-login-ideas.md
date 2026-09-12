# Logo e tela de login

> **Estado:** conceitos **escolhidos em 11/09/2026**; o logo **implementado em 12/09**
> (`04c48b7`), o login ainda não — ele espera as imagens do P4. O logo é a tiragem
> segurada na mão — **desenho aprovado**, com o SVG no P1 do checklist —; o login é a mesa
> com a carta central já tirada. Peças, tamanhos e o que o agente de imagem entrega estão em
> `docs/visual-identity-checklist.md` (P1 a P4).
>
> As cores vêm da paleta que está em `development` desde `ed0785d`. Confira a `/paleta` antes de
> gerar qualquer imagem: se um token mudar, a tabela abaixo muda junto.

---

## Princípios

- **Logo vetorial (SVG), capaz de funcionar numa cor só.** Pintado por token, ele troca de tema
  sozinho, funciona sobre qualquer fundo da paleta e vira favicon. Um PNG precisaria de uma
  versão por tema.
- **Nenhuma arte de jogo.** Nem o verso das cartas de Magic, nem Pokébola, nem o redemoinho do
  Yu-Gi-Oh!, nem o Olho do Milênio. É um portal da LigaMagic, mas a entrega precisa ser arte
  nossa: propriedade intelectual de terceiro num projeto de avaliação é risco à toa.
- **Texto nunca dentro da imagem.** Nomes e frases ficam no HTML, por acessibilidade. Se a
  palavra "Oráculo" ganhar um desenho de letra próprio, ela entra no SVG como traçado, não como
  fonte — sem fonte remota nem arquivo de fonte de terceiro (RNF-01, ADR-001).
- **A arte usa a família violeta e os neutros, e só.** Cada pedra da paleta já significa algo
  (`docs/design.md` §4): rubi é perigo, topázio é atenção, jade é sucesso, safira é
  informação. Um detalhe verde no logo ensinaria ao olho que verde é marca, e o "salvo com
  sucesso" perderia a força. Os dez materiais de raridade também ficam fora: são dado, e só
  aparecem no selo.

## A paleta de referência

Os papéis que interessam para logo e imagem, lidos do `tokens.css` em 11/09:

| Papel | Token | Claro | Escuro |
|---|---|---|---|
| Marca (logotipo) | `--color-brand` | `#492c9b` | `#bab3ff` |
| Acento suave | `--color-accent-soft` | `#e7e6f6` | `#292440` |
| Fundo da página | `--color-bg` | `#f0eff5` | `#0f0f16` |
| Superfície | `--color-surface` | `#ffffff` | `#1e1e25` |
| Linha | `--color-line` | `#dcdbe1` | `#35353e` |
| Borda (limite de controle, 3:1) | `--color-border` | `#807f87` | `#74737c` |
| Texto primário | `--color-ink` | `#1b1c1c` | `#e4e4ea` |
| Metadado | `--color-muted` | `#67686b` | `#9aa0a8` |

A marca passa com folga sobre a superfície: 9,92:1 no claro, 8,66:1 no escuro. A ação
(`--color-accent`, `#6a4bc6` / `#a290fa`) fica **fora** da arte: é a voz única de ação, cerca
de 10% da tela, e o logo aparece em todas elas.

---

## Logo — a tiragem segurada na mão

Três cartas em leque, como uma mão de cartas: o gesto de quem joga TCG, com uma escolhida.

- **A carta central** é a maior, **em pé no eixo vertical** e **preenchida** com a cor da marca.
  Vertical é o que a mantém nítida a 16px: um retângulo reto cai na grade de pixels.
- **As duas laterais** têm 86% da central, **só em contorno**, e inclinam 18° com a parte de
  baixo em direção à central. Os números saíram da comparação de três variantes em 11/09; a
  geometria completa e o código do SVG estão no P1 do checklist.
- **Um pivô só.** As laterais giram em torno do mesmo ponto, abaixo do centro, onde o polegar
  seguraria. Cada uma girando em torno do próprio centro parece arrumado, não segurado.
- **Um vão entre as laterais e a central.** Contornos que se cruzam viram emaranhado a 16–32px.
  A central, preenchida, cobre o que está atrás dela, e o vão separa as formas.
- **Preenchida é a escolhida; contorno são as outras.** É a mesma linguagem do rádio do seletor
  de cor da raridade, e é o que deixa o logo funcionar numa cor só.

### O sigilo

Uma gema em **lapidação esmeralda, vista de cima**, vazada no centro da carta central: um
octógono em degraus que repete o retângulo da carta. Ela liga o logo ao vocabulário que o
sistema já tem — as pedras dos estados e os materiais das raridades. A lapidação brilhante, de
perfil, foi comparada e ficou de fora: lê na hora, mas é o diamante que qualquer produto usa.

- **Duas versões do logo, e só duas:** com o sigilo e sem ele. O sigilo entra com o símbolo a
  partir de **64px** — medido em 11/09: a 48px as facetas se fundem, a 64px se leem nos dois
  temas. Abaixo disso — o cabeçalho, com 24px (48px com a fonte em 200%), e o favicon —, o
  logo são as três cartas.
- **O sigilo é também o centro do verso da carta** (P3). A carta central do logo grande é um
  verso: o logo grande, o espaço vazio da galeria e as cartas do login contam a mesma história.
- **Sem olho.** Foi considerado e recusado, por três motivos: é o símbolo mais gasto do tema (o
  olho que tudo vê); o Olho de Wdjat é o dos Itens do Milênio do Yu-Gi-Oh!, e um olho num verso
  de carta é a associação que "nenhuma arte de jogo" quer evitar; e, num portal que registra
  quem alterou o quê, um olho em toda aba pode ser lido como vigilância.

### O favicon

Desenhado à parte, em 16 e 32px, ajustado ao pixel — e não o logo grande encolhido. Diferença
sutil de tamanho e de ângulo some a 16px; o desenho pequeno exagera as duas o bastante para
continuarem visíveis. Sem sigilo.

---

## Login — a mesa, com a carta já tirada

1. **Ao abrir:** uma mesa vista por quem está sentado, com as duas cartas laterais deitadas de
   costas, em perspectiva. A carta central já está **em pé, voltada para você e ainda de
   costas**, com o formulário sobre o verso. O foco vai para o e-mail, e o preenchimento
   automático de senha age na hora.
2. **Ao clicar em Entrar:** o botão mostra "Entrando…". Se der erro, a carta não vira, e a
   mensagem fica nela.
3. **Com o login aceito:** a carta vira, em cerca de 350ms, e mostra a frente — o símbolo, ou
   "Bem-vindo, *nome*". A aplicação entra por esmaecimento, em cerca de 200ms.

**Por que a carta já começa tirada, e não com um botão antes.** O login não aparece uma vez só:
sempre que a sessão vence, ele volta com "Sua sessão expirou" (`frontend/src/main.js`). Um
botão antes do formulário poria um clique e uma animação em cada entrada, inclusive no meio de
uma tarefa; tiraria o foco do e-mail que a tela tem hoje; e deixaria o preenchimento automático
esperando o clique, porque antes dele os campos não existem. O clique que importa é o Entrar, e
é ele que dispara a virada.

As regras que vêm junto:

- **O formulário é a página, não um modal.** Modal é caixa sobre um conteúdo para onde se
  volta, com Esc, foco preso e anúncio de diálogo; no login não há para onde voltar. É o
  `<main>`, desenhado como a face da carta.
- **O verso fica bem apagado atrás dos campos**, ou os campos ficam numa faixa lisa: texto a
  4,5:1 sobre o que estiver atrás, nos dois temas.
- **Só as laterais ficam em perspectiva.** Texto em plano inclinado lê mal; a carta do
  formulário é frontal.
- **Em tela estreita**, a carta central ocupa a largura, e as laterais só aparecem quando cabem
  — pela largura do `.login-layout` (`@container`), não pela da janela. **Com o celular
  deitado**, com menos de 400px de altura, a cena não pode empurrar o formulário para fora da
  tela.
- **A virada acontece depois da resposta do servidor**, nunca no clique. A virada e o
  esmaecimento são dois movimentos, e cada um fica abaixo dos 400ms do `docs/design.md` §5.
  Virar e crescer ao mesmo tempo seria uma transformação 3D sobre a árvore inteira da
  aplicação, que é onde a animação engasga.
- **Movimento reduzido:** sem virada, só o esmaecimento (`docs/design.md` §7).
- **"Entrar", nunca "Logar".** É como o sistema inteiro fala: o botão, "Entrar no Oráculo",
  "Sair", "Entre novamente".
- **A mesa nos dois temas**, uma cena por tema, pelo token `--image-*`. Mesa fixa no escuro
  faria quem usa o claro sair de uma cena noturna para uma aplicação clara no instante da
  virada — um clarão bem no momento que devia encantar.
- **De tecido, na névoa violeta** (linho claro no claro, veludo quase preto no escuro), e
  **em camadas**: a mesa sozinha e uma carta deitada transparente, que o CSS posiciona ao lado
  do cartão e espelha. Uma cena única poria as cartas embaixo do formulário com a fonte em
  200%. O pedido ao agente está no P4 do checklist.
- **É a primeira tela:** a cena em WebP, dimensionada, sem `loading="lazy"`, e o formulário
  funcionando antes de a imagem chegar.

---

## Os outros conceitos, e o que ficou deles

Registrados em 10/09 e avaliados na escolha de 11/09.

| Conceito | Destino |
|---|---|
| Logo 2 — O verso do Oráculo | O sigilo virou o centro do verso da carta e o detalhe do logo grande |
| Logo 3 — A carta que vê | Recusado: o olho (ver "O sigilo") |
| Logo 4 — O "O" lapidado | A gema virou o sigilo |
| Logo 5 — O acento que brilha | Fora: não funciona sozinho, e o logo já tem símbolo |
| Login B — O formulário é uma carta | Absorvido: o formulário fica sobre a carta central |
| Login C — Tela dividida com ilustração | Fora: formato comum; dele ficou só a cena em imagem, que virou a mesa |
| Login D — A atual, com assinatura | Fora: o menor ganho |

## Próximo passo

Detalhar cada peça para o agente de imagem — composição com as proporções, cores por tema com
o token de origem, tamanhos e formatos —, seguindo `docs/visual-identity-checklist.md` na ordem
de lá: o símbolo e o favicon (P1 e P2), o verso (P3) e, por último, o login (P4), que usa os
três.
