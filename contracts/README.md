# Private witness and public result demo

This folder is educational material only. The Compact Privacy Change Gate product is an off-chain compiler-backed service and does not use or require this contract. The counter is not deployed to Midnight Mainnet and must not be presented as a Mainnet deployment of the product.

`private-access-counter.compact` is a minimal mechanism example for the schema gate. It demonstrates the boundary between a local secret supplied by a witness and public ledger state:

- The local TypeScript harness owns a random 32-byte secret in private state.
- The contract stores the hash of the initial secret and a public counter in its ledger.
- `incrementCounter` obtains the secret through `accessWitness`, checks its hash, then increments the public counter.
- A wrong witness must fail the circuit before it can produce a valid state transition.

This is not a general access-control product or a production authorization design. The hash is public, so the secret must be generated uniformly at random and kept secret; do not use a human password. Repeated use is allowed and the public counter reveals each successful use. Review these disclosures before adapting the pattern.

The implementation follows the structure in Midnight's current [private-state witness guide](https://docs.midnight.network/guides/private-state-witnesses), but remains separately implemented in this repository. Compiler metadata must be inspected before creating its reviewed schema policy. Never copy the smoke policy or hand-invent the metadata representation.
