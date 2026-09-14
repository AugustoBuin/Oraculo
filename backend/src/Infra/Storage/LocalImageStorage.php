<?php

declare(strict_types=1);

namespace App\Infra\Storage;

use App\Domain\Card\Gateway\ImageStorage;

/**
 * Arquivos enviados, gravados em disco **fora do document root**.
 *
 * Arquivo enviado dentro de pasta pública é execução remota esperando
 * acontecer: basta um upload que passe pela validação de tipo e uma
 * configuração de servidor um pouco mais permissiva. Fora do document root,
 * não existe caminho que o alcance — a única forma de lê-lo é pela rota, que
 * devolve o Content-Type verificado na gravação (docs/decisions/ADR-008).
 *
 * O nome do arquivo é validado contra uma expressão estrita antes de qualquer
 * acesso a disco. O nome chega gerado pelo servidor, mas esta classe também é
 * quem lê a pedido de uma rota — e ali o valor vem da URL.
 */
final class LocalImageStorage implements ImageStorage
{
    /** 32 hexadecimais mais uma das quatro extensões permitidas. */
    private const NAME_PATTERN = '/^[a-f0-9]{32}\.(jpg|png|webp|gif)$/';

    public function __construct(
        private readonly string $directory,
    ) {
    }

    public function store(string $fileName, string $contents): string
    {
        $this->assertSafeName($fileName);

        if (!is_dir($this->directory) && !mkdir($this->directory, 0o775, true) && !is_dir($this->directory)) {
            throw new \RuntimeException('Não foi possível preparar o diretório de imagens.');
        }

        if (file_put_contents($this->directory . '/' . $fileName, $contents) === false) {
            throw new \RuntimeException('Não foi possível gravar a imagem.');
        }

        return $fileName;
    }

    public function exists(string $fileName): bool
    {
        return $this->isSafeName($fileName) && is_file($this->directory . '/' . $fileName);
    }

    public function read(string $fileName): ?string
    {
        if (!$this->exists($fileName)) {
            return null;
        }

        $contents = file_get_contents($this->directory . '/' . $fileName);

        return $contents === false ? null : $contents;
    }

    private function isSafeName(string $fileName): bool
    {
        // A expressão não aceita barra, ponto-ponto nem qualquer caractere de
        // caminho: travessia de diretório morre aqui, antes do disco.
        return preg_match(self::NAME_PATTERN, $fileName) === 1;
    }

    private function assertSafeName(string $fileName): void
    {
        if (!$this->isSafeName($fileName)) {
            throw new \InvalidArgumentException('Nome de arquivo de imagem inválido.');
        }
    }
}
