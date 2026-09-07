import { ApiError, MALFORMED_MESSAGE } from "@/shared/api/errors.js";
import { normalizeQuery, parseCard, parseCardList } from "@/features/cards/api/cards-api.js";
import { readCardQuery, writeCardQuery } from "@/features/cards/utils/card-query.js";
import { assertNull, assertSame, assertThrows, suite, test } from "~/runner.js";

const cartaValida = {
  id: 12,
  nameEn: "Black Lotus",
  namePt: null,
  game: { id: "magic", name: "Magic: The Gathering" },
  edition: { id: "dom", name: "Dominaria" },
  rarity: { id: "mythic", name: "Mítica" },
  imageUrl: "https://exemplo.test/lotus.png",
  createdAt: "2026-09-04T12:00:00-03:00",
  updatedAt: null,
};

suite("features/cards/api · validação na borda", () => {
  test("normaliza a carta do contrato", () => {
    const card = parseCard(cartaValida);

    assertSame(card.nameEn, "Black Lotus");
    assertSame(card.game.name, "Magic: The Gathering");
    assertSame(card.rarity.id, "mythic");
  });

  test("namePt ausente é válido, e vira nulo (RN-03)", () => {
    // O desafio diz explicitamente que o nome em português "pode existir ou
    // não". String vazia também é ausência.
    assertNull(parseCard({ ...cartaValida, namePt: null }).namePt);
    assertNull(parseCard({ ...cartaValida, namePt: "" }).namePt);
    assertSame(parseCard({ ...cartaValida, namePt: "Lótus Negro" }).namePt, "Lótus Negro");
  });

  test("recusa carta sem nome em inglês", () => {
    assertNull(parseCard({ ...cartaValida, nameEn: "" }));
    assertNull(parseCard({ ...cartaValida, nameEn: undefined }));
  });

  test("recusa carta sem jogo, edição ou raridade", () => {
    assertNull(parseCard({ ...cartaValida, game: null }));
    assertNull(parseCard({ ...cartaValida, edition: { id: "dom" } }));
    assertNull(parseCard({ ...cartaValida, rarity: "mythic" }));
  });

  test("descarta imageUrl com esquema perigoso em vez de propagá-la", () => {
    // A allowlist roda na BORDA: nenhum componente adiante precisa lembrar.
    assertNull(parseCard({ ...cartaValida, imageUrl: "javascript:alert(1)" }).imageUrl);
    assertNull(parseCard({ ...cartaValida, imageUrl: "data:text/html,<script>" }).imageUrl);
  });

  test("aceita imageUrl relativa, que é como o upload volta", () => {
    assertSame(
      parseCard({ ...cartaValida, imageUrl: "/api/media/a1b2.webp" }).imageUrl,
      "/api/media/a1b2.webp",
    );
  });
});

suite("features/cards/api · envelope da listagem", () => {
  const envelope = (data, pagination) => ({
    data,
    pagination: { page: 1, perPage: 20, total: data.length, totalPages: 1, ...pagination },
  });

  test("normaliza a lista e a paginação", () => {
    const { cards, pagination } = parseCardList(envelope([cartaValida]));

    assertSame(cards.length, 1);
    assertSame(pagination.page, 1);
    assertSame(pagination.total, 1);
  });

  test("UMA carta ruim não derruba a listagem inteira", () => {
    // Um registro velho no banco não pode esconder as outras trinta cartas
    // (§7.3). Ela é descartada e contada, para não sumir do radar.
    const { cards, discarded } = parseCardList(
      envelope([cartaValida, { id: "não é número" }, { ...cartaValida, id: 13 }]),
    );

    assertSame(cards.length, 2);
    assertSame(discarded, 1);
  });

  test("envelope fora do contrato vira mensagem de reserva", () => {
    const erro = assertThrows(() => parseCardList({ data: "não é lista" }), ApiError);
    assertSame(erro.message, MALFORMED_MESSAGE);

    assertThrows(() => parseCardList({ data: [], pagination: null }), ApiError);
  });
});

suite("features/cards/api · normalização da consulta", () => {
  test("aplica os padrões do contrato", () => {
    const q = normalizeQuery({});

    assertSame(q.page, 1);
    assertSame(q.perPage, 20);
    assertSame(q.sort, "recent");
    assertSame(q.search, "");
  });

  test("trunca perPage no teto em vez de recusar", () => {
    assertSame(normalizeQuery({ perPage: 500 }).perPage, 100);
    assertSame(normalizeQuery({ perPage: 0 }).perPage, 1);
  });

  test("página inválida cai em 1", () => {
    assertSame(normalizeQuery({ page: -3 }).page, 1);
    assertSame(normalizeQuery({ page: 1.5 }).page, 1);
  });

  test("sort fora da allowlist vira o padrão, não vai para o servidor", () => {
    // É o único ponto em que algo do cliente chega perto de um nome de coluna.
    assertSame(normalizeQuery({ sort: "senha" }).sort, "recent");
    assertSame(normalizeQuery({ sort: "name" }).sort, "name");
  });

  test("edição e raridade SEM jogo são descartadas", () => {
    // O contrato só as aceita junto de `game`; mandá-las soltas faria o
    // servidor recusar com 400 uma tela que o usuário montou clicando.
    const q = normalizeQuery({ edition: "dom", rarity: "mythic" });

    assertNull(q.edition);
    assertNull(q.rarity);
  });

  test("edição e raridade COM jogo passam", () => {
    const q = normalizeQuery({ game: "magic", edition: "dom", rarity: "mythic" });

    assertSame(q.edition, "dom");
    assertSame(q.rarity, "mythic");
  });

  test("apara espaço da busca", () => {
    assertSame(normalizeQuery({ search: "  Black Lotus  " }).search, "Black Lotus");
  });
});

suite("features/cards/utils · consulta na URL", () => {
  test("valor padrão NÃO vira parâmetro", () => {
    // A URL é copiada e compartilhada: o que está nela deve ser o que a pessoa
    // escolheu, não o que ela não mudou.
    assertSame(writeCardQuery({ page: 1, sort: "recent" }), "");
  });

  test("escreve só o que difere do padrão", () => {
    assertSame(writeCardQuery({ page: 2 }), "?page=2");
    assertSame(writeCardQuery({ sort: "name" }), "?ordem=name");
  });

  test("os parâmetros da URL estão em português", () => {
    const url = writeCardQuery({ search: "Ilha", game: "magic", edition: "dom" });

    assertSame(url, "?busca=Ilha&jogo=magic&edicao=dom");
  });

  test("ida e volta preserva a consulta", () => {
    const original = { page: 3, search: "Anão", game: "magic", rarity: "mythic", sort: "name" };
    const devolta = readCardQuery(writeCardQuery(original));

    assertSame(devolta.page, 3);
    assertSame(devolta.search, "Anão");
    assertSame(devolta.game, "magic");
    assertSame(devolta.rarity, "mythic");
    assertSame(devolta.sort, "name");
  });

  test("query string hostil é descartada, não repassada", () => {
    // A URL é dado de fora (§8.5): quem digita `?ordem=;DROP` na barra do
    // navegador recebe a ordenação padrão, e o servidor nunca vê o valor.
    const q = readCardQuery("?ordem=%3BDROP&page=abc&edicao=dom");

    assertSame(q.sort, "recent");
    assertSame(q.page, 1);
    assertNull(q.edition, "edição sem jogo não passa");
  });

  test("query string vazia devolve a consulta padrão", () => {
    const q = readCardQuery("");

    assertSame(q.page, 1);
    assertSame(q.sort, "recent");
  });
});
