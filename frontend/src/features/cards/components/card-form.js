/**
 * O formulário de carta — criação e edição.
 *
 * **Um formulário só para as duas operações.** Dois divergiriam, e a edição
 * passaria a aceitar o que o cadastro recusa — foi o mesmo raciocínio que fez
 * o backend compartilhar a cadeia de validação entre criar e atualizar.
 *
 * **Os catálogos chegam por injeção, não por import.** Cartas e catálogos são
 * duas features, e feature nunca importa feature (§2.1). Receber as funções de
 * carregamento mantém o formulário nesta feature e deixa a página — a camada
 * autorizada a conhecer as duas — fazer a ligação.
 */

import { ApiError, userMessage } from "@/shared/api/errors.js";
import { button } from "@/shared/components/button.js";
import { cascadeSelect } from "@/shared/components/cascade-select.js";
import { field } from "@/shared/components/field.js";
import { inlineMessage } from "@/shared/components/feedback.js";
import { el } from "@/shared/dom/elements.js";
import { createCard, parseDuplicate, updateCard } from "@/features/cards/api/cards-api.js";
import { cardImageField } from "@/features/cards/components/card-image-field.js";

const MAX_NAME_LENGTH = 150;

/** Os campos que o servidor nomeia em `errors` (`api-contract.md` §5). */
const SERVER_FIELDS = {
  nameEn: "nameEn",
  namePt: "namePt",
  game: "game",
  editionId: "edition",
  rarityId: "rarity",
};

/**
 * @param {{
 *   scope: object,
 *   card?: object | null,
 *   catalogs: { listGames: Function, listEditions: Function, listRarities: Function },
 *   onSaved: (card: object) => void,
 *   onCancel: () => void,
 * }} config
 */
