/**
 * A paleta lida do próprio `tokens.css`, e o contraste medido.
 *
 * A tela `/paleta` existe para avaliar mudança de cor sem abrir o arquivo nem
 * refazer conta à mão. Ela só vale alguma coisa se duas coisas forem verdade:
 * que o que ela mostra é o que o `tokens.css` declara AGORA — uma lista de
 * tokens escrita à mão mentiria na primeira cor que mudasse —, e que o
 * contraste que ela calcula é o mesmo que a tabela do `docs/design.md` §3
 * registra. Se as duas discordassem, uma estaria mentindo.
 */

import {
  collectTokens,
  contrastPairs,
  contrastRatio,
  readTokenRules,
  resolveColor,
} from "@/shared/theme/palette.js";
import { assertEquals, assertFalse, assertNull, assertSame, assertTrue, suite, test } from "~/runner.js";

const regra = (selector, declarations) => ({ selector, declarations });

/** Os tokens de cor que o projeto declara hoje, na ordem do arquivo. */
const NOMES = [
  "--color-bg",
  "--color-surface",
  "--color-ink",
  "--color-body",
  "--color-muted",
  "--color-line",
  "--color-line-art",
  "--color-line-art-strong",
  "--color-border",
  "--color-brand",
  "--color-accent",
  "--color-on-accent",
  "--color-accent-soft",
  "--color-success",
  "--color-success-soft",
  "--color-attention",
  "--color-attention-soft",
  "--color-danger",
  "--color-danger-soft",
  "--color-info",
  "--color-info-soft",
  "--color-focus",
];

const temPar = (pares, fg, bg) => pares.some((par) => par.fg === fg && par.bg === bg);

suite("shared/theme/palette · a fórmula de contraste", () => {
  test("branco sobre preto é 21:1, o máximo da fórmula", () => {
    assertSame(contrastRatio([255, 255, 255], [0, 0, 0]).toFixed(2), "21.00");
  });

  test("uma cor contra ela mesma é 1:1", () => {
    assertSame(contrastRatio([191, 53, 32], [191, 53, 32]).toFixed(2), "1.00");
  });

  test("a ordem do par não muda a razão", () => {
    assertSame(contrastRatio([0, 0, 0], [191, 53, 32]), contrastRatio([191, 53, 32], [0, 0, 0]));
  });

  test("concorda com a tabela medida do design.md: acento sobre branco dá 6,11:1", () => {
    // O número vem da §3 do `docs/design.md`. A tela tem de chegar ao mesmo
    // valor da tabela, ou uma das duas está errada — e este teste muda junto
    // com a tabela sempre que o acento mudar.
    assertSame(contrastRatio(resolveColor("#6a4bc6"), resolveColor("#ffffff")).toFixed(2), "6.11");
  });
});

suite("shared/theme/palette · leitura de cor", () => {
  test("resolve hexadecimal curto e longo", () => {
    assertEquals(resolveColor("#fff"), [255, 255, 255]);
    assertEquals(resolveColor("#bf3520"), [191, 53, 32]);
  });

  test("resolve rgb() e oklch(), que é para onde a paleta nova pode ir", () => {
    assertEquals(resolveColor("rgb(18 113 25)"), [18, 113, 25]);

    const oklch = resolveColor("oklch(0.62 0.2 29)");

    assertTrue(Array.isArray(oklch) && oklch.length === 3, "oklch() não foi resolvida em RGB");
  });

  test("o que não é cor devolve nulo, em vez de uma cor inventada", () => {
    // O navegador ignora em silêncio um `fillStyle` inválido e mantém o
    // anterior. Sem a checagem, "0.25rem" sairia com a cor do token de antes.
    assertNull(resolveColor("0.25rem"));
    assertNull(resolveColor("banana"));
  });

  test("cor com transparência não é medida, porque o resultado depende do que está atrás", () => {
    assertNull(resolveColor("rgb(0 0 0 / 0.5)"));
    assertNull(resolveColor("transparent"));
  });

  test("referência a outro token não é medida: o valor dela depende do tema em uso", () => {
    // `var()` passa em `CSS.supports`, mas o canvas não sabe resolvê-la — e
    // manteria em silêncio a cor anterior.
    assertNull(resolveColor("var(--color-info)"));
  });
});

suite("shared/theme/palette · os tokens", () => {
  test("junta claro e escuro de cada token, na ordem em que foram declarados", () => {
    const tokens = collectTokens(
      [
        regra(":root", [["--color-bg", "#f6f1ea"], ["--color-ink", "#26201e"]]),
        regra(':root[data-theme="dark"]', [["--color-ink", "#f3ece4"], ["--color-bg", "#14100e"]]),
      ],
      "--color-",
    );

    assertEquals(tokens, [
      { name: "--color-bg", light: "#f6f1ea", dark: "#14100e" },
      { name: "--color-ink", light: "#26201e", dark: "#f3ece4" },
    ]);
  });

  test("deixa de fora o que não tem o prefixo pedido", () => {
    const tokens = collectTokens(
      [regra(":root", [["--color-bg", "#f6f1ea"], ["--space-1", "0.25rem"]])],
      "--color-",
    );

    assertEquals(tokens.map((token) => token.name), ["--color-bg"]);
  });

  test("token sem valor no escuro herda o do claro, como na cascata", () => {
    const [raio] = collectTokens([regra(":root", [["--radius-sm", "0.25rem"]])], "--radius-");

    assertSame(raio.dark, "0.25rem");
  });

  test("o escuro vem da regra explícita, não do bloco da preferência do sistema", () => {
    // `tokens.css` declara o escuro duas vezes: sob `prefers-color-scheme` e
    // sob `[data-theme="dark"]`. Os valores são iguais, e ler só um evita que
    // uma divergência futura entre os dois apareça como token duplicado.
    const [bg] = collectTokens(
      [
        regra(":root", [["--color-bg", "#f6f1ea"]]),
        regra(':root:not([data-theme="light"])', [["--color-bg", "#000000"]]),
        regra(':root[data-theme="dark"]', [["--color-bg", "#14100e"]]),
      ],
      "--color-",
    );

    assertSame(bg.dark, "#14100e");
  });

  test("lê o tokens.css de verdade, que a página de testes carrega", () => {
    const tokens = collectTokens(readTokenRules(document.styleSheets), "--color-");
    const bg = tokens.find((token) => token.name === "--color-bg");

    assertTrue(bg !== undefined, "o token --color-bg não foi encontrado nas folhas carregadas");
    assertTrue(bg.light !== "" && bg.dark !== "", "o fundo veio sem valor em um dos temas");
    assertTrue(bg.light !== bg.dark, "claro e escuro saíram iguais: o escuro não foi lido");
  });
});

