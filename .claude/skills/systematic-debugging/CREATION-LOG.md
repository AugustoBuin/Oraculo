# Log de criação e adaptação — skill de depuração sistemática

Registro de como esta skill chegou aqui, o que foi preservado e o que mudou. Serve de
referência para adaptar as outras skills e para saber **o que não desfazer** por engano.

## Origem

A skill veio pronta de outro projeto (Node/TypeScript, Next.js, Prisma, Vitest). O método —
as quatro fases, a lei de ferro, a resistência à racionalização — é bom e é o mesmo que o
`backend/PADROES.md` §11 já exige deste repositório. O que não servia era o **vocabulário**:
comandos `npm test`, exemplos em React, bisseção por `npm test <arquivo>`.

## Decisões de extração

**Preservado, sem tocar no mérito:**
- A lei de ferro: nenhuma correção sem investigação de causa raiz antes.
- As quatro fases, na mesma ordem e com os mesmos critérios de saída.
- A regra das três correções falhadas → problema de arquitetura → **conversar com o humano**.
- A tabela de racionalizações e a seção de bandeiras vermelhas: é o que cria atrito
  cognitivo na hora em que o atalho parece justificado.
- A seção "sinais de quem está acompanhando" — as frases que denunciam que o processo
  foi pulado.
- Os três testes de pressão e o teste acadêmico, como método de validação.

**Traduzido para este repositório:**
- Idioma: português, como todo documento normativo do projeto (`ENGENHARIA.md` §6).
- Instrumentação de fronteira: o exemplo de Next.js virou a cadeia real daqui —
  tela → `shared/api/client.js` → Apache → front controller → rota → caso de uso → PDO.
- Comandos: `docker compose exec app php backend/bin/validate.php` e o placar de
  `http://localhost:8080/tests`, no lugar de `npm test` / `npx vitest`.
- Fase 4: passou a citar o ADR-004 — **bug corrigido entra com o teste que o reproduz,
  sem exceção**, inclusive nas camadas fora do TDD estrito.
- Exemplos: os bugs reais deste projeto (o link de pular conteúdo morto no roteador, a URL
  malformada estourando fora do `try`, a corrida do RF-25) substituíram os exemplos de
  `git init` em diretório errado.
- `find-polluter.sh`: agora usa o filtro por classe do micro-runner autoral
  (`php backend/bin/test.php <Classe>`) em vez de `npm test <arquivo>`, e documenta como
  bisseccionar a suíte do navegador, que não tem execução por linha de comando.
- `condition-based-waiting-example.ts` virou `.js`, sem tipos e sem dependência (ADR-001),
  com os auxiliares que fazem sentido aqui: esperar elemento, esperar requisição, esperar
  **cancelamento** (a corrida do RF-25).
- Acrescentada a seção "as armadilhas de depuração deste repositório" — o WORKDIR do
  contêiner, a janela minimizada que congela o renderizador, a CSP que derruba iframe, o
  console sujo esperado em `/tests`. Cada uma custou uma sessão inteira pelo menos uma vez.

**Removido:**
- Nada do método. As referências a ferramentas que não existem aqui foram substituídas, não
  apagadas — o objetivo era manter a força da skill e trocar o endereço dos comandos.

## Elementos de blindagem (por que o texto é assim)

**Linguagem:** "SEMPRE" e "NUNCA", não "deveria" e "tente". "Especialmente quando houver
pressa." "PARE e volte à Fase 1." São escolhas deliberadas: instrução mole é a primeira coisa
a ceder sob prazo.

**Estrutura:** Fase 1 obrigatória antes de qualquer proposta; uma hipótese por vez; modo de
falha explícito ("se a correção não funcionar, conte quantas você já tentou"); seção de
antipadrões mostrando exatamente com que cara o atalho aparece.

**Redundância:** o mandato de causa raiz aparece no princípio, na lei de ferro, na Fase 1 e
nas bandeiras vermelhas. Repetição aqui não é desleixo — é o que sobrevive à leitura
apressada.

## Como validar depois de mexer

1. `test-academic.md` — sem pressão: a skill **ensina** o que pretende?
2. `test-pressure-1.md` — prazo de entrega e remendo de 2 minutos.
3. `test-pressure-2.md` — custo afundado e cansaço.
4. `test-pressure-3.md` — autoridade e pressão social.

Rode cada um numa sessão limpa, com acesso à skill, e confira a nota de avaliação no fim de
cada arquivo. Resposta que cite comando de outro projeto (`npm test`, `npx vitest`) é sinal
de que a skill não foi lida — ou de que uma adaptação escapou.

## Regra de manutenção

Quando uma regra do projeto mudar, atualize **todos** os documentos que a descrevem na mesma
leva (`PADROES.md` §15.1). Definição de agente ou skill desatualizada ensina o agente a
reintroduzir o defeito que já foi corrigido — já aconteceu, em outro projeto, com o
tratamento de erro.

---

*Origem: outro repositório, 03/10/2025 · Adaptado para o Oráculo em 08/09/2026*
