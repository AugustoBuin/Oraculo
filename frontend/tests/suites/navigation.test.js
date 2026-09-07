import { PERMISSION_LEVELS } from "@/shared/config/constants.js";
import { NAVIGATION, ROUTES, visibleNavigation } from "@/pages/app-shell/navigation.js";
import { assertSame, assertTrue, suite, test } from "~/runner.js";

/** Um `hasLevel` de mentira, com o mesmo contrato do de verdade. */
const levelOf = (role) => (required) => PERMISSION_LEVELS[role] >= PERMISSION_LEVELS[required];

const labels = (role) =>
  visibleNavigation(levelOf(role))
    .map((item) => item.label)
    .join(", ");

suite("pages/app-shell/navigation", () => {
  test("VIEWER vê consulta e conta, e não vê catálogos", () => {
    // A forma mais eficaz de proteger quem tem menos familiaridade com
    // tecnologia não é uma interface mais simples: é não lhe dar um botão que
    // ela não precisa apertar.
    assertSame(labels("VIEWER"), "Cartas, Minha conta");
  });

  test("EDITOR ainda não alcança a administração de catálogos", () => {
    assertSame(labels("EDITOR"), "Cartas, Minha conta");
  });

  test("ADMIN vê tudo", () => {
    assertSame(labels("ADMIN"), "Cartas, Catálogos, Minha conta");
  });

  test("o item de catálogos exige ADMIN, não EDITOR", () => {
    const catalogos = NAVIGATION.find((item) => item.href === ROUTES.catalogs);

    assertSame(catalogos.requires, "ADMIN");
  });

  test("todo item declara o nível que exige", () => {
    // Um item sem `requires` apareceria para todo mundo em silêncio.
    assertTrue(
      NAVIGATION.every((item) => typeof item.requires === "string" && item.requires !== ""),
      "item de navegação sem nível declarado",
    );
  });

  test("devolve só rótulo e destino, sem vazar o nível para a interface", () => {
    // O cabeçalho é componente global e não pode receber regra de permissão
    // junto com o item, ou passaria a conhecê-la (§2.3).
    const [primeiro] = visibleNavigation(levelOf("ADMIN"));

    assertSame(Object.keys(primeiro).sort().join(","), "href,label");
  });
});
