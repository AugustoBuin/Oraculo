/**
 * O painel de administração de um catálogo: edições ou raridades.
 *
 * **Um componente para os dois.** Edição e raridade têm a mesma forma e as
 * mesmas operações; dois painéis divergiriam, e a raridade acabaria aceitando
 * o que a edição recusa — o mesmo raciocínio que fez o formulário de carta ser
 * um só para criar e editar (§4.1).
 *
 * Quem chama injeta as quatro operações e, quando o catálogo tem cor, a
 * aparência (`appearance`): o seletor de cor e o selo. O painel não sabe se
 * está mexendo em edições ou em raridades — sabe só se há cor para escolher.
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
 *   appearance?: {
 *     field: (config: { id: string, value?: string }) => { wrapper: HTMLElement, value: string, setValue: Function },
 *     badge: (item: { name: string, color?: string }) => HTMLElement,
 *   },
 * }} config
 */
export function catalogPanel({ title, singular, gameId, scope, notify, api, appearance }) {
  const body = el("div", { classes: ["catalog-body"] });

  /** A vida dos controles da lista corrente. */
  let listLife = null;

  /** Os itens da última leitura: abrir e fechar a edição redesenham daqui, sem rede. */
  let items = [];

  /** A referência do item em edição. Uma linha por vez. */
  let editingRef = null;

  scope.add(() => listLife?.dispose());

  const renderInto = (build) => {
    listLife?.dispose();
    listLife = createScope();
    body.replaceChildren(build(listLife));
  };

  /** O botão Editar de uma linha — é para ele que o foco volta. */
  const editButtonOf = (item) => `[data-edit-ref="${item.ref}"]`;

  function renderList(focusSelector) {
    renderInto((life) => el("ul", { classes: ["catalog-list"], children: items.map((item) => row(item, life)) }));

    if (focusSelector !== undefined) {
      body.querySelector(focusSelector)?.focus();
    }
  }

  async function load(focusSelector) {
    renderInto(() => loading(`Carregando ${title.toLowerCase()}…`));

    // Trocar de jogo descarta o painel inteiro; a leitura dele tem de ir junto,
    // ou a resposta do jogo anterior desenha sobre o painel do novo (RNF-07).
    const controller = scope.controller();

    try {
      const fresh = await api.list(gameId, { signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      items = fresh;
      editingRef = null;

      if (items.length === 0) {
        renderInto(() =>
          empty({
            title: `Nenhuma ${singular} cadastrada para este jogo.`,
            description: `Use o formulário abaixo para criar a primeira.`,
          }),
        );
        return;
      }

      renderList(focusSelector);
    } catch (error) {
      // Cancelar não é falhar: o painel já foi descartado, e um estado de erro
      // aqui só existiria para ninguém ver.
      if (controller.signal.aborted) {
        return;
      }

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

  function openEditor(item) {
    editingRef = item.ref;
    renderList(`#${singular}-nome-${item.ref}`);
  }

  function closeEditor(item) {
    editingRef = null;
    renderList(editButtonOf(item));
  }

  /** Uma linha da lista, com as ações do estado em que ela está. */
  function row(item, life) {
    if (item.ref === editingRef) {
      return editor(item, life);
    }

    const actions = [
      button({
        label: "Editar",
        variant: "secondary",
        scope: life,
        attrs: { "aria-label": `Editar ${item.name}`, "data-edit-ref": String(item.ref) },
        onClick: () => openEditor(item),
      }).node,
    ];

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
              // O PUT é substituição: o registro inteiro vai junto mesmo só
              // querendo reativar. Mandar `sortOrder: 0`, como antes, jogava a
              // "Mítica" reativada para o topo da cascata; e a raridade sem a
              // cor seria recusada.
              await api.update(item.ref, {
                name: item.name,
                sortOrder: item.sortOrder,
                active: true,
                color: item.color,
              });
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
      classes: [
        "cluster",
        "cluster-between",
        "catalog-row",
        ...(item.active ? [] : ["catalog-row-inactive"]),
      ],
      children: [
        el("div", {
          classes: ["cluster", "catalog-row-main"],
          children: [
            // Com aparência, o nome vai no selo que a carta vai mostrar: quem
            // administra vê a cor como ela aparece, e não um nome e um código.
            appearance === undefined
              ? el("span", { text: item.name, classes: ["catalog-name"] })
              : appearance.badge(item),
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
        el("div", { classes: ["cluster", "catalog-row-actions"], children: actions }),
      ],
    });
  }

  /**
   * A linha em edição: nome e, se houver, cor. O código aparece e não é campo.
   *
   * Na própria linha, e não num modal: a tarefa não precisa interromper nada
   * nem prender o foco, e quem edita continua vendo a lista em volta. Esc e
   * Cancelar fecham sem ir à rede, e o foco volta ao Editar de onde saiu.
   */
  function editor(item, life) {
    const name = field({ id: `${singular}-nome-${item.ref}`, label: "Nome", required: true });
    const color = appearance?.field({ id: `${singular}-cor-${item.ref}`, value: item.color });
    const alert = el("div", { classes: ["form-alert"] });
    const save = button({ label: "Salvar", variant: "primary", type: "submit" });
    const cancel = button({ label: "Cancelar", variant: "ghost", scope: life, onClick: () => closeEditor(item) });

    name.input.value = item.name;

    const form = el("form", {
      attrs: { novalidate: true, "aria-label": `Editar ${item.name}` },
      classes: ["catalog-edit", "stack"],
      children: [
        alert,
        el("p", {
          classes: ["catalog-edit-code"],
          children: [
            el("span", { text: "Código " }),
            el("code", { text: item.id, classes: ["catalog-code"] }),
            el("span", { text: " · não muda depois de criado" }),
          ],
        }),
        name.wrapper,
        ...(color === undefined ? [] : [color.wrapper]),
        el("div", { classes: ["cluster"], children: [save.node, cancel.node] }),
      ],
    });

    let saving = false;

    life.on(form, "keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEditor(item);
      }
    });

    life.on(form, "submit", async (event) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      alert.replaceChildren();
      name.clearError();

      if (name.value.trim() === "") {
        name.setError("O nome é obrigatório.");
        name.input.focus();
        return;
      }

      saving = true;
      save.setLoading(true, "Salvando…");

      try {
        // O PUT é substituição: a ordem e o estado vão como vieram da
        // listagem, e a cor é a escolhida — sem seletor, a que já havia.
        await api.update(item.ref, {
          name: name.value,
          sortOrder: item.sortOrder,
          active: item.active,
          color: color?.value ?? item.color,
        });

        notify({ message: `${name.value.trim()} foi alterada.`, tone: "success" });
        load(editButtonOf(item));
      } catch (error) {
        alert.replaceChildren(inlineMessage({ message: userMessage(error) }));
      } finally {
        saving = false;
        save.setLoading(false);
      }
    });

    return el("li", { classes: ["catalog-row", "catalog-row-editing"], children: [form] });
  }

  // --- criação -------------------------------------------------------------

  const code = field({
    id: `${singular}-codigo`,
    label: "Código",
    hint: "Letras minúsculas, números e hífen. Não muda depois de criado.",
    required: true,
  });

  const name = field({ id: `${singular}-nome`, label: "Nome", required: true });
  const createColor = appearance?.field({ id: `${singular}-cor` });
  const createAlert = el("div", { classes: ["form-alert"] });

  const submit = button({ label: `Adicionar ${singular}`, variant: "primary", type: "submit" });

  const form = el("form", {
    attrs: { novalidate: true },
    classes: ["catalog-form", "stack"],
    children: [
      createAlert,
      code.wrapper,
      name.wrapper,
      ...(createColor === undefined ? [] : [createColor.wrapper]),
      submit.node,
    ],
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
      await api.create(gameId, { code: code.value, name: name.value, sortOrder: 0, color: createColor?.value });

      notify({ message: `${name.value.trim()} foi criada.`, tone: "success" });
      code.input.value = "";
      name.input.value = "";
      createColor?.setValue();
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
