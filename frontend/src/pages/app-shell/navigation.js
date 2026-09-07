/**
 * O mapa de navegação e o nível que cada destino exige.
 *
 * **Isto não é autorização.** É a lista do que faz sentido oferecer a cada
 * perfil. O servidor recusa a rota de qualquer forma, a cada requisição — o
 * que se resolve aqui é não dar a alguém um botão que ela não precisa apertar
 * (PADROES-ENGENHARIA.md §8.1).
 *
 * A divisão segue a persona do enunciado: o portal será usado por pessoas com
 * diferentes níveis de familiaridade com tecnologia, e a forma mais eficaz de
 * proteger quem tem menos familiaridade não é uma interface mais simples — é
 * uma interface que não oferece o que ela não deve fazer.
 */

export const ROUTES = {
  cards: "/",
  catalogs: "/catalogos",
  account: "/conta",
};

/** @type {ReadonlyArray<{ label: string, href: string, requires: string }>} */
export const NAVIGATION = [
  { label: "Cartas", href: ROUTES.cards, requires: "VIEWER" },
  { label: "Catálogos", href: ROUTES.catalogs, requires: "ADMIN" },
  { label: "Minha conta", href: ROUTES.account, requires: "VIEWER" },
];

/**
 * Os itens que o perfil corrente enxerga.
 *
 * Recebe a função de checagem em vez de importá-la para poder ser exercitada
 * com cada um dos três perfis sem montar uma sessão — e para deixar explícito
 * que a decisão vem de um lugar só (`shared/session`).
 *
 * @param {(required: string) => boolean} hasLevel
 */
export function visibleNavigation(hasLevel) {
  return NAVIGATION.filter((item) => hasLevel(item.requires)).map(({ label, href }) => ({
    label,
    href,
  }));
}
