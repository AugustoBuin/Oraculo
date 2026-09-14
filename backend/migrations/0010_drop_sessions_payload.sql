-- A coluna `payload` existia para a serialização nativa do PHP, quando a sessão
-- seria gravada por um SessionHandlerInterface. A implementação mudou para uma
-- sessão explícita (docs/decisions/ADR-003, revisão de 05/09) e a coluna virou
-- peso morto: uma coluna que ninguém lê é uma pergunta que alguém vai fazer
-- daqui a seis meses.
--
-- A migration 0003 NÃO é editada — migration aplicada nunca é. A correção é
-- sempre uma migration nova, para que os ambientes convirjam pelo mesmo caminho.
ALTER TABLE sessions DROP COLUMN payload;
