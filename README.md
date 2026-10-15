# Compact Privacy Change Gate

A local-first gate for reviewing changes to the public ledger schema emitted by the real Compact compiler. It compiles a contract, parses `contract-info.json`, compares the observed ledger and pinned toolchain to a human-reviewed policy, and exits nonzero when they differ.

This is a schema change gate, not a contract security or privacy certification. It does not prove contract logic safe, determine whether an approved field is appropriate, or assess transaction metadata.

## Verification record

The verification results below are historical results recorded on 2026-10-14. The current Windows environment was checked again on 2026-10-15; current outcomes and limitations are in [the verification report](docs/verification-report.md). The current public API integration and compiler preflight did **not** pass in this environment because Docker Desktop's Linux engine is stopped and WSL access was denied.

- **VERIFIED:** Compact 0.31.1 compiled the smoke source and matched its reviewed policy; the mutated source was blocked for an unapproved public `revision` field. The private-access-counter was also compiled from source and its generated metadata matched its checked-in policy during the Mainnet dry preflight. The local runtime witness demonstration and local devnet transaction have not been independently rerun in this verification.
- **VERIFIED:** the public compiler image was built and verified, and the public API exercised matching and mutated uploads using actual compiler metadata, upload size limits, invalid JSON handling, timeout responses, and container cleanup.
- **NO PRODUCT CONTRACT REQUIRED:** the gate is an off-chain service. Its former Mainnet submission path deployed only the unrelated `private-access-counter` teaching demo and has been removed to avoid misrepresenting that demo as the product. No product contract has been deployed or submitted to Mainnet.
- **NOT VERIFIED:** hosted public deployment. Browser E2E tests cannot launch Chromium because the WSL environment lacks `libnspr4.so`; Playwright's browser download succeeded, but installing OS dependencies stopped because sudo authentication is unavailable.

## Run the local compiler-backed product in WSL

Requirements: Node.js 22+ and the pinned Compact toolchain. Install the Compact CLI 0.5.1 and compiler 0.31.1 using Midnight's official installer, then install the locked Node dependencies. Do not use the Windows `compact.exe` filesystem utility as the compiler.

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh | sh
compact update 0.31.1
compact --version
compact compile --version
npm ci
npm test
npm run test:compiler
```

`test:compiler` exercises three distinct outcomes through the real compiler: the baseline passes, the schema mutation compiles and is policy-blocked, and malformed Compact source returns a compiler error. A compiler error is never treated as a policy block. The checked-in GitHub Actions workflow runs the real compiler, constrained Docker compiler image, upload API, and browser workflow on Ubuntu.

From this directory, run `bash run-wsl.sh`, then open `http://127.0.0.1:4178`. The landing page is `/`; the schema inspector is at `/app`. It invokes the configured local Compact CLI. Source and policy paths are confined to `CPG_PROJECT_ROOT`. The server enforces a loopback bind and is not ready to expose publicly. This local inspector also contains a separate counter teaching walkthrough; it is not part of the off-chain public upload app and has no Mainnet deployment.

To reproduce the schema gate checks:

```bash
npm test
CPG_PROJECT_ROOT="$PWD" node cli.mjs examples/ledger-schema-smoke.compact --policy examples/ledger-schema-smoke.policy.json
CPG_PROJECT_ROOT="$PWD" node cli.mjs examples/ledger-schema-smoke-mutated.compact --policy examples/ledger-schema-smoke.policy.json
```

The first real compile should return `PASS` / exit 0. The mutation should compile, report `BLOCKED` with an `unapproved` `revision` entry, and exit 1. Save the actual reports and exits; never turn compiler failures into a gate result.

## Run the private witness / public result demonstration

From this directory in WSL:

```bash
npm run contract:demo
```

This compiles `contracts/private-access-counter.compact` into `contracts/managed/private-access-counter/`, imports the generated contract, executes the valid and invalid witness paths through the real Compact runtime, and inspects the returned ledger state. Expected behavior is a public `counter` increment for a valid witness and a circuit assertion failure for an invalid one. The runner labels itself as local runtime execution and does **not** claim a submitted proof or on-chain state change.

For an actual proof-backed transaction on the isolated local chain, run:

```bash
docker context ls
docker context show
docker --context "$(docker context show)" info
npm run devnet:up
npm run contract:local-e2e
npm run devnet:down
```

The first three commands make the selected engine explicit. The `devnet:up/down` scripts repeat that check and refuse to run Compose if the engine is unavailable. This deploys and calls only the loopback `undeployed` network using the official local test wallet. It captures actual deployment/call identifiers and independently reads the public `counter` and `secret_hash` through the indexer; a failure is recorded as failure. Local-devnet evidence does not establish public testnet or production deployment.

The inspector's **Deploy and verify locally** button invokes this same real path after Compose services are started. The browser displays the actual runner report; the API accepts no target or contract parameters. The Playwright suite starts the real server and exercises the compiler-backed pass/block workflows but intentionally does not click the transaction button.

Then inspect the actual compiler metadata:

```bash
cat contracts/managed/private-access-counter/compiler/contract-info.json
```

Write `contracts/private-access-counter.policy.json` only after reviewing these exact observed fields and toolchain versions. Do not hand-copy the smoke policy or blindly auto-approve the first compilation. Run `npm run contract:gate` to check the source against that reviewed policy. The generated directory is ignored; the source, harness, report, and policy are the reproducible records.

