# Verification report

**Report date:** 2026-10-14 (UTC)  
**Project:** Compact Privacy Change Gate  
**Mainnet status:** Not deployed; no transaction submitted; no contract address exists.

## Current Windows session addendum — 2026-10-15

These are fresh results in the current Windows session. They supersede no historical Linux/WSL result above; each environment is recorded separately.

The checked-in compiler image was updated from CLI 0.5.3 to CLI 0.5.1 to match the currently tested devtools version in Midnight's official support matrix. The prior successful Docker build and API checks used CLI 0.5.3 and therefore do not verify this updated image; rebuild and rerun in CI or a working Linux/Docker host.

| Command / check | Current observed result |
| --- | --- |
| `node --version` / `npm --version` | PASS — Node `v24.18.0`, npm `11.16.0`. |
| `npm test` | PASS — 19 deterministic fixture assertions; no real compiler exercised. |
| `npm run deploy:preflight` (before retiring the teaching-demo deployment path) | BLOCKED — normal execution could not spawn `compact` (`EPERM`). Elevated retry invoked Windows `compact.exe`, the file-compression tool, which is not Midnight Compact. WSL invocation returned `Wsl/Service/CreateInstance/E_ACCESSDENIED`. No compiler-backed preflight ran in this session. The counter's unrelated Mainnet transaction path has since been removed. |
| `npm run test:public-api` | FAIL/BLOCKED — normal execution returned HTTP 500 at the matching-upload assertion. Elevated retry returned 503 at the same assertion. `docker info` confirmed Docker Desktop's Linux engine is not running (`dockerDesktopLinuxEngine` pipe not found). No real upload compile or container cleanup assertion completed. |
| `npm run e2e` | BLOCKED — Playwright exited with `Error: spawn EPERM` before tests/assertions. |
| Git remote | `origin` is `https://github.com/demonchant/wavehacks.git`, not the user-provided `https://github.com/demonchant/midnight-hackathon.git`. No push/publication was attempted. |
| Mainnet project transaction | NOT APPLICABLE — the schema gate is off-chain and does not need a contract. No Mainnet network request, wallet, transaction, or contract deployment was attempted. |
| Public hosting | NOT DEPLOYED — no hosting account/URL was configured and no paid resources were created. A Render `1c-2g` service is now the proposed host; the current compute estimate is $25/month prorated by the second, plus possible usage charges. See `docs/render-deployment.md`; review the Render Dashboard total/spend cap before creation. |

The previous top-level Mainnet demo deployment script and npm transaction commands were removed because they could deploy only the unrelated `private-access-counter` teaching demo. This keeps the operational project boundary aligned with the product. The source contract and local-only teaching walkthrough remain separate.

## Historical report (2026-10-14)

## Changes recorded

- Completed the separate upload compiler image and public API integration already present in the project, then rebuilt/retested it during this work (see commands/results below).
- Added `scripts/deploy-mainnet.mjs`, separate package commands, deployment procedure, and the initial not-deployed evidence file. The local private deployment runner remains fixed to local `undeployed` endpoints and its existing fixed local-only fixture.
- Added the screen-recording voiceover and exact app steps.
- The selected contract remains `contracts/private-access-counter.compact`, a teaching demo with public `counter` and `secret_hash` fields and a private witness check before increment. The Mainnet script deploys only its initial state and does not call increment. It is not production access control and has not been audited.

## Environment

- WSL user/environment reported as `wizardskull@pinchichi`.
- Node.js: `v24.10.0`; npm: `11.6.1`.
- Local Compact CLI: `compact` at `/home/wizardskull/.local/bin/compact`; `compact compile --version` returned `0.31.1`.
- Docker daemon: sandbox access first returned permission denied at `/var/run/docker.sock`. An approved escalated Docker check worked; Docker server reports `29.1.3` on Ubuntu 26.04/WSL. This is a sandbox/socket access boundary, not evidence that Docker Desktop was absent. No group or socket permission changes were made.
- `@midnightntwrk/wallet-sdk` is pinned at 1.2.0; the project pins Midnight.js 4.1.1 and Compact runtime 0.16.0.
- The current official support matrix lists Mainnet Node 1.0.400, Compact devtools 0.5.1, toolchain 0.31.1, runtime 0.16.0, Compact JS 2.5.1, Platform JS 2.2.4, Wallet SDK 1.2.0, Midnight.js/testkit 4.1.1, and proof server 8.1.3. Public Mainnet uses Blockfrost node and indexer endpoints with a Mainnet project token. These were checked against official docs on 2026-10-14; recheck before deployment.
- The official Compact GitHub security page was checked on 2026-10-14 and stated “There aren't any published security advisories.” This is only a current public advisory search result; it is not evidence the compiler is secure or audited. Compact CLI 0.5.3 is pinned in the image and compiler 0.31.1 is pinned; the current official matrix lists 0.5.1 as its tested devtools version. The actual compiler is 0.31.1, matching Mainnet's listed toolchain. Recheck compatibility before deployment.

