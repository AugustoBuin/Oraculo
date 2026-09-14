# ADR-011 — Padrões de engenharia de referência, versionados e anonimizados

**Data:** 04/09/2026 · **Revisto:** 14/09/2026 · **Status:** aceito

---

## Contexto

O projeto é construído sobre dois documentos de padrões de engenharia que escrevi a partir da
minha experiência profissional: `backend/PADROES.md` e `frontend/PADROES-ENGENHARIA.md`. Eles
são a régua de qualidade deste repositório, e os ADRs os citam por seção o tempo todo.

Os documentos nasceram no contexto do meu emprego atual. O de backend nomeia a empresa e
descreve incidentes de segurança do sistema dela com detalhe suficiente para identificá-lo.

Este repositório é público e está anexado a uma candidatura em outra empresa. Quem avalia
precisa ver a régua que o projeto afirma seguir; a empresa onde trabalho não pode ser exposta.

## Opções consideradas

**A. Versionar como estão.** Publica o nome e o histórico de incidentes de um terceiro, sem o
consentimento dele. Histórico de Git não se apaga: publicado, existe em todo clone e fork.

**B. Versionar uma versão anonimizada.** A régua fica visível, e as citações dos ADRs passam a
ser conferíveis. Exige revisão integral dos cerca de 140 KB, linha a linha, com o risco de
deixar passar uma referência indireta.

**C. Não versionar.** Protege o terceiro, mas o avaliador não vê a régua nem confere uma
citação sequer.

## Decisão

**Opção B.** Os dois documentos são versionados depois de anonimizados, por estas regras:

1. **Nenhum identificador.** Nome de empresa, marca, produto, cliente, fornecedor ou pessoa;
   domínio, URL, e-mail, IP, nome de servidor, de banco ou de repositório; qualquer caminho que
   leve à empresa. Onde o nome sustentava a frase, entra um genérico: "o sistema", "a empresa".
2. **Incidente vira lição.** Fica o tipo de falha e a regra que ela gerou. Saem o sistema, a
   data, a duração, o volume de dados afetados e qualquer detalhe que sirva de caminho de
   ataque a um sistema real.
3. **Exemplos reescritos.** Código e configuração de exemplo usam nomes deste projeto ou
   neutros.
4. **Metadado também identifica.** Caminho absoluto de máquina e e-mail de autor de commit
   carregam nome de empresa, e a regra vale para eles.
5. **Revisão sem pressa, antes do commit.** A leitura é integral e acontece como último passo
   antes da entrega, junto da revisão da camada `.claude/`
   ([ADR-009](ADR-009-ferramental-de-ia-declarado.md)). O commit só acontece depois de uma
   busca pelos termos proibidos — e a lista desses termos fica fora do repositório, porque ela
   própria os contém.
6. **Antes de qualquer `git add`**, conferir se um arquivo novo carrega nome de empresa, dado
   pessoal ou histórico de incidente de terceiro. Publicação é irreversível; a conferência
   custa segundos.

A revisão terminou em 14/09, e os dois arquivos entraram no repositório.

## Consequências

- O avaliador vê a régua que o projeto afirma seguir, e cada citação `PADROES.md §x` dos ADRs
  passa a ser conferível.
- **Custo real:** a versão anonimizada perde o peso do caso concreto — um incidente contado em
  termos genéricos convence menos que o original. Aceito: a lição sobrevive, e é ela que
  justifica a regra.
- O risco residual é a referência indireta que escapa à leitura. A busca por termos cobre o
  óbvio; a leitura integral cobre o resto.

## Gatilho de revisão

Se anonimizar um trecho exigir tirar tanto que a regra perca o motivo, o trecho sai inteiro, e
o ADR que o citava passa a trazer o motivo em palavras próprias.

## Histórico

A primeira versão desta decisão, de 04/09, escolheu a opção C: revisar o texto sob o prazo da
construção era onde escaparia justamente o detalhe que importa. Em 14/09, com o código pronto e
tempo para a leitura integral, a decisão passou a ser a opção B.
