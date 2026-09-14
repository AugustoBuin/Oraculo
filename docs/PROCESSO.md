# Como o Oráculo foi construído

> Este documento conta com que ferramentas o projeto foi feito, quem decidiu o quê e em que
> dias. Ele existe porque usei agentes de IA do começo ao fim, e quem avalia o trabalho deve
> saber disso lendo, não descobrindo. A decisão está no
> [ADR-009](decisions/ADR-009-ferramental-de-ia-declarado.md).

---

## 1. O prazo

- Recebi o desafio em **03/09/2026, quinta-feira, às 14h52**. Não havia prazo oficial.
- Me dei cerca de dez dias. O escopo planejado fechou em **09/09**, com o merge do Épico 10.
- De 10 a 14/09, o trabalho foi refinamento sobre um produto que já funcionava: layout, paleta,
  cores de raridade e identidade visual.
- Entregue em **14/09/2026, segunda-feira**.

## 2. Linha do tempo

Tirada do histórico do Git (`git log --merges development`). A data é a do commit: ela diz o
que entrou em cada dia, não quantas horas foram trabalhadas.

| Dia | O que entrou |
|---|---|
| 03/09, qui | Desafio recebido. |
| 04/09, sex | Planejamento: PRD, ADRs, contrato da API, schema do banco e backlog do backend. |
| 05/09, sáb | O backend inteiro, Épicos 0 a 4: ambiente reprodutível, autenticação e permissões, catálogos, cartas com imagem, trilha de auditoria e gestão de catálogo. |
| 06/09, dom | — |
| 07/09, seg (feriado) | O frontend, Épicos 5 a 9: fundação, acesso, galeria com filtros e tabela, cadastro de cartas e administração de catálogos. |
| 08/09, ter | Acabamento: a interface com a fonte do navegador em 200%, a hierarquia de títulos, a Content-Security-Policy e o README de entrega. |
| 09/09, qua | Auditoria completa de qualidade e segurança, verificação na tela e as correções OF-001 a OF-004. Merge do Épico 10: **fim do escopo planejado**. |
| 10/09, qui | Layout em primitivas que decidem pela largura do componente; a tela `/paleta`, que mede contraste ao vivo; a paleta nova; e o backend das cores de raridade. |
| 11/09, sex | As cores de raridade na interface, com o editar na própria linha. |
| 12/09, sáb | Identidade visual: a marca, o ícone da aba, o verso da carta, os ícones, a carta no modal de exclusão, as ilustrações dos estados vazios e a cena da tela de entrada. A correção do OF-005. |
| 13/09, dom | A virada da carta na tela de entrada. |
| 14/09, seg | Auditoria do que mudou desde 09/09, a correção do OF-006, o merge da identidade visual e esta documentação. |

## 3. Quem fez o quê

### O que foi meu

- **O escopo e os cortes:** o que entra e o que fica fora, com o motivo ([PRD](PRD.md) §3).
- **As decisões de arquitetura**, registradas em [`decisions/`](decisions/).
- **A régua de qualidade:** os padrões de engenharia de backend e de frontend, que escrevi a
  partir da minha experiência profissional
  ([ADR-011](decisions/ADR-011-padroes-de-referencia-anonimizados.md)).
- **As decisões de produto e de desenho:** as cinco decisões do README, a paleta, a marca e a
  cena da tela de entrada, escolhidas entre alternativas.
- **A aprovação de cada entrega** antes do merge, e a **verificação na tela**. Foi olhando a
  aplicação que achei o OF-004 e o OF-005, que os testes e as auditorias deixaram passar.

### O que foi delegado

- **Claude Code**, da Anthropic. O código foi escrito em sessões com ele, a partir do backlog e
  sob as regras deste repositório. Foi ele também quem rodou as auditorias (seção 5), fez as
  medições e as fotos de tela com o Chrome sem janela, e escreveu como código os SVGs da marca,
  dos ícones, do verso da carta e das ilustrações.
- **Claude in Chrome**, a extensão do Claude para o navegador, na verificação da aplicação em
  execução: teclado, zoom e larguras de tela.
- **Gemini**, do Google, nas imagens raster da tela de entrada: a mesa e a carta deitada, uma
  de cada por tema. Os pedidos estão no P4 do
  [checklist de identidade visual](visual-identity-checklist.md).
- **Um artefato do Claude**, publicado, na pesquisa sobre a empresa e os produtos dela, em
  [`pre-development/LigaMagic-research.md`](pre-development/LigaMagic-research.md).

## 4. As travas

Delegar exige limite. Estas regras valeram para todo trabalho feito por agente:

- **Nenhuma dependência de terceiros**
  ([ADR-001](decisions/ADR-001-sem-dependencias-de-terceiros.md)). Nada que um agente
  instalasse entraria no projeto.
