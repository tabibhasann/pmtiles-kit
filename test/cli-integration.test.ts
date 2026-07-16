// CLI integration tests — verify --help and --version commands work
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CLI = resolve(ROOT, 'dist', 'cli.js');

function run(args: string): string {
  return execSync(`node "${CLI}" ${args}`, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15000,
  });
}

describe('CLI integration', () => {
  it('pmtiles-kit --help prints usage information', () => {
    const out = run('--help');
    expect(out).toMatch(/pmtiles-kit|Usage|usage/i);
  });

  it('pmtiles-kit --version prints version string', () => {
    const out = run('--version');
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('pmtiles-kit -h is alias for --help', () => {
    const out = run('-h');
    expect(out).toMatch(/pmtiles-kit|Usage|usage/i);
  });
});
