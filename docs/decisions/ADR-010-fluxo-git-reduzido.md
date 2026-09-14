# ADR-010 — GitFlow reduzido a `main`, `development` e `feature-*`

**Data:** 04/09/2026 · **Status:** aceito
**Diverge de:** `backend/PADROES.md` §13.1

---

## Contexto

O `PADROES.md` §13.1 define cinco branches: `release` (produção), `main` (homologação),
`development` (integração), `feature-*` e `bugfix-*`. Faz total sentido num sistema com
ambientes de deploy separados.

Este repositório não tem deploy. Ele tem **um leitor**: o avaliador, que clona e roda.

E ele tem um risco concreto que o fluxo completo cria: quatro branches longevas com um punhado
de commits cada lê como cerimônia, não como processo. Pior, existe uma armadilha operacional
real — o avaliador clona, cai na branch padrão e precisa que o código completo esteja **ali**.

## Opções consideradas

**A. GitFlow completo do §13.1.** Coerente com o padrão. Cria `release` sem nada para
liberar e arrisca deixar o avaliador na branch errada.

**B. Só `main`, commits diretos.** Simples e honesto para um projeto solo, mas joga fora a
demonstração de fluxo de trabalho — que é um dos conhecimentos essenciais listados no
anúncio da vaga ("conhecimentos básicos de Git, Jira e Linux").

**C. GitFlow reduzido.**

## Decisão

**Opção C.**

| Branch | Papel |
|---|---|
| `main` | **A branch de entrega.** É onde o avaliador cai ao clonar, e está sempre em estado executável |
| `development` | Integração. Base de toda feature |
| `feature-*` | Uma por entrega do backlog |

Sem `release`: não há produção para liberar.

### As regras do §13.2 valem integralmente

Elas custaram incidente real na equipe e não têm nada a ver com o número de branches:

```bash
git switch -c feature-sessao-de-servidor --no-track origin/development
git push -u origin feature-sessao-de-servidor
```

- **Hífen, nunca barra.** O Git guarda refs como arquivos: `refs/heads/feature` (arquivo) e
  `refs/heads/feature/algo` (que exige `feature` como diretório) não coexistem. Basta alguém
  criar uma branch chamada `feature` uma vez para todo `feature/*` passar a ser rejeitado.
- **`--no-track` sempre.** `git checkout -b nome origin/development` herda
  `origin/development` como upstream, e clientes gráficos empurram para o upstream
  configurado — os commits caem direto na base, sem PR e sem revisão. `git branch -vv`
  mostra o upstream antes do push.
- **Nome específico.** Nada de `ajustes`, `teste`, `correcao`, `fix`.

### Merge com `--no-ff`

Merge de `feature-*` em `development` sempre com `--no-ff`, para que o histórico mostre o
agrupamento das entregas. Com fast-forward, os commits se dissolvem numa linha reta e o
processo desaparece — que é exatamente o que se quer mostrar aqui.

### Commits

Conventional Commits com descrição em português, no imperativo (§13.3):

```
feat(session): grava a sessão no MySQL com revogação por usuário
fix(card): cancela a requisição de edições em voo ao trocar de jogo
docs(adr): registra a divergência de status 401 e 403
test(card): cobre a validação de edição de outro jogo
```

Um commit = uma ideia. Se o título precisa de "e", são dois commits. Nada de `wip` na branch
que vai ser lida.

## Consequências

- O histórico conta uma história legível: fundação → autenticação → catálogos → cartas →
  frontend → acabamento, com os merges marcando as fronteiras.
- **Verificação obrigatória antes da entrega:** confirmar que `main` é a branch padrão do
  repositório no GitHub e que ela contém tudo. É o erro mais bobo e mais caro possível aqui.
- Sem PRs formais, já que não há revisor. O checklist de PR do §17.3 é aplicado como
  autoconferência antes de cada merge em `development`.

## Gatilho de revisão

Adotar o fluxo completo do §13.1 assim que houver ambiente de deploy real ou um segundo
desenvolvedor. As duas coisas que faltam aqui — `release` e revisão por PR — só fazem
sentido quando existe para onde liberar e quem revisar.
