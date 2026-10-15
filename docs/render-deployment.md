# Render deployment

This is the deployment profile for the public judge demo. The product is an off-chain compiler tool; this deployment creates no Midnight wallet, contract, or transaction.

## Render architecture and trust boundary

Render runs a single Docker web service from `render.yaml` and `deploy/Dockerfile.render`. The image contains the pinned Compact CLI 0.5.1 and compiler 0.31.1. The web service invokes the compiler as a child process in a temporary directory, then removes that directory. It does not use Docker-in-Docker, a host Docker socket, or a per-upload compiler container.

This is a materially weaker isolation boundary than the Docker/Compose profile: uploaded Compact source is parsed by an unprivileged compiler subprocess within the web service's Render container, which shares the app's service-level CPU, memory, and network. Request size, single-job concurrency, per-client/global rate limits, and compiler timeout still apply. The demo warns users to submit sample or otherwise non-sensitive source only. Production teams should use the CLI/self-hosted workflow or the Docker-sandbox profile for confidential sources.

The service binds to Render's `PORT` on `0.0.0.0`, exposes `/api/status` as its health check, runs one instance, and trusts Render's forwarded client IP from the first `X-Forwarded-For` entry for rate limiting. The on-screen app never deploys a visitor's contract.

The Docker image installs `unzip` because `compact update` uses it to extract the pinned compiler toolchain. Keep this system dependency in both `deploy/Dockerfile.render` and `deploy/Dockerfile.compiler` so the Render and isolated-compiler builds install the same toolchain successfully.

## Cost and approval

Recommended plan: one web service on Render `1c-2g` (1 CPU, 2 GB RAM), currently **US$25/month while running**, prorated by the second. That is the compute plan rate, not a guaranteed all-in bill ceiling. Render's Hobby workspace has no monthly workspace fee. Free web instances have 512 MB RAM, sleep after 15 idle minutes, and take about a minute to wake; they are not the selected plan for a judge-facing compiler demo. No database, persistent disk, custom domain, or second service is required. Render supplies an `onrender.com` hostname and HTTPS.

Included bandwidth and build-pipeline allowances depend on the current Render workspace plan; confirm the exact allowances in the Dashboard before deployment. Additional bandwidth or build usage may incur charges. Render's pipeline spend limit applies to build-pipeline usage only; it does not cap the web-service compute charge or all possible usage charges. Keep one instance, no add-ons, and delete/suspend the service after the judging period. Review Render's order and billing views before creation and monitor usage while it runs. No Render service has been created and no charge incurred.

## Deploy after approval

1. Confirm `main` on `https://github.com/demonchant/midnight-hackathon` contains this project at the repository root. The repository root has `render.yaml` and `deploy/Dockerfile.render`.
2. In Render, choose **New → Blueprint** and connect `demonchant/midnight-hackathon`. Select `main` and the root `render.yaml`. Render reads the Dockerfile path and build context from the blueprint. It creates one Oregon web service on the `1c-2g` plan and configures `/api/status` as the health check.
3. Before confirming creation, verify the service is `compact-privacy-change-gate`, plan `1c-2g`, one instance, no disk/database/add-on, and the displayed rate and possible usage charges are acceptable. Do not add Blockfrost, wallet, or other secrets.
4. Wait for the Docker build and health check. A healthy `/api/status` must say `ready: true`, compiler `0.31.1`, and `compilerExecution: service-process`.
5. From a trusted local checkout, run `PUBLIC_BASE_URL=https://<service>.onrender.com npm run verify:hosted`. It must confirm the landing and upload pages, HTTPS/security headers, a compiler-backed PASS, a schema-change BLOCKED result, compiler-error distinction, and no contract deployment route. Open the URL in a separate browser/device and try both built-in sample buttons.
6. Check Render logs, memory use, the health page and Billing usage. Share the URL only after all checks pass. Record the exact URL and check output in `docs/verification-report.md` and the AKINDO submission.
7. After judging, suspend or delete the service and verify billing stops.

The hostname is assigned by Render after service creation; no real URL exists until then. Never provide a Render API key, GitHub token, password, or private key in chat. Connect provider accounts through Render's own dashboard.

## Current pre-deployment status

- Blueprint and Render Dockerfile are prepared locally; Render has not built them.
- The real Compact compiler/browser path is not verified in this Windows environment. CI is configured to exercise the embedded compiler path on Linux, but no successful hosted CI run or Render deployment is claimed.
- The GitHub repository is `demonchant/midnight-hackathon`; its root is this project, including the Blueprint.
- The Blueprint is ready, but a Render service has not been created. Creating it requires access to the user's Render account and starts a paid `1c-2g` compute instance. No Mainnet deployment applies to this product.

## Official Render documentation checked 2026-10-15

- [Web services and ports](https://render.com/docs/web-services)
- [Docker runtime](https://render.com/docs/docker)
- [Compute plans](https://render.com/docs/compute-plans)
- [Free instance limitations](https://render.com/docs/free)
- [Billing and proration](https://render.com/docs/faq)
- [Build pipeline usage](https://render.com/docs/build-pipeline)
- [Health checks](https://render.com/docs/health-checks)
