/**
 * O formulário de troca de senha.
 *
 * A suíte nasceu de um defeito de F-050: o formulário trazia o próprio `h1`,
 * e ele é embutido numa página que já tem título. A tela de conta terminava
 * com um `h2` antes do `h1` — ordem invertida, e o `h1` anunciava "Trocar a
 * senha" como se fosse o nome da página.
 *
 * Quem é dono do `h1` é a página; o componente embutido entra no nível de
 * baixo.
 */

import { changePasswordForm } from "@/features/auth/components/change-password-form.js";
import { scope } from "@/shared/dom/events.js";
import { assertCount, assertSame, suite, test } from "~/runner.js";

function comFormulario(body) {
  const life = scope();

  try {
    return body(changePasswordForm({ scope: life, onChanged: () => {} }).node);
  } finally {
    life.dispose();
  }
}

suite("features/auth/components/change-password-form · cabeçalho", () => {
  test("o formulário embutido entra com h2 — o h1 é da página (RNF-06)", () =>
    comFormulario((form) => {
      const heading = form.querySelector("h1, h2, h3, h4, h5, h6");

      assertSame(heading.tagName, "H2");
      assertSame(heading.textContent, "Trocar a senha");
    }));

  test("não existe h1 dentro do componente", () =>
    comFormulario((form) => {
      assertCount(form.querySelectorAll("h1"), 0);
    }));
});
