# Rastrear a causa raiz para trás

## O princípio

Bugs costumam aparecer **fundo** na pilha: a exceção estoura no `decodeURIComponent`, o
listener some no meio de uma navegação, o SQL recebe `null`. O instinto é corrigir onde o
erro aparece — e isso é tratar sintoma.

> Suba a cadeia de chamadas até o **gatilho original** e corrija lá.

## Quando usar

- O erro acontece longe do ponto de entrada.
- A pilha mostra uma cadeia longa.
- Não está claro de onde veio o valor inválido.
- Você precisa descobrir **qual** teste ou **qual** tela dispara o problema.

Se a cadeia não puder ser rastreada (fronteira de processo, código de terceiros — que aqui
não existe), corrija no ponto do sintoma **e** acrescente defesa em profundidade
(`defense-in-depth.md`).

---

## O processo

### 1. Observe o sintoma

```
Uncaught (in promise) URIError: URI malformed
```

### 2. Ache a causa imediata

Qual código causa isso diretamente?

```js
params[parameter.groups.name] = decodeURIComponent(pathParts[index]);
```

### 3. Pergunte: quem chamou?

```
matchRoute()
  ← resolve()
  ← render()          ← aqui há try/catch… mas o resolve() acontece FORA dele
  ← navigate()
  ← handleClick()     ← um clique em link com %E0%A4%A no caminho
```

### 4. Continue subindo

Que valor foi passado? De onde ele veio? A URL é **entrada externa** — chega malformada
porque alguém colou, porque um link antigo tinha escape quebrado, porque um scanner pediu.

### 5. Ache o gatilho original

Neste caso o gatilho não é o clique: é a **posição do `resolve()`**. Ele roda fora do `try`
do `render()`, então a exceção sobe como rejeição não tratada em vez de virar um 404 de
tela. A correção na causa raiz é a guarda dentro do `matchRoute` (URL malformada → `null` →
rota não casa → 404), não um `try/catch` em volta do sintoma.

---

## Quando não der para rastrear lendo

Instrumente antes da operação suspeita — **antes**, nunca depois de falhar:

```js
// frontend, temporário
function handleClick(event) {
  const link = event.target.closest?.("a[href]");
  console.log("[router] clique", {
    href: link?.href,
    hash: link?.hash,
    pathname: link?.pathname,
    atual: window.location.pathname,
    pilha: new Error().stack,
  });
  // …
}
```

```php
// backend, temporário
error_log('[repo] antes da consulta: ' . json_encode([
    'sql' => $sql,
    'params' => $params,
    'trace' => (new \Exception())->getTraceAsString(),
]));
```

Capture:

```bash
docker compose logs app | grep '\[repo\]'
```

No navegador, filtre o console por `[router]`.

**Ao ler a pilha:** procure o nome do arquivo de teste ou da página, ache a linha que
disparou, e procure o **padrão** — sempre o mesmo teste? sempre o mesmo parâmetro?

## Achar qual teste suja o estado

Se algo aparece durante a suíte e você não sabe qual teste causou, use a bisseção:

```bash
.claude/skills/systematic-debugging/find-polluter.sh 'backend/storage/uploads/*.png'
```

Veja o cabeçalho do script para as opções.

---

## Exemplo real deste projeto: o link de pular conteúdo morto

**Sintoma:** "Pular para o conteúdo" não faz nada. Nenhum erro no console.

**Cadeia:**
1. O foco não vai para `#conteudo`.
2. O navegador nunca processa o fragmento.
3. `handleClick` do roteador chamou `event.preventDefault()`.
4. Ele intercepta **todo** link interno de mesma origem.
5. Um link puramente de fragmento (`#conteudo`) tem a mesma origem, o mesmo `pathname` e a
   mesma query — e cai na mesma regra.

**Causa raiz:** o roteador tratava como navegação algo que **não é navegação**.

**Correção na origem** — devolver antes do `preventDefault()`:

```js
if (
  link.hash !== "" &&
  link.pathname === window.location.pathname &&
  link.search === window.location.search
) {
  return; // não é do roteador: é âncora dentro da mesma tela
}
```

E o teste que reproduz virou uma suíte inteira: *"o clique que não é do roteador"*.

**Se tivesse sido corrigido no sintoma** — um `tabindex`/`focus()` manual no link — o
defeito continuaria para toda âncora futura da aplicação.

---

## O princípio, em uma linha

```
Achou a causa imediata
      → dá para subir um nível?  SIM → suba
                                  NÃO → corrija aqui E acrescente defesa em camadas
      → é a origem?              NÃO → continue subindo
                                  SIM → corrija aqui
      → valide em cada camada         → o bug fica impossível
```

**Nunca corrija apenas onde o erro aparece.**

## Dicas de pilha

- **Em teste:** use `console.error`/`error_log` — logger pode estar suprimido.
- **Antes da operação**, não depois de falhar.
- **Inclua contexto:** caminho, usuário, nível, parâmetros, ambiente.
- **Capture a pilha:** `new Error().stack` no JS, `(new \Exception())->getTraceAsString()`
  no PHP.
- **Tire a instrumentação antes do commit** — ela é achado de auditoria.