- **Teste antes da implementação**
  ([ADR-004](decisions/ADR-004-tdd-seletivo-e-runner-autoral.md)). Nas camadas sob TDD
  estrito, o teste é escrito e visto falhando antes do código; e todo bug corrigido entra com o
  teste que o reproduz.
- **O portão não usa IA.** O pré-push roda `backend/bin/validate.php` no contêiner: conflitos
  de merge, sintaxe, fronteiras de camada e testes. Quem avalia o projeto não precisa de agente
  nenhum para verificá-lo.
- **O agente não publica nem apaga.** Nas sessões, ficaram bloqueados o envio ao GitHub — todo
  push foi meu —, a reescrita de histórico, o descarte de alterações, a remoção recursiva de
  diretório e a leitura do `.env`. A configuração dessas travas mora em `.claude/`.
- **Decisão de gosto é minha.** Em desenho, o agente mostra o rascunho e pergunta; sozinho, só
  corrige defeito técnico, como contraste abaixo do piso ou forma saindo da caixa.
- **Teste não basta para layout.** O que a suíte não mede se confere na tela, com a aplicação
  rodando.

## 5. As auditorias

Três agentes auditores, somente leitura: qualidade do backend, qualidade do frontend e
segurança, esta com os achados pontuados em CVSS v3.1. Cada um grava um relatório datado em
[`audits/`](audits/), e os achados graves entram no [ledger](audits/open-findings.md).

| Data | Escopo | Backend | Frontend | Segurança |
|---|---|---|---|---|
| 09/09 | Completo | 0 C · 1 A · 6 M · 8 B | 0 C · 2 A · 4 M · 7 B | 0 C · 0 A · 3 M · 2 B |
| 14/09 | O que mudou desde 09/09 | 0 C · 1 A · 2 M · 2 B | 0 C · 0 A · 2 M · 3 B | 0 C · 0 A · 0 M · 0 B |

*C: crítico · A: alto · M: médio · B: baixo.*

- Os três achados altos de 09/09 (OF-001 a OF-003) eram defeitos do código escrito por agente,
  achados por outro agente. Foram corrigidos no mesmo dia, cada um com o teste antes.
- O alto de 14/09, o A-1 do relatório de backend, virou o OF-006 e foi corrigido antes do
  merge — ver a seção 6.
- **A auditoria de segurança de 14/09 foi interrompida** por limite de uso da ferramenta e
  refeita no mesmo dia, quando o limite renovou: nenhum achado.
- Auditoria feita por agente não substitui olhar a aplicação: nenhuma das três de 09/09 pegou o
  OF-004.

## 6. Onde a IA errou, e como foi pego

| Quando | O que aconteceu | Quem pegou |
|---|---|---|
| 09/09 | **OF-004.** O campo de imagem ficou inutilizável no desktop, numa regressão do próprio acabamento. | Eu, na tela. As três auditorias completas tinham passado por ele. |
| 11/09 | O agente começou uma terceira rodada de variantes do logo, por gosto próprio, sem me mostrar. | Eu. A regra passou a ser mostrar o rascunho e perguntar. |
| 12/09 | **Dois testes que não mediam nada.** A rede de testes de geometria montava a galeria e a paginação do jeito errado e media uma caixa vazia desde 10/09: os testes passavam sem verificar. | O próprio agente, ao escrever o teste seguinte (`6f343cd`). |
| 12/09 | **OF-005.** O botão "Excluir" quebrava ao meio na visão tabela. A rede de geometria não alcançava tabelas. | Eu, na tela. |
| 14/09 | **OF-006 (A-1).** O seed, que roda a cada boot, desfazia o nome e a ordem que o ADMIN editasse em edições e raridades — alcançável pela interface desde que o editar entrou, em 11/09. | A auditoria do que mudou. Corrigido com teste antes do merge (`ae882c5`). |
| 14/09 | **Uma premissa errada.** O registro tratava a moldura do cartão de entrada como esticada, e havia uma decisão pendente sobre isso. Medido o cartão real, ela não esticava: ficava centrada. | A medição, antes que a decisão fosse tomada sobre o problema errado. |

## 7. O histórico do Git

- Os commits feitos em sessão com o Claude Code levam a linha `Co-Authored-By: Claude`.
- Em **08/09**, seguindo a primeira versão do ADR-009, reescrevi o histórico para retirar essa
  linha. Por isso os commits de 04 a 08/09, até `4dcca3c`, não a têm. O trabalho desses dias
  foi feito da mesma forma que o dos seguintes.
- A partir de **09/09** (`b80502f`), a linha ficou.

## 8. O que fica fora do repositório

- **As permissões locais do Claude Code** (`.claude/settings.local.json`), que liberam
  ferramentas sem pedir confirmação. As travas estão versionadas em `.claude/settings.json`
  ([ADR-009](decisions/ADR-009-ferramental-de-ia-declarado.md)).
