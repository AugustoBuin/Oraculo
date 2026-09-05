<?php

declare(strict_types=1);

/**
 * Massa de dados inicial.
 *
 * Roda no boot a cada `docker compose up` e é idempotente por chave natural:
 * jogos por slug, edições e raridades por (jogo, código), usuários por e-mail.
 *
 * Duas regras de segurança que valem para sempre neste arquivo:
 *
 * 1. **A senha de um usuário existente nunca é reescrita.** Um seed que
 *    redefine senha e permissão de administrador a cada deploy é uma porta dos
 *    fundos que se auto-restaura (PADROES.md §16.3).
 * 2. **Senha fixa só em APP_ENV=local.** Em qualquer outro ambiente o
 *    administrador nasce com senha aleatória, exibida uma única vez.
 */

use App\Infra\Database\Connection;
use App\Shared\Config\Env;

require __DIR__ . '/../src/autoload.php';

const LOCAL_ENVIRONMENT = 'local';
const DEMO_PASSWORD = 'oraculo123';
const BCRYPT_COST = 12;

/** Espelha App\Shared\Enum\PermissionLevel — o enum chega no Épico 1. */
const LEVEL_VIEWER = 1;
const LEVEL_EDITOR = 2;
const LEVEL_ADMIN = 3;

$pdo = Connection::shared();
$now = date('Y-m-d H:i:s');
$isLocal = Env::required('APP_ENV') === LOCAL_ENVIRONMENT;

// ---------------------------------------------------------------- usuários ---

/**
 * Cria o usuário se ele ainda não existir. Se existir, atualiza apenas o nome:
 * senha e nível de permissão de um usuário existente são intocáveis.
 */
$seedUser = static function (string $name, string $email, int $level, string $password) use ($pdo, $now): void {
    $statement = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, role_level, active, created_at)
         VALUES (:name, :email, :hash, :level, 1, :now)
         ON DUPLICATE KEY UPDATE name = VALUES(name)'
    );

    $statement->execute([
        'name' => $name,
        'email' => $email,
        'hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => BCRYPT_COST]),
        'level' => $level,
        'now' => $now,
    ]);
};

if ($isLocal) {
    $seedUser('Administrador', 'admin@oraculo.local', LEVEL_ADMIN, DEMO_PASSWORD);
    $seedUser('Editor de Catálogo', 'editor@oraculo.local', LEVEL_EDITOR, DEMO_PASSWORD);
    $seedUser('Consulta', 'consulta@oraculo.local', LEVEL_VIEWER, DEMO_PASSWORD);
    echo '  usuários  3 perfis de demonstração (credenciais no README)' . PHP_EOL;
} else {
    $existing = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();

    if ($existing === 0) {
        // random_bytes e não rand(): gerador criptográfico para credencial.
        $password = bin2hex(random_bytes(12));
        $seedUser('Administrador', 'admin@oraculo.local', LEVEL_ADMIN, $password);

        // Exibida uma única vez, na saída do boot. Não é gravada em lugar nenhum.
        fwrite(STDERR, 'Administrador criado. Senha inicial: ' . $password . PHP_EOL);
        fwrite(STDERR, 'Troque-a no primeiro acesso — ela não será exibida de novo.' . PHP_EOL);
    }
}

// ------------------------------------------------------------------- jogos ---

/** Os três do enunciado. A tabela existe para que o quarto seja um INSERT. */
$games = [
    ['magic', 'Magic: The Gathering', 1],
    ['pokemon', 'Pokémon', 2],
    ['yugioh', 'Yu-Gi-Oh!', 3],
];

$insertGame = $pdo->prepare(
    'INSERT INTO games (slug, name, sort_order, active, created_at)
     VALUES (:slug, :name, :sort_order, 1, :now)
     ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)'
);

foreach ($games as [$slug, $name, $order]) {
    $insertGame->execute(['slug' => $slug, 'name' => $name, 'sort_order' => $order, 'now' => $now]);
}

/** @var array<string,int> slug do jogo => id */
$gameIds = [];
foreach ($pdo->query('SELECT id, slug FROM games') as $row) {
    $gameIds[$row['slug']] = (int) $row['id'];
}

