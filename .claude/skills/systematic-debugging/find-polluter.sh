#!/usr/bin/env bash
# Acha qual teste do backend suja o estado global (arquivo, diretório, tabela).
#
# Uso:
#   ./find-polluter.sh '<caminho-ou-glob>' [filtro]
#
# Exemplos:
#   ./find-polluter.sh 'backend/storage/uploads/*.png'
#   ./find-polluter.sh 'backend/storage/sessions/sess_*'
#   ./find-polluter.sh '.git/index.lock' Card
#
# Como funciona: o micro-runner aceita um filtro pelo nome da classe
# (`php backend/bin/test.php Card`). O script roda UMA classe de cada vez e,
# depois de cada uma, verifica se a sujeira apareceu. Para na primeira que sujar.
#
# Pré-requisitos: `docker compose up` no ar. O WORKDIR do contêiner é /var/www,
# com backend/ e frontend/ lado a lado — por isso o caminho começa em backend/.
#
# O frontend não tem execução por linha de comando: o runner roda no navegador,
# em /tests. Para bisseccionar lá, comente metade dos imports de
# frontend/tests/main.js, recarregue a página, e repita dividindo ao meio.

set -uo pipefail

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  echo "Uso: $0 '<caminho-ou-glob>' [filtro-de-classe]" >&2
  echo "Ex.: $0 'backend/storage/uploads/*.png'" >&2
  exit 1
fi

POLLUTION="$1"
CLASS_FILTER="${2:-}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

# Existe alguma coisa casando com o padrão? (funciona para caminho fixo e glob)
pollution_exists() {
  compgen -G "$POLLUTION" > /dev/null 2>&1
}

if pollution_exists; then
  echo "A sujeira JÁ EXISTE antes de começar: $POLLUTION" >&2
  echo "Limpe primeiro, senão a bisseção não diz nada." >&2
  exit 1
fi

mapfile -t TEST_FILES < <(find backend/tests -name '*Test.php' | sort)

if [ "${#TEST_FILES[@]}" -eq 0 ]; then
  echo "Nenhum arquivo *Test.php encontrado em backend/tests." >&2
  exit 1
fi

echo "Procurando quem cria: $POLLUTION"
echo "Classes de teste: ${#TEST_FILES[@]}"
echo

COUNT=0

for TEST_FILE in "${TEST_FILES[@]}"; do
  CLASS_NAME="$(basename "$TEST_FILE" .php)"

  if [ -n "$CLASS_FILTER" ] && [[ "$CLASS_NAME" != *"$CLASS_FILTER"* ]]; then
    continue
  fi

  COUNT=$((COUNT + 1))
  printf '[%3d] %s\n' "$COUNT" "$CLASS_NAME"

  docker compose exec -T app php backend/bin/test.php "$CLASS_NAME" > /dev/null 2>&1

  if pollution_exists; then
    echo
    echo "ACHOU: $CLASS_NAME"
    echo "  arquivo: $TEST_FILE"
    echo "  criou:   $POLLUTION"
    echo
    ls -la $POLLUTION 2>/dev/null
    echo
    echo "Para investigar:"
    echo "  docker compose exec app php backend/bin/test.php $CLASS_NAME"
    echo "  cat $TEST_FILE"
    exit 1
  fi
done

echo
echo "Nenhum poluidor encontrado em $COUNT classe(s)."
echo "Se a sujeira aparece só na suíte completa, o problema é INTERAÇÃO entre testes:"
echo "  rode a suíte inteira e bisseccione por diretório (Domain, UseCases, Infra)."
exit 0
