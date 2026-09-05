# ADR-004 — TDD onde o retorno é alto, com micro-runner autoral

**Data:** 04/09/2026 · **Status:** aceito
**Diverge de:** `backend/PADROES.md` §10.1 · **Aplica:** `frontend/PADROES-ENGENHARIA.md` §13.2

---

## Contexto

Os dois documentos de referência não dizem a mesma coisa sobre testes, e a diferença precisa
ser resolvida **antes** da implementação — não descoberta no meio dela.

`backend/PADROES.md` §10.1 é absoluto:

> *"NENHUM CÓDIGO DE PRODUÇÃO SEM UM TESTE FALHANDO ANTES. Escreveu o código antes do teste?
> Apague e recomece. Sem exceção."*

`frontend/PADROES-ENGENHARIA.md` §13.2 prioriza:

| Prioridade | Alvo |
|---|---|
| Alta | Regra de negócio pura, permissão, formatação, cálculo, validação |
| Alta | Camada de dados: montagem de requisição e tratamento de erro |
| Média | Comportamento de componente |
| Baixa | Detalhe de implementação interna — *"quase sempre não deve ser testado"* |

Somando: cinco dias úteis, uma pessoa, e a exigência do próprio §10.1 de que a exceção seja
*"combinada com um humano antes"*. É o que este ADR faz.

## Opções consideradas

**A. TDD estrito em 100% do código.** Coerente com o §10.1. Testar repositório PDO exige
banco de teste, fixtures e limpeza entre casos; testar renderização de DOM sem biblioteca
exige montar um harness próprio. É meio dia de infraestrutura de teste por camada, num
cronograma que tem cinco dias no total.

**B. Sem testes automatizados.** O usuário já descartou, e com razão: o anúncio da vaga pede
"preocupação com qualidade e boas práticas", e teste é a evidência disso.

**C. TDD estrito onde o teste é barato e valioso; verificação manual documentada no resto.**

## Decisão

**Opção C**, com a fronteira definida por escrito para que não vire desculpa em campo.

### Sob TDD estrito — RED verificado antes de qualquer implementação

| Alvo | Por quê |
|---|---|
| Entidades de domínio | Puras, sem I/O. Teste roda em milissegundos |
| Casos de uso, com dublês simples dos gateways | As interfaces do domínio existem exatamente para isso |
| Elos da cadeia de validação | Cada elo é uma unidade isolada, e é onde o dado inválido é barrado |
| Regras de permissão (`PermissionLevel`) | Cobertura obrigatória: nível suficiente, nível insuficiente, e **o efeito que não pode acontecer** quando o acesso é negado |
| Estratégias de imagem | Validação de esquema de URL e de tipo real de arquivo |
| Apresentadores (`present*`) | Garantem que id interno e coluna de banco não vazam para a resposta |

Cobertura obrigatória por caso de uso (§10.5): caminho feliz, **cada** validação, **cada**
regra de autorização, e o efeito colateral que não pode ocorrer quando o acesso é negado.

### Fora do TDD — verificação por roteiro manual documentado

| Alvo | Por quê | Como é verificado |
|---|---|---|
| Repositórios PDO | Exigem banco; seriam teste de integração, não unitário | Exercitados de ponta a ponta pelo roteiro manual |
| Fiação de rota e middleware | Testar o roteador testa o roteador | Mapa de rotas do `api-contract.md` §9 conferido rota a rota |
| Renderização de DOM | Sem biblioteca, o harness custa mais que o valor que entrega | Roteiro manual com console aberto |

O roteiro de testes manuais vai no README e cobre, no mínimo: os três perfis de permissão,
os quatro estados de cada tela, a cascata com troca rápida (RF-25), o desfazer da exclusão,
e os dois temas.

### O runner é autoral

`bin/test.php`, ~120 linhas, decorrência direta do ADR-001. Descobre `tests/**/*Test.php`,
instancia, executa métodos que começam com `test`, e oferece `assertSame`, `assertEquals`,
`assertTrue`, `assertNull`, `assertCount` e `assertThrows`. Devolve exit code — é o que
permite ao `bin/validate.php` bloquear o push.

Convenções mantidas do §10.5: testes espelham `src/`, um arquivo por unidade, nomes em
português descrevendo comportamento (`testRejeitaEdicaoDeOutroJogoComValidationError`), e
um `makeSut()` por classe de teste.

## Consequências

- **A cobertura não é uniforme, e isso é deliberado.** A camada onde um bug custa caro
  (domínio, casos de uso, permissão, validação) tem TDD estrito; a camada onde o teste
  custaria mais do que entrega tem verificação manual documentada.
- O `bin/validate.php` continua bloqueando o push com teste vermelho — o portão existe, só
  não cobre tudo.
- **Bug corrigido entra com o teste que o reproduz**, sem exceção, mesmo em área fora do
  TDD estrito. Se o bug estiver numa camada sem teste unitário, o teste da correção é o
  gatilho para criar a infraestrutura daquela camada.

## Gatilho de revisão

Promover o restante para TDD estrito quando: o projeto ganhar um segundo desenvolvedor; ou
o mesmo defeito reaparecer duas vezes numa camada hoje sem teste — a segunda ocorrência é
prova de que a economia estava errada.