echo '  jogos     ' . count($games) . PHP_EOL;

// ----------------------------------------------------------------- edições ---

/**
 * Reproduzidas LITERALMENTE do enunciado, inclusive as quatro que não existem
 * no mundo real: The Hobbit, Marvel Super Heroes, Chaos Rising e Blazing
 * Dominion. A massa é o contrato do desafio — "corrigir" seria entregar algo
 * diferente do que foi pedido.
 */
$editions = [
    ['magic', 'dom', 'Dominaria', 1],
    ['magic', 'war', 'War of the Spark', 2],
    ['magic', 'eld', 'Throne of Eldraine', 3],
    ['magic', 'hob', 'The Hobbit', 4],
    ['magic', 'msh', 'Marvel Super Heroes', 5],
    ['pokemon', 'base1', 'Base Set', 1],
    ['pokemon', 'swsh1', 'Sword & Shield', 2],
    ['pokemon', 'sv1', 'Scarlet & Violet', 3],
    ['pokemon', '30c', '30th Celebration', 4],
    ['pokemon', 'cri', 'Chaos Rising', 5],
    ['yugioh', 'lob', 'Legend of Blue Eyes White Dragon', 1],
    ['yugioh', 'mrd', 'Metal Raiders', 2],
    ['yugioh', 'sdy', 'Starter Deck: Yugi', 3],
    ['yugioh', 'rotd', 'Rise of the Duelist', 4],
    ['yugioh', 'blzd', 'Blazing Dominion', 5],
];

$insertEdition = $pdo->prepare(
    'INSERT INTO editions (game_id, code, name, sort_order, active, created_at)
     VALUES (:game_id, :code, :name, :sort_order, 1, :now)
     ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)'
);

foreach ($editions as [$game, $code, $name, $order]) {
    $insertEdition->execute([
        'game_id' => $gameIds[$game],
        'code' => $code,
        'name' => $name,
        'sort_order' => $order,
        'now' => $now,
    ]);
}

/** @var array<string,int> "jogo:codigo" => id */
$editionIds = [];
foreach ($pdo->query('SELECT e.id, e.code, g.slug FROM editions e JOIN games g ON g.id = e.game_id') as $row) {
    $editionIds[$row['slug'] . ':' . $row['code']] = (int) $row['id'];
}

echo '  edições   ' . count($editions) . ' (conforme o JSON do enunciado)' . PHP_EOL;

// --------------------------------------------------------------- raridades ---

/**
 * Código em inglês (identificador), nome em português (exibido ao usuário), na
 * ordem natural do jogo — comum para mítica —, que não é a ordem alfabética.
 *
 * É esta tabela que impede cadastrar carta de Magic como "Secret Rare".
 */
$rarities = [
    ['magic', 'common', 'Comum', 1],
    ['magic', 'uncommon', 'Incomum', 2],
    ['magic', 'rare', 'Rara', 3],
    ['magic', 'mythic', 'Mítica', 4],
    ['pokemon', 'common', 'Comum', 1],
    ['pokemon', 'uncommon', 'Incomum', 2],
    ['pokemon', 'rare', 'Rara', 3],
    ['pokemon', 'rare-holo', 'Rara Holo', 4],
    ['pokemon', 'ultra-rare', 'Ultra Rara', 5],
    ['pokemon', 'secret-rare', 'Secreta', 6],
    ['yugioh', 'common', 'Comum', 1],
    ['yugioh', 'rare', 'Rara', 2],
    ['yugioh', 'super-rare', 'Super Rara', 3],
    ['yugioh', 'ultra-rare', 'Ultra Rara', 4],
    ['yugioh', 'secret-rare', 'Secreta', 5],
];

$insertRarity = $pdo->prepare(
    'INSERT INTO rarities (game_id, code, name, sort_order, active, created_at)
     VALUES (:game_id, :code, :name, :sort_order, 1, :now)
     ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)'
);

foreach ($rarities as [$game, $code, $name, $order]) {
    $insertRarity->execute([
        'game_id' => $gameIds[$game],
        'code' => $code,
        'name' => $name,
        'sort_order' => $order,
        'now' => $now,
    ]);
}