## Commands and observed results

| Command | Result |
| --- | --- |
| `node --version` | PASS — `v24.10.0` |
| `npm --version` | PASS — `11.6.1` |
| `compact compile --version` | PASS — `0.31.1` |
| `npm install --package-lock-only --ignore-scripts --offline` | PASS — lockfile synchronized; 0 audit vulnerabilities reported by npm |
| `npm test` | PASS — 19 deterministic assertions; these are fixtures, not compiler integration |
| `npm run build:compiler` | PASS — final pinned image built successfully as `cpg-compact-compiler:0.31.1`, image ID `sha256:01da059dcaddc4c9f61de20afb14e651ff2804145e760fb8a6a1dfd8b6b011c9`. `.dockerignore` reduced the build context to 2.108 MiB; without it the build stalled while sending the oversized context. |
| `npm run verify:compiler` | PASS — inside the constrained, network-disabled image, `command -v compact` returned `/root/.local/bin/compact`, CLI `compact 0.5.3`, compiler `0.31.1`, and executable `/opt/compact-home/.compact/versions/0.31.1/x86_64-unknown-linux-musl/compactc`. |
| `npm run test:public-compiler` | PASS — actual matching source/policy passed; mutated source blocked for unapproved `revision`. |
| `npm run test:public-api` | PASS — status/upload UI, invalid policy JSON, oversized source and policy, real matching and mutated API uploads, local-run route 404; forced timeout returned 504 and left no labeled compiler container. |
| `CPG_PROJECT_ROOT="$PWD" node cli.mjs examples/ledger-schema-smoke.compact --policy examples/ledger-schema-smoke.policy.json` | Previously PASS with actual local Compact 0.31.1. |
| Same CLI with `examples/ledger-schema-smoke-mutated.compact` and original policy | Previously correctly BLOCKED for unapproved `revision`. |
| `CPG_HOST=0.0.0.0 node server.mjs` | PASS — exited 1 with the expected loopback-only guard; no listener was started. |
| `npm run e2e` | FAILED/BLOCKED — all 5 tests fail before assertions because Chromium cannot load `libnspr4.so`. `npx playwright install chromium` downloaded Chromium successfully. `npx playwright install-deps chromium` could not install OS libraries because `sudo` required a terminal to authenticate. No browser assertion ran. |
| `npm run deploy:preflight` | PASS — actual local Compact compile and metadata extraction; exact policy matched. Output: compiler `0.31.1`, language `0.23.0`, runtime `0.16.0`; ledger `counter` index 0 (`Uint`) and `secret_hash` index 1 (`Bytes[32]`). Printed status `PREFLIGHT_PASS_NO_NETWORK_TRANSACTION`; confirmed no wallet credentials read and no transaction submitted. Source SHA-256 `36299a58a901f4db6ad65ef0e84416b9302488daef3fc73ab62ffa5c2fbfe83f`; policy SHA-256 `537e35192df3af83b10542c98c6317dfb8c4b4f5710c23256ae1af018ed5db4c`; compiler metadata SHA-256 `caef962276a2e4c9882dde2727312a46bc00eeb8351205f9fd3ae995b2d14c1c`. |
| `npm run deploy:wallet-check` | BLOCKED — stopped immediately with “Mainnet credentials file not found” at the documented WSL-home path. No wallet was initialized, network balance checked, or transaction attempted. |
| `node scripts/deploy-mainnet.mjs deploy --submit` | BLOCKED safely — stopped at the same missing credentials file before wallet/network setup and before the confirmation prompt. No transaction was submitted. |

“Previously PASS” refers to earlier completed work in this project/session; it is not a fresh rerun on the report date unless the command above says PASS without that qualifier.

## Current Mainnet blockers

