import { API_ENDPOINTS } from "@/shared/api/endpoints.js";
import { CARD_SORT_OPTIONS, PERMISSION_LEVELS } from "@/shared/config/constants.js";
import { ConfigError, loadConfig } from "@/shared/config/env.js";
import { assertSame, assertThrows, assertTrue, suite, test } from "~/runner.js";

suite("shared/config/env", () => {
  test("devolve a configuração e a entrega congelada", () => {
    const config = loadConfig();

    assertSame(config.apiBase, "/api");
    assertSame(config.defaultPageSize, 20);
    assertTrue(Object.isFrozen(config), "configuração alterável é uma segunda fonte de verdade");
  });

  test("o endereço da API é relativo, para a mesma origem valer", () => {
    // Endereço absoluto aqui reintroduziria CORS, preflight e SameSite=None —
    // os três problemas que o ADR-003 elimina.
    assertTrue(loadConfig().apiBase.startsWith("/"));
  });

  test("ConfigError nomeia a chave quebrada", () => {
    const error = assertThrows(() => {
      throw new ConfigError("DEFAULT_PAGE_SIZE", "esperado um inteiro positivo");
    }, ConfigError);

    assertSame(error.key, "DEFAULT_PAGE_SIZE");
    assertTrue(
      error.message.includes("DEFAULT_PAGE_SIZE"),
      "quem lê o erro precisa saber que arquivo abrir",
    );
  });
});

suite("shared/config/constants", () => {
  test("os níveis são hierárquicos e batem com o enum do backend", () => {
    assertSame(PERMISSION_LEVELS.VIEWER, 1);
    assertSame(PERMISSION_LEVELS.EDITOR, 2);
    assertSame(PERMISSION_LEVELS.ADMIN, 3);
    assertTrue(
      PERMISSION_LEVELS.VIEWER < PERMISSION_LEVELS.EDITOR &&
        PERMISSION_LEVELS.EDITOR < PERMISSION_LEVELS.ADMIN,
      "fora de ordem, ADMIN deixaria de alcançar o que EDITOR alcança",
    );
  });

  test("a allowlist de ordenação é exatamente a do contrato", () => {
    assertSame(CARD_SORT_OPTIONS.join(","), "recent,name,game");
  });
});

suite("shared/api/endpoints", () => {
  test("monta o caminho da carta pelo id", () => {
    assertSame(API_ENDPOINTS.cards.byId(12), "/cards/12");
    assertSame(API_ENDPOINTS.cards.history(12), "/cards/12/history");
    assertSame(API_ENDPOINTS.cards.restore(12), "/cards/12/restore");
  });

  test("escapa o trecho que vai para dentro do caminho", () => {
    // O gameId vem da seleção do usuário. Uma barra crua mudaria a rota
    // chamada — deixaria de ser /games/{id}/editions.
    const path = API_ENDPOINTS.catalogs.editions("magic/../admin");

    assertSame(path.includes("../"), false, "o caminho não pode escapar da rota");
    assertSame(path, "/games/magic%2F..%2Fadmin/editions");
  });

  test("escapa a referência de imagem", () => {
    assertSame(API_ENDPOINTS.media.byReference("../../.env"), "/media/..%2F..%2F.env");
  });

  test("a coleção de cartas é uma entrada só, usada por listar e criar", () => {
    // Duas constantes com o mesmo valor divergiriam na primeira mudança.
    assertSame(API_ENDPOINTS.cards.list, "/cards");
    assertSame(API_ENDPOINTS.cards.create, undefined);
  });
});