/** @var array<string,int> "jogo:codigo" => id */
$rarityIds = [];
foreach ($pdo->query('SELECT r.id, r.code, g.slug FROM rarities r JOIN games g ON g.id = r.game_id') as $row) {
    $rarityIds[$row['slug'] . ':' . $row['code']] = (int) $row['id'];
}

echo '  raridades ' . count($rarities) . PHP_EOL;

// ------------------------------------------------------------------ cartas ---

/**
 * Cartas só entram uma vez.
 *
 * Diferente dos catálogos, carta não tem chave natural — em card games reais a
 * mesma carta tem várias impressões na mesma edição (RN-04). Sem chave natural
 * não há como fazer upsert, então o critério é: se já existe carta, não mexe.
 * Isso preserva o que o avaliador cadastrar entre reinícios do contêiner.
 */
$alreadySeeded = (int) $pdo->query('SELECT COUNT(*) FROM cards')->fetchColumn() > 0;

if ($alreadySeeded) {
    echo '  cartas    já existentes, preservadas' . PHP_EOL;
    exit(0);
}

$authorId = (int) $pdo->query('SELECT id FROM users ORDER BY role_level DESC, id ASC LIMIT 1')->fetchColumn();

/**
 * [jogo, edição, raridade, nome EN, nome PT, tipo de imagem, referência]
 *
 * As URLs foram verificadas uma a uma contra os CDNs oficiais de cada jogo.
 * Imagem por URL e não por arquivo, de propósito: o seed não pode depender de
 * permissão de volume no ambiente de quem avalia (docs/decisions/ADR-008).
 */
$scryfall = 'https://cards.scryfall.io/normal/front/';
$pokemon = 'https://images.pokemontcg.io/';
$ygo = 'https://images.ygoprodeck.com/images/cards/';

