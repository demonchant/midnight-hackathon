# Screen recording: Compact Privacy Change Gate

## Before recording

Use the project directory in WSL. The public compiler image and real upload API have been verified locally, but there is no verified Mainnet deployment to show. Do not show or narrate wallet credentials, seed phrases, private keys, Blockfrost tokens, secret values, or deployment configuration. Keep the recording on the schema inspection app; it does not need a wallet.

Start the app in a WSL terminal, then open the indicated URL in a browser:

```bash
cd /mnt/c/Users/pinch/Downloads/wavehacks/wavehacks-repo/compact-privacy-change-gate
CPG_PUBLIC_HOST=127.0.0.1 CPG_PUBLIC_PORT=4179 npm run start:public
```

Open `http://127.0.0.1:4179/app`. Use a clean browser window and hide unrelated tabs and terminals. The project examples are under `examples/`.

## Scene 1 — What the gate checks

**Capture:** Landing page or `/app` introduction and upload form.

**Voiceover:** “Compact Privacy Change Gate checks what the Compact compiler actually produces for a contract’s public ledger. I provide the source and the policy I reviewed, and the gate reports whether the observed schema and pinned toolchain match. This is a change check, not a security audit.”

## Scene 2 — Upload an approved source and policy

**Capture:** On `/app`, select `examples/ledger-schema-smoke.compact` as the Compact source and `examples/ledger-schema-smoke.policy.json` as the reviewed policy. Submit and wait for the compiler-backed report. Keep the result visible long enough to read the PASS status, ledger summary, and toolchain.

**Voiceover:** “For the baseline, I’m uploading the smoke contract and its reviewed policy. The pinned Compact compiler generates the metadata used by the gate. The public Render demo runs it as an unprivileged subprocess and asks visitors to use sample or otherwise non-sensitive source. The report comes from the compiler’s generated metadata, then compares that result with the policy I supplied. This baseline matches.”

## Scene 3 — Introduce an unapproved public field

**Capture:** Select `examples/ledger-schema-smoke-mutated.compact`, keep the original `examples/ledger-schema-smoke.policy.json`, submit, and show the blocked report with the new `revision` ledger field. Do not edit or regenerate the policy during this scene.

**Voiceover:** “Now the source adds a public `revision` field, while I keep the original policy. The compiler sees that field in the generated ledger schema, and the gate blocks the change because it was not reviewed and approved in this policy.”

## Scene 4 — Explain the result

**Capture:** Hold on the blocked result, then scroll enough to show the diff and report language distinguishing schema matching from a security audit.

**Voiceover:** “That gives reviewers a clear point to investigate before accepting a schema change. A pass only means the observed ledger and toolchain match this policy. It does not prove the contract is private, secure, or ready for production. The policy still needs human review, and the contract needs its own testing and security work.”

## Exact checks behind the recording

These are the local, reproducible checks for what the recording shows:

```bash
npm run verify:compiler
npm run test:public-compiler
npm run test:public-api
```

The matching and mutation results were exercised through the public API with the actual pinned compiler image. There is no Mainnet deployment evidence at the time of this script. Do not add a fabricated address, transaction, or claim to the video.
