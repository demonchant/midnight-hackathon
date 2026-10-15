// SPDX-License-Identifier: Apache-2.0
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';
import { DustSecretKey, LedgerParameters, ZswapSecretKeys } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { Contract, ledger } from '../contracts/managed/private-access-counter/contract/index.js';

// This runner is intentionally fixed to loopback local devnet. Never adapt it to
// Preview, Preprod, or Mainnet by overriding URLs or network IDs.
if (process.env.CPG_NETWORK && process.env.CPG_NETWORK !== 'undeployed') {
  throw new Error('This runner only supports the isolated undeployed local network.');
}
if (process.env.MIDNIGHT_NETWORK && process.env.MIDNIGHT_NETWORK !== 'undeployed') {
  throw new Error('This runner only supports the isolated undeployed local network.');
}

globalThis.WebSocket = WebSocket;
const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..');
const workspace = path.resolve(project, '..');
const assets = path.join(project, 'contracts', 'managed', 'private-access-counter');
const sourcePath = path.join(project, 'contracts', 'private-access-counter.compact');
const networkId = 'undeployed';
setNetworkId(networkId);

const endpoints = {
  walletNetworkId: networkId,
  networkId,
  indexer: 'http://127.0.0.1:8088/api/v4/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
  node: 'http://127.0.0.1:9944',
  nodeWS: 'ws://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  faucet: ''
};

const waitFor = (observable, predicate, label, timeoutMs = 300_000) => Rx.firstValueFrom(
  observable.pipe(
    Rx.filter(predicate),
    Rx.timeout({ first: timeoutMs, with: () => Rx.throwError(() => new Error(`${label} timed out after ${timeoutMs}ms`)) })
  )
);
const isComplete = progress => typeof progress?.isStrictlyComplete === 'function' && progress.isStrictlyComplete();

const source = await readFile(sourcePath);
const result = {
  startedAtUtc: new Date().toISOString(),
  mode: 'isolated local devnet only; not Preview, Preprod, or Mainnet',
  networkId,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  status: 'RUNNING'
};
let wallet;
try {
  // This well-known seed is a local devnet fixture only; it is never used on a public network.
  const { wallet: localWallet, seeds, keystore } = await FluentWalletBuilder
    .forEnvironment(endpoints)
    .withDustOptions({ ledgerParams: LedgerParameters.initialParameters(), additionalFeeOverhead: 1_000n, feeBlocksMargin: 5 })
    .withSeed('0'.repeat(63) + '1')
    .buildWithoutStarting();
  wallet = localWallet;
  const shieldedSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  await waitFor(
    wallet.state(),
    state => isComplete(state.unshielded?.progress) && isComplete(state.shielded?.state?.progress) && isComplete(state.dust?.state?.progress),
    'Local wallet sync'
  );

  const accountId = keystore.getBech32Address().asString();
  const storagePassword = `${randomBytes(24).toString('base64')}aA1!`;
  const privateStateProvider = levelPrivateStateProvider({
    privateStateStoreName: `cpg-private-${randomUUID()}`,
    signingKeyStoreName: `cpg-signing-${randomUUID()}`,
    privateStoragePasswordProvider: () => storagePassword,
    accountId
  });
  const publicDataProvider = indexerPublicDataProvider(endpoints.indexer, endpoints.indexerWS);
  const zkConfigProvider = new NodeZkConfigProvider(assets);
  const walletAndMidnightProvider = {
    getCoinPublicKey: () => shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx, ttl = ttlOneHour()) {
      const recipe = await wallet.balanceUnboundTransaction(tx, { shieldedSecretKeys, dustSecretKey }, { ttl });
      return wallet.finalizeRecipe(recipe);
    },
    submitTx: tx => wallet.submitTransaction(tx)
  };
  const providers = {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider: httpClientProofProvider(endpoints.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider
  };

  const state = await waitFor(wallet.state(), s => isComplete(s.unshielded?.progress), 'Local NIGHT sync');
  const unregistered = state.unshielded.availableCoins.filter(coin => coin.meta.registeredForDustGeneration === false);
  if (unregistered.length) {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      unregistered,
      keystore.getPublicKey(),
      payload => keystore.signData(payload)
    );
    await wallet.submitTransaction(await wallet.finalizeRecipe(recipe));
  }
  await waitFor(wallet.state(), s => (s.dust?.availableCoins?.length ?? 0) >= 1, 'Local spendable DUST');

  const secret = randomBytes(32);
  const witnesses = { access_witness: ({ privateState: ps }) => [ps, ps.secret] };
  const compiledContract = CompiledContract.withCompiledFileAssets(
    CompiledContract.withWitnesses(CompiledContract.make('private-access-counter', Contract), witnesses),
    assets
  );
  const deployed = await deployContract(providers, {
    compiledContract,
    args: [secret],
    privateStateId: `cpg-${randomUUID()}`,
    initialPrivateState: { secret }
  });
  result.deployTxId = deployed.deployTxData.public.txId;
  result.contractAddress = deployed.deployTxData.public.contractAddress;

  const call = await deployed.callTx.increment_counter();
  result.callTxId = call.public.txId;
  result.blockHeight = String(call.public.blockHeight);

  // Read from the indexer, independently of the local call's returned context.
  const indexed = await waitFor(
    Rx.from(publicDataProvider.watchForContractState(result.contractAddress)),
    value => value?.data && Number(ledger(value.data).counter) === 1,
    'Independent indexer read-back'
  );
  const publicLedger = ledger(indexed.data);
  if (Number(publicLedger.counter) !== 1 || publicLedger.secret_hash?.length !== 32) {
    throw new Error('Independent indexer state did not match the expected public counter and commitment shape.');
  }
  result.status = 'VERIFIED';
  result.finalizedCallObserved = true;
  result.independentIndexerReadBack = true;
  result.publicState = { counter: String(publicLedger.counter), fields: ['counter', 'secret_hash'], secretHashBytes: publicLedger.secret_hash.length };
  result.privateSecretLogged = false;
  result.completedAtUtc = new Date().toISOString();
} catch (error) {
  result.status = 'FAILED';
  result.error = error instanceof Error ? error.message : String(error);
  result.completedAtUtc = new Date().toISOString();
} finally {
  if (wallet) {
    try { await wallet.stop(); }
    catch (error) {
      result.cleanupError = error instanceof Error ? error.message : String(error);
      if (result.status === 'VERIFIED') result.status = 'PARTIAL';
    }
  }
}

const evidenceDir = path.join(workspace, 'evidence', 'compact-privacy-change-gate');
await mkdir(evidenceDir, { recursive: true });
const stamp = result.startedAtUtc.replaceAll(':', '').replaceAll('-', '');
const evidencePath = path.join(evidenceDir, `local-devnet-${stamp}.json`);
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(`CPG_LOCAL_RESULT_JSON=${JSON.stringify({ ...result, evidence: path.relative(workspace, evidencePath) })}`);
if (result.status !== 'VERIFIED') process.exitCode = 1;
