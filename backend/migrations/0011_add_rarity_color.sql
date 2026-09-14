-- A raridade ganha cor: um material da paleta (App\Shared\Enum\RarityColor).
--
-- VARCHAR e não ENUM de propósito: a allowlist é o enum do domínio, e trocar a
-- paleta não pode pedir migration — o mesmo raciocínio de `code` e de `sort`.
--
-- O padrão é 'graphite', o selo neutro de antes da paleta: raridade que ninguém
-- pintou continua com a mesma cara.
ALTER TABLE rarities
    ADD COLUMN color VARCHAR(16) NOT NULL DEFAULT 'graphite' AFTER name;
