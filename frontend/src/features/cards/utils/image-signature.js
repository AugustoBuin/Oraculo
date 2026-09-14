/**
 * Identificação de imagem pelo **conteúdo do arquivo**, não pela extensão.
 *
 * O RF-32 é explícito: o tipo é validado pelo conteúdo. `file.type` não serve
 * para isso — na maioria dos sistemas ele é derivado da extensão, que é dado
 * do cliente e mente. Um `.jpg` cujo conteúdo é PHP passa por `file.type` e é
 * recusado aqui.
 *
 * **Isto é conveniência, não barreira.** A validação que vale é a do servidor,
 * com `finfo` (§8.1). O que esta função entrega é o "não" imediato, sem gastar
 * uma ida de rede e a espera do upload.
 */

/** Quantos bytes bastam para reconhecer todos os formatos da allowlist. */
const SIGNATURE_LENGTH = 16;

/**
 * A allowlist do contrato (`api-contract.md` §6).
 *
 * **SVG não está aqui, e a ausência é o ponto:** SVG é um documento XML que
 * carrega script, e servi-lo da mesma origem seria XSS por convite.
 */
const SIGNATURES = [
  { type: "image/jpeg", label: "JPEG", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", label: "PNG", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/gif", label: "GIF", bytes: [0x47, 0x49, 0x46, 0x38] },
];

/** `RIFF....WEBP` — o formato tem o marcador no byte 8, depois do tamanho. */
const WEBP_PREFIX = [0x52, 0x49, 0x46, 0x46];
const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50];

const matchesAt = (bytes, expected, offset = 0) =>
  expected.every((value, index) => bytes[offset + index] === value);

/**
 * Reconhece o tipo real.
 *
 * @param {Uint8Array} bytes os primeiros bytes do arquivo
 * @returns {{ type: string, label: string } | { type: null, label: string }}
 */
export function identifyImage(bytes) {
  for (const signature of SIGNATURES) {
    if (matchesAt(bytes, signature.bytes)) {
      return { type: signature.type, label: signature.label };
    }
  }

  if (matchesAt(bytes, WEBP_PREFIX) && matchesAt(bytes, WEBP_MARKER, 8)) {
    return { type: "image/webp", label: "WebP" };
  }

  // SVG é reconhecido de propósito, para a recusa poder EXPLICAR o motivo em
  // vez de dizer "formato não reconhecido" a quem escolheu um arquivo válido.
  const head = new TextDecoder().decode(bytes).trimStart().toLowerCase();

  if (head.startsWith("<svg") || head.startsWith("<?xml")) {
    return { type: null, label: "SVG" };
  }

  return { type: null, label: "desconhecido" };
}

/** Lê os primeiros bytes do arquivo. */
export async function readSignature(file) {
  const slice = file.slice(0, SIGNATURE_LENGTH);

  return new Uint8Array(await slice.arrayBuffer());
}

/**
 * Tamanho em texto legível.
 *
 * "3 MB" diz alguma coisa a quem escolheu o arquivo; "3145728" não diz nada, e
 * é o que o servidor manda (§7.1).
 */
export function formatBytes(bytes) {
  const megabytes = bytes / (1024 * 1024);

  if (megabytes >= 1) {
    return `${megabytes.toFixed(megabytes < 10 ? 1 : 0).replace(".", ",")} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