## Private/public behavior and limits

The example keeps a random 32-byte secret in the local harness's private state. The constructor publishes its persistent hash. `incrementCounter` obtains the secret through a witness, asserts that its hash matches the public commitment, and increments the public counter. The secret itself is not put in the ledger or printed. The public hash and number of successful calls are visible. Repeated use is allowed, so this example is not an authorization system suitable for production.

The circuit/witness distinction follows Midnight's [private-state witness guide](https://docs.midnight.network/guides/private-state-witnesses). Public-network transactions require additional network-specific configuration and must be verified through finalized transaction data and independent public-state read-back.

## Policy format

Policies pin the observed compiler, language, and runtime versions as well as every public ledger entry (`name`, `index`, `exported`, `storage`, `type`) and a human-written reason for each approved field. The checked-in smoke policy records values observed from its actual compiler run. For another contract, inspect its actual output first. The parser is strict about the observed top-level `ledger` array and fails closed on unsupported output.

## Tests and evidence

`npm test` runs deterministic unit assertions against isolated fixtures; it does not contact the compiler or network. User-captured live compiler reports and the exact current blockers are indexed in `../evidence/compact-privacy-change-gate/README.md`. No browser, container, hosted deployment, testnet, or mainnet outcome is claimed unless its own evidence is recorded.

Run `npm run e2e` from this folder in WSL to test the actual server and configured Compact CLI in a browser. It may take several minutes because the suite compiles the real smoke and mutation contracts. It is not a substitute for local-devnet or public-network verification.

## Public upload schema inspector

The public upload app is a separate server (`public-server.mjs`) and is available at `/app`. It has no local contract-runner route and does not use the local server's configured source paths, wallet fixtures, private keys, or local network. Keep `server.mjs` bound to `127.0.0.1` for local development.

The public compiler image pins Compact CLI 0.5.1 and Compact toolchain 0.31.1 in `deploy/Dockerfile.compiler`, matching the current official tested tool versions. Build and verify it with:

```bash
npm run build:compiler
npm run verify:compiler
```

Expected version output from the second command is `0.31.1`. Then run the real compiler-backed matching and mutated source checks:

```bash
npm run test:public-compiler
```

For the deterministic policy and comparison tests, run `npm test`. These do not require Docker and do not test compilation. To start the public server locally on loopback:

```bash
CPG_PUBLIC_HOST=127.0.0.1 CPG_PUBLIC_PORT=4179 npm run start:public
```

Open `http://127.0.0.1:4179/app` and upload `examples/ledger-schema-smoke.compact` with `examples/ledger-schema-smoke.policy.json`. It should pass. Upload `examples/ledger-schema-smoke-mutated.compact` with the same policy; it should be blocked because the compiler observed the unapproved public `revision` field. A visitor's uploaded policy is the policy used for that request; the private contract policy is never applied automatically.

The inspector accepts source up to 256 KiB and policy JSON up to 64 KiB in a 2 MiB bounded JSON request and validates policy structure and unique ledger names/indices. In the Docker/Compose profile, each compile uses a disposable, network-disabled container with CPU, memory, process, tmpfs and timeout limits. Render cannot provide that host Docker socket, so its profile compiles in an unprivileged subprocess inside the service container and deletes its temporary directory after each run; this has a weaker isolation boundary. The public UI warns against uploading confidential source. Uploaded contents are not logged. Compiler failures remain separate `COMPILATION_FAILED` errors rather than policy blocks. A schema/toolchain match is not a security audit or privacy proof.

The public app enforces an 8 inspections / 10 minutes per client limit, a global 32 inspections / 10 minutes cap, and one active compile. These limits are in-memory and apply to a single instance; do not scale horizontally without shared rate/queue control. For self-hosting with stronger compiler isolation, use `Dockerfile.web`, `compose.public.yaml`, and `deploy/Caddyfile.public`; the Docker socket grants host-level control, so that profile belongs on a dedicated host. The Render deployment uses `render.yaml` and `deploy/Dockerfile.render`; it has no Docker socket and therefore uses the documented in-service compiler subprocess. Publishing the web app does not deploy visitor contracts to Midnight Mainnet. See [Render deployment](docs/render-deployment.md).

Compact's official compiler repository currently lists no published security advisories. That public advisory status is not a complete independent audit. Toolchain 0.31.1 is pinned to match the checked-in reviewed smoke policy and is the release family documented for current Midnight mainnet compatibility in the official release notes; reassess advisories and compatibility before deployment.

## Mainnet and judge demo status

The gate does not require a contract and has no deployment on Midnight Mainnet. The proposed judge demo host is Render; the `1c-2g` instance currently costs up to $25/month while active, prorated by the second. See [Render deployment](docs/render-deployment.md) and [the Mainnet decision](docs/mainnet-deployment.md). The app has not been published and has no public URL. See [judge readiness](docs/judge-readiness.md) for product framing and evidence against the requested criteria.


## Deploy the judge demo to Render

The checked-in [`render.yaml`](render.yaml) uses the Render Docker web service in the `1c-2g` plan and the pinned Compact compiler. Render cannot mount the host Docker socket used by the stronger Compose isolation profile, so this demo runs the compiler as an unprivileged subprocess in its service container. The public page warns people to use non-sensitive sample source. Review the [Render deployment and cost guide](docs/render-deployment.md) before creating the service; no paid service has been created.
