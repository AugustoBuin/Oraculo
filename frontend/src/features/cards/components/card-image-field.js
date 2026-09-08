/**
 * O campo de imagem da carta.
 *
 * **Duas formas, e o upload é o caminho padrão** (Decisão de UX nº 4): pedir a
 * URL de uma imagem a alguém não técnico é transferir trabalho de engenharia
 * para o usuário — ele teria que hospedar o arquivo em algum lugar e saber
 * extrair o endereço. O campo de endereço fica para quem já tem o link do CDN.
 *
 * Atende os dois perfis sem penalizar nenhum, e **sem imagem também é válido**
 * — a listagem mostra o espaço reservado (RF-34).
 */

import { ApiError, userMessage } from "@/shared/api/errors.js";
import { button } from "@/shared/components/button.js";
import { segmentedControl } from "@/shared/components/segmented-control.js";
import { UPLOAD_ALLOWED_TYPES, UPLOAD_MAX_BYTES } from "@/shared/config/constants.js";
import { el } from "@/shared/dom/elements.js";
import { isSafeUrl } from "@/shared/dom/safe-url.js";
import { uploadCardImage } from "@/features/cards/api/cards-api.js";
import {
  formatBytes,
  identifyImage,
  readSignature,
} from "@/features/cards/utils/image-signature.js";

export const IMAGE_SOURCES = {
  REMOTE: "remote",
  UPLOAD: "upload",
};

const MODES = {
  UPLOAD: "upload",
  REMOTE: "remote",
};

/**
 * @param {{ scope: object, value?: { type: string, reference: string } | null, previewUrl?: string | null }} config
 */
