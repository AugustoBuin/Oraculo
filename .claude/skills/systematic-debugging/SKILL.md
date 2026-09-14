---
name: systematic-debugging
description: Use diante de qualquer bug, teste vermelho ou comportamento inesperado no Oráculo, antes de propor qualquer correção. As quatro fases até a causa raiz, com as fronteiras deste projeto (navegador → cliente HTTP → Apache → front controller → rota → caso de uso → PDO).
---

# Depuração sistemática

## O princípio

Correção aleatória gasta tempo e cria bug novo. Remendo esconde o defeito.

> **SEMPRE ache a causa raiz antes de tentar corrigir. Corrigir o sintoma é falha.**

Violar a letra deste processo é violar o espírito da depuração.

## A lei de ferro

```
NENHUMA CORREÇÃO SEM INVESTIGAÇÃO DE CAUSA RAIZ ANTES
```

Se você não completou a Fase 1, você não pode propor correção.

## Quando usar

Qualquer problema técnico: teste vermelho, bug em uso, comportamento inesperado, lentidão,
falha de boot do contêiner, resposta errada da API.

**Especialmente quando:**
- Há pressa (a entrega é o que torna o chute tentador).
- "É só uma correçãozinha" parece óbvio.
- Você já tentou mais de uma correção.
- A correção anterior não resolveu.
- Você não entende o problema por inteiro.

**Não pule porque:** o bug parece simples (bug simples também tem causa), você está com
pressa (chutar garante retrabalho), ou a entrega é amanhã (sistemático é mais rápido que
tatear).

---

## As quatro fases

Complete cada uma antes de passar para a seguinte.

### Fase 1 — Investigar a causa raiz

**ANTES de qualquer correção:**

**1. Leia a mensagem de erro inteira.** Stack trace completo, arquivo, linha, código do
erro. Ela frequentemente contém a solução. No backend, o runner já aponta a linha do
**teste** que falhou, não a do auxiliar de asserção — use isso.

**2. Reproduza de forma consistente.** Quais passos exatos? Acontece sempre? Em qual perfil
(VIEWER, EDITOR, ADMIN)? Em qual tema? Em qual largura? Não reproduz? Colete mais dados —
não adivinhe.

**3. Verifique o que mudou.**
```bash
git status --short
git log --oneline -10
git diff development...HEAD -- <área suspeita>
```
Mudança de configuração conta: `.env`, `docker/app/apache.conf`, `docker/app/php.ini`,
`importmap` do `index.html`.

**4. Instrumente as fronteiras.** Este sistema tem várias camadas, e a primeira pergunta
não é *por que* quebrou — é **onde**. Registre o que entra e o que sai de cada fronteira,
rode **uma vez**, e leia a evidência.

```js
// Camada 1 — a tela: o que a página pediu?
console.log("[cards-page] filtros", { gameId, editionId, page });

// Camada 2 — o cliente HTTP: que URL e que cabeçalhos saíram?
// (temporário em shared/api/client.js)
console.log("[client] saída", { url, method, headers, credentials });

// Camada 3 — a rede: DevTools → Network. Status? Corpo? O cookie de sessão foi junto?
```

```php
// Camada 4 — o front controller / a rota: o que chegou?
error_log('[rota] entrada: ' . json_encode(['path' => $request->path(), 'user' => $userId]));

// Camada 5 — o caso de uso: com que DTO ele foi chamado?
// Camada 6 — o repositório: qual SQL, com quais parâmetros?
error_log('[repo] sql=' . $sql . ' params=' . json_encode($params));
```

Leia com:
```bash
docker compose logs -f app
```

Isso responde **qual camada falha** (tela ✓, cliente ✓, resposta 403 ✗ → investigar o
guard e a sessão). Só então investigue aquela camada.

> Instrumentação é temporária. Ela sai antes do commit — `console.log` em
> `frontend/src/` e `error_log` em `backend/src/` são achados de auditoria.

**5. Rastreie o dado para trás.** Onde o valor ruim nasceu? Quem chamou com ele? Suba até a
origem. Veja `root-cause-tracing.md` nesta pasta para a técnica completa.

### Fase 2 — Analisar o padrão

1. **Ache um caso parecido que funciona** no próprio repositório. Este projeto é repetitivo
   de propósito: se `CardModule` funciona e `CatalogModule` não, a diferença está escrita.
2. **Leia a referência inteira.** Não passe o olho — leia cada linha.
3. **Liste todas as diferenças**, por menores que sejam. *"Isso não pode importar"* é onde o
   bug mora. (Foi assim com `overflow-wrap: anywhere` versus `break-word`: uma palavra de
   diferença, e uma muda o tamanho mínimo do conteúdo.)
4. **Entenda as dependências:** o que mais essa peça precisa? Qual configuração, qual
   variável de ambiente, qual middleware na frente?

### Fase 3 — Hipótese e teste

1. **Uma hipótese por vez, escrita.** "Acho que X é a causa porque Y." Específica, não vaga.
2. **Teste com a menor mudança possível.** Uma variável de cada vez.
3. **Verifique antes de continuar.** Funcionou? Fase 4. Não funcionou? **Nova** hipótese —
   não empilhe correções sobre a anterior.
4. **Quando não souber, diga "não entendo X".** Não finja. Pesquise, ou pergunte.

### Fase 4 — Corrigir e proteger

