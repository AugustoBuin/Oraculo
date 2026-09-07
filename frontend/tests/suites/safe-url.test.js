import { isSafeUrl } from "@/shared/dom/safe-url.js";
import { assertFalse, assertTrue, suite, test } from "~/runner.js";

suite("shared/dom/safe-url", () => {
  test("aceita http e https", () => {
    assertTrue(isSafeUrl("http://exemplo.test/carta.png"));
    assertTrue(isSafeUrl("https://exemplo.test/carta.png"));
  });

  test("aceita caminho relativo da própria origem", () => {
    // É a forma que o servidor devolve a imagem enviada: /api/media/<ref>.
    assertTrue(isSafeUrl("/api/media/a1b2c3.webp"));
  });

  test("recusa javascript:", () => {
    assertFalse(isSafeUrl("javascript:alert(1)"));
  });

  test("recusa javascript: disfarçado de maiúsculas", () => {
    // A normalização do construtor URL é o que fecha esta: uma comparação de
    // string escrita à mão passaria.
    assertFalse(isSafeUrl("JaVaScRiPt:alert(1)"));
  });

  test("recusa javascript: com espaço antes do esquema", () => {
    assertFalse(isSafeUrl("   javascript:alert(1)"));
  });

  test("recusa data:, que carrega documento inteiro", () => {
    assertFalse(isSafeUrl("data:text/html,<script>alert(1)</script>"));
  });

  test("recusa vbscript: e file:", () => {
    assertFalse(isSafeUrl("vbscript:msgbox(1)"));
    assertFalse(isSafeUrl("file:///etc/passwd"));
  });

  test("recusa string vazia, só espaços e valor que não é texto", () => {
    assertFalse(isSafeUrl(""));
    assertFalse(isSafeUrl("   "));
    assertFalse(isSafeUrl(null));
    assertFalse(isSafeUrl(undefined));
    assertFalse(isSafeUrl(42));
    assertFalse(isSafeUrl({}));
  });

  test("recusa URL absoluta malformada sem lançar", () => {
    // Entrada do usuário chega assim o tempo todo (RF-31). O construtor URL
    // lança em host vazio; recusar é o comportamento certo, e lançar aqui
    // derrubaria o formulário inteiro.
    assertFalse(isSafeUrl("http://"));
    assertFalse(isSafeUrl("https://"));
  });

  test("texto sem esquema é caminho da própria origem, e isso é seguro", () => {
    // `://sem-esquema` não é URL absoluta: o parser o resolve como caminho
    // relativo, virando http://<origem>/://sem-esquema. Não executa nada e não
    // sai da origem — no pior caso dá 404 e a carta cai no espaço reservado
    // (RF-34). Esta função responde "é seguro?", não "está bem formado?".
    assertTrue(isSafeUrl("://sem-esquema"));
    assertTrue(isSafeUrl("cartas/12"));
  });

  test("aceita URL de outra origem por http(s), que o RF-31 permite", () => {
    // Imagem por URL de CDN é caminho previsto. Sair da origem não é o
    // problema; sair do esquema é.
    assertTrue(isSafeUrl("//exemplo.test/carta.png"));
    assertTrue(isSafeUrl("https://cdn.exemplo.test/carta.png"));
  });
});
