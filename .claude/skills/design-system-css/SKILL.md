---
name: design-system-css
description: Use ao criar ou alterar qualquer componente visual do Oráculo. Sistema de design em HTML e CSS puros — hierarquia de tokens, variantes por classe, os dois temas, grade que reflui, movimento e acessibilidade. Sem framework, sem pré-processador, sem utilitário de terceiros (ADR-001).
---

# Sistema de design em CSS puro

## Por que não há framework aqui

Nenhuma dependência de terceiros (ADR-001) — a restrição é requisito de entrega, não estilo.
Isso apaga Tailwind, CVA, `clsx`, `tailwind-merge` e qualquer biblioteca de componente. O
que **não** apaga é a disciplina que essas ferramentas embutem, e é ela que esta skill
guarda:

| A ideia da ferramenta | Como ela existe aqui |
|---|---|
| `@theme` / tokens de tema | `styles/tokens.css` — a única fonte de valor visual |
| `dark:` / `darkMode` | `[data-theme]` + `prefers-color-scheme`, os dois temas obrigatórios |
| `cva()` com `variants` | classe base + classe modificadora: `.button` + `.button-primary` |
| `cn()` / `tailwind-merge` | `el(tag, { classes: [...] })` — a lista é montada em JS, sem conflito a resolver |
| `<Grid cols={4}>` | `grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr))` |
| Componente de biblioteca | `shared/components/*.js`, que devolvem nó **e** limpeza |

## Os quatro arquivos, nesta ordem

```
tokens.css      valor visual: cor, tipo, espaço, raio, sombra, duração, alvo
base.css        reset + elementos nativos (h1, input, table, fieldset…)
utilities.css   utilitário de uma responsabilidade (.stack-loose, .text-muted…)
components.css  o componente nomeado (.button, .card-grid, .filters…)
```

Ordem de carga fixa no `index.html`. Um valor visual só nasce em `tokens.css`; um
componente só nasce em `components.css`. **Nenhum `style=` inline** — a CSP não tem
`unsafe-inline`, e um estilo inline simplesmente não pinta.

---

## 1. Hierarquia de tokens

```
papel semântico  (--color-ink, --color-accent, --color-danger)
      └── usado direto pelo componente
```

Este projeto pula a camada de "token de marca" de propósito: com uma paleta só, um
`--brand-red-600` apontando para `--color-accent` seria indireção sem leitor. O que **não**
se pula:

**Toda cor é papel, nunca aparência.** `--color-danger`, não `--color-red`. O dia em que o
tema escuro pedir um vermelho mais claro, o nome continua verdadeiro.

**Todo token existe nos dois temas, ou não existe.** Um token definido só no claro vira
`inherit` silencioso no escuro — o defeito visual mais difícil de enxergar, porque quase
sempre ainda dá para ler.

**Toda superfície de ação declara a própria tinta.** `--color-accent` anda com
`--color-on-accent`. Branco fixo sobre superfície que clareia no tema escuro é reprovação de
contraste garantida.

**A escala é fechada.** `--text-xs … --text-2xl`, `--space-1 … --space-6`. Precisou de um
tamanho intermediário? Ou o desenho está errado, ou a escala precisa mudar **em
`tokens.css`** — nunca um `0.9375rem` solto no componente.

**Contraste é medido, não estimado.** `docs/design.md` tem a tabela par a par, nos dois
temas. Cor nova entra com a medida (4,5:1 para texto — RNF-05).

---

## 2. Variantes: base + modificador

O que o `cva()` resolve com objeto, aqui se resolve com duas classes e uma allowlist.

```css
/* components.css */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--target-min);          /* 44px — alvo de toque, §9.5 */
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-default);
  font: inherit;
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.button-primary   { background: var(--color-accent);  color: var(--color-on-accent); }
.button-secondary { background: var(--color-surface); color: var(--color-ink); border-color: var(--color-line); }
.button-ghost     { background: transparent;          color: var(--color-body); }
.button-danger    { background: var(--color-danger);  color: var(--color-on-accent); }
```

```js
// shared/components/button.js — a allowlist é o que o cva() dava de graça
const VARIANTS = new Set(["primary", "secondary", "ghost", "danger"]);

if (!VARIANTS.has(variant)) {
  throw new TypeError(`Variante de botão desconhecida: "${variant}".`);
}

const node = el("button", {
  text: label,
  attrs: { type, ...attrs },
  classes: ["button", `button-${variant}`],
});
```

Três regras que vêm junto:

1. **Elemento nativo, sempre.** `button`, não `div` clicável: `role`, `tabindex`, Enter e
   Espaço vêm de graça (§9.1).
2. **Componente global não conhece domínio.** Nenhum `if` de regra de negócio dentro de
   `shared/components/` — quem chama decide.
3. **Variante desconhecida lança.** Erro de digitação vira exceção no teste, não um botão
   sem estilo em produção.

**Uma ação primária por contexto.** Se duas coisas na tela estão com a cor de acento, uma
está errada. A cor de acento não passa de ~10% da tela.

---

## 3. Componente que devolve a própria limpeza

O contrato que substitui o ciclo de vida do React (§12.4):

```js
export function algo({ scope }) {
  const node = el("div", { classes: ["algo"] });

  scope.on(node, "click", handle);       // o escopo desliga tudo depois

  return { node, dispose: () => scope.dispose() };
}
```

Toda função de montagem devolve a limpeza, e **quem monta guarda**. Listener, timer,
`matchMedia` e requisição pendente sem cancelamento são vazamento — o tipo de defeito que
não quebra nada e degrada a aplicação a cada tela visitada.

