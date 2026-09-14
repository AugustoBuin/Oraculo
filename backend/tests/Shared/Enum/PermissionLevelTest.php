<?php

declare(strict_types=1);

namespace Tests\Shared\Enum;

use App\Shared\Enum\PermissionLevel;
use Tests\TestCase;

/**
 * A hierarquia de permissões, verificada na matriz completa.
 *
 * Três níveis encaixáveis: ADMIN faz tudo que EDITOR faz, que faz tudo que
 * VIEWER faz (docs/decisions/ADR-006). A matriz 3x3 inteira é verificada porque
 * uma comparação invertida aqui abriria o portal inteiro — e passaria
 * despercebida em qualquer teste que só cobrisse o caminho feliz.
 */
final class PermissionLevelTest extends TestCase
{
    public function testViewerSoAlcancaOProprioNivel(): void
    {
        $viewer = PermissionLevel::VIEWER;

        $this->assertTrue($viewer->allows(PermissionLevel::VIEWER));
        $this->assertFalse($viewer->allows(PermissionLevel::EDITOR));
        $this->assertFalse($viewer->allows(PermissionLevel::ADMIN));
    }

    public function testEditorAlcancaViewerEEditor(): void
    {
        $editor = PermissionLevel::EDITOR;

        $this->assertTrue($editor->allows(PermissionLevel::VIEWER));
        $this->assertTrue($editor->allows(PermissionLevel::EDITOR));
        $this->assertFalse($editor->allows(PermissionLevel::ADMIN));
    }

    public function testAdminAlcancaTudo(): void
    {
        $admin = PermissionLevel::ADMIN;

        $this->assertTrue($admin->allows(PermissionLevel::VIEWER));
        $this->assertTrue($admin->allows(PermissionLevel::EDITOR));
        $this->assertTrue($admin->allows(PermissionLevel::ADMIN));
    }

    public function testOsValoresNumericosSaoEstaveis(): void
    {
        // O número é o que está gravado em users.role_level. Mudá-lo sem
        // migration reclassificaria todos os usuários existentes em silêncio.
        $this->assertSame(1, PermissionLevel::VIEWER->value);
        $this->assertSame(2, PermissionLevel::EDITOR->value);
        $this->assertSame(3, PermissionLevel::ADMIN->value);
    }

    public function testConverteDoValorGravadoNoBanco(): void
    {
        $this->assertSame(PermissionLevel::EDITOR, PermissionLevel::from(2));
    }

    public function testRecusaValorDesconhecido(): void
    {
        // Nível fora do enum precisa explodir, não virar um default permissivo.
        $this->assertNull(PermissionLevel::tryFrom(99));
    }

    public function testExpoeORotuloEmPortuguesParaAInterface(): void
    {
        $this->assertSame('Consulta', PermissionLevel::VIEWER->label());
        $this->assertSame('Editor', PermissionLevel::EDITOR->label());
        $this->assertSame('Administrador', PermissionLevel::ADMIN->label());
    }
}
