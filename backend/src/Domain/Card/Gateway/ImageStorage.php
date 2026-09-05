<?php

declare(strict_types=1);

namespace App\Domain\Card\Gateway;

/**
 * Onde os arquivos enviados são guardados.
 *
 * Porta no domínio para que a validação de upload seja testável sem tocar o
 * disco — e para que trocar o destino (volume local hoje, objeto remoto amanhã)
 * não alcance nenhuma regra.
 */
interface ImageStorage
{
    /**
     * Grava o conteúdo sob o nome dado e devolve o nome gravado.
     *
     * O nome é **gerado pelo servidor** e chega pronto: o nome enviado pelo
     * cliente é dado hostil, tanto ao gravar quanto ao exibir.
     */
    public function store(string $fileName, string $contents): string;

    public function exists(string $fileName): bool;

    /** @return string|null o conteúdo, ou null se não existir */
    public function read(string $fileName): ?string;
}
