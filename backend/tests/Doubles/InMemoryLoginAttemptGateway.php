<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Domain\Auth\Gateway\LoginAttemptGateway;

final class InMemoryLoginAttemptGateway implements LoginAttemptGateway
{
    /** @var array<string, list<\DateTimeImmutable>> */
    public array $attempts = [];

    public function countSince(string $identifier, \DateTimeImmutable $since): int
    {
        $recent = array_filter(
            $this->attempts[$identifier] ?? [],
            static fn(\DateTimeImmutable $at): bool => $at >= $since
        );

        return count($recent);
    }

    public function record(string $identifier, \DateTimeImmutable $at): void
    {
        $this->attempts[$identifier][] = $at;
    }

    public function clear(string $identifier): void
    {
        unset($this->attempts[$identifier]);
    }

    public function purgeOlderThan(\DateTimeImmutable $before, int $limit): int
    {
        $removed = 0;

        foreach ($this->attempts as $identifier => $timestamps) {
            $kept = array_values(array_filter(
                $timestamps,
                static fn(\DateTimeImmutable $at): bool => $at >= $before
            ));

            $removed += count($timestamps) - count($kept);
            $this->attempts[$identifier] = $kept;
        }

        return $removed;
    }
}
