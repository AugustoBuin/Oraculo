# ADR-009 — Ferramental de IA versionado e declarado

**Data:** 04/09/2026 · **Revisto:** 14/09/2026 · **Status:** aceito

---

## Contexto

Este projeto foi construído com agentes de IA. O código foi escrito em sessões com o Claude
Code, que também rodou as auditorias; um agente Gemini produziu as artes raster da tela de
entrada. A camada que orienta os agentes segue o `backend/PADROES.md` §15: o `CLAUDE.md` na
raiz, os agentes auditores e as skills de método em `.claude/`, e hooks que bloqueiam comando
destrutivo.

A questão não é se deve usar, e sim **o que o repositório que o avaliador clona mostra e declara.**

O enunciado exige *"código 100% autoral e puro"*. No contexto, a frase se refere à ausência de
framework e de biblioteca proibida, não ao uso de assistente de desenvolvimento. Mas, numa
avaliação de contratação, a forma como o assunto chega ao leitor importa.

## Opções consideradas

**A. Versionar e declarar.** A camada entra no repositório, e o uso é explicado no README e
num documento de processo. O leitor julga com a informação inteira.

**B. Versionar sem mencionar.** O leitor encontra o rastro sozinho — nos relatórios de
auditoria, na métrica dos auditores, no histórico — e lê o silêncio como omissão.

**C. Manter fora e não mencionar.** Esconde a ferramenta, mas não o rastro: os relatórios, a
métrica de custo dos auditores e as linhas `Co-Authored-By` dos commits são versionados de
qualquer jeito. Na prática, vira a opção B.

## Decisão

**Opção A.**

- O uso é declarado numa seção curta no fim do `README.md` e detalhado em
  [`docs/PROCESSO.md`](../PROCESSO.md): quem decidiu o quê, o que foi delegado, as travas, os
  erros da IA e como foram pegos, e a linha do tempo.
- `.claude/` e `CLAUDE.md` são versionados, depois da revisão de anonimização do
  [ADR-011](ADR-011-padroes-de-referencia-anonimizados.md): a camada veio adaptada de um
  projeto anterior e cita os padrões de referência.
- **As permissões ficam divididas.** As travas — o que é negado, o que pede confirmação e o
  hook que bloqueia comando destrutivo — vão em `.claude/settings.json`, versionado. O
  `.claude/settings.local.json`, que libera ferramentas sem pedir confirmação, fica fora do
  Git: versionado, ele daria essa liberação a qualquer pessoa que clonasse o projeto e o
  abrisse no Claude Code.
- A linha `Co-Authored-By` fica nos commits. O histórico é a parte conferível do que o
  documento de processo conta.
- O portão de pré-push continua sem IA: `backend/bin/validate.php` no contêiner. Quem avalia
  verifica o projeto sem precisar de agente nenhum.
- `docs/ENGENHARIA.md` continua sendo o guia normativo, escrito para qualquer pessoa que
  mantenha o projeto — e serve igualmente a um agente. O `CLAUDE.md` aponta para ele.

## Consequências

- O avaliador lê o trabalho e sabe como ele foi feito, sem precisar deduzir.
- A seção do README fica no fim: a conversa começa pelo produto e pela engenharia, e a
  explicação está onde quem procura encontra.
- A camada versionada documenta um processo reproduzível: os auditores, o portão e as travas
  ficam à vista de quem mantiver o projeto.
- **Custo real:** um avaliador que desconfie de trabalho feito com IA pode pesar isso contra.
  Aceito: descobrir depois o que não foi dito seria pior, e não usar assistente em 2026 não é
  uma virtude.

## Gatilho de revisão

Se a revisão de anonimização achar, em `.claude/`, conteúdo que não se anonimiza sem perder o
sentido, aquele arquivo fica fora — e o `docs/PROCESSO.md` diz qual e por quê.
