<?php

declare(strict_types=1);

namespace Tests\Shared\Quality;

use App\Shared\Quality\LayerBoundary;
use Tests\TestCase;

/**
 * O verificador das fronteiras de camada.
 *
 * Ele é testado com o mesmo rigor do código de produção, e por um motivo:
 * verificador com falso-negativo é pior do que verificador nenhum, porque dá
 * confiança onde não há. "Fronteira sem verificador é sugestão" só vale se o
 * verificador funcionar (docs/decisions/ADR-002).
 */
final class LayerBoundaryTest extends TestCase
{
    // --- Domain: livre de infraestrutura -------------------------------------

    public function testAcusaPdoNoDominio(): void
    {
        $violations = LayerBoundary::violations(
            'src/Domain/Card/Entity/Card.php',
            '<?php $statement = $pdo->prepare("SELECT id FROM cards");'
        );

        $this->assertCount(1, $violations);
    }

    public function testAcusaSuperglobalNoDominio(): void
    {
        $violations = LayerBoundary::violations(
            'src/Domain/Card/Entity/Card.php',
            '<?php $id = $_GET["id"];'
        );

        $this->assertCount(1, $violations);
    }

    public function testAcusaImportDeInfraNoDominio(): void
    {
        $violations = LayerBoundary::violations(
            'src/Domain/Card/Gateway/CardGateway.php',
            '<?php use App\Infra\Database\Connection;'
        );

        $this->assertCount(1, $violations);
    }

    public function testAceitaDominioPuro(): void
    {
        $violations = LayerBoundary::violations(
            'src/Domain/Card/Entity/Card.php',
            '<?php use App\Domain\Errors\ValidationError; final class Card {}'
        );

        $this->assertCount(0, $violations);
    }

    // --- UseCases: só conhecem interfaces ------------------------------------

    public function testAcusaImportDeInfraNoCasoDeUso(): void
    {
        $violations = LayerBoundary::violations(
            'src/UseCases/Card/CreateCardUseCase.php',
            '<?php use App\Infra\Repository\Card\CardRepositoryPdo;'
        );

        $this->assertCount(1, $violations);
    }

    public function testAceitaCasoDeUsoQueImportaApenasDominio(): void
    {
        $violations = LayerBoundary::violations(
            'src/UseCases/Card/CreateCardUseCase.php',
            '<?php use App\Domain\Card\Gateway\CardGateway; use App\Shared\Enum\PermissionLevel;'
        );

        $this->assertCount(0, $violations);
    }

    // --- Shared: sem regra de negócio ----------------------------------------

    public function testAcusaImportDeCasoDeUsoNoCompartilhado(): void
    {
        $violations = LayerBoundary::violations(
            'src/Shared/Enum/HttpStatus.php',
            '<?php use App\UseCases\Card\CreateCardUseCase;'
        );

        $this->assertCount(1, $violations);
    }

    // --- Infra: é a borda, pode tudo -----------------------------------------

    public function testAceitaInfraImportandoQualquerCamada(): void
    {
        $violations = LayerBoundary::violations(
            'src/Infra/Repository/Card/CardRepositoryPdo.php',
            '<?php use App\Domain\Card\Entity\Card; use App\UseCases\Card\CreateCardUseCase; $pdo->prepare("x");'
        );

        $this->assertCount(0, $violations);
    }

    // --- Frontend: features isoladas entre si --------------------------------

    public function testAcusaFeatureImportandoOutraFeature(): void
    {
        $violations = LayerBoundary::violations(
            'frontend/src/features/cards/api/cards.js',
            'import { login } from "@/features/auth/api/auth.js";'
        );

        $this->assertCount(1, $violations);
    }

    public function testAcusaFeatureImportandoDePagina(): void
    {
        // A regra de dependência do PADROES-ENGENHARIA.md §2.1 diz que uma
        // feature conhece a camada compartilhada e ela mesma — nada mais.
        // Importar de `pages/` inverte a seta: a página compõe a feature, não
        // o contrário, e o import cruzado torna a feature inutilizável em
        // qualquer outra tela.
        $violations = LayerBoundary::violations(
            'frontend/src/features/cards/utils/card-query.js',
            'import { ROUTES } from "@/pages/app-shell/navigation.js";'
        );

        $this->assertCount(1, $violations);
    }

    public function testAceitaFeatureImportandoDoCompartilhado(): void
    {
        $violations = LayerBoundary::violations(
            'frontend/src/features/cards/api/cards.js',
            'import { request } from "@/shared/api/client.js";'
        );

        $this->assertCount(0, $violations);
    }

    public function testAceitaFeatureImportandoDelaMesma(): void
    {
        $violations = LayerBoundary::violations(
            'frontend/src/features/cards/components/card-grid.js',
            'import { listCards } from "@/features/cards/api/cards.js";'
        );

        $this->assertCount(0, $violations);
    }

    public function testAcusaCompartilhadoImportandoFeature(): void
    {
        // É esta pureza que mantém o compartilhado reutilizável e impede
        // dependência circular.
        $violations = LayerBoundary::violations(
            'frontend/src/shared/components/modal.js',
            'import { CardForm } from "@/features/cards/components/card-form.js";'
        );

        $this->assertCount(1, $violations);
    }

    public function testAcusaCompartilhadoImportandoPagina(): void
    {
        $violations = LayerBoundary::violations(
            'frontend/src/shared/api/client.js',
            'import { CardsPage } from "@/pages/cards.js";'
        );

        $this->assertCount(1, $violations);
    }

    public function testAceitaPaginaImportandoTudo(): void
    {
        $violations = LayerBoundary::violations(
            'frontend/src/pages/cards.js',
            'import { a } from "@/shared/x.js"; import { b } from "@/features/cards/y.js";'
        );

        $this->assertCount(0, $violations);
    }

    // --- Fora de escopo -------------------------------------------------------

    public function testIgnoraArquivoForaDasCamadasVerificadas(): void
    {
        $violations = LayerBoundary::violations('backend/bin/seed.php', '<?php $pdo->prepare("x");');

        $this->assertCount(0, $violations);
    }

    public function testRelataOArquivoEAMensagemJuntos(): void
    {
        $violations = LayerBoundary::violations(
            'src/Domain/Card/Entity/Card.php',
            '<?php $pdo->query("SELECT 1");'
        );

        // Achado sem localização obriga quem lê a caçar o arquivo.
        $this->assertTrue(str_contains($violations[0], 'src/Domain/Card/Entity/Card.php'));
    }
}
