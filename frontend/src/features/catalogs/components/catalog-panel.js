/**
 * O painel de administração de um catálogo: edições ou raridades.
 *
 * **Um componente para os dois.** Edição e raridade têm a mesma forma e as
 * mesmas operações; dois painéis divergiriam, e a raridade acabaria aceitando
 * o que a edição recusa — o mesmo raciocínio que fez o formulário de carta ser
 * um só para criar e editar (§4.1).
 *
 * Quem chama injeta as quatro operações. O painel não sabe se está mexendo em
 * edições ou em raridades.
 */

import { userMessage } from "@/shared/api/errors.js";
import { button } from "@/shared/components/button.js";
import { field } from "@/shared/components/field.js";
import { empty, failure, inlineMessage, loading } from "@/shared/components/feedback.js";
import { el } from "@/shared/dom/elements.js";
import { scope as createScope } from "@/shared/dom/events.js";

/** `code` vira parte da URL pública (`api-contract.md` §4). */
const CODE_PATTERN = /^[a-z0-9-]{1,32}$/;

/**
 * @param {{
 *   title: string,
 *   singular: string,
 *   gameId: string,
 *   scope: object,
 *   notify: Function,
 *   api: { list: Function, create: Function, update: Function, deactivate: Function },
 * }} config
 */
export function catalogPanel({ title, singular, gameId, scope, notify, api }) {
  const body = el("div", { classes: ["catalog-body"] });

  /** A vida dos controles da lista corrente. */
  let listLife = null;

  scope.add(() => listLife?.dispose());

  const renderInto = (build) => {
    listLife?.dispose();
    listLife = createScope();
    body.replaceChildren(build(listLife));
  };

  async function load() {
    renderInto(() => loading(`Carregando ${title.toLowerCase()}…`));

    try {
      const items = await api.list(gameId);

      if (items.length === 0) {
        renderInto(() =>
          empty({
            title: `Nenhuma ${singular} cadastrada para este jogo.`,
            description: `Use o formulário abaixo para criar a primeira.`,
          }),
        );
        return;
      }

      renderInto((life) => el("ul", { classes: ["catalog-list"], children: items.map((item) => row(item, life)) }));
    } catch (error) {
      renderInto((life) =>
        failure({
          message: userMessage(error),
          action: button({
            label: "Tentar novamente",
            variant: "secondary",
            scope: life,
            onClick: () => load(),
          }).node,
        }),
      );
    }
  }

  /** Uma linha da lista, com as ações do estado em que ela está. */
  function row(item, life) {
    const actions = [];

    if (item.active) {
      actions.push(
        button({
          label: "Desativar",
          variant: "danger",
          scope: life,
          attrs: { "aria-label": `Desativar ${item.name}` },
          onClick: async () => {
            try {
              const { wasInUse } = await api.deactivate(item.ref);

              /*
               * Avisar DEPOIS de agir é honesto quando a ação é reversível.
               *
               * `wasInUse` é o que permite dizer a coisa certa: as cartas que
               * já usam o item continuam como estão (RF-43). Sem esse aviso, o
               * ADMIN ficaria sem saber se acabou de estragar algo.
               */
              notify({
                message: wasInUse
                  ? `${item.name} foi desativada. As cartas que já a usam continuam como estão.`
                  : `${item.name} foi desativada.`,
                tone: "attention",
              });

              load();
            } catch (error) {
              notify({ message: userMessage(error), tone: "danger" });
            }
          },
        }).node,
      );
    } else {
      actions.push(
        button({
          label: "Reativar",
          variant: "secondary",
          scope: life,
          attrs: { "aria-label": `Reativar ${item.name}` },
          onClick: async () => {
            try {
              // O PUT é substituição: `name` vai junto mesmo só querendo
              // reativar, senão o servidor devolve 400 apontando `name`.
              await api.update(item.ref, { name: item.name, sortOrder: 0, active: true });
              notify({ message: `${item.name} foi reativada.`, tone: "success" });
              load();
            } catch (error) {
              notify({ message: userMessage(error), tone: "danger" });
            }
          },
        }).node,
      );
    }

    return el("li", {
      classes: ["catalog-row", ...(item.active ? [] : ["catalog-row-inactive"])],
      children: [
        el("div", {
          classes: ["catalog-row-main"],
          children: [
            el("span", { text: item.name, classes: ["catalog-name"] }),
            // O código é mostrado porque é o identificador público — e **não**
            // é editável: trocá-lo quebraria URLs e filtros salvos em silêncio.
            el("code", { text: item.id, classes: ["catalog-code"] }),
            // Dois sinais: a etiqueta diz "Desativada" em texto, e a linha
            // esmaece. Só o esmaecimento excluiria quem não distingue tons.
            ...(item.active
              ? []
              : [el("span", { text: "Desativada", classes: ["badge", "badge-attention"] })]),
          ],
        }),
        el("div", { classes: ["catalog-row-actions"], children: actions }),
      ],
    });
  }

  // --- criação -------------------------------------------------------------

  const code = field({
    id: `${singular}-codigo`,
    label: "Código",
    hint: "Letras minúsculas, números e hífen. Não muda depois de criado.",
    required: true,
  });

  const name = field({ id: `${singular}-nome`, label: "Nome", required: true });
  const createAlert = el("div", { classes: ["form-alert"] });

  const submit = button({ label: `Adicionar ${singular}`, variant: "primary", type: "submit" });

  const form = el("form", {
    attrs: { novalidate: true },
    classes: ["catalog-form", "stack"],
    children: [createAlert, code.wrapper, name.wrapper, submit.node],
  });

  let submitting = false;

  scope.on(form, "submit", async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    createAlert.replaceChildren();
    code.clearError();
    name.clearError();

    let valid = true;

    if (!CODE_PATTERN.test(code.value.trim())) {
      code.setError("Use letras minúsculas, números e hífen, até 32 caracteres.");
      valid = false;
    }

    if (name.value.trim() === "") {
      name.setError("O nome é obrigatório.");
      valid = false;
    }

    if (!valid) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    submitting = true;
    submit.setLoading(true, "Adicionando…");

    try {
      await api.create(gameId, { code: code.value, name: name.value, sortOrder: 0 });

      notify({ message: `${name.value.trim()} foi criada.`, tone: "success" });
      code.input.value = "";
      name.input.value = "";
      code.input.focus();
      load();
    } catch (error) {
      // O `409` de código repetido no mesmo jogo é o caso previsto: a mensagem
      // do servidor explica, e o campo certo recebe o destaque.
      if (error.status === 409) {
        code.setError(userMessage(error));
        code.input.focus();
      } else {
        createAlert.replaceChildren(inlineMessage({ message: userMessage(error) }));
      }
    } finally {
      submitting = false;
      submit.setLoading(false);
    }
  });

  load();

  return {
    node: el("section", {
      classes: ["card", "catalog-panel"],
      attrs: { "aria-label": title },
      children: [el("h2", { text: title }), body, form],
    }),
    reload: load,
  };
}
