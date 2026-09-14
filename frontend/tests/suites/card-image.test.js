import { imageFromUrl } from "@/features/cards/api/cards-api.js";
import {
  formatBytes,
  identifyImage,
  readSignature,
} from "@/features/cards/utils/image-signature.js";
import { UPLOAD_ALLOWED_TYPES } from "@/shared/config/constants.js";
import { assertFalse, assertNull, assertSame, assertTrue, suite, test } from "~/runner.js";

const bytes = (...values) => Uint8Array.from(values);
const fromText = (text) => new TextEncoder().encode(text);

suite("features/cards/utils · tipo pelo CONTEÚDO", () => {
  test("reconhece JPEG, PNG, GIF e WebP", () => {
    assertSame(identifyImage(bytes(0xff, 0xd8, 0xff, 0xe0)).type, "image/jpeg");
    assertSame(identifyImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)).type, "image/png");
    assertSame(identifyImage(fromText("GIF89a")).type, "image/gif");

    const webp = new Uint8Array(16);
    webp.set(fromText("RIFF"), 0);
    webp.set(fromText("WEBP"), 8);
    assertSame(identifyImage(webp).type, "image/webp");
  });

  test("RECUSA arquivo .jpg cujo conteúdo é PHP", () => {
    /*
     * O caso que o RF-32 nomeia. `file.type` diria "image/jpeg", porque na
     * maioria dos sistemas ele vem da extensão — que é dado do cliente e
     * mente. O conteúdo diz a verdade.
     */
    const hostil = identifyImage(fromText("<?php system($_GET['c']); ?>"));

    assertNull(hostil.type);
  });

  test("RECUSA SVG, e diz que é SVG", () => {
    // Reconhecer o formato permite explicar o motivo, em vez de dizer
    // "formato não reconhecido" a quem escolheu um arquivo válido.
    assertSame(identifyImage(fromText('<svg xmlns="http://www.w3.org/2000/svg">')).label, "SVG");
    assertSame(identifyImage(fromText('<?xml version="1.0"?><svg>')).label, "SVG");
    assertNull(identifyImage(fromText("<svg>")).type);
  });

  test("SVG não está na allowlist, e a ausência é o ponto", () => {
    // SVG é documento XML e carrega script; servi-lo da mesma origem seria XSS
    // por convite (`api-contract.md` §6).
    assertFalse(UPLOAD_ALLOWED_TYPES.includes("image/svg+xml"));
  });

  test("lê a assinatura de um arquivo de verdade", async () => {
    const png = new File([bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)], "x.png");

    assertSame(identifyImage(await readSignature(png)).type, "image/png");
  });
});

suite("features/cards/utils · tamanho legível", () => {
  test("mostra megabytes com vírgula decimal", () => {
    // "3145728" é o que o servidor manda e não diz nada a quem escolheu o
    // arquivo (§7.1).
    assertSame(formatBytes(3 * 1024 * 1024), "3,0 MB");
    assertSame(formatBytes(4 * 1024 * 1024), "4,0 MB");
  });

  test("abaixo de um megabyte usa KB", () => {
    assertSame(formatBytes(500 * 1024), "500 KB");
  });

  test("arquivo minúsculo não vira 0 KB", () => {
    assertSame(formatBytes(10), "1 KB");
  });
});

suite("features/cards/api · recuperação da imagem na edição", () => {
  test("URL de upload volta a virar referência", () => {
    /*
     * O contrato expõe a URL pronta e nunca o par (type, reference) — decisão
     * certa para quem só exibe. Mas sem recuperá-lo, abrir uma carta, mudar só
     * o nome e salvar mandaria `image: null` e APAGARIA a imagem.
     */
    const recuperada = imageFromUrl("/api/media/a1b2c3d4e5f6.png");

    assertSame(recuperada.type, "upload");
    assertSame(recuperada.reference, "a1b2c3d4e5f6.png");
  });

  test("URL externa volta como remota", () => {
    const recuperada = imageFromUrl("https://cdn.exemplo.test/carta.png");

    assertSame(recuperada.type, "remote");
    assertSame(recuperada.reference, "https://cdn.exemplo.test/carta.png");
  });

  test("carta sem imagem devolve nulo, que é válido (RF-34)", () => {
    assertNull(imageFromUrl(null));
    assertNull(imageFromUrl(""));
    assertNull(imageFromUrl(undefined));
  });

  test("URL com esquema perigoso não vira referência", () => {
    assertNull(imageFromUrl("javascript:alert(1)"));
    assertNull(imageFromUrl("data:text/html,<script>"));
  });

  test("caminho de mídia com travessia não casa o padrão de upload", () => {
    // `/api/media/../../etc` não pode virar `{type: upload}`: a referência tem
    // formato fechado, e o que não bate é tratado como endereço remoto — que
    // então precisa passar pela allowlist de esquema.
    const recuperada = imageFromUrl("/api/media/../../.env");

    assertTrue(recuperada === null || recuperada.type === "remote");
  });
});
