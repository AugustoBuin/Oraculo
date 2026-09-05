# ADR-011 — Padrões de engenharia de referência fora do repositório

**Data:** 04/09/2026 · **Status:** aceito

---

## Contexto

O projeto é construído sobre dois documentos de padrões de engenharia trazidos da
experiência profissional do autor: um de backend e um de frontend. Eles são a régua de
qualidade deste repositório, e os ADRs desta pasta os citam por seção o tempo todo.

Ao preparar o primeiro commit, uma leitura dos arquivos revelou o problema: o documento de
backend **nomeia o empregador atual do autor** e descreve incidentes de segurança
específicos daquele sistema, entre eles um achado crítico de leitura e exclusão não
autenticadas de dados pessoais de clientes que permaneceu aberto por meses.

Este repositório é público e está anexado a uma candidatura em outra empresa.

## Opções consideradas

**A. Versionar os dois documentos como estavam.** Dá ao leitor o contexto completo das
decisões. Publica o histórico de incidentes de segurança de um terceiro, num repositório
público, sem o consentimento dele. Histórico de Git não se apaga: uma vez publicado, existe
em todo clone e em todo fork.

**B. Versionar uma versão anonimizada.** Remover nomes e detalhes de incidente. Preserva a
maior parte do valor. Mas exige revisar 75 KB de texto linha a linha com risco de deixar
passar uma referência indireta — e trabalho de revisão sob prazo é onde escapa justamente o
detalhe que importa.

**C. Não versionar.**

## Decisão

**Opção C.** `backend/PADROES.md` e `frontend/PADROES-ENGENHARIA.md` entram no
`.gitignore`. Continuam no disco como referência de construção; não vão para o repositório.

O que o repositório precisa expor, ele expõe por conta própria:

- `docs/ENGENHARIA.md` traz as regras operacionais que quem mantém o projeto precisa seguir.
- Cada ADR **cita inline** o trecho relevante do padrão que motivou a decisão, então o
  raciocínio é acompanhável sem o documento de origem.
- As referências por seção (`PADROES.md §5.1`) continuam nos ADRs como procedência, do mesmo
  modo que se cita uma norma interna que não se reproduz.

## Consequências

- Um leitor externo não consegue conferir a citação contra o documento original. Custo real
  e aceito: a alternativa é publicar material de terceiro.
- O autor mantém os dois arquivos localmente e pode compartilhá-los sob controle, se a
  conversa técnica pedir.
- **Regra que passa a valer no projeto:** antes de qualquer `git add -A`, verificar se algum
  arquivo novo carrega nome de empresa, dado pessoal ou histórico de incidente de terceiro.
  Publicação é irreversível; a conferência custa segundos.

## Gatilho de revisão

Versionar uma variante anonimizada (opção B) se o documento vier a ser usado como material
público — artigo, palestra, portfólio aberto. Nesse caso a revisão é feita sem prazo e com
leitura integral, não como etapa de um commit.
