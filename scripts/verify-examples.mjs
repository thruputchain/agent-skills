// Run by check-examples.mjs inside each isolated, version-pinned consumer.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
// Each consumer pins its own client version, so load SDK names where they are used.
import * as sdk from '@thruputchain/client';
import { parseProviderRequest, parseTransactionHex, parseSignedTransactionHex } from '@thruputchain/client/provider';

const kind = process.argv[2];
const cli = process.env.THRUPUT_CLI;
assert.ok(cli, 'Set THRUPUT_CLI to an absolute Thruput CLI binary path');
const node = spawn(cli, ['node', '--port', '9545', '--json', '--non-interactive'], {
  env: { ...process.env, TMPDIR: process.cwd(), XDG_CONFIG_HOME: join(process.cwd(), 'config') },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const exited = once(node, 'exit');
const lines = createInterface({ input: node.stdout });
const watchdog = setTimeout(() => node.kill('SIGTERM'), 120_000);
let browser;
let server;
try {
  const ready = await Promise.race([
    once(lines, 'line').then(([line]) => JSON.parse(line)),
    exited.then(([code]) => { throw new Error(`Local node exited: ${code}`); }),
  ]);
  assert.equal(ready.ok, true);
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  const page = await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]);

  if (kind === 'react') {
    await page.getByText(/Read at block/).waitFor();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
    await page.route('**/rpc', route => route.abort());
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('alert').waitFor();
    await page.unroute('**/rpc');
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('alert').waitFor({ state: 'detached' });
    await page.route('**/rpc', route => route.abort());
    await page.reload();
    await page.getByRole('alert').waitFor();
    console.log('React: live read, refresh, failed refresh, recovery, and connection error passed.');
  } else {
    const {
      createThruputClient, createPubkeyAccount, createWalletClient, localnet, Ed25519Signer,
      toBase58, toHex0x, signTransaction, hashSignedTransaction, serializeSignedTransaction,
    } = sdk;
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'read.ts'], { encoding: 'utf8' });
    assert.match(output, /Native token supply:/);
    assert.match(output, /Read at block: \d+/);
    const client = await createThruputClient({ cluster: localnet() });
    const signer = Ed25519Signer.fromSeed(randomBytes(32));
    const account = createPubkeyAccount({ signer });
    const wallet = createWalletClient({ client, account });
    await wallet.requestAirdrop();
    const networkHash = toBase58(client.network.networkHash);
    execFileSync(cli, ['config', 'new', 'local', '--network', 'local', '--global',
      '--rpc-url', ready.data.rpcUrl, '--network-hash', networkHash, '--json'], {
      env: { ...process.env, XDG_CONFIG_HOME: join(process.cwd(), 'config') },
    });
    const accountWire = { address: toBase58(account.address), publicKey: toBase58(signer.publicKey.ed25519), nonce: '0' };
    let submissions = 0;
    await page.exposeFunction('providerRequest', async value => {
      const request = parseProviderRequest(value);
      if (request.method === 'signTransaction') {
        const signed = await signTransaction(parseTransactionHex(request.params.transaction),
          [{ signer, publicKeyId: 0n }], client.network.networkHash);
        return { signedTransaction: toHex0x(serializeSignedTransaction(signed)), hash: toBase58(hashSignedTransaction(signed)) };
      }
      assert.equal(request.method, 'submitTransaction');
      const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), `native-transfer:v1:${networkHash}`);
      assert.equal(saved.signedTransaction, request.params.signedTransaction, 'Persist before broadcast');
      assert.equal(saved.networkHash, networkHash);
      assert.equal(saved.account.address, accountWire.address);
      submissions++;
      const signedTransaction = serializeSignedTransaction(parseSignedTransactionHex(request.params.signedTransaction));
      const { transactionHash } = await client.sendTransaction({ signedTransaction });
      return { hash: toBase58(transactionHash) };
    });
    await page.evaluate(async ({ networkHash, accountWire }) => {
      window.example = await import('/wallet.ts');
      window.provider = {
        info: { id: 'skill-test', name: 'Skill test', version: '2.0.0' },
        on() { return () => {}; },
        async request(request) {
          if (request.method === 'connect' || request.method === 'getSession') {
            return { networkHash, accounts: [accountWire] };
          }
          if (window.rejectSignature && request.method === 'signTransaction') throw { code: 4001, message: 'Signature rejected' };
          return window.providerRequest(request);
        },
      };
    }, { networkHash, accountWire });

    await page.route('**/rpc', async route => {
      const request = route.request().postDataJSON();
      if (request.method !== 'getTransactionReceipt') return route.continue();
      await route.fulfill({ json: { jsonrpc: '2.0', id: request.id, error: { code: -32050, message: 'Observation unavailable' } } });
    });
    const result = await page.evaluate(receiver => window.example.sendNativeToken(window.provider, receiver), accountWire.address);
    assert.equal(result.state, 'unobserved');
    assert.equal(submissions, 1);
    await page.unroute('**/rpc');
    await page.reload();
    const recovered = await page.evaluate(async () => {
      window.example = await import('/wallet.ts');
      return window.example.inspectPending();
    });
    assert.equal(recovered.hash, result.hash);
    assert.equal(recovered.status.status, 'committed');
    assert.equal(recovered.receipt.execution.result, 'return');
    assert.equal(submissions, 1, 'Recovery must not submit again');
    const inspection = JSON.parse(execFileSync(cli,
      ['tx', 'show', result.hash, '--profile', 'local', '--json'], {
        encoding: 'utf8',
        env: { ...process.env, XDG_CONFIG_HOME: join(process.cwd(), 'config') },
      }));
    assert.equal(inspection.ok, true, 'The documented CLI lookup must inspect the same hash');
    const blocked = await page.evaluate(async receiver => {
      try { await window.example.sendNativeToken({}, receiver); } catch (error) { return error.message; }
    }, accountWire.address);
    assert.match(blocked, /existing transfer/);
    await page.evaluate(() => window.example.acknowledgeResult());
    assert.equal(await page.evaluate(() => window.example.inspectPending()), null);

    // Recreate only the provider; the recovered module/client stays unchanged.
    await page.evaluate(({ networkHash, accountWire }) => {
      window.provider = {
        info: { id: 'skill-test', name: 'Skill test', version: '2.0.0' },
        on() { return () => {}; },
        async request(request) {
          if (request.method === 'connect' || request.method === 'getSession') return { networkHash, accounts: [accountWire] };
          if (window.rejectSignature && request.method === 'signTransaction') throw { code: 4001, message: 'Signature rejected' };
          return window.providerRequest(request);
        },
      };
      window.rejectSignature = true;
    }, { networkHash, accountWire });
    const rejected = await page.evaluate(async receiver => {
      try { await window.example.sendNativeToken(window.provider, receiver); } catch (error) { return error.message; }
    }, accountWire.address);
    assert.match(rejected, /rejected/);
    assert.equal(submissions, 1);
    assert.equal(await page.evaluate(() => window.example.inspectPending()), null);
    await page.evaluate(() => {
      window.rejectSignature = false;
      Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
    });
    const failedSave = await page.evaluate(async receiver => {
      try { await window.example.sendNativeToken(window.provider, receiver); } catch (error) { return error.message; }
    }, accountWire.address);
    assert.match(failedSave, /Storage unavailable/);
    assert.equal(submissions, 1, 'Failed persistence must prevent broadcast');
    console.log('TypeScript: live read, persisted-before-broadcast transfer, observation failure, reload recovery, CLI inspection, duplicate guard, rejection, and storage failure passed.');
  }
} finally {
  clearTimeout(watchdog);
  await browser?.close();
  await server?.close();
  lines.close();
  if (node.exitCode === null && node.signalCode === null) node.kill('SIGTERM');
  await exited;
}
