/**
 * Ponto de entrada da página de testes.
 *
 * As suítes se registram no momento do import — por isso elas vêm antes da
 * chamada de `run()`. Acrescentar uma suíte é acrescentar uma linha aqui.
 */

import { run } from "~/runner.js";

import "~/suites/safe-url.test.js";
import "~/suites/elements.test.js";
import "~/suites/events.test.js";
import "~/suites/config.test.js";
import "~/suites/theme.test.js";
import "~/suites/client.test.js";
import "~/suites/store.test.js";
import "~/suites/session.test.js";
import "~/suites/router.test.js";
import "~/suites/auth-api.test.js";
import "~/suites/navigation.test.js";
import "~/suites/cards-api.test.js";
import "~/suites/cascade-select.test.js";
import "~/suites/preference.test.js";
import "~/suites/card-image.test.js";

const root = document.getElementById("results");

if (root === null) {
  console.error("[testes] o elemento de resultados não existe");
} else {
  await run(root);
}
