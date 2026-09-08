/**
 * Leitura do catálogo de cartas.
 *
 * A resposta é **validada na borda, uma vez**, e o resto da tela trabalha com
 * o dado já normalizado — sem `carta?.game?.name` defensivo espalhado por cada
 * componente (PADROES-ENGENHARIA.md §5.2).
 */

import { api } from "@/shared/api/client.js";
import { API_ENDPOINTS } from "@/shared/api/endpoints.js";
import { ApiError, MALFORMED_MESSAGE } from "@/shared/api/errors.js";
import {
  CACHE_TTL_MS,
  CARD_SORT_OPTIONS,
  DEFAULT_CARD_SORT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/shared/config/constants.js";
import { isSafeUrl } from "@/shared/dom/safe-url.js";
import { cache, cacheKey } from "@/shared/store/cache.js";

/** Um catálogo referenciado pela carta: jogo, edição ou raridade. */
function parseReference(raw) {
  if (raw === null || typeof raw !== "object") {
    return null;
  }

  const { id, name } = raw;

  return typeof id === "string" && typeof name === "string" ? { id, name } : null;
}

/**
 * Normaliza uma carta, ou devolve `null` quando ela não bate com o contrato.
 *
 * **Uma linha ruim não derruba a listagem inteira** (§7.3): quem chama descarta
 * a carta e registra para quem desenvolve, e o catálogo continua utilizável.
 * Falhar a tela toda por causa de um registro faria um dado velho no banco
 * esconder as outras trinta cartas.
 */
export function parseCard(raw) {
  if (raw === null || typeof raw !== "object") {
    return null;
  }

  const { id, nameEn, namePt, imageUrl } = raw;

  if (typeof id !== "number" || typeof nameEn !== "string" || nameEn === "") {
    return null;
  }

  const game = parseReference(raw.game);
  const edition = parseReference(raw.edition);
  const rarity = parseReference(raw.rarity);

  if (game === null || edition === null || rarity === null) {
    return null;
  }

  return {
    id,
    nameEn,
    namePt: typeof namePt === "string" && namePt !== "" ? namePt : null,
    game,
    edition,
    rarity,
    /*
     * A URL passa pela allowlist de esquema AQUI, e não na hora de virar
     * `src`. Validar na borda significa que nenhum componente adiante precisa
     * lembrar de fazê-lo — e `el()` recusaria de qualquer forma, mas aí a
     * carta apareceria sem imagem sem ninguém saber por quê.
     */
    imageUrl: typeof imageUrl === "string" && isSafeUrl(imageUrl) ? imageUrl : null,
  };
}

function parsePagination(raw, fallbackPerPage) {
  const page = Number(raw?.page);
  const perPage = Number(raw?.perPage);
  const total = Number(raw?.total);
  const totalPages = Number(raw?.totalPages);

  if (![page, perPage, total, totalPages].every(Number.isFinite)) {
    return null;
  }

  return { page, perPage: perPage || fallbackPerPage, total, totalPages };
}

/**
 * Normaliza o envelope `{ data, pagination }` do contrato.
 *
 * Devolve também quantas cartas foram descartadas, para a tela poder decidir
 * se avisa — silêncio total sobre dado inválido é como ele fica anos no banco.
 */
export function parseCardList(payload) {
  if (!Array.isArray(payload?.data)) {
    throw new ApiError(200, MALFORMED_MESSAGE, { body: payload });
  }

  const pagination = parsePagination(payload.pagination, DEFAULT_PAGE_SIZE);

  if (pagination === null) {
    throw new ApiError(200, MALFORMED_MESSAGE, { body: payload });
  }

  const cards = [];
  let discarded = 0;

  for (const raw of payload.data) {
    const card = parseCard(raw);

    if (card === null) {
      discarded++;
      console.error("[cards] carta fora do contrato, descartada", { raw });
      continue;
    }

    cards.push(card);
  }

  return { cards, pagination, discarded };
}

/**
 * Normaliza a consulta antes de virar chave de cache e query string.
 *
 * Existe para que a mesma busca produza **sempre** a mesma chave: sem isto,
 * `{ search: "" }` e `{ search: undefined }` gerariam duas entradas de cache
 * para a mesma tela (§5.4).
 */
export function normalizeQuery(query = {}) {
  const page = Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
  const requested = Number.isInteger(query.perPage) ? query.perPage : DEFAULT_PAGE_SIZE;
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const game = typeof query.game === "string" && query.game !== "" ? query.game : null;
  const sort = CARD_SORT_OPTIONS.includes(query.sort) ? query.sort : DEFAULT_CARD_SORT;

  // Edição e raridade só são válidas junto de um jogo (`api-contract.md` §5).
  // Mandá-las soltas faria o servidor recusar com 400 uma tela que o usuário
  // montou clicando.
  const edition = game !== null && typeof query.edition === "string" && query.edition !== ""
    ? query.edition
    : null;
  const rarity = game !== null && typeof query.rarity === "string" && query.rarity !== ""
    ? query.rarity
    : null;

  return {
    page,
    perPage: Math.min(Math.max(requested, 1), MAX_PAGE_SIZE),
    search,
    game,
    edition,
    rarity,
    sort,
  };
}

/**
 * Lista as cartas.
 *
 * **Sobre cancelamento e cache juntos:** cada consulta tem chave própria, então
 * abortar a página 1 não envenena a promessa da página 2 — são chaves
 * diferentes. E o `fetchOnce` tira a chave de "em voo" mesmo no erro, então a
 * página abortada é buscada de novo normalmente quando o usuário voltar a ela.
 *
 * @param {object} query
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function listCards(query, { signal } = {}) {
  const normalized = normalizeQuery(query);

  const key = cacheKey(
    "cards",
    normalized.page,
    normalized.perPage,
    normalized.search,
    normalized.game,
    normalized.edition,
    normalized.rarity,
    normalized.sort,
  );

  const payload = await cache.fetchOnce(
    key,
    () =>
      api.get(API_ENDPOINTS.cards.list, {
        params: {
          page: normalized.page,
          perPage: normalized.perPage,
          search: normalized.search,
          game: normalized.game,
          edition: normalized.edition,
          rarity: normalized.rarity,
          sort: normalized.sort,
        },
        signal,
      }),
    { ttlMs: CACHE_TTL_MS.cards },
  );

  return parseCardList(payload);
}

/**
 * Derruba o cache da listagem.
 *
 * Escopo mínimo: alterar uma carta não muda a lista de edições, então o cache
 * de catálogos fica de pé (§5.4).
 */
export function invalidateCards() {
  cache.invalidate("cards");
}

/**
 * Uma carta específica.
 *
 * `404` quando não existe **ou está excluída** — o contrato não distingue os
 * dois, e o cliente não deve tentar: devolver "existe mas foi excluída"
 * confirmaria a existência do registro (`api-contract.md` §5).
 */
export async function getCard(id, { signal } = {}) {
  const payload = await cache.fetchOnce(
    cacheKey("cards", "byId", id),
    () => api.get(API_ENDPOINTS.cards.byId(id), { signal }),
    { ttlMs: CACHE_TTL_MS.card },
  );

  const card = parseCard(payload?.data);

  if (card === null) {
    throw new ApiError(200, MALFORMED_MESSAGE, { body: payload });
  }

  return card;
}

/**
 * Monta o corpo da escrita **campo a campo**.
 *
 * O corpo da requisição nunca é o objeto do formulário repassado inteiro: `id`,
 * `createdBy` e `createdAt` não vêm do cliente, e a identidade do solicitante
 * vem sempre da sessão, no servidor (RN-08, `PADROES.md` §5.3).
 */
function toCardPayload(form, { confirmDuplicate = false } = {}) {
  return {
    nameEn: form.nameEn.trim(),
    // Ausência é ausência: string vazia vira nulo, porque `namePt` é opcional
    // por regra de negócio, não por descuido (RN-03).
    namePt: form.namePt?.trim() === "" ? null : (form.namePt?.trim() ?? null),
    game: form.game,
    edition: form.edition,
    rarity: form.rarity,
    image: form.image ?? null,
    confirmDuplicate,
  };
}

/**
 * Cria uma carta.
 *
 * **A duplicidade avisa, não bloqueia** (RN-04): o servidor devolve `409` com a
 * carta existente no corpo, e quem chama decide se reenvia com
 * `confirmDuplicate`. Impressões múltiplas na mesma edição são legítimas —
 * terrenos básicos em Magic são o caso clássico.
 */
export async function createCard(form, options = {}) {
  const payload = await api.post(API_ENDPOINTS.cards.list, toCardPayload(form, options), {
    silent: true,
  });

  invalidateCards();

  return parseCard(payload?.data);
}

export async function updateCard(id, form, options = {}) {
  const payload = await api.put(API_ENDPOINTS.cards.byId(id), toCardPayload(form, options), {
    silent: true,
  });

  invalidateCards();
  cache.invalidate(cacheKey("cards", "byId", id));

  return parseCard(payload?.data);
}

/**
 * A carta duplicada que o `409` carrega, normalizada.
 *
 * Devolve `null` quando o corpo não traz o aviso — o mesmo `409` também cobre
 * outras violações de estado, e a tela não pode presumir qual foi.
 */
export function parseDuplicate(error) {
  const raw = error?.body?.duplicate;

  if (raw === null || typeof raw !== "object") {
    return null;
  }

  const edition = raw.edition;

  return typeof raw.nameEn === "string"
    ? {
        id: raw.id,
        nameEn: raw.nameEn,
        editionName: typeof edition?.name === "string" ? edition.name : null,
      }
    : null;
}