export function cardForm({ scope, card = null, catalogs, onSaved, onCancel }) {
  const isEditing = card !== null;

  const nameEn = field({
    id: "nome-en",
    label: "Nome em inglês",
    required: true,
    hint: "Obrigatório.",
  });

  const namePt = field({
    id: "nome-pt",
    label: "Nome em português",
    // O desafio diz explicitamente que o nome em português "pode existir ou
    // não" (RN-03). A dica diz isso, para ninguém preencher por obrigação.
    hint: "Opcional.",
  });

  nameEn.input.value = card?.nameEn ?? "";
  namePt.input.value = card?.namePt ?? "";

  const game = el("select", { attrs: { id: "jogo-carta" }, classes: ["field-input"] });

  const edition = cascadeSelect({
    id: "edicao-carta",
    label: "Edição",
    placeholder: "Selecione a edição",
    emptyLabel: "Este jogo não tem edições cadastradas.",
    scope,
    loadOptions: (gameId, options) => catalogs.listEditions(gameId, options),
  });

  const rarity = cascadeSelect({
    id: "raridade-carta",
    label: "Raridade",
    placeholder: "Selecione a raridade",
    emptyLabel: "Este jogo não tem raridades cadastradas.",
    scope,
    loadOptions: (gameId, options) => catalogs.listRarities(gameId, options),
  });

  const image = cardImageField({ scope, value: null });

  const submit = button({
    label: isEditing ? "Salvar alterações" : "Cadastrar carta",
    variant: "primary",
    type: "submit",
  });

  const cancel = button({ label: "Cancelar", variant: "ghost", scope, onClick: () => onCancel() });

  const alertSlot = el("div", { classes: ["form-alert"] });

  const fieldsByServerName = { nameEn, namePt };

  const form = el("form", {
    attrs: { novalidate: true },
    classes: ["card-form", "stack"],
    children: [
      alertSlot,
      nameEn.wrapper,
      namePt.wrapper,
      el("div", {
        classes: ["field"],
        children: [
          el("label", { text: "Jogo", attrs: { for: "jogo-carta" }, classes: ["field-label"] }),
          game,
          el("p", { classes: ["field-error"], attrs: { hidden: true, id: "jogo-carta-erro" } }),
        ],
      }),
      edition.wrapper,
      rarity.wrapper,
      image.node,
      el("div", { classes: ["form-actions"], children: [cancel.node, submit.node] }),
    ],
  });

  const gameError = form.querySelector("#jogo-carta-erro");

  let submitting = false;
  /** Fica preenchido quando o servidor avisa de duplicidade e o usuário decide. */
  let confirmDuplicate = false;
  let dirty = false;

  const markDirty = () => {
    dirty = true;
    // Uma edição nova invalida a confirmação anterior: quem mudou o nome
    // depois de confirmar a duplicata está cadastrando outra coisa.
    confirmDuplicate = false;
  };

  scope.on(form, "input", markDirty);
  scope.on(form, "change", markDirty);

  function clearErrors() {
    alertSlot.replaceChildren();
    nameEn.clearError();
    namePt.clearError();
    gameError.hidden = true;
    gameError.textContent = "";
  }

  function setGameError(message) {
    gameError.textContent = message;
    gameError.hidden = false;
    game.setAttribute("aria-invalid", "true");
  }

  /** Validação local: feedback rápido, nunca barreira (§8.5). */
  function validate() {
    clearErrors();

    let valid = true;

    if (nameEn.value.trim() === "") {
      nameEn.setError("O nome em inglês é obrigatório.");
      valid = false;
    } else if (nameEn.value.trim().length > MAX_NAME_LENGTH) {
      nameEn.setError(`O nome tem no máximo ${MAX_NAME_LENGTH} caracteres.`);
      valid = false;
    }

    if (namePt.value.trim().length > MAX_NAME_LENGTH) {
      namePt.setError(`O nome tem no máximo ${MAX_NAME_LENGTH} caracteres.`);
      valid = false;
    }

    if (game.value === "") {
      setGameError("Escolha o jogo da carta.");
      valid = false;
    }

    if (edition.value === "") {
      edition.select.setAttribute("aria-invalid", "true");
      valid = false;
    }

    if (rarity.value === "") {
      rarity.select.setAttribute("aria-invalid", "true");
      valid = false;
    }

    return valid;
  }

  /** Ancora a mensagem do servidor no campo que ele nomeou. */
  function applyServerErrors(error) {
    if (!(error instanceof ApiError) || error.errors === null) {
      return false;
    }

    let anchored = false;

    for (const [serverName, target] of Object.entries(SERVER_FIELDS)) {
      const message = error.errors[serverName];

      if (typeof message !== "string" || message === "") {
        continue;
      }

      anchored = true;

      if (target === "game") {
        setGameError(message);
        continue;
      }

      if (target === "edition") {
        edition.select.setAttribute("aria-invalid", "true");
        alertSlot.replaceChildren(inlineMessage({ message }));
        continue;
      }

      if (target === "rarity") {
        rarity.select.setAttribute("aria-invalid", "true");
        alertSlot.replaceChildren(inlineMessage({ message }));
        continue;
      }

      fieldsByServerName[target]?.setError(message);
    }

    return anchored;
  }

  /**
   * O aviso de duplicidade (RN-04, Decisão de UX nº 5).
   *
   * **Avisa, não bloqueia.** A mesma carta tem múltiplas impressões na mesma
   * edição — terrenos básicos em Magic são o caso clássico. Bloquear seria
   * modelar o domínio errado; avisar cobre o cadastro duplicado por engano sem
   * inviabilizar o caso legítimo.
   */
  function showDuplicate(duplicate) {
    const onde =
      duplicate.editionName === null ? "nesta edição" : `em ${duplicate.editionName}`;

    const confirmar = button({
      label: "Cadastrar mesmo assim",
      variant: "secondary",
      scope,
      onClick: () => {
        confirmDuplicate = true;
        form.requestSubmit();
      },
    });

    alertSlot.replaceChildren(
      el("div", {
        classes: ["inline-message", "inline-message-attention"],
        attrs: { role: "status" },
        children: [
          el("p", { text: `Já existe "${duplicate.nameEn}" ${onde}.` }),
          el("p", {
            text: "Impressões múltiplas na mesma edição são normais. Confirme se é o caso.",
            classes: ["text-muted"],
          }),
          confirmar.node,
        ],
      }),
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!validate()) {
      // O foco vai para o primeiro campo com problema: sem isso quem navega
      // por teclado não sabe onde o erro apareceu (§9.2).
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    submitting = true;
    submit.setLoading(true, "Salvando…");

    const payload = {
      nameEn: nameEn.value,
      namePt: namePt.value,
      game: game.value,
      edition: edition.value,
      rarity: rarity.value,
      image: image.value,
    };

    try {
      const saved = isEditing
        ? await updateCard(card.id, payload, { confirmDuplicate })
        : await createCard(payload, { confirmDuplicate });

      dirty = false;
      onSaved(saved);
    } catch (error) {
      const duplicate = error instanceof ApiError && error.isConflict ? parseDuplicate(error) : null;

      if (duplicate !== null) {
        showDuplicate(duplicate);
      } else if (!applyServerErrors(error)) {
        alertSlot.replaceChildren(inlineMessage({ message: userMessage(error) }));
      }
    } finally {
      submitting = false;
      submit.setLoading(false);
    }
  }

  scope.on(form, "submit", handleSubmit);

  /**
   * Sair com alterações não salvas avisa antes de descartar.
   *
   * O navegador só permite a mensagem padrão dele; o texto é ignorado, e é por
   * isso que não passamos nenhum.
   */
  scope.on(window, "beforeunload", (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  async function loadGames() {
    game.replaceChildren(el("option", { text: "Carregando jogos…", attrs: { value: "" } }));
    game.disabled = true;

    try {
      const games = await catalogs.listGames();

      game.replaceChildren(
        el("option", { text: "Selecione o jogo", attrs: { value: "" } }),
        ...games.map((item) => el("option", { text: item.name, attrs: { value: item.id } })),
      );

      game.disabled = false;

      if (isEditing) {
        // Editar carrega os valores atuais e dispara a cascata já com jogo,
        // edição e raridade selecionados.
        game.value = card.game.id;
        edition.setValue(card.edition.id);
        rarity.setValue(card.rarity.id);

        await Promise.allSettled([
          edition.setParent(card.game.id, { keepSelection: true }),
          rarity.setParent(card.game.id, { keepSelection: true }),
        ]);

        // Carregar os valores existentes não é alteração do usuário.
        dirty = false;
      }
    } catch (error) {
      game.replaceChildren(el("option", { text: "Não foi possível carregar", attrs: { value: "" } }));
      alertSlot.replaceChildren(inlineMessage({ message: userMessage(error) }));
    }
  }

  scope.on(game, "change", async () => {
    game.removeAttribute("aria-invalid");
    // Trocar o jogo recarrega e RESETA as duas seleções (RF-24, RF-27).
    await Promise.allSettled([edition.setParent(game.value), rarity.setParent(game.value)]);
  });

  scope.on(edition.select, "change", () => edition.select.removeAttribute("aria-invalid"));
  scope.on(rarity.select, "change", () => rarity.select.removeAttribute("aria-invalid"));

  loadGames();

  return {
    node: form,
    focus: () => nameEn.input.focus(),
    get isDirty() {
      return dirty;
    },
  };
}
