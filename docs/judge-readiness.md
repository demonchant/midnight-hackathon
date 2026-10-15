# Judge readiness

## Project overview

Compact Privacy Change Gate is for Compact contract teams that need to see when a code change alters the public ledger layout or compiler/runtime versions. The developer compiles a candidate contract, compares compiler-produced ledger metadata with a reviewed policy, and blocks CI when the observed public schema or pinned toolchain differs. Run it before merging a contract change, after a compiler upgrade, and as a required pull-request check. It complements code review, circuit tests, threat modeling, and independent security review; it does not replace them.

The schema is public by definition. The service does not require or inspect private witnesses, wallet information, or deployed state. Uploaded policy content is supplied by the submitter and is not independently attested. The Compose profile compiles uploads in a disposable, network-disabled Docker container. The Render demo profile instead runs the compiler as an unprivileged subprocess within one service container; that tradeoff is documented and the public page asks users to submit only non-sensitive sample code.

## Requested judging criteria and evidence

| Criterion | Concrete evidence in the project | Current gap |
| --- | --- | --- |
| Engineering & Implementation | Real CLI compiler path (`cli.mjs`, `inspect.mjs`), strict policy comparison (`core.mjs`), compiler-backed upload API, pinned compiler image, Docker resource limits, and CLI exit behavior for pass/block. | The app itself intentionally has no contract integration because schema comparison is compiler tooling. CI also compiles the distinct private-state teaching fixture and checks its reviewed public ledger policy; a toolchain-backed workflow result is still pending. |
| Quality Assurance & Reliability | Deterministic assertions, compiler smoke and mutation fixtures, upload API integration coverage for invalid JSON, input limits, timeout, and cleanup; Playwright browser suite. | Current `npm test` passes 19 deterministic assertions. Public API/browser and Compact compiler/runtime checks are currently blocked by unavailable Docker/Compact processes and Windows Playwright `spawn EPERM`; historical Linux successes are clearly dated in the verification report. |
| Product & Vision | Contract-team user, public-schema drift problem, merge/upgrade workflow, human-reviewed policy, and explicit security-review boundary described above and in README. | No customer discovery or adoption evidence is claimed. |
| User Experience & Design | Landing page and upload flow; baseline sample and mutation fixture; clear PASS/BLOCK result and policy limitations; `/api/status` exposes service mode and limits. | No hosted URL or public-browser run is available yet. Built-in sample buttons now let judges experience pass/block without local files. Render deployment, hosted HTTPS verification, and post-deploy memory/cleanup monitoring remain to be completed. |
| Communication | README, architecture/setup details, timed demo script, verification report, Mainnet decision, and this judge-readiness map. | The configured Git remote differs from the user-provided GitHub URL; the intended public submission repository must be made accessible and verified before publication. |
| Business Development & Viability | Likely users are Midnight/Compact protocol and application teams; adoption path is CLI/CI and PR checks. One serialized worker keeps initial operation simple. | There is no traction, customer, revenue, or funding claim. Ongoing costs include a dedicated VM, monitoring, bandwidth, and maintenance; see the hosting plan. Sustainability would be open-source maintenance, community contributions, and optional hosted/team operations if validated. |

## Demo script (about 2 minutes)

1. **0:00–0:20 — State the problem.** “Contract teams need a clear review signal when compiler output changes public ledger fields or toolchain versions. This gate checks generated metadata against a policy the team has reviewed.”
2. **0:20–0:55 — Show the matching example.** Click **Run passing example** (or upload `examples/ledger-schema-smoke.compact` and its policy). Explain that the real compiler, not a hand-written parser of source syntax, produces the metadata used by the comparison.
3. **0:55–1:30 — Show the schema change.** Click **Run schema-change example** to send the mutated source with the same policy. Point to the unapproved `revision` field and the BLOCK result. Do not update the policy during the demo.
4. **1:30–1:50 — Show CI/CLI use.** Demonstrate that the same source/policy decision is available through the CLI and exits nonzero for a block. A checked-in GitHub Actions workflow runs unit, CLI compiler, teaching-contract policy, witness runtime, isolated compiler, upload API, and local/public browser checks. No hosted CI run is claimed until GitHub executes it.
5. **1:50–2:00 — State limits.** “A pass means only that the observed ledger schema and toolchain match this reviewed policy. It is not a privacy guarantee, security audit, or contract approval. The gate runs off-chain; the counter example is educational and is not deployed as this product.”

The app currently has no public URL. Do not claim it is live until HTTPS hosting and both built-in sample runs are verified.

## Adoption and operating model

Start with an open-source local CLI in one team’s pull-request workflow. Reviewers approve a policy diff alongside contract changes; CI runs the compiler-backed check against that policy. A hosted upload demo can lower setup friction, while production adoption should favor self-hosted workers or an organization-managed runner so source code stays within the team’s trust boundary. Initial operations are one dedicated Linux VM, one isolated compiler worker at a time, HTTPS, rate and body limits, health monitoring, and prompt patching. The proposed host estimate excludes taxes and variable network charges; no service has been ordered.

## Active event and submission status

The active event is the [Midnight Buildathon on AKINDO](https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG). The [official Midnight schedule](https://midnight.network/hackathon/buildathon) lists Wave 2 build dates Sep 27 through Oct 17, 2026 and judging Oct 17 through Oct 27. This aligns with the requested Unlimited category, TypeScript and Compact tags, and six judging criteria documented above. Finish and submit the Wave 2 milestone in AKINDO before October 17, 2026; this repository cannot prove registration, eligibility, or submission completion. The supplied GitHub organization and Discord links are ecosystem references, not a submission repository or proof of eligibility.
