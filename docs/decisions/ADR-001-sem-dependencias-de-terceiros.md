# ADR-001 — Zero dependências de terceiros, inclusive Composer

**Data:** 04/09/2026 · **Status:** aceito
**Diverge de:** `backend/PADROES.md` §2.5 e §10.6

---

## Contexto

O `PADROES.md` §2.5 estabelece, com razão, o autoload PSR-4 **via Composer**, e é explícito
ao justificar: *"Composer é gerenciador de dependência, não framework — usar é correto"*. O
§10.6 usa PHPUnit e o §16.1 versiona o `composer.lock`. Em qualquer projeto normal, isso é
a escolha certa e eu concordo integralmente.

Este projeto tem uma restrição que os projetos normais não têm. O enunciado do desafio exige:

> *"Código 100% autoral e puro, garantindo que nenhum framework ou biblioteca proibida foi
> utilizado"*

E, sobre o frontend: *"JavaScript vanilla (sem bibliotecas ou dependências externas)"*.

O que a entrega precisa provar não é apenas que nenhuma biblioteca proibida foi usada — é
que isso é **verificável em segundos** por quem avalia.

## Opções consideradas

**A. Composer para autoload + PHPUnit + PHPStan.** O que o `PADROES.md` prescreve. Ganha
PHPStan level 8, que é uma perda real de abrir mão. Custa um diretório `vendor/` no
repositório: mesmo contendo só autoloader e ferramentas de desenvolvimento, ele é a primeira
coisa que um avaliador apressado vê, e o convida a parar e verificar antes de ler uma linha
de código.

**B. Composer só em desenvolvimento, `vendor/` no `.gitignore`.** Resolve o problema visual,
mas transfere um passo de instalação para o avaliador (`composer install`) e quebra o
requisito de subir com um comando só. Pior: o `composer.json` versionado continua listando
dependências, e a explicação passa a ser necessária de qualquer forma.

**C. Zero dependências.** Autoloader PSR-4 escrito à mão, micro-runner de testes autoral,
`php -l` no lugar da análise estática.

## Decisão

**Opção C.** Nenhuma dependência de terceiros, em nenhuma camada.

O autoload PSR-4 são ~15 linhas com `spl_autoload_register`, entregando o mesmo mapeamento
que o Composer entregaria:

```php
spl_autoload_register(static function (string $class): void {
    // App\Domain\Card\Entity\Card → src/Domain/Card/Entity/Card.php
    if (!str_starts_with($class, self::PREFIX)) {
        return;
    }
    $relative = str_replace('\\', '/', substr($class, strlen(self::PREFIX)));
    $file = self::SOURCE_DIR . '/' . $relative . '.php';
    if (is_file($file)) {
        require $file;
    }
});
```

Não vale o risco de percepção por 15 linhas de código.

## Consequências

**Perdas — e como são compensadas:**

| Perdemos | Compensação |
|---|---|
| PHPStan level 8 | `declare(strict_types=1)` em todo arquivo, tipos em toda assinatura e propriedade, `php -l` sobre todos os arquivos dentro de `bin/validate.php`. É menos, e é honesto reconhecer. |
| PHPUnit | Micro-runner autoral (ADR-004), ~120 linhas, com `assertSame`, `assertEquals`, `assertThrows` e exit code. |
| Ecossistema de bibliotecas | Nenhuma é necessária no escopo. As necessidades reais — UUID, JSON, hash, sessão, upload — são todas atendidas por funções nativas do PHP. |

**Ganhos:**
- A verificação de conformidade com o enunciado é uma busca por `vendor/` que volta vazia.
- O `docker compose up` não precisa de etapa de instalação de dependências.
- A regra do `.gitignore` que bloqueia `/vendor/` vira uma guarda, não uma exclusão.

## Gatilho de revisão

Este ADR vale **exclusivamente** enquanto a restrição "código 100% autoral" existir. Fora
do contexto do desafio — em um projeto real na mesma stack —, a decisão correta é a
**opção A**, exatamente como o `PADROES.md` §2.5 prescreve. Se este código virar base de
algo continuado, o primeiro passo é adotar Composer, PHPUnit e PHPStan.
