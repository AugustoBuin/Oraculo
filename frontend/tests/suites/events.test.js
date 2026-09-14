import { on, scope } from "@/shared/dom/events.js";
import { assertSame, assertTrue, suite, test } from "~/runner.js";

const target = () => document.createElement("button");

suite("shared/dom/events", () => {
  test("on devolve a função que remove o listener", () => {
    const button = target();
    let clicks = 0;

    const off = on(button, "click", () => clicks++);
    button.click();
    assertSame(clicks, 1);

    off();
    button.click();
    assertSame(clicks, 1, "o listener deveria ter sido removido");
  });

  test("dispose derruba todos os listeners do escopo", () => {
    const a = target();
    const b = target();
    let calls = 0;
    const life = scope();

    life.on(a, "click", () => calls++);
    life.on(b, "click", () => calls++);

    a.click();
    b.click();
    assertSame(calls, 2);

    life.dispose();
    a.click();
    b.click();
    assertSame(calls, 2, "nenhum listener deveria ter sobrado");
  });

  test("dispose cancela timer pendente", async () => {
    let disparou = false;
    const life = scope();

    life.timeout(() => {
      disparou = true;
    }, 5);
    life.dispose();

    await new Promise((resolve) => setTimeout(resolve, 20));
    assertSame(disparou, false, "o timer deveria ter sido cancelado");
  });

  test("dispose aborta requisição em voo", () => {
    const life = scope();
    const controller = life.controller();

    assertSame(controller.signal.aborted, false);
    life.dispose();
    assertTrue(controller.signal.aborted, "o sinal deveria estar abortado");
  });

  test("limpeza que lança não impede as seguintes de rodar", () => {
    // Se uma falha interrompesse a fila, o vazamento aconteceria justamente no
    // caminho de erro — que é quando ele menos aparece em teste manual.
    const life = scope();
    let limpou = false;

    life.add(() => {
      limpou = true;
    });
    life.add(() => {
      throw new Error("falha proposital");
    });

    life.dispose();
    assertTrue(limpou, "a limpeza restante deveria ter rodado");
  });

  test("limpa na ordem inversa do registro", () => {
    const ordem = [];
    const life = scope();

    life.add(() => ordem.push("primeiro"));
    life.add(() => ordem.push("segundo"));
    life.dispose();

    assertSame(ordem.join(","), "segundo,primeiro");
  });

  test("registrar em escopo já encerrado limpa na hora, não vaza", () => {
    const life = scope();
    life.dispose();

    const button = target();
    let clicks = 0;
    life.on(button, "click", () => clicks++);

    button.click();
    assertSame(clicks, 0, "o listener não deveria ter ficado pendurado");
  });

  test("dispose é idempotente", () => {
    const life = scope();
    let vezes = 0;

    life.add(() => vezes++);
    life.dispose();
    life.dispose();

    assertSame(vezes, 1);
    assertTrue(life.isDisposed);
  });
});
