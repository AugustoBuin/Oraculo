# Espera por condição, não por relógio

## O princípio

Teste instável costuma chutar tempo: `await sleep(50)` e torcer. Isso cria corrida — passa
na sua máquina, falha sob carga, falha no contêiner.

> Espere **a condição que interessa**, não um palpite sobre quanto tempo ela leva.

## Quando usar

- O teste tem espera arbitrária (`setTimeout`, `sleep`).
- O teste é intermitente.
- Você está esperando uma operação assíncrona terminar: uma requisição, um redesenho, o
  cancelamento de uma requisição anterior.

**Não use quando o comportamento sob teste é o próprio tempo** — supressão de repetição
(*debounce*), limite de espera (*timeout*), duração de animação. Nesses casos a espera é o
objeto do teste, e ela precisa de comentário dizendo **por quê**.

---

## O padrão

```js
// ❌ ANTES: chutando o tempo
await new Promise((r) => setTimeout(r, 50));
assertCount(lista.children, 3);

// ✅ DEPOIS: esperando a condição
await waitFor(() => lista.children.length === 3, "a lista desenhar três itens");
assertCount(lista.children, 3);
```

## Padrões rápidos

| Situação | Espera |
|---|---|
| A tela terminou de desenhar | `waitFor(() => root.querySelector("[data-testid=grade]") !== null, "…")` |
| A requisição saiu | `waitFor(() => fetch.calls.length === 1, "…")` |
| A requisição anterior foi abortada | `waitFor(() => fetch.calls[0].signal.aborted, "…")` |
| A sessão mudou | `waitFor(() => isAuthenticated() === false, "…")` |
| Chegou a quantidade esperada | `waitFor(() => itens.length >= 5, "…")` |
| Condição composta | `waitFor(() => estado.pronto && estado.total > 0, "…")` |

Implementação pronta em `condition-based-waiting-example.js`, nesta pasta — sem dependência
externa, como tudo aqui (ADR-001).

---

## Erros comuns

**❌ Sondar rápido demais** (`setTimeout(check, 1)`) — gasta CPU e atrapalha o próprio
`microtask` que você espera.
**✅** Sonde a cada ~10ms.

**❌ Sem teto de espera** — o teste trava para sempre em vez de falhar.
**✅** Sempre com teto e mensagem clara: *"esperando a lista desenhar três itens"*.

**❌ Ler o estado antes do laço** e testar a cópia.
**✅** Chame o getter **dentro** do laço, a cada rodada.

**❌ Esperar por tempo o que o navegador resolve na próxima tarefa.**
**✅** Para redesenho síncrono depois de um `await`, muitas vezes basta um
`await Promise.resolve()` ou um `requestAnimationFrame`.

---

## Quando a espera por tempo é a resposta certa

```js
// A cascata dispara a busca 250ms depois da última troca (RF-25).
// Primeiro espere a CONDIÇÃO de que a primeira troca foi registrada…
await waitFor(() => campo.value === "2", "o campo aceitar a segunda troca");

// …e só então espere o TEMPO, que é o comportamento sob teste.
await sleep(300); // 250ms de supressão + folga; documentado no RF-25
assertCount(fetch.calls, 1, "trocas rápidas produzem UMA requisição, não três");
```

Requisitos para uma espera por tempo ser aceitável:

1. Primeiro esperar a condição que dispara.
2. O tempo vem de um número **conhecido** (o da supressão, o do teto), não de um chute.
3. Comentário explicando **por quê** — e, aqui, apontando o requisito
   (`docs/PRD.md`, RF-25) ou o token (`--duration-*`).

---

## Por que isto importa neste projeto

A corrida do RF-25 — trocar jogo e edição rápido e a resposta antiga chegar por cima da nova
— é um requisito **explícito**, e a mesma classe de corrida aparece no roteador (o contador
de navegação) e na montagem de página assíncrona. Teste que dorme em vez de esperar a
condição é justamente o teste que **não** protege contra o defeito que o projeto mais teme.
