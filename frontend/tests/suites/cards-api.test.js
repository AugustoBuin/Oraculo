import { ApiError, MALFORMED_MESSAGE } from "@/shared/api/errors.js";
import {
  createCard,
  getCardHistory,
  normalizeQuery,
  parseCard,
  parseCardList,
  parseDuplicate,
} from "@/features/cards/api/cards-api.js";
import { readCardQuery, writeCardQuery } from "@/features/cards/utils/card-query.js";
import { cache, cacheKey } from "@/shared/store/cache.js";
import { fetchDouble } from "~/doubles/fetch.js";
import { assertNull, assertRejects, assertSame, assertThrows, suite, test } from "~/runner.js";

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

suite("features/cards/api · escrita", () => {
  const carta = {
    nameEn: "  Black Lotus  ",
    namePt: "  ",
    game: "magic",
    edition: "dom",
    rarity: "mythic",
    image: null,
  };

  const resposta = {
    data: {
      id: 12,
      nameEn: "Black Lotus",
      namePt: null,
      game: { id: "magic", name: "Magic" },
      edition: { id: "dom", name: "Dominaria" },
      rarity: { id: "mythic", name: "Mítica" },
      imageUrl: null,
    },
  };

  async function withFetch(body) {
    const double = fetchDouble();

    try {
      await body(double);
      assertSame(double.unexpected.length, 0, `requisição não prevista: ${double.unexpected}`);
    } finally {
      double.restore();
      cache.clear();
    }
  }

  test("monta o corpo campo a campo, sem id nem autoria", async () => {
    // O corpo nunca é o objeto do formulário repassado inteiro: `id`,
    // `createdBy` e `createdAt` não vêm do cliente, e a identidade do
    // solicitante vem da sessão, no servidor (RN-08).
    await withFetch(async (double) => {
      double.onJson("POST", "/api/cards", resposta, 201);

      await createCard({ ...carta, id: 99, createdBy: 1, createdAt: "hoje" });

      const enviado = JSON.parse(double.lastCall.body);
      assertSame(
        Object.keys(enviado).sort().join(","),
        "confirmDuplicate,edition,game,image,nameEn,namePt,rarity",
      );
    });
  });

  test("apara o nome e transforma nome PT vazio em nulo (RN-03)", async () => {
    await withFetch(async (double) => {
      double.onJson("POST", "/api/cards", resposta, 201);

      await createCard(carta);

      const enviado = JSON.parse(double.lastCall.body);
      assertSame(enviado.nameEn, "Black Lotus");
      assertNull(enviado.namePt, "string vazia é ausência, não texto em branco");
    });
  });

  test("confirmDuplicate só vai como verdadeiro quando o usuário confirma", async () => {
    await withFetch(async (double) => {
      double.onJson("POST", "/api/cards", resposta, 201);

      await createCard(carta);
      assertSame(JSON.parse(double.lastCall.body).confirmDuplicate, false);

      await createCard(carta, { confirmDuplicate: true });
      assertSame(JSON.parse(double.lastCall.body).confirmDuplicate, true);
    });
  });

  test("o 409 de duplicidade carrega a carta existente", async () => {
    await withFetch(async (double) => {
      double.on("POST", "/api/cards", {
        status: 409,
        body: JSON.stringify({
          message: "Já existe uma carta com este nome nesta edição.",
          duplicate: { id: 8, nameEn: "Forest", edition: { id: "dom", name: "Dominaria" } },
        }),
      });

      const erro = await assertRejects(createCard(carta), ApiError);
      const duplicata = parseDuplicate(erro);

      assertSame(duplicata.nameEn, "Forest");
      assertSame(duplicata.editionName, "Dominaria");
    });
  });

  test("409 sem aviso de duplicidade devolve nulo, sem presumir a causa", async () => {
    // O mesmo 409 cobre outras violações de estado; a tela não pode presumir
    // qual foi e mostrar um aviso de duplicidade que não existe.
    await withFetch(async (double) => {
      double.on("POST", "/api/cards", {
        status: 409,
        body: JSON.stringify({ message: "Conflito de estado." }),
      });

      const erro = await assertRejects(createCard(carta), ApiError);
      assertNull(parseDuplicate(erro));
    });
  });

  test("salvar derruba o cache da listagem, e só dele", async () => {
    // Alterar uma carta não muda a lista de edições: derrubar o catálogo junto
    // transformaria o cache em enfeite (§5.4).
    await withFetch(async (double) => {
      double.onJson("POST", "/api/cards", resposta, 201);

      await cache.fetchOnce(cacheKey("cards", 1), async () => "lista", { ttlMs: 60000 });
      await cache.fetchOnce(cacheKey("catalogs", "games"), async () => "jogos", { ttlMs: 60000 });

      await createCard(carta);

      assertSame(cache.peek(cacheKey("cards", 1)), undefined);
      assertSame(cache.peek(cacheKey("catalogs", "games")), "jogos");
    });
  });
});

suite("features/cards/api · histórico", () => {
  async function withFetch(body) {
    const double = fetchDouble();

    try {
      await body(double);
      assertSame(double.unexpected.length, 0, `requisição não prevista: ${double.unexpected}`);
    } finally {
      double.restore();
      cache.clear();
    }
  }

  test("normaliza as entradas do contrato", async () => {
    await withFetch(async (double) => {
      double.onJson("GET", "/api/cards/12/history", {
        data: [
          {
            action: "updated",
            user: { id: 2, name: "Editor de Catálogo" },
            changes: { rarity: { from: "Rara", to: "Mítica" } },
            createdAt: "2026-09-04T14:31:02-03:00",
          },
        ],
      });

      const entradas = await getCardHistory(12);

      assertSame(entradas.length, 1);
      assertSame(entradas[0].action, "updated");
      assertSame(entradas[0].userName, "Editor de Catálogo");
      assertSame(entradas[0].changes.rarity.to, "Mítica");
    });
  });

  test("um registro fora do contrato não derruba o painel", async () => {
    await withFetch(async (double) => {
      double.onJson("GET", "/api/cards/12/history", {
        data: [
          { action: "created", user: { name: "Alguém" }, changes: {}, createdAt: "2026-09-04T14:31:02-03:00" },
          { semAcao: true },
        ],
      });

      const entradas = await getCardHistory(12);

      assertSame(entradas.length, 1, "a linha ruim foi descartada, o resto ficou");
    });
  });

  test("autor removido não vira 'undefined' na tela", async () => {
    await withFetch(async (double) => {
      double.onJson("GET", "/api/cards/12/history", {
        data: [{ action: "deleted", changes: {}, createdAt: "2026-09-04T14:31:02-03:00" }],
      });

      assertNull((await getCardHistory(12))[0].userName);
    });
  });
});
