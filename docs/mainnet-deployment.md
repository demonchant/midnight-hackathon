# Midnight Mainnet and public demo deployment decision

## Mainnet decision

Compact Privacy Change Gate is an off-chain developer tool. Its useful behavior is to invoke the Compact compiler, read compiler-produced `contract-info.json`, and compare the observed public ledger schema and toolchain with a human-reviewed policy. It does not require Midnight consensus, private state, proofs, a wallet, or an on-chain registry to deliver that behavior.

**No product contract will be deployed to Midnight Mainnet.** The `private-access-counter` in `contracts/` is an independent teaching example, not a component of the gate. Deploying it would consume real DUST without improving the product, so the former Mainnet submission path for that demo has been removed. The local counter demo remains clearly identified as separate educational material. The gate itself is not deployed on Midnight Mainnet.

There is consequently no product contract address, transaction ID, wallet address, proof-server requirement, or Mainnet transaction cost. Do not create a wallet or fund one for this project. The Mainnet preflight for the unrelated counter was not a product preflight and was removed along with its transaction command.

## Public demo hosting plan ? Render (not yet approved or deployed)

The judge-facing app needs a public HTTPS web service and a real Compact compiler. Render can build its Docker web service from `render.yaml`; however, it does not provide the host Docker socket required by the existing isolated-worker Compose profile. The Render build therefore uses `CPG_COMPILER_MODE=direct`: the pinned compiler runs as an unprivileged subprocess in a temporary directory inside the app service. This simplifies deployment but weakens isolation compared with the disposable, network-disabled Docker-worker profile. The public page tells visitors to use sample/non-sensitive source only. The service remains off-chain, one instance, one active compile, 8 inspections/client/10 minutes, and 32 total/10 minutes.

Proposed target: one Render Web Service, `1c-2g` plan (1 CPU, 2 GB RAM), one instance in Oregon, sourced from the actual public submission repository. Current published compute price is **US$25/month**, prorated by active seconds; Render's Hobby workspace fee is $0. No database, disk, custom domain, or extra service is needed. Render provides the public `onrender.com` hostname and HTTPS. Its Free plan is not the selected judge target: it has 512 MB RAM, sleeps after 15 minutes idle, and takes about a minute to wake. The Render workspace includes a monthly build allowance and bandwidth allowance, but exceeding included amounts may add usage charges. Review current Dashboard limits, set a monthly spend limit, and check the final order before creating the service. The provider's invoice/order view is authoritative. No service or cost exists yet.

The app will be verified with `PUBLIC_BASE_URL=https://<service>.onrender.com npm run verify:hosted`, then exercised through both built-in sample buttons from a second browser/device. The verification must show a ready compiler, baseline PASS, schema-change BLOCKED, compiler-error distinction, HTTPS/security headers, and no contract deployment endpoint. Suspend or delete the Render service after the judging period. Exact service URL will only exist after Render creates it.

See [Render deployment plan and instructions](render-deployment.md). The previous Hetzner/Caddy plan is no longer the proposed target.

## Current blockers and evidence

- Docker Desktop's Linux engine is unavailable here; Docker API and isolated-container integration tests cannot run in this Windows session.
- Direct Compact compiler and Playwright child-process checks currently fail to start (`EPERM`) in this Windows environment. The Render-specific compiler image and execution path have not been built/tested on Linux; CI now includes the direct compiler smoke and public browser run.
- No Render service exists, so there is no app URL or hosted verification evidence.
- No Render account/usage limits or explicit approval for the US$25/month plan are available. No cost has been incurred.
- The configured Git remote is `https://github.com/demonchant/wavehacks.git`; the requested repository is `https://github.com/demonchant/midnight-hackathon.git`. No code has been pushed or published.

## Official Midnight references checked 2026-10-15

- [Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix): Mainnet currently tests Compact toolchain 0.31.1, runtime 0.16.0, Wallet SDK 1.2.0, Midnight.js 4.1.1, and proof server 8.1.3. Those contract tool versions are irrelevant to deploying this off-chain service.
- [Environments and endpoints](https://docs.midnight.network/relnotes/network): Mainnet node and indexer RPC are served through Blockfrost and require a Mainnet project token when an app actually uses those services. This app does not.
- [Deploying and operating a contract](https://docs.midnight.network/guides/deploy-and-operate): contracts require proof, wallet, state, and network providers. The schema gate has no such runtime path.

## Render references

Render service details, official documentation, cost assumptions and deployment steps are listed in [the Render runbook](render-deployment.md).

The active event is the [Midnight Buildathon on AKINDO](https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG), not the ended May 2026 Devpost event. The [official Midnight Buildathon schedule](https://midnight.network/hackathon/buildathon) lists Wave 2 build dates as Sep 27 through Oct 17, 2026, with judging Oct 17 through Oct 27. The requested project rubric is Engineering & Implementation, Quality Assurance & Reliability, Product & Vision, User Experience & Design, Communication, and Business Development & Viability; tags are TypeScript and Compact, category Unlimited. This project still needs to be submitted through its AKINDO project page; repository code and an open web demo alone do not establish registration or submission eligibility.
