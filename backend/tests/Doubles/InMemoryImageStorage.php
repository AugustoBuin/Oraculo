<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Domain\Card\Gateway\ImageStorage;

final class InMemoryImageStorage implements ImageStorage
{
    /** @var array<string,string> */
    public array $files = [];

    public function store(string $fileName, string $contents): string
    {
        $this->files[$fileName] = $contents;

        return $fileName;
    }

    public function exists(string $fileName): bool
    {
        return array_key_exists($fileName, $this->files);
    }

    public function read(string $fileName): ?string
    {
        return $this->files[$fileName] ?? null;
    }
}