1. **Escreva o teste que reproduz o bug.** Obrigatório, sem exceção — inclusive nas camadas
   fora do TDD estrito (ADR-004). Se a camada não tem infraestrutura de teste, **este é o
   gatilho para criá-la**. Vermelho antes da correção, sempre (ADR-004).
2. **Uma correção só**, na causa raiz. Nada de "já que estou aqui".
3. **Verifique:**
   ```bash
   docker compose exec app php backend/bin/validate.php
   ```
   e o placar de `http://localhost:8080/tests`.
   *(WORKDIR do contêiner é `/var/www`; por isso o caminho começa em `backend/`.)*
4. **Se a correção não funcionar:** pare e conte quantas você já tentou.
   - Menos de 3 → volte à Fase 1 com a informação nova.
   - **3 ou mais → pare e questione a arquitetura** (passo 5).
5. **Três correções falhadas = problema de arquitetura, não hipótese errada.**
   Sinais: cada correção revela um acoplamento novo em outro lugar; a correção exigiria
   "refatoração massiva"; cada correção cria sintoma novo.
   Pare e pergunte: este desenho é sólido? Estamos mantendo por inércia? **Converse com o
   humano antes de tentar a quarta correção.**

---

## Bandeiras vermelhas — pare e volte à Fase 1

Se você se pegar pensando:

- "Correção rápida agora, investigo depois."
- "Vou mudar X e ver se resolve."
- "Mudo três coisas e rodo os testes."
- "Pulo o teste, verifico na mão."
- "Provavelmente é X, deixa eu corrigir."
- "Não entendi direito, mas isto talvez funcione."
- "A referência é longa, adapto o padrão."
- Listar correções antes de ter rastreado o dado.
- "Mais uma tentativa" — quando já tentou duas.

**Todas significam: PARE. Fase 1.**

## Sinais de quem está acompanhando

- *"Isso não está acontecendo?"* → você supôs sem verificar.
- *"Isso vai nos mostrar…?"* → faltou instrumentar a fronteira.
- *"Para de chutar."* → você está propondo correção sem entender.
- *"Repensa isso a fundo."* → questione os fundamentos, não o sintoma.
- *"A gente travou?"* → sua abordagem não está funcionando.

Ao ver qualquer um: pare e volte à Fase 1.

---

## Racionalizações comuns

| Desculpa | Realidade |
|---|---|
| "É simples, não precisa de processo" | Bug simples também tem causa. O processo é rápido para eles. |
| "É urgente, não dá tempo" | Sistemático é **mais rápido** que tatear. |
| "Tento isto primeiro, depois investigo" | A primeira correção define o padrão. Faça certo desde o começo. |
| "Escrevo o teste depois de confirmar" | Correção sem teste não gruda. O ADR-004 não abre exceção para bug. |
| "Corrijo várias coisas de uma vez" | Você não saberá o que resolveu. E cria bug novo. |
| "A referência é longa, adapto" | Entendimento parcial garante bug. |
| "Estou vendo o problema" | Ver o sintoma ≠ entender a causa. |
| "Mais uma tentativa" (após 2 falhas) | 3 falhas = problema de arquitetura. Questione o padrão. |

---

## Referência rápida

| Fase | Atividades | Critério de sucesso |
|---|---|---|
| **1. Causa raiz** | Ler erro, reproduzir, ver o que mudou, instrumentar fronteiras, rastrear o dado | Entender **o quê** e **por quê** |
| **2. Padrão** | Achar o caso que funciona, comparar | Identificar as diferenças |
| **3. Hipótese** | Formular, testar minimamente | Confirmada, ou nova hipótese |
| **4. Correção** | Teste que reproduz, corrigir, verificar | Bug resolvido, `validate.php` verde |

---

## As armadilhas de depuração deste repositório

Coisas que já custaram uma sessão inteira aqui:

- **`Could not open input file`** ao rodar um script: o WORKDIR do contêiner é `/var/www`,
  com `backend/` e `frontend/` lado a lado. O caminho é `php backend/bin/…`, não `php bin/…`.
- **A janela do navegador ignorando comandos**: se ela estiver minimizada,
  `document.visibilityState` é `"hidden"` e o renderizador congela. Verifique antes de
  concluir que a ferramenta quebrou.
- **A CSP com `frame-ancestors 'none'`** derruba qualquer harness em iframe. Medida de
  largura se faz com a janela real.
- **Console sujo em `/tests` é esperado e documentado**; console sujo **na aplicação** é
  defeito (RNF-03). Não confunda os dois.
- **Variável de ambiente ausente** falha no boot com o nome dela — se o contêiner não sobe,
  leia a saída antes de investigar o código.

## Quando o processo revela "não há causa raiz"

Se a investigação mostrar que o problema é mesmo ambiental, de temporização ou externo:
documente o que foi investigado, implemente o tratamento adequado (nova tentativa, teto de
espera, mensagem de erro) e deixe registro para a próxima investigação.

**Mas:** 95% dos casos de "não há causa raiz" são investigação incompleta.

## Técnicas de apoio, nesta pasta

- **`root-cause-tracing.md`** — subir a cadeia de chamadas até o gatilho original.
- **`defense-in-depth.md`** — validar em todas as camadas depois de achar a causa.
- **`condition-based-waiting.md`** — trocar espera arbitrária por espera por condição
  (+ `condition-based-waiting-example.js`).
- **`find-polluter.sh`** — bisseção para achar o teste que suja o estado global.

Depois de corrigir, `validate.php` verde **e** o placar de `/tests` verde antes de dizer que
acabou.