The compilation preflight is verified, but a real deployment is not ready. No deployment credentials file, Mainnet Blockfrost project ID, wallet funding, or spendable DUST are configured. The proof server release/version and Mainnet health have not been verified here. `wallet-check` stopped before initializing a wallet because credentials are absent; deployment stopped at the same guard. A preflight does not submit or reserve a transaction. Do not create a transaction until the user has provisioned credentials and funding privately, verified the printed public wallet address, verified compatible proof server and current official matrix/advisory status, and typed the script's exact interactive confirmation.

The Mainnet evidence file intentionally remains **NOT DEPLOYED**. There is no genuine transaction ID or contract address. Public hosting is not approved or performed.

## Security and evidence limits

- Compiler image build and real upload/API checks use a local Docker daemon. Docker socket access is effectively host administrative access; a public deployment needs a dedicated isolated worker host without wallet secrets or unrelated workloads.
- Compiler image isolation does not eliminate host-kernel/runtime risks. HTTPS, reverse-proxy deadlines, edge rate limiting, host patching, quotas, monitoring, and isolated worker operations remain deployment requirements.
- The demo contract, schema gate, and deployment path have not been security audited. Matching compiler schema/toolchain policy is not a security or privacy certification.
- The supplied GitHub URL `https://github.com/demonchant/midnight-hackathon.git` could not be fetched in the environment (network DNS restriction/cache miss); it was not cloned or modified.


## Judge-facing workflow changes ? 2026-10-15

- Added built-in public inspector examples and `/samples/*` read-only routes so visitors can run a compiler-backed pass and schema-change block without local files. User-upload form remains available.
- Added a dedicated public-app Playwright suite (`npm run e2e:public`) and CI step. This suite requires the isolated compiler image and a working Docker engine; it has not run successfully in the current Windows session.
- Active event corrected to the Midnight Buildathon Wave 2 (build ends Oct 17, judging runs Oct 17?27, 2026) from the official schedule. No AKINDO submission is recorded here.
- Static Node syntax, deterministic tests, Docker API/integration tests, browser checks, hosted smoke checks, and public deployment remain to be rerun after these changes. No public URL or external service exists.


### Fresh checks after the judge-facing sample update ? 2026-10-15

| Command | Observed result |
| --- | --- |
| `npm test` | PASS ? 19 deterministic assertions. |
| `node --check` for `public-server.mjs`, `public-inspect.mjs`, `public/upload.js`, `scripts/check-private-contract-policy.mjs`, `scripts/compile-private-contract.mjs`, and `playwright.public.config.mjs`; package JSON parse | PASS ? syntax/JSON only. |
| `docker compose --env-file deploy/public.env.example -f compose.public.yaml config` | PASS ? Compose parses; Docker group placeholder is expected to be filled on the host. |
| `npm run test:compiler` / `npm run contract:gate` | BLOCKED ? child process spawn returned `EPERM`; no Compact compiler check ran. |
| `npm run contract:demo` | BLOCKED ? Windows `compact.exe` ran the unrelated filesystem compression command and did not produce compiler artifacts. The new guard correctly stopped before runtime execution. |
| `npm run test:public-api` | BLOCKED ? public server could not report readiness because Docker engine/compiler image is unavailable. |
| `npm run e2e:public` and `npm run e2e` | BLOCKED ? Playwright exited with `spawn EPERM` before browser assertions. |

The public app now has no-file sample buttons for pass and schema-change block using the same upload API path. These interactions have not been exercised in a real browser or against a real compiler in this environment.


## Render deployment profile ? prepared, not deployed (2026-10-15)

- Added `render.yaml` and `deploy/Dockerfile.render` with Compact CLI 0.5.1/compiler 0.31.1, Render `PORT`/health-check wiring, one `1c-2g` instance, and no wallet or external service secrets.
- Added `CPG_COMPILER_MODE=direct`: compiler process uses a unique temporary directory, timeout, limits, and cleanup. `/api/status` reports `compilerExecution: service-process`; the hosted verifier accepts this and the stronger Docker container mode. The public UI now cautions against uploading confidential source.
- Render's managed service does not provide the Docker host socket needed by the current disposable-worker profile. The Render setup therefore trades per-upload process/container isolation for platform-container isolation; it is explicitly documented as a demo profile and not suitable for confidential contract source.
- The CI workflow now runs public compiler smoke and browser pass/block flows in direct mode on Linux after installing the official pinned compiler. Neither that workflow nor a Render build/deployment has run in this session. The Docker-backed API tests remain in CI for the stronger self-hosted profile.
- Current host checks: `npm test` and JS/package syntax checks pass; Render Dockerfile has not been built because Docker is unavailable. No Render service, URL, bill, Mainnet wallet, contract, or transaction exists.
