import { el, externalLink, replaceContent } from "@/shared/dom/elements.js";
import { assertSame, assertThrows, suite, test } from "~/runner.js";

suite("shared/dom/elements", () => {
  test("texto vai por textContent, nunca vira HTML", () => {
    const hostile = '<img src=x onerror="alert(1)">';
    const node = el("span", { text: hostile });

    assertSame(node.textContent, hostile);
    // O nó não tem filho elemento nenhum: o markup virou texto visível, que é
    // exatamente o que se quer de um nome de carta vindo do banco.
    assertSame(node.children.length, 0);
  });

  test("converte valor que não é texto em vez de escrever [object Object]", () => {
    assertSame(el("span", { text: 12 }).textContent, "12");
  });

  test("texto ausente não vira a string vazia nem 'null'", () => {
    assertSame(el("span").textContent, "");
    assertSame(el("span", { text: null }).textContent, "");
  });

  test("recusa atributo de evento e aponta a alternativa", () => {
    const error = assertThrows(() => el("button", { attrs: { onclick: "alert(1)" } }), TypeError);
    assertSame(error.message.includes("on()"), true, "a mensagem deveria apontar on()");
  });

  test("recusa atributo de evento em qualquer capitalização", () => {
    assertThrows(() => el("button", { attrs: { OnClick: "alert(1)" } }), TypeError);
  });

  test("recusa srcdoc, formaction e style", () => {
    assertThrows(() => el("iframe", { attrs: { srcdoc: "<script>" } }), TypeError);
    assertThrows(() => el("button", { attrs: { formaction: "/x" } }), TypeError);
    // style é recusado por um segundo motivo: valor visual mora em tokens.css.
    assertThrows(() => el("div", { attrs: { style: "color: red" } }), TypeError);
  });

  test("descarta href inseguro sem derrubar a renderização", () => {
    // URL insegura é DADO, não erro de programação: pode vir de uma carta
    // antiga. O elemento nasce sem o atributo e a listagem continua de pé.
    const node = el("a", { text: "carta", attrs: { href: "javascript:alert(1)" } });

    assertSame(node.hasAttribute("href"), false);
    assertSame(node.textContent, "carta");
  });

  test("descarta src inseguro e mantém o resto dos atributos", () => {
    const node = el("img", { attrs: { src: "data:text/html,<script>", alt: "Black Lotus" } });

    assertSame(node.hasAttribute("src"), false);
    assertSame(node.getAttribute("alt"), "Black Lotus");
  });

  test("aceita href e src seguros", () => {
    assertSame(el("a", { attrs: { href: "/cartas" } }).getAttribute("href"), "/cartas");
    assertSame(
      el("img", { attrs: { src: "https://exemplo.test/c.png" } }).getAttribute("src"),
      "https://exemplo.test/c.png",
    );
  });

  test("booleano falso remove o atributo em vez de escrever 'false'", () => {
    // `disabled="false"` é lido pelo HTML como desabilitado — o oposto.
    assertSame(el("button", { attrs: { disabled: false } }).hasAttribute("disabled"), false);
    assertSame(el("button", { attrs: { disabled: true } }).getAttribute("disabled"), "");
  });

  test("atributo nulo ou indefinido não vira a string 'null'", () => {
    const node = el("input", { attrs: { value: null, placeholder: undefined } });

    assertSame(node.hasAttribute("value"), false);
    assertSame(node.hasAttribute("placeholder"), false);
  });

  test("link externo sempre sai com noopener noreferrer", () => {
    const link = externalLink({ href: "https://exemplo.test", text: "fonte" });

    assertSame(link.getAttribute("target"), "_blank");
    assertSame(link.getAttribute("rel"), "noopener noreferrer");
  });

  test("aplica classes e monta filhos", () => {
    const node = el("div", {
      classes: ["card", "card-compact"],
      children: [el("h3", { text: "Black Lotus" })],
    });

    assertSame(node.className, "card card-compact");
    assertSame(node.children.length, 1);
    assertSame(node.children[0].textContent, "Black Lotus");
  });

  test("replaceContent troca o conteúdo inteiro", () => {
    const container = el("div", { children: [el("p", { text: "antigo" })] });
    replaceContent(container, el("p", { text: "novo" }));

    assertSame(container.children.length, 1);
    assertSame(container.textContent, "novo");
  });
});
