#!/usr/bin/env node
/*
 * PreToolUse hook: blocks shell commands that match a user-maintained blocklist.
 *
 * Shell-agnostic: wire it to the Bash AND PowerShell tools (see
 * .claude/settings.local.json -> hooks.PreToolUse). The list of patterns lives
 * in the sibling file `blocked-commands.txt` — that's the file you edit. You
 * normally never need to touch this script.
 *
 * Contract (Claude Code hooks):
 *   - stdin  = JSON with { tool_name, tool_input: { command }, ... }
 *   - exit 0 = allow the tool call
 *   - exit 2 = BLOCK the tool call; stderr is fed back to Claude as the reason
 *
 * Fail-open: any parsing/IO problem exits 0 so a broken hook can never brick
 * the agent. A missing/empty blocklist simply blocks nothing.
 */

const fs = require('fs');
const path = require('path');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function loadPatterns() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'blocked-commands.txt'), 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } catch {
    return []; // no list -> block nothing
  }
}

// Lowercasing is handled by the case-insensitive flag; here we just defang the
// two cheapest evasions: ".exe" suffixes and irregular whitespace/newlines.
function normalize(command) {
  return command
    .replace(/\.exe\b/gi, '') // "git.exe push" -> "git push"
    .replace(/\s+/g, ' ')     // collapse runs of whitespace/newlines
    .trim();
}

function toRegex(pattern) {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    // Not valid regex -> treat the line as a literal substring.
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
  }
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin() || '{}');
  } catch {
    process.exit(0); // unparseable stdin -> fail open
  }

  const command = input && input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || !command.trim()) {
    process.exit(0); // not a shell command we can inspect
  }

  const normalized = normalize(command);
  for (const pattern of loadPatterns()) {
    if (toRegex(pattern).test(normalized)) {
      const tool = input.tool_name || 'shell';
      process.stderr.write(
        `[block-commands] Comando bloqueado pela blocklist.\n` +
          `Padrao correspondente: "${pattern}"\n` +
          `Tool: ${tool}\n` +
          `Comando: ${command}\n` +
          `Para liberar, edite/comente o padrao em ` +
          `.claude/hooks/blocked-commands.txt.\n`
      );
      process.exit(2); // block the call
    }
  }

  process.exit(0); // nothing matched -> allow
}

main();
