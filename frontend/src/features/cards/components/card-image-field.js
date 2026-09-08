/**
 * O campo de imagem da carta.
 *
 * **Duas formas, um caminho padrão** (Decisão de UX nº 4): o upload é o
 * caminho principal, porque pedir a URL de uma imagem a alguém não técnico é
 * transferir trabalho de engenharia para o usuário — ele teria que hospedar o
 * arquivo em algum lugar e saber extrair o endereço. O campo de URL fica para
 * quem já tem o link do CDN.
 *
 * Nesta etapa (F-031) só a forma por URL está ligada; o upload com
 * pré-visualização chega em F-032.
 */

import { el } from "@/shared/dom/elements.js";
import { isSafeUrl } from "@/shared/dom/safe-url.js";

export const IMAGE_SOURCES = {
  NONE: "none",
  REMOTE: "remote",
  UPLOAD: "upload",
};

/**
 * @param {{ scope: object, value?: object | null }} config
 */
export function cardImageField({ scope, value = null }) {
  const url = el("input", {
    attrs: {
      id: "imagem-url",
      type: "url",
      placeholder: "https://…",
      autocomplete: "off",
      value: value?.type === IMAGE_SOURCES.REMOTE ? value.reference : "",
    },
    classes: ["field-input"],
  });

  const error = el("p", { classes: ["field-error"], attrs: { hidden: true } });

  const preview = el("div", { classes: ["image-preview"] });

  function clearPreview() {
    preview.replaceChildren(
      el("p", {
        text: "Nenhuma imagem escolhida.",
        classes: ["text-muted", "image-preview-empty"],
      }),
    );
  }

  /**
   * Mostra o que vai ser salvo, **antes** de salvar (RF-30, RF-31).
   *
   * A imagem pode falhar ao carregar — a URL pode estar certa e o servidor
   * fora do ar. Isso é falha de recurso opcional: vira aviso no campo, não
   * ícone quebrado (§7.3).
   */
  function showPreview(source) {
    const image = el("img", {
      classes: ["image-preview-media"],
      attrs: { src: source, alt: "Pré-visualização da imagem da carta" },
    });

    scope.on(
      image,
      "error",
      () => {
        clearPreview();
        setError("Não foi possível carregar a imagem deste endereço.");
      },
      { once: true },
    );

    preview.replaceChildren(image);
  }

  function setError(message) {
    error.textContent = message;
    error.hidden = message === "";
    url.setAttribute("aria-invalid", message === "" ? "false" : "true");
  }

  function apply() {
    const raw = url.value.trim();

    if (raw === "") {
      setError("");
      clearPreview();
      return;
    }

    /*
     * Só `http` e `https` (RF-33).
     *
     * A checagem aqui é feedback rápido; a que vale é a do servidor (§8.1).
     * Mas deixar `javascript:` chegar à pré-visualização seria criar o próprio
     * vetor dentro do formulário.
     */
    if (!isSafeUrl(raw)) {
      setError("Informe um endereço que comece com http:// ou https://.");
      clearPreview();
      return;
    }

    setError("");
    showPreview(raw);
  }

  scope.on(url, "input", apply);
  scope.on(url, "blur", apply);

  const node = el("div", {
    classes: ["image-field"],
    children: [
      el("div", {
        classes: ["field"],
        children: [
          el("label", {
            text: "Imagem por endereço",
            attrs: { for: "imagem-url" },
            classes: ["field-label"],
          }),
          el("p", {
            text: "Cole o endereço de uma imagem já hospedada.",
            classes: ["field-hint"],
          }),
          url,
          error,
        ],
      }),
      preview,
    ],
  });

  clearPreview();

  if (url.value !== "") {
    apply();
  }

  return {
    node,

    /**
     * O que vai no corpo da carta.
     *
     * `null` quando não há imagem — que é válido, e a listagem mostra o espaço
     * reservado (RF-34).
     */
    get value() {
      const raw = url.value.trim();

      if (raw === "" || !isSafeUrl(raw)) {
        return null;
      }

      return { type: IMAGE_SOURCES.REMOTE, reference: raw };
    },

    get hasError() {
      return url.getAttribute("aria-invalid") === "true";
    },

    focus: () => url.focus(),
  };
}