suite("shared/theme/palette · os pares medidos", () => {
  // Calculado dentro de cada teste, e não no corpo da suíte: uma exceção aqui
  // aconteceria no registro e derrubaria a página de testes inteira.
  const pares = () => contrastPairs(NOMES);

  test("toda tinta é medida contra o fundo e contra a superfície", () => {
    for (const tinta of ["--color-ink", "--color-muted", "--color-accent", "--color-danger"]) {
      assertTrue(temPar(pares(), tinta, "--color-bg"), `${tinta} não foi medida sobre o fundo`);
      assertTrue(temPar(pares(), tinta, "--color-surface"), `${tinta} não foi medida sobre a superfície`);
    }
  });

  test("a tinta de uma superfície de ação é medida sobre ela", () => {
    assertTrue(temPar(pares(), "--color-on-accent", "--color-accent"), "on-accent não foi medida sobre o acento");
  });

  test("cada cor é medida sobre a própria versão suave", () => {
    for (const cor of ["accent", "success", "attention", "danger", "info"]) {
      assertTrue(
        temPar(pares(), `--color-${cor}`, `--color-${cor}-soft`),
        `--color-${cor} não foi medida sobre a própria versão suave`,
      );
    }
  });

  test("o foco é medido a 3:1, que é o piso de componente, e não o de texto", () => {
    const foco = pares().find((par) => par.fg === "--color-focus" && par.bg === "--color-bg");

    assertSame(foco?.min, 3);
    assertSame(pares().find((par) => par.fg === "--color-ink").min, 4.5);
  });

  test("a borda de controle é medida a 3:1, como componente — nunca como texto", () => {
    // É o limite que identifica um campo de formulário (WCAG 1.4.11). A linha
    // decorativa não identifica nada e não é medida; a borda de controle é.
    const borda = pares().filter((par) => par.fg === "--color-border");

    assertSame(borda.length, 2);
    assertTrue(borda.every((par) => par.min === 3), "a borda foi medida com o piso de texto");
    assertTrue(temPar(pares(), "--color-border", "--color-surface"), "a borda não foi medida sobre a superfície");
  });

  test("fundo, superfície, linha e as versões suaves nunca entram como tinta", () => {
    for (const nome of ["--color-bg", "--color-surface", "--color-line", "--color-success-soft"]) {
      assertTrue(!pares().some((par) => par.fg === nome), `${nome} foi medido como se fosse texto`);
    }
  });

  test("a família da linha inteira fica de fora, e não só o nome exato", () => {
    /*
     * `--color-line-art` é o traço do verso da carta: decorativo, como a
     * divisória, e por isso medido a nada — não a 4,5:1, que ele reprovaria
     * por projeto (1,34:1 no claro). A regra é a FAMÍLIA, e não o nome exato:
     * escrita como igualdade, cada tom de arte novo entrava como texto e
     * derrubava a `/paleta` no dia em que nascesse.
     */
    for (const nome of ["--color-line-art", "--color-line-art-strong"]) {
      const comArte = contrastPairs([...NOMES, nome]);

      assertFalse(
        comArte.some((par) => par.fg === nome),
        `${nome} foi medido como se fosse texto`,
      );
      assertFalse(
        comArte.some((par) => par.bg === nome),
        `${nome} virou superfície de alguma tinta`,
      );
    }
  });

  test("são os 24 pares por tema do design.md, mais os dois do foco e os dois da borda", () => {
    assertSame(pares().length, 28);
  });

  test("fundo de raridade só se mede com a própria tinta em cima, nunca contra a superfície", () => {
    // O selo de raridade é fundo e tinta, como o botão de ação. Tratado como
    // tinta, o fundo seria medido contra a superfície — um par que não existe
    // na tela. E tirá-lo das tintas não basta: o par `on-X` sobre `X` só nascia
    // quando `X` era tinta, e a medida que importa sumiria junto.
    const comRaridade = contrastPairs([...NOMES, "--color-rarity-gold", "--color-on-rarity-gold"]);

    assertTrue(temPar(comRaridade, "--color-on-rarity-gold", "--color-rarity-gold"), "a tinta sobre o selo não foi medida");
    assertFalse(temPar(comRaridade, "--color-rarity-gold", "--color-surface"), "o fundo do selo foi medido como tinta");
    assertFalse(temPar(comRaridade, "--color-rarity-gold", "--color-bg"), "o fundo do selo foi medido como tinta");
    assertSame(comRaridade.length, 29);
  });
});
