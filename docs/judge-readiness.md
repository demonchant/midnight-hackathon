# Judge readiness and submission checklist

**Project:** Compact Privacy Change Gate  
**Live showcase:** <https://compact-privacy-change-gate.onrender.com/>  
**Last checked:** 2026-10-15

## Product in one minute

Compact contract teams need to notice when a code change or compiler upgrade changes the public ledger. This tool compiles the real Compact source, reads the compiler-produced ledger metadata, and compares it with a human-reviewed policy. A match passes; an unapproved field or toolchain change blocks; a compiler error is reported separately.

The product is an off-chain developer tool. It does not connect a visitor's wallet, deploy a contract, or certify contract privacy/security. Its meaningful Midnight integration is the real Compact compiler and its generated contract metadata. The hosted demo is for sample or non-sensitive source because the Render process profile has a weaker isolation boundary than the disposable Docker worker profile.

## Live proof path

The deployed `/app` page offers two one-click examples that call the same real compiler-backed API as file uploads:

1. The baseline Compact source and reviewed policy produce **PASS**.
2. The mutated source adds public field `revision`; the unchanged policy produces **BLOCKED**.
3. Invalid Compact input produces **COMPILATION_FAILED**, not a policy block.

`npm run verify:hosted` passed these cases over HTTPS on 2026-10-15. The exact check summary is in [hosted verification evidence](../evidence/hosted-verification-2026-10-15.md). This is an API-backed hosted verification, not a claim that the full Playwright suite or every browser/device journey has passed.

## Captured judging criteria and honest status

The event page capture lists these weights. They are judging categories, not a score prediction.

| Criterion | Weight | What the project can show | Remaining evidence or work |
| --- | ---: | --- | --- |
| Engineering & Implementation | 40% | Real Compact compilation; compiler-generated public-ledger inspection; reviewed policy comparison; CLI, upload API, and CI workflow. | Confirm GitHub Actions run is green. Do not present the tool as an on-chain DApp. |
| Quality Assurance & Reliability | 15% | 19 deterministic assertions and a fresh hosted verification covering PASS, BLOCKED, compilation error, HTTPS, and readiness. | Full browser/device review and green CI run are not established by the hosted check. |
| Product & Vision | 15% | Specific user (Compact developers/reviewers), concrete schema-drift problem, and a practical pre-merge workflow. | Independent developer interviews and product validation remain to be done. |
| User Experience & Design | 15% | Public project overview, guided one-click examples, file upload, and distinct result states. | Human browser/accessibility review is still useful before recording. |
| Communication | 10% | Hosted project walkthrough and browser slide deck at `/deck`; recording script is available. | Record and attach the required video/video pitch in AKINDO. |
| Business Development & Viability | 5% | Open-source local CLI/CI adoption path for Compact teams. | No customer, revenue, or traction evidence is claimed. |

## Submission gates

The captured AKINDO listing calls for a compiling Compact contract, meaningful Midnight functionality, original work, a public GitHub repository with the `midnightntwrk` topic, Apache-2.0 licensing for Wave-developed Midnight code, a clear README, a slide deck, and a demo video or video pitch. Verify current requirements and entrant-specific eligibility in the signed-in AKINDO page before submission.

| Gate | Current status |
| --- | --- |
| Public project repository and README | Published at <https://github.com/demonchant/midnight-hackathon>; README describes the live app and its limits. |
| Apache-2.0 license | License file is included; review any bundled third-party assets/dependencies as part of the submission. |
| Compact compiler and Midnight-specific function | Hosted verification compiles Compact source and uses actual generated ledger metadata for the schema decision. No wallet, transaction, or contract deployment is claimed. |
| Live judge experience | Available at <https://compact-privacy-change-gate.onrender.com/>. |
| Slide deck | Browser deck at `/deck`; use its Print / save PDF control to export a PDF. |
| Demo video/video pitch | Not recorded or uploaded yet. Use [the recording guide](demo-recording-script.md). |
| `midnightntwrk` GitHub topic | Must be checked/set in GitHub repository settings. |
| AKINDO eligibility, entry fields, and receipt | Account-holder actions; not verifiable from this repository. Preserve the actual receipt after submitting. |
| Green GitHub Actions run | Not recorded in this evidence set; inspect Actions before claiming it. |

## Presenter notes

Keep the story narrow: “This gate makes compiler-reported public-state changes visible and blocks changes the team's reviewed policy does not approve.” Show the pass, then the `revision` mutation block. Explain that humans own policy approval and the gate does not certify privacy or security. Do not imply a Mainnet deployment or successful hosted upload of confidential code.

The official schedule gives Wave 2 build dates Sep 27–Oct 17, 2026 and judging Oct 17–27, 2026. Confirm the exact signed-in submission cutoff and event rules in AKINDO. [Official schedule](https://midnight.network/hackathon/buildathon) · [AKINDO event listing](https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG)