export function cardImageField({ scope, value = null, previewUrl = null }) {
  /** A referência que vai no corpo da carta. */
  let saved = value;

  /**
   * A URL de objeto da pré-visualização local.
   *
   * Precisa ser revogada ao trocar de arquivo e ao desmontar: cada uma segura
   * o arquivo inteiro na memória até ser liberada, e um formulário usado a
   * tarde toda acumularia todas (§12.4).
   */
  let objectUrl = null;

  const revokeObjectUrl = () => {
    if (objectUrl !== null) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  scope.add(revokeObjectUrl);

  const file = el("input", {
    attrs: {
      id: "imagem-arquivo",
      type: "file",
      accept: UPLOAD_ALLOWED_TYPES.join(","),
    },
    classes: ["field-input", "file-input"],
  });

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
  const status = el("p", { classes: ["field-hint"] });
  const preview = el("div", { classes: ["image-preview"] });

  const uploadPane = el("div", {
    classes: ["field"],
    children: [
      el("label", {
        text: "Arquivo de imagem",
        attrs: { for: "imagem-arquivo" },
        classes: ["field-label"],
      }),
      el("p", {
        text: `JPEG, PNG, WebP ou GIF, até ${formatBytes(UPLOAD_MAX_BYTES)}.`,
        classes: ["field-hint"],
      }),
      file,
    ],
  });

  const remotePane = el("div", {
    classes: ["field"],
    attrs: { hidden: true },
    children: [
      el("label", {
        text: "Endereço da imagem",
        attrs: { for: "imagem-url" },
        classes: ["field-label"],
      }),
      el("p", { text: "Cole o endereço de uma imagem já hospedada.", classes: ["field-hint"] }),
      url,
    ],
  });

  function setError(message) {
    error.textContent = message;
    error.hidden = message === "";
  }

  function clearPreview(message = "Nenhuma imagem escolhida.") {
    revokeObjectUrl();
    preview.replaceChildren(
      el("p", { text: message, classes: ["text-muted", "image-preview-empty"] }),
    );
  }

  /**
   * Mostra o que vai ser salvo, **antes** de salvar (RF-30, RF-31).
   *
   * A imagem pode falhar ao carregar — o endereço pode estar certo e o
   * servidor fora do ar. Falha de recurso opcional vira aviso no campo, não
   * ícone quebrado (§7.3, RF-34).
   */
  function showPreview(source, { local = false } = {}) {
    const image = el("img", {
      classes: ["image-preview-media"],
      attrs: { src: source, alt: "Pré-visualização da imagem da carta" },
    });

    scope.on(
      image,
      "error",
      () => {
        clearPreview("Não foi possível exibir esta imagem.");

        if (!local) {
          setError("Não foi possível carregar a imagem deste endereço.");
        }
      },
      { once: true },
    );

    preview.replaceChildren(image);
  }

  const remove = button({
    label: "Remover imagem",
    variant: "ghost",
    scope,
    onClick: () => {
      saved = null;
      file.value = "";
      url.value = "";
      setError("");
      status.textContent = "";
      clearPreview();
      remove.node.hidden = true;
    },
  });

  remove.node.hidden = value === null;

  // --- Upload --------------------------------------------------------------

  let uploading = null;

  scope.on(file, "change", async () => {
    const chosen = file.files?.[0];

    setError("");

    if (chosen === undefined) {
      return;
    }

    // Tamanho primeiro: é a checagem mais barata, e a que evita ler os bytes
    // de um arquivo que já se sabe grande demais.
    if (chosen.size > UPLOAD_MAX_BYTES) {
      file.value = "";
      clearPreview();
      setError(
        `O arquivo tem ${formatBytes(chosen.size)} e o limite é ${formatBytes(UPLOAD_MAX_BYTES)}.`,
      );
      return;
    }

    const identified = identifyImage(await readSignature(chosen));

    if (identified.type === null || !UPLOAD_ALLOWED_TYPES.includes(identified.type)) {
      file.value = "";
      clearPreview();
      setError(
        identified.label === "SVG"
          ? "Arquivos SVG não são aceitos, porque podem conter script."
          : "Este arquivo não é uma imagem JPEG, PNG, WebP ou GIF.",
      );
      return;
    }

    // A pré-visualização é imediata e local: aparece antes de o upload
    // terminar, que é o que a Decisão de UX nº 4 promete.
    revokeObjectUrl();
    objectUrl = URL.createObjectURL(chosen);
    showPreview(objectUrl, { local: true });

    // O nome do arquivo é dado hostil ao exibir: vai por `textContent` (§8.5).
    status.textContent = `Enviando ${chosen.name}…`;
    remove.node.hidden = true;

    uploading?.abort();
    const controller = new AbortController();
    uploading = controller;
    scope.add(() => controller.abort());

    try {
      const uploaded = await uploadCardImage(chosen, { signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      saved = { type: IMAGE_SOURCES.UPLOAD, reference: uploaded.reference };
      status.textContent = `${chosen.name} · ${formatBytes(chosen.size)} · ${identified.label}`;
      remove.node.hidden = false;
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      saved = null;
      file.value = "";
      status.textContent = "";
      clearPreview();

      /*
       * O servidor é a autoridade, e a mensagem dele tem precedência.
       *
       * O 413 e o 415 chegam quando a checagem local passou e a do servidor
       * não — arquivo no limite, tipo que o `finfo` lê diferente. Traduzir o
       * número cru do limite em texto legível é trabalho da tela (§7.1).
       */
      if (error instanceof ApiError && error.status === 413) {
        setError(`O arquivo passou do limite de ${formatBytes(UPLOAD_MAX_BYTES)}.`);
      } else {
        setError(userMessage(error));
      }
    }
  });

  // --- Endereço ------------------------------------------------------------

  function applyUrl() {
    const raw = url.value.trim();

    setError("");

    if (raw === "") {
      saved = null;
      clearPreview();
      remove.node.hidden = true;
      return;
    }

    // Só `http` e `https` (RF-33). Deixar `javascript:` chegar à
    // pré-visualização seria criar o vetor dentro do próprio formulário.
    if (!isSafeUrl(raw)) {
      saved = null;
      clearPreview();
      remove.node.hidden = true;
      setError("Informe um endereço que comece com http:// ou https://.");
      return;
    }

    saved = { type: IMAGE_SOURCES.REMOTE, reference: raw };
    showPreview(raw);
    remove.node.hidden = false;
  }

  scope.on(url, "input", applyUrl);
  scope.on(url, "blur", applyUrl);

  // --- Alternância ---------------------------------------------------------

  const modes = segmentedControl({
    label: "Forma de informar a imagem",
    options: [
      { value: MODES.UPLOAD, label: "Enviar arquivo" },
      { value: MODES.REMOTE, label: "Usar endereço" },
    ],
    value: value?.type === IMAGE_SOURCES.REMOTE ? MODES.REMOTE : MODES.UPLOAD,
    scope,
    onChange: (mode) => {
      /*
       * Trocar de forma limpa a anterior.
       *
       * A carta tem UMA imagem: deixar as duas preenchidas criaria a dúvida de
       * qual vale, e a resposta estaria escondida na ordem do código.
       */
      uploadPane.hidden = mode !== MODES.UPLOAD;
      remotePane.hidden = mode !== MODES.REMOTE;

      saved = null;
      file.value = "";
      url.value = "";
      status.textContent = "";
      setError("");
      clearPreview();
      remove.node.hidden = true;
    },
  });

  const node = el("fieldset", {
    classes: ["image-field"],
    children: [
      el("legend", { text: "Imagem", classes: ["field-label"] }),
      el("div", {
        classes: ["image-field-controls"],
        children: [modes.node, uploadPane, remotePane, status, error, remove.node],
      }),
      preview,
    ],
  });

  if (value?.type === IMAGE_SOURCES.REMOTE) {
    remotePane.hidden = false;
    uploadPane.hidden = true;
    applyUrl();
  } else if (previewUrl !== null && isSafeUrl(previewUrl)) {
    // Editando uma carta que já tem imagem enviada: mostra a que está lá sem
    // reenviar nada.
    showPreview(previewUrl);
  } else {
    clearPreview();
  }

  return {
    node,

    /** O que vai no corpo da carta. `null` é válido (RF-34). */
    get value() {
      return saved;
    },

    get hasError() {
      return !error.hidden;
    },
  };
}
