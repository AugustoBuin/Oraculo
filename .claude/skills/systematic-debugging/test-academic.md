# Teste acadêmico — skill de depuração sistemática

Sem pressão, sem cenário. Serve para conferir se a skill **ensina** o que pretende ensinar,
antes de testar se ela resiste a pressão.

Você tem acesso à skill em `.claude/skills/systematic-debugging/`.

Leia a skill e responda **somente com base no que ela diz**:

1. Quais são as quatro fases da depuração sistemática?
2. O que é obrigatório fazer **antes** de qualquer tentativa de correção?
3. Na Fase 3, o que fazer quando a primeira hipótese não se confirma?
4. O que a skill diz sobre corrigir várias coisas de uma vez?
5. O que fazer quando você não entende o problema por inteiro?
6. É aceitável pular o processo quando o bug parece simples?
7. Quantas correções falhadas indicam problema de **arquitetura**, e o que fazer nesse ponto?
8. A Fase 4 exige um teste que reproduz o bug. Segundo o ADR-004 deste projeto, existe
   alguma camada isenta dessa exigência?
9. Quais comandos verificam que a correção não quebrou nada neste repositório?
10. Onde a skill manda tirar a instrumentação temporária, e por quê?

Responda citando trechos diretos da skill onde for aplicável.

---

**Gabarito de referência** (para quem estiver avaliando):

- **1.** Investigar a causa raiz · Analisar o padrão · Hipótese e teste · Corrigir e proteger.
- **2.** Completar a Fase 1 — ler a mensagem inteira, reproduzir, ver o que mudou,
  instrumentar as fronteiras e rastrear o dado para trás. *"Se você não completou a Fase 1,
  você não pode propor correção."*
- **3.** Formular uma **nova** hipótese. Nunca empilhar correção sobre correção.
- **4.** Não fazer: você não saberá o que resolveu, e isso cria bug novo.
- **5.** Dizer "não entendo X". Não fingir; pesquisar ou perguntar.
- **6.** Não. *"Bug simples também tem causa."*
- **7.** Três. Parar, questionar a arquitetura e **conversar com o humano** antes da quarta
  tentativa.
- **8.** Não. *"Bug corrigido entra com o teste que o reproduz, sem exceção"* — inclusive
  fora do TDD estrito; nesse caso o teste é o gatilho para criar a infraestrutura da camada.
- **9.** `docker compose exec app php backend/bin/validate.php` e o placar verde de
  `http://localhost:8080/tests`.
- **10.** Antes do commit: `console.log` em `frontend/src/` e `error_log` em `backend/src/`
  são achados de auditoria (e console limpo na aplicação é o RNF-03).

Resposta que **não** cite a skill, ou que invente comando de outro projeto (`npm test`,
`npx vitest`), é falha do teste — indica que a skill não está sendo lida.
