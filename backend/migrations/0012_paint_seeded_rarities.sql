-- As raridades do seed ganham as cores dos próprios jogos. No Magic, as do
-- símbolo de edição: preto, prata, ouro e laranja. No Yu-Gi-Oh!, Rara é o nome
-- em prata e Ultra Rara o nome em ouro. As comuns ficam no grafite do padrão.
--
-- Por que numa migration, e não só no seed: o seed roda a cada boot e pinta
-- apenas na INSERÇÃO — se reescrevesse a cor no ON DUPLICATE KEY, desfaria a
-- escolha do ADMIN a cada `docker compose up`. É aqui que um banco que já
-- existia recebe as cores; num banco novo, este UPDATE não encontra nada e o
-- seed insere já pintado.
--
-- Separada da 0011 porque o Migrator executa o arquivo num único exec(), e o
-- PDO só reporta o erro do primeiro comando de um lote: um UPDATE que falhasse
-- depois do ALTER passaria calado.
UPDATE rarities r
INNER JOIN games g ON g.id = r.game_id
SET r.color = CASE CONCAT(g.slug, ':', r.code)
    WHEN 'magic:uncommon'      THEN 'silver'
    WHEN 'magic:rare'          THEN 'gold'
    WHEN 'magic:mythic'        THEN 'copper'
    WHEN 'pokemon:uncommon'    THEN 'silver'
    WHEN 'pokemon:rare'        THEN 'gold'
    WHEN 'pokemon:rare-holo'   THEN 'aquamarine'
    WHEN 'pokemon:ultra-rare'  THEN 'tourmaline'
    WHEN 'pokemon:secret-rare' THEN 'obsidian'
    WHEN 'yugioh:rare'         THEN 'silver'
    WHEN 'yugioh:super-rare'   THEN 'aquamarine'
    WHEN 'yugioh:ultra-rare'   THEN 'gold'
    WHEN 'yugioh:secret-rare'  THEN 'obsidian'
    ELSE r.color
END;
