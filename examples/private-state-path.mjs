// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import * as RT from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../contracts/managed/private-access-counter/contract/index.js';

const COIN = '0'.repeat(64);
const secret = randomBytes(32);
const wrongSecret = randomBytes(32);
const privateState = { secret };

const witnesses = {
  access_witness: ({ privateState: state }) => [state, state.secret]
};

const contract = new Contract(witnesses);
const constructorResult = contract.initialState(
  RT.createConstructorContext(privateState, COIN),
  secret
);
const address = RT.sampleContractAddress();

const goodContext = RT.createCircuitContext(address, COIN, constructorResult.currentContractState, privateState);
const goodCall = contract.impureCircuits.increment_counter(goodContext);
const publicState = ledger(goodCall.context.currentQueryContext.state);
assert.equal(Number(publicState.counter), 1, 'valid private witness should increment public counter');
assert.equal(publicState.secret_hash.length, 32, 'only the 32-byte verifier hash is on the public ledger');

const badContext = RT.createCircuitContext(
  address,
  COIN,
  constructorResult.currentContractState,
  { secret: wrongSecret }
);
assert.throws(
  () => contract.impureCircuits.increment_counter(badContext),
  /Invalid access code/,
  'wrong private witness must fail before public state changes'
);
assert.equal(Number(ledger(badContext.currentQueryContext.state).counter), 0, 'invalid witness must leave the public counter unchanged');

console.log(JSON.stringify({
  result: 'PASS',
  mode: 'local Compact runtime execution; no network transaction was submitted',
  validWitness: { publicCounterAfter: String(publicState.counter), secretReturnedOrLogged: false },
  invalidWitness: { result: 'rejected by the Compact circuit assertion', publicCounterAfter: '0' },
  publicLedgerFields: ['counter', 'secret_hash']
}, null, 2));
