/**
 * O micro-runner de testes do frontend.
 *
 * Decorrência direta do ADR-001 e do ADR-002: sem framework, sem biblioteca e
 * **sem Node**. Acrescentar um runtime a um projeto que se apresenta como zero
 * dependência pediria uma explicação que escrever isto torna desnecessária —
 * e é o mesmo raciocínio que produziu o `backend/bin/test.php`.
 *
 * As asserções espelham os nomes do runner do backend de propósito: quem
 * navega das duas metades do repositório não deve ter que aprender dois
 * vocabulários. `assertRejects` é a única a mais, porque no frontend quase
 * tudo que falha, falha numa promessa.
 *
 * O ADR-004 mantém renderização de DOM fora do teste automatizado, verificada
 * por roteiro manual. O que roda aqui é lógica pura: validação, formatação,
 * montagem de requisição e guardas de corrida.
 */

/** @type {Array<{ name: string, tests: Array<{ name: string, fn: Function }> }>} */
const suites = [];

/** Declara uma suíte. O corpo registra os testes com `test()`. */
export function suite(name, register) {
  const tests = [];
  const previous = currentTests;

  currentTests = tests;
  register();
  currentTests = previous;

  suites.push({ name, tests });
}

let currentTests = null;

/** Declara um teste. O nome descreve o comportamento, em português. */
export function test(name, fn) {
  if (currentTests === null) {
    throw new Error(`O teste "${name}" está fora de uma suíte.`);
  }

  currentTests.push({ name, fn });
}

// --- Asserções -------------------------------------------------------------

class AssertionError extends Error {
  constructor(message, expected, received) {
    super(message);
    this.name = "AssertionError";
    this.expected = expected;
    this.received = received;
  }
}

const show = (value) => {
  if (typeof value === "string") return JSON.stringify(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

export function assertSame(received, expected, message = "valores diferentes") {
  if (!Object.is(received, expected)) {
    throw new AssertionError(message, expected, received);
  }
}

export function assertEquals(received, expected, message = "estruturas diferentes") {
  if (JSON.stringify(received) !== JSON.stringify(expected)) {
    throw new AssertionError(message, expected, received);
  }
}

export function assertTrue(received, message = "esperado verdadeiro") {
  if (received !== true) {
    throw new AssertionError(message, true, received);
  }
}

export function assertFalse(received, message = "esperado falso") {
  if (received !== false) {
    throw new AssertionError(message, false, received);
  }
}

export function assertNull(received, message = "esperado nulo") {
  if (received !== null) {
    throw new AssertionError(message, null, received);
  }
}

export function assertCount(received, expected, message = "quantidade diferente") {
  const count = received?.length;

  if (count !== expected) {
    throw new AssertionError(message, expected, count);
  }
}

/**
 * Confere que a função lança, e devolve o erro para inspeção adicional.
 *
 * Recebe o tipo esperado porque "lançou alguma coisa" é uma asserção fraca: um
 * erro de digitação dentro do próprio teste também lança, e passaria.
 */
export function assertThrows(fn, expectedType = Error, message = "esperado que lançasse") {
  let thrown = null;

  try {
    fn();
  } catch (error) {
    thrown = error;
  }

  if (thrown === null) {
    throw new AssertionError(message, `${expectedType.name} lançado`, "nada lançado");
  }

  if (!(thrown instanceof expectedType)) {
    throw new AssertionError(message, expectedType.name, show(thrown));
  }

  return thrown;
}

/** A versão assíncrona. */
export async function assertRejects(
  promise,
  expectedType = Error,
  message = "esperado que rejeitasse",
) {
  let thrown = null;

  try {
    await promise;
  } catch (error) {
    thrown = error;
  }

  if (thrown === null) {
    throw new AssertionError(message, `${expectedType.name} rejeitado`, "resolveu");
  }

  if (!(thrown instanceof expectedType)) {
    throw new AssertionError(message, expectedType.name, show(thrown));
  }

  return thrown;
}

// --- Execução --------------------------------------------------------------

/**
 * Roda tudo e desenha o placar.
 *
 * Cada teste roda no próprio try/catch: exceção não capturada vira falha e
 * **não derruba o runner**, que é a diferença entre saber que um teste quebrou
 * e ver a página em branco.
 */
export async function run(root) {
  const summary = { passed: 0, failed: 0 };
  const output = document.createElement("div");

  for (const { name, tests } of suites) {
    const heading = document.createElement("h2");
    heading.textContent = name;
    output.append(heading);

    for (const item of tests) {
      const line = document.createElement("p");
      line.classList.add("result");

      try {
        await item.fn();
        summary.passed++;
        line.classList.add("passed");
        line.textContent = `✓ ${item.name}`;
      } catch (error) {
        summary.failed++;
        line.classList.add("failed");
        line.textContent = `✗ ${item.name}`;

        const detail = document.createElement("span");
        detail.classList.add("detail");
        detail.textContent =
          error instanceof AssertionError
            ? `${error.message} — esperado ${show(error.expected)}, recebido ${show(error.received)}`
            : `${error.name}: ${error.message}`;

        line.append(detail);
        console.error(`[teste] ${name} › ${item.name}`, error);
      }

      output.append(line);
    }
  }

  const total = document.createElement("p");
  total.classList.add("summary", summary.failed === 0 ? "passed" : "failed");
  total.textContent = `${summary.passed} passou, ${summary.failed} falhou`;
  output.append(total);

  root.replaceChildren(output);

  // Publicado para que o roteiro manual e qualquer automação leiam o resultado
  // sem precisar interpretar a tela.
  window.__testSummary = summary;

  return summary;
}
