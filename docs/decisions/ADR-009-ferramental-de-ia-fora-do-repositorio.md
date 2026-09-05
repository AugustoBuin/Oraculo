# ADR-009 — Ferramental de IA fora do repositório entregue

**Data:** 04/09/2026 · **Status:** aceito

---

## Contexto

O `backend/PADROES.md` §15 descreve uma camada de agentes de IA — `CLAUDE.md` na raiz, três
agentes especializados em `.claude/agents/`, duas skills de método e hooks de bloqueio de
comando destrutivo. É ferramental legítimo e produtivo, e será usado na construção deste
projeto.

A questão não é se usar; é **o que vai versionado no repositório que o avaliador clona.**

O enunciado exige *"código 100% autoral e puro"*. Essa frase se refere, no contexto, à
ausência de framework e biblioteca proibida — não ao uso de assistente de desenvolvimento,
que em 2026 é ferramenta corrente. Mas um repositório cuja raiz abre com `CLAUDE.md` e
`.claude/agents/` coloca a discussão sobre autoria **antes** da primeira linha de código
lida. Numa avaliação de contratação, a ordem de leitura importa.

## Opções consideradas

**A. Versionar e assumir abertamente**, com uma seção no README explicando o uso de IA como
ferramenta de engenharia e os auditores como parte do portão de qualidade. É a opção mais
transparente, e pode impressionar quem valoriza ferramental moderno. Depende inteiramente da
cultura da empresa — que ainda não conhecemos.

**B. Versionar sem mencionar.** A pior das três: se o avaliador encontrar por conta própria
algo que o README não menciona, lê como omissão.

**C. Manter fora do repositório.** O ferramental existe e é usado localmente; não é
versionado.

## Decisão

**Opção C.**

- `.claude/` e `CLAUDE.md` entram no `.gitignore`.
- O conteúdo que o Anexo A do `PADROES.md` prescreve para o `CLAUDE.md` — como rodar, quais
  as fronteiras, quais as armadilhas do repositório — **é versionado**, como
  `docs/ENGENHARIA.md`. Ele é escrito como guia de manutenção para qualquer pessoa que
  entre no projeto, e serve igualmente bem a um agente.
- O `CLAUDE.md` da raiz é um ponteiro de três linhas para `docs/ENGENHARIA.md`, e fica local.

**O conhecimento é versionado; a ferramenta, não.**

## Consequências

- O repositório entregue é lido como o que ele é: código, documentação de engenharia e
  registro de decisões. A conversa começa pelo trabalho.
- Nada de valor se perde: `docs/ENGENHARIA.md`, os ADRs, o PRD, o contrato de API e o
  backlog são exatamente o que um time precisa para manter o projeto — e são os artefatos
  que demonstram processo.
- Se o assunto surgir na entrevista, ele é respondido diretamente. Não usar assistente em
  2026 não é uma virtude, e este ADR existe para que a decisão seja explicável.
- **Custo real:** um leitor que valorizasse especificamente a automação de qualidade não vai
  vê-la. Aceito, porque é uma aposta sobre cultura desconhecida, e a alternativa arrisca
  algo maior.

## Gatilho de revisão

Reverter para a **opção A** assim que a cultura de engenharia da empresa for conhecida — em
conversa técnica, ou num segundo projeto para o mesmo time. Fora do contexto de avaliação
de contratação, versionar o ferramental é o correto: é o que o `PADROES.md` §15 prescreve, e
ferramenta compartilhada só ajuda o time se estiver no repositório.