---

## 4. Grade que reflui

O padrão de grade responsiva, com a armadilha que este projeto já pagou para aprender:

```css
/* ✅ certo: o mínimo cede quando a tela é menor que ele */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr));
  gap: var(--space-4);
}

/* ❌ errado: abaixo de 11rem a página rola na horizontal */
.card-grid {
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
}
```

`min(11rem, 100%)` é o que faz a coluna encolher em vez de empurrar. Vale para toda grade:
cartas, filtros, formulário.

Companheiros obrigatórios:

```css
fieldset,
input, select, textarea { min-width: 0; }  /* o padrão do navegador é min-content, e ele estoura */
```

**`overflow-wrap: anywhere` NUNCA no `body`.** Ele zera a contribuição de min-content de
todo texto que o herda, e o mínimo de qualquer coluna vira um caractere — foi o OF-004,
"Remover imagem" uma letra por linha. Ele vale só no texto que veio de fora (lista no topo
de `components.css`) e no utilitário `.wrap-anywhere`. `break-word` não serve: não afeta o
tamanho mínimo.

**Arranjo é primitiva, não media query** (`docs/design.md` §9). `@media (min-width…)` em
`components.css` é reprovação — o componente decide pela largura DELE:

| Precisa de | Use |
|---|---|
| Linha que quebra quando não cabe | `.cluster` (+ `-between`, `-center`, `-end`, `-baseline`) |
| Conteúdo + barra fixa que desce | `.sidebar` + `.sidebar-content` / `.sidebar-side` |
| Colunas que viram pilha num limiar | `.switcher` com `--switcher-threshold` |
| Mudar os filhos pela própria largura | `@container` no componente — nunca num ancestral com `position: fixed` dentro |

Ajuste por custom property na regra do componente (`--cluster-gap`), não por variante. Piso
em `rem` vai em `min(…, 100%)`; trilha que encolhe é `minmax(0, 1fr)`; item de flex com
texto de fora ganha `min-width: 0`.

Tela nova entra em `frontend/tests/suites/layout-geometry.test.js` — e o teste **afirma**
que mediu o estado com dado, não o de carregamento.

**Nenhuma largura fixa em pixel governa layout.** A verificação é: 320, 360, 768 e 1440px,
mais 200% de zoom de texto, **sem rolagem horizontal** (RNF-04).

Conteúdo largo que não tem como encolher — tabela, bloco de código, diagrama — rola dentro
do próprio contêiner (`overflow-x: auto`), nunca no `body`.

---

## 5. Os dois temas

```css
:root { --color-bg: #f6f1ea; /* … claro … */ }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --color-bg: #14100e; /* … escuro … */ }
}

:root[data-theme="dark"] { --color-bg: #14100e; /* … escuro … */ }
```

Três estados, não dois: escolha explícita (`data-theme`), e o padrão do sistema (atributo
ausente). A preferência do usuário é lembrada por `shared/storage/preference.js`; a troca
acontece **sem recarregar**.

Nenhuma cor pode ter a única definição dentro de um `@media` ou de um `[data-theme]`.

---

## 6. Movimento

```css
.algo { transition: opacity var(--duration-base) var(--ease-out); }

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;   /* 1ms, NUNCA 0 */
    animation-iteration-count: 1 !important;
    /* transição de cor, opacidade e sombra CONTINUA — ela comunica estado */
  }
}
```

- Duração vem de `--duration-*`. Nada acima de 400ms, exceto indicador de progresso.
- `1ms` e não `0`: com `0`, o evento `animationend` pode nunca disparar, e o código que
  espera por ele trava.
- `prefers-reduced-motion` reduz **movimento**, não *feedback*. Matar a transição de cor
  junto deixa a interface sem resposta visível.

---

## 7. Acessibilidade que é do CSS

- **Alvo de toque:** `min-height: var(--target-min)` (44px) em tudo que é clicável.
- **Foco visível sempre.** Nunca `outline: none` sem substituto; use
  `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }`.
- **Um `<h1>` por tela**, sem salto de nível. Título de cartão é `h2` quando a página já tem
  o `h1` — o tamanho vem da classe, não da tag.
- **Piso tipográfico:** `--text-xs` (12px) é o menor que existe. Não invente menor.
- **Cor nunca é o único sinal.** Estado que só muda de cor precisa de texto, ícone ou forma.
- **Ordem do DOM = ordem visual.** Reordenar com `order`/`grid-area` quebra a tabulação.

---

## Antes de dar por pronto

- [ ] Nenhum valor visual fora de `tokens.css`; nenhum `style=` inline.
- [ ] Todo token novo existe nos dois temas, com contraste medido em `docs/design.md`.
- [ ] O componente devolve a própria limpeza, e quem monta guarda.
- [ ] Elemento nativo; variante fora da allowlist lança.
- [ ] Sem rolagem horizontal em 320/360/768/1440 e a 200% de zoom.
- [ ] Alvo de 44px, foco visível, um `h1`, sem salto de nível.
- [ ] `prefers-reduced-motion` respeitado, com `1ms` e não `0`.
- [ ] Verificado **na tela**, nos dois temas — a suíte não pega layout.

## Referências

- `references/advanced-patterns.md` — diálogo/modal, animação de entrada, consulta de
  contêiner, controle segmentado e a lista do que fazer e do que não fazer.
- `frontend/src/styles/` — a implementação real; leia antes de inventar padrão novo.
- `docs/design.md` — a tabela de contraste medida.
- `frontend/PADROES-ENGENHARIA.md` §9 (acessibilidade), §10 (design system), §11 (movimento).
