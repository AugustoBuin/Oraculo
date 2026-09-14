/**
 * As rotas da API, nomeadas em um lugar só.
 *
 * Nenhuma URL de API é escrita fora deste arquivo. É o que permite trocar um
 * caminho, versionar a API ou acrescentar um prefixo sem varrer o projeto — e
 * é o que impede que uma rota literal apareça no meio de um componente, que é
 * achado CRÍTICO em auditoria (PADROES-ENGENHARIA.md §4.3 e §17.1).
 *
 * A tabela completa, com o nível exigido por rota, está em
 * `docs/api-contract.md` §9. São 22 rotas; todas aparecem aqui.
 */

/**
 * O prefixo de toda a API.
 *
 * Relativo, e não absoluto, porque frontend e API compartilham a mesma origem
 * — é isso que elimina CORS, preflight e `SameSite=None`
 * (docs/decisions/ADR-003). Um host aqui reintroduziria os três.
 */
export const API_BASE = "/api";

/**
 * Todo trecho que vai para dentro de um caminho é escapado.
 *
 * O `gameId` vem da seleção do usuário e o `reference` de imagem vem do
 * servidor, mas nenhum dos dois é confiável ao ponto de ser concatenado cru:
 * uma barra ou um `..` no valor mudaria a rota chamada.
 */
const segment = (value) => encodeURIComponent(String(value));

export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    session: "/auth/session",
    password: "/auth/password",
  },
  cards: {
    // Cada entrada nomeia um **caminho**, não uma operação: `list` é a coleção,
    // usada tanto pelo GET que lista quanto pelo POST que cria. Duas constantes
    // com o mesmo valor divergiriam na primeira vez que o caminho mudasse.
    list: "/cards",
    byId: (id) => `/cards/${segment(id)}`,
    history: (id) => `/cards/${segment(id)}/history`,
    restore: (id) => `/cards/${segment(id)}/restore`,
  },
  catalogs: {
    games: "/games",
    editions: (gameId) => `/games/${segment(gameId)}/editions`,
    rarities: (gameId) => `/games/${segment(gameId)}/rarities`,
    editionById: (id) => `/editions/${segment(id)}`,
    rarityById: (id) => `/rarities/${segment(id)}`,
  },
  uploads: {
    cardImage: "/uploads/card-image",
  },
  media: {
    byReference: (reference) => `/media/${segment(reference)}`,
  },
};
