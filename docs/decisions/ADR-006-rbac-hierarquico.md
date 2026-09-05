# ADR-006 — Três níveis hierárquicos, não matriz de permissões

**Data:** 04/09/2026 · **Status:** aceito
**Aplica:** `backend/PADROES.md` §5.1 e §5.2

---

## Contexto

O enunciado não pede controle de acesso — pede apenas "usuários devidamente autenticados".
Mas pede outra coisa, com todas as letras:

> *"Considere que o Portal será utilizado por pessoas responsáveis pela gestão das cartas,
> com **diferentes níveis de familiaridade com a tecnologia**."*

E o `PADROES.md` §5.1 marca a proteção de rota por nível como o item de maior valor do
documento inteiro, com uma justificativa que veio de incidente real: rotas nascidas sem
guard resultaram em leitura e exclusão não autenticadas de dados pessoais de clientes.

Entregar um portal administrativo sem níveis de permissão contrariaria o padrão mais caro
da equipe — e desperdiçaria a melhor resposta de produto ao requisito acima.

## Opções consideradas

**A. Sem autorização.** Todo usuário autenticado faz tudo. Atende o enunciado ao pé da
letra, e só.

**B. Dois níveis: `EDITOR` e `ADMIN`.** Cobre a necessidade técnica (alguém precisa
gerenciar jogos). Mas perde o argumento de produto mais forte.

**C. Três níveis hierárquicos: `VIEWER` < `EDITOR` < `ADMIN`.**

**D. Matriz de permissões por recurso.** Tabelas `roles`, `permissions`, `role_permissions`,
com permissões nomeadas (`cards.create`, `games.update`…). É RBAC "de verdade" e é o que se
faria num sistema grande.

## Decisão

**Opção C.** Três níveis hierárquicos, em enum de inteiros, como o §5.1 prescreve:

```php
enum PermissionLevel: int
{
    case VIEWER = 1;   // lista e visualiza cartas
    case EDITOR = 2;   // + cria, edita, exclui, restaura; vê histórico
    case ADMIN  = 3;   // + gerencia jogos, edições e raridades
}
```

Hierárquico significa que a checagem é `$usuario->level->value >= $rota->minimo->value` — um
`ADMIN` faz tudo que um `EDITOR` faz, sem precisar de linha nenhuma dizendo isso.

### Por que o `VIEWER` existe — e é a parte que importa

É a resposta de produto ao "diferentes níveis de familiaridade com a tecnologia". A forma
mais eficaz de proteger quem tem menos familiaridade **não é uma interface mais simples** —
é não dar a essa pessoa um botão que ela não precisa apertar.

Alguém do atendimento que só precisa conferir a raridade de uma carta não deveria conseguir
excluí-la, nem por acidente. O papel de consulta transforma uma preocupação de UX numa
garantia estrutural — validada no servidor, não escondida no CSS.

### Por que não a matriz (opção D)

Com três papéis e um agregado principal, a matriz é **indireção sem ganho** — decoração pelo
critério do §1.3. Ela se paga quando os papéis deixam de ser hierárquicos (alguém que edita
cartas mas não vê relatórios), o que não acontece aqui.

O caminho de migração está aberto: o guard consulta `PermissionLevel`, e trocar a
implementação por consulta a uma matriz é mudar uma classe.

### O que vem junto, obrigatoriamente

| Regra | Origem |
|---|---|
| Toda rota é registrada **envolvida** pelo guard, no composition root — nunca com checagem dentro do corpo | §5.1 |
| A identidade vem **sempre** da sessão, nunca do corpo da requisição | §5.3 |
| Operação destrutiva ou administrativa não pode ser alcançável no nível mais baixo | §5.1 |
| A checagem no cliente serve **apenas** para mostrar ou esconder elemento; a decisão é do servidor | `PADROES-ENGENHARIA.md` §8.1 |
| Nada de checar permissão no cliente imediatamente antes da mutação (TOCTOU) | `PADROES-ENGENHARIA.md` §8.1 |
| O mapa completo de rota → nível vive em `docs/api-contract.md` §9 e é conferido na auditoria | §5.1 |

### Sobre IDOR (§5.2)

O §5.2 exige que todo caso de uso que alcança registro por id verifique posse ou nível, não
apenas existência. **Neste domínio não há posse:** o catálogo de cartas é compartilhado, e
não existe "carta do usuário X". A autorização é integralmente por nível.

Isso está registrado aqui de propósito — para que uma auditoria futura saiba que a ausência
de checagem de posse foi **avaliada e considerada correta**, e não esquecida. Se algum dia
existir recurso com dono (rascunho pessoal, lista privada), o §5.2 volta a valer integralmente
e o helper `assertCanAccess*` precisa ser criado.

## Consequências

- Três usuários no seed, com credenciais publicadas no README — o avaliador consegue
  **testar o RBAC**, não só ler sobre ele. Isso vale mais que qualquer parágrafo.
- A interface esconde ações que o usuário não pode executar, mas o servidor recusa de
  qualquer forma. As duas coisas, sempre.
- O CRUD de usuários pela interface fica fora de escopo (PRD §3.2): os três perfis do seed
  já demonstram o mecanismo, e a tela não acrescenta nada ao que está sendo avaliado.

## Gatilho de revisão

Migrar para matriz de permissões quando surgir o primeiro papel **não hierárquico** — alguém
que possa fazer algo que um nível superior não pode. Enquanto os papéis forem encaixáveis
uns nos outros, o inteiro é a modelagem correta.