$cards = [
    // Magic — Dominaria
    ['magic', 'dom', 'mythic', 'Karn, Scion of Urza', null, $scryfall . '0/7/07a3d9e8-8597-498b-869c-cff79e0df516.jpg'],
    ['magic', 'dom', 'mythic', 'Lyra Dawnbringer', null, $scryfall . '9/3/93be6799-7b9d-44d4-84dc-2961692b5a85.jpg'],
    ['magic', 'dom', 'common', 'Llanowar Elves', 'Elfos de Llanowar', $scryfall . '5/8/581b7327-3215-4a4f-b4ae-d9d4002ba882.jpg'],
    ['magic', 'dom', 'common', 'Shivan Fire', 'Fogo de Shiv', $scryfall . '2/1/21b9d339-99ed-4923-8f56-be37f29a0bfa.jpg'],
    // As duas Forest são propositais: mesma carta, mesma edição, impressões
    // diferentes. É o caso real que justifica avisar em vez de bloquear (RN-04).
    ['magic', 'dom', 'common', 'Forest', 'Floresta', $scryfall . 'a/e/ae21165c-cc6d-45cc-b5c1-97b73e85dddd.jpg'],
    ['magic', 'dom', 'common', 'Forest', 'Floresta', $scryfall . 'a/e/ae21165c-cc6d-45cc-b5c1-97b73e85dddd.jpg'],

    // Magic — War of the Spark
    ['magic', 'war', 'mythic', 'Nicol Bolas, Dragon-God', null, $scryfall . '9/8/98b68dea-a7be-4f99-8a50-4c8cf0e0f7a9.jpg'],
    ['magic', 'war', 'rare', 'Teferi, Time Raveler', null, $scryfall . '5/c/5cb76266-ae50-4bbc-8f96-d98f309b02d3.jpg'],
    ['magic', 'war', 'rare', 'Ugin, the Ineffable', null, $scryfall . '7/b/7b003521-3da3-41bf-9765-36630653f902.jpg'],
    ['magic', 'war', 'mythic', 'God-Eternal Oketra', null, $scryfall . 'd/f/df70f155-2336-421c-8a9d-69772d2b51a8.jpg'],

    // Magic — Throne of Eldraine
    ['magic', 'eld', 'mythic', 'Oko, Thief of Crowns', null, $scryfall . '3/4/3462a3d0-5552-49fa-9eb7-100960c55891.jpg'],
    ['magic', 'eld', 'mythic', 'Questing Beast', null, $scryfall . 'e/4/e41cf82d-3213-47ce-a015-6e51a8b07e4f.jpg'],
    ['magic', 'eld', 'mythic', 'Brazen Borrower', null, $scryfall . 'c/2/c2089ec9-0665-448f-bfe9-d181de127814.jpg'],
    ['magic', 'eld', 'rare', 'Bonecrusher Giant', 'Gigante Quebra-Ossos', $scryfall . '0/9/09fd2d9c-1793-4beb-a3fb-7a869f660cd4.jpg'],

    // Edições fictícias do enunciado: sem imagem, de propósito — exercita o
    // espaço reservado da interface (RF-34).
    ['magic', 'hob', 'mythic', 'The One Ring', 'O Um Anel', null],
    ['magic', 'msh', 'rare', 'Spider-Man', 'Homem-Aranha', null],

    // Pokémon
    ['pokemon', 'base1', 'rare-holo', 'Charizard', null, $pokemon . 'base1/4.png'],
    ['pokemon', 'base1', 'rare-holo', 'Blastoise', null, $pokemon . 'base1/2.png'],
    ['pokemon', 'base1', 'rare-holo', 'Venusaur', null, $pokemon . 'base1/15.png'],
    ['pokemon', 'base1', 'common', 'Pikachu', 'Pikachu', $pokemon . 'base1/58.png'],
    ['pokemon', 'swsh1', 'ultra-rare', 'Zacian V', null, $pokemon . 'swsh1/25.png'],
    ['pokemon', 'swsh1', 'rare', 'Rillaboom', null, $pokemon . 'swsh1/50.png'],
    ['pokemon', 'sv1', 'secret-rare', 'Miraidon ex', null, $pokemon . 'sv1/245.png'],
    ['pokemon', 'sv1', 'rare', 'Gardevoir', null, $pokemon . 'sv1/86.png'],
    ['pokemon', '30c', 'rare', 'Celebration Pikachu', null, null],

    // Yu-Gi-Oh!
    ['yugioh', 'lob', 'ultra-rare', 'Blue-Eyes White Dragon', 'Dragão Branco de Olhos Azuis', $ygo . '89631139.jpg'],
    ['yugioh', 'lob', 'ultra-rare', 'Dark Magician', 'Mago Negro', $ygo . '46986414.jpg'],
    ['yugioh', 'lob', 'ultra-rare', 'Red-Eyes B. Dragon', 'Dragão Negro de Olhos Vermelhos', $ygo . '74677422.jpg'],
    ['yugioh', 'lob', 'rare', 'Dark Hole', 'Buraco Negro', $ygo . '5405694.jpg'],
    ['yugioh', 'mrd', 'rare', 'Cyber Jar', 'Jarro Cibernético', $ygo . '44519536.jpg'],
    ['yugioh', 'mrd', 'super-rare', 'Gravekeeper Servant', 'Servo do Zelador do Túmulo', $ygo . '70046172.jpg'],
    ['yugioh', 'sdy', 'ultra-rare', 'Dark Magician Girl', 'Garota Maga Negra', $ygo . '38033121.jpg'],
    ['yugioh', 'rotd', 'secret-rare', 'Dragonmaid Sheou', null, $ygo . '9012916.jpg'],
];

$insertCard = $pdo->prepare(
    'INSERT INTO cards
        (game_id, edition_id, rarity_id, name_en, name_pt, image_type, image_reference, created_by, created_at)
     VALUES
        (:game_id, :edition_id, :rarity_id, :name_en, :name_pt, :image_type, :image_reference, :created_by, :now)'
);

foreach ($cards as [$game, $edition, $rarity, $nameEn, $namePt, $image]) {
    $insertCard->execute([
        'game_id' => $gameIds[$game],
        'edition_id' => $editionIds[$game . ':' . $edition],
        'rarity_id' => $rarityIds[$game . ':' . $rarity],
        'name_en' => $nameEn,
        'name_pt' => $namePt,
        'image_type' => $image === null ? null : 'remote',
        'image_reference' => $image,
        'created_by' => $authorId,
        'now' => $now,
    ]);
}

echo '  cartas    ' . count($cards) . PHP_EOL;
