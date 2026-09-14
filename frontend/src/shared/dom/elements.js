/**
 * Criação de elementos segura **por construção**.
 *
 * Quem monta o DOM à mão perde de graça a proteção que um framework dá contra
 * XSS. A resposta deste projeto não é revisar cada `innerHTML` — é não ter um
 * caminho que aceite HTML. Aqui texto é sempre texto, atributo de evento é
 * erro de programação, e atributo de URL passa por allowlist de esquema
 * (PADROES-ENGENHARIA.md §8.3).
 */

import { isSafeUrl } from "@/shared/dom/safe-url.js";

/**
 * Atributos que carregam URL e por isso precisam de validação de esquema.
 */
const URL_ATTRIBUTES = new Set(["href", "src", "action", "poster", "cite"]);

/**
 * Atributos que não têm uso legítimo aqui.
 *
 * `srcdoc` e `formaction` são vetores diretos. `style` é recusado por um
 * segundo motivo, igualmente firme: valor visual mora em `tokens.css`, e
 * estilo inline é a porta pela qual ele escapa (§10.1).
 */
const FORBIDDEN_ATTRIBUTES = new Set(["srcdoc", "formaction", "style"]);

/**
 * Monta um elemento.
 *
 * @param {string} tag
 * @param {{
 *   text?: unknown,
 *   attrs?: Record<string, unknown>,
 *   classes?: string[],
 *   children?: Node[],
 * }} [options]
 */
export function el(tag, { text, attrs = {}, classes = [], children = [] } = {}) {
  const node = document.createElement(tag);

  if (text !== undefined && text !== null) {
    // `textContent`, nunca `innerHTML`: é o que torna o nó imune por
    // construção. Uma carta chamada `<img src=x onerror=alert(1)>` vira texto
    // visível, que é exatamente o que se quer.
    node.textContent = String(text);
  }

  if (classes.length > 0) {
    node.classList.add(...classes);
  }

  for (const [name, value] of Object.entries(attrs)) {
    applyAttribute(node, tag, name, value);
  }

  node.append(...children);

  return node;
}

function applyAttribute(node, tag, name, value) {
  // Atributo ausente é ausência, não a string "null". Booleano falso remove o
  // atributo em vez de escrever `disabled="false"`, que o HTML lê como ativo.
  if (value === undefined || value === null || value === false) {
    return;
  }

  /*
   * Atributo de evento é ERRO DE PROGRAMAÇÃO, e por isso lança.
   *
   * A distinção com o caso da URL abaixo é deliberada: `onclick` só aparece
   * aqui se quem escreveu o componente errou, e falhar alto conserta na hora.
   * Uma URL insegura, ao contrário, é DADO — pode vir do banco, do usuário ou
   * de uma carta antiga — e derrubar a renderização de uma listagem inteira
   * por causa de uma imagem ruim seria trocar um problema por outro pior.
   */
  if (/^on/i.test(name)) {
    throw new TypeError(
      `Atributo de evento "${name}" não é aceito. Use on(), de shared/dom/events.js.`,
    );
  }

  if (FORBIDDEN_ATTRIBUTES.has(name)) {
    throw new TypeError(`Atributo "${name}" não é aceito em el().`);
  }

  if (URL_ATTRIBUTES.has(name) && !isSafeUrl(value)) {
    // Falha em recurso opcional é silenciosa para o usuário e registrada para
    // quem desenvolve (§7.3). O elemento nasce sem o atributo, e quem chama
    // decide o que mostrar no lugar — no caso da carta, o espaço reservado
    // legível que o RF-34 exige.
    console.warn("[el] atributo de URL recusado", { tag, name, value });
    return;
  }

  node.setAttribute(name, value === true ? "" : String(value));
}

/**
 * Link externo, com a proteção que `target="_blank"` exige.
 *
 * Sem `rel="noopener"`, a página aberta recebe uma referência de volta por
 * `window.opener` e consegue navegar a origem para onde quiser. É por isso que
 * o `rel` não é opcional aqui: deixá-lo a cargo de quem chama garante que um
 * dia alguém esquece (§8.3).
 */
export function externalLink({ href, text, attrs = {}, classes = [] }) {
  return el("a", {
    text,
    classes,
    attrs: { ...attrs, href, target: "_blank", rel: "noopener noreferrer" },
  });
}

/**
 * Substitui todo o conteúdo de um contêiner.
 *
 * Existe para que ninguém precise de `innerHTML = ""` para limpar — que é o
 * atalho que reintroduz o hábito que este módulo remove.
 */
export function replaceContent(container, ...children) {
  container.replaceChildren(...children);

  return container;
}
