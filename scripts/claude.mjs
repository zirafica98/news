// Pokretanje Claude Code-a (claude -p) sa strukturisanim JSON odgovorom.
// Koristi pretplatu sa ovog Mac-a. Bez fajl alata; WebFetch samo kad se traži.

import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TIMEOUT_MS = 25 * 60_000;

/**
 * Šalje prompt Claude-u i vraća JSON rezultat (structured_output je u polju istog imena).
 * Radi u praznom privremenom folderu, da ne pokupi CLAUDE.md i podešavanja iz repoa.
 */
export async function pitajClaude(prompt, { schema, model, webFetch = false }) {
  const workDir = await mkdtemp(join(tmpdir(), 'ai-jutro-'));
  try {
    return await runClaude(prompt, schema, workDir, model, webFetch);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function runClaude(input, jsonSchema, cwd, model, webFetch) {
  const args = [
    '-p',
    '--restricted',
    '--strict-mcp-config',
    '--tools', webFetch ? 'WebFetch' : '',
    ...(webFetch ? ['--allowedTools', 'WebFetch'] : []),
    '--permission-mode', 'dontAsk',
    '--no-session-persistence',
    '--output-format', 'json',
    '--json-schema', jsonSchema,
    '--model', model,
    ...(model === 'sonnet' ? [] : ['--fallback-model', 'sonnet']),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_BIN || 'claude', args, { cwd, timeout: TIMEOUT_MS, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) return reject(new Error(`Claude je prekinut (${signal}), verovatno je isteklo ${TIMEOUT_MS / 60_000} minuta.`));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Claude je završio sa kodom ${code}.\n${stderr || stdout}`.trim()));
      }
    });
    child.stdin.end(input);
  });
}
