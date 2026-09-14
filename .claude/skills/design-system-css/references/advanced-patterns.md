# Padrões avançados — CSS puro

Complemento do `SKILL.md`. Aqui ficam os padrões que costumam justificar uma biblioteca, e
como eles existem neste projeto sem nenhuma.

---

## Padrão 1 — Sobreposição e as quatro regras de foco

O que uma biblioteca de diálogo entrega não é a caixa: é o **foco**. As quatro regras
(§9.2), e todas as quatro são obrigatórias:

1. O foco **entra** ao abrir.
2. O foco **fica preso** enquanto está aberto.
3. `Esc` **fecha**.
4. O foco **volta** para quem abriu.

Um modal que erra qualquer uma delas deixa quem navega por teclado preso atrás da
sobreposição, sem saída.

```js
// o que o navegador considera focável, na ordem do DOM
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const opener = document.activeElement;   // regra 4 começa aqui
// … ao fechar: opener?.focus()
```

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--space-4);        /* o modal nunca encosta na borda em tela pequena */
  background: rgb(0 0 0 / 0.5);
}

.modal {
  width: min(32rem, 100%);        /* mesma ideia do min() da grade */
  max-height: 90dvh;              /* dvh, não vh: a barra do navegador móvel some e volta */
  overflow-y: auto;
  background: var(--color-surface);
  border-radius: var(--radius-default);
  box-shadow: var(--shadow-overlay);   /* sombra só para o que flutua de verdade */
}
```

**Detalhes que só aparecem no celular:** `100dvh` em vez de `100vh` (a barra de endereço
muda a altura), `padding` no fundo (senão o cartão cola na borda), e travar a rolagem do
corpo enquanto há modal aberto — contando os modais abertos, para o segundo fechar não
destravar o primeiro.

---

## Padrão 2 — Animação de entrada sem biblioteca

```css
.notification {
  animation: entrada var(--duration-base) var(--ease-out);
}

@keyframes entrada {
  from { opacity: 0; transform: translateY(-0.5rem); }
  to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .notification { animation-duration: 1ms; }
}
```

Para animar a **entrada** de um elemento recém-inserido sem truque de duplo
`requestAnimationFrame`, existe `@starting-style` — use só depois de conferir suporte, e
sempre com o estado final funcionando sem ela:

```css
.popover {
  opacity: 1;
  transition: opacity var(--duration-fast) var(--ease-out), display allow-discrete;
}

@starting-style {
  .popover { opacity: 0; }
}
```

Regra de ouro: **a interface tem de estar correta sem nenhuma animação**. Animação é
acabamento, nunca a informação.

---

## Padrão 3 — Controle segmentado e barra de ações

Grupos horizontais são a origem clássica de quebra em tela estreita e em zoom alto:

```css
.segmented,
.app-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;      /* sem isto, a 200% "Sair" vira S/ai/r */
}
```

Marque o estado com atributo, não com classe solta — assim a semântica e o visual saem do
mesmo lugar:

```css
.segmented [aria-pressed="true"] { background: var(--color-accent-soft); }
.app-nav [aria-current="page"]   { border-bottom: 2px solid var(--color-accent); }
```

E `aria-current` precisa **acompanhar a rota**: "você está aqui" preso na primeira tela é
pior do que não existir.

---

## Padrão 4 — Consulta de contêiner

Quando o componente aparece em larguras diferentes (uma coluna estreita e a página inteira),
a mídia mente — o que importa é o espaço **do contêiner**:

```css
.card-list { container-type: inline-size; }

@container (min-width: 30rem) {
  .card-tile { grid-template-columns: auto 1fr; }
}
```

Use quando o componente precisa mudar os PRÓPRIOS FILHOS pela própria largura — neste
projeto, só a barra de filtros. Para arranjar colunas e linhas, as primitivas `.cluster`,
`.sidebar` e `.switcher` resolvem sem consulta nenhuma (`docs/design.md` §9).

`container-type` aplica contenção de layout, e isso torna o contêiner o bloco de referência
de todo `position: fixed` dentro dele. Nunca no `<main>`: modal e avisos são fixos.

---

## Padrão 5 — Tema, sem recarregar

Os três estados e o que cada um significa:

| Estado | Como fica no DOM | Quem decide |
|---|---|---|
| Sistema (padrão) | sem `data-theme` | `prefers-color-scheme` |
| Claro explícito | `data-theme="light"` | a pessoa |
| Escuro explícito | `data-theme="dark"` | a pessoa |

```js
// a preferência é lembrada; a troca é imediata
document.documentElement.dataset.theme = escolha;   // ou delete para voltar ao sistema
```

O botão de tema escuta `matchMedia("(prefers-color-scheme: dark)")` para acompanhar a
mudança do sistema **enquanto a página está aberta** — e é justamente esse listener que
precisa morrer na limpeza. Um listener de `matchMedia` por navegação é o vazamento mais
discreto que existe: nada quebra, a aplicação só fica mais lenta a cada tela.

---

## O que fazer

- Valor visual só em `tokens.css`; componente só em `components.css`.
- Cor por **papel** (`--color-danger`), nunca por aparência (`--color-red`).
- `min()` em todo mínimo de grade; `flex-wrap` em toda linha de ações.
- Elemento nativo antes de qualquer `role`.
- Estado marcado por atributo ARIA, e o CSS lendo esse atributo.
- Verificar **na tela**, nos dois temas, em 320/360/768/1440 e a 200%.
- `dvh` no lugar de `vh` onde a altura da janela importa.

## O que não fazer

- `style=` inline — a CSP não tem `unsafe-inline`; simplesmente não pinta.
- Tamanho intermediário fora da escala (`0.9375rem`).
- Token definido em um tema só.
- Branco fixo sobre superfície que clareia no escuro.
- `outline: none` sem substituto visível.
- `animation-duration: 0` em `prefers-reduced-motion` — use `1ms`, senão `animationend`
  pode nunca disparar.
- `overflow-wrap: break-word` esperando que ele conserte refluxo: ele **não** afeta o
  tamanho mínimo do conteúdo; `anywhere` afeta.
- Reordenar visualmente com `order`/`grid-area` sem conferir a ordem de tabulação.
- Duas ações com a cor de acento na mesma tela.
