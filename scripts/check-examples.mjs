// Extract the maintained examples; test installed packages, never sibling source aliases.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = await mkdtemp(join(tmpdir(), 'thruput-skill-examples-'));
console.log(`Example evidence: ${work}`);

async function run(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, `${command} ${args.join(' ')} failed`);
}

for (const kind of ['typescript', 'react']) {
  const directory = join(work, kind);
  await mkdir(directory);
  const source = await readFile(join(root, `skills/thruput/references/${kind}.md`), 'utf8');
  const blocks = [...source.matchAll(/```(?:ts|tsx) title="([\w.-]+)"\n([\s\S]*?)\n```/g)];
  assert.equal(blocks.length, kind === 'typescript' ? 3 : 2);
  for (const [, name, code] of blocks) await writeFile(join(directory, name), `${code}\n`);
  await writeFile(join(directory, 'package.json'), JSON.stringify({
    private: true, type: 'module', dependencies: {
      '@groundhogchain/client': kind === 'react' ? '0.11.0' : '0.14.0',
      '@groundhogchain/protocol': '0.12.0',
      ...(kind === 'react' ? {
        '@groundhogchain/react': '0.3.1', '@tanstack/react-query': '5.103.1',
        react: '19.1.1', 'react-dom': '19.1.1',
        '@types/react': '19.1.9', '@types/react-dom': '19.1.7',
      } : {}),
      typescript: '6.0.3', tsx: '4.22.4', '@types/node': '25.9.1',
      vite: '7.3.6', 'playwright-core': '1.63.0',
    },
  }, null, 2));
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler',
      strict: true, noEmit: true, skipLibCheck: true, jsx: 'react-jsx',
      lib: ['ES2022', 'DOM'], types: ['node'] },
    include: ['*.ts', '*.tsx'],
  }));
  await writeFile(join(directory, 'index.html'), '<!doctype html><html><head><title>Skill example</title></head><body><div id="root"></div>' +
    (kind === 'react' ? '<script type="module" src="/main.tsx"></script>' : '') + '</body></html>');
  await copyFile(join(root, 'scripts/verify-examples.mjs'), join(directory, 'verify.mjs'));
  await run('npm', ['install', '--no-audit', '--no-fund'], directory);
  await run('npm', ['exec', '--', 'tsc'], directory);
  await run(process.execPath, ['verify.mjs', kind], directory);
}
