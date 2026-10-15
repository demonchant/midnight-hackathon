# Hosted demo and video pitch guide

**Live app:** <https://compact-privacy-change-gate.onrender.com/>  
**Interactive deck:** <https://compact-privacy-change-gate.onrender.com/deck>  
**Target length:** about 2 minutes

## Before recording

- Open the live app and `/app` in a clean browser window. Check the landing page reports Compact 0.31.1 ready.
- On `/app`, click both built-in examples once. Confirm the first is **PASS** and the second is **BLOCKED** for unapproved `revision`.
- Use the `/deck` presentation to review the narrative; it supports arrow keys and Print / save PDF.
- Hide personal tabs, credentials, account information, and unrelated desktop content. Use only the built-in examples; do not upload private source or secrets.
- Capture the actual result panels long enough for the status and changed field to be legible. If the service is unavailable or reports a different result, stop and resolve it before recording.

## Two-minute narration and screen path

### 0:00–0:20 — Problem and user

**Show:** Project landing page, title and problem section.

**Say:** “Compact gives contract developers tools for private computation, but contracts still have compiler-reported public ledger state. A source change or compiler upgrade can add or alter a public field. Compact Privacy Change Gate helps contract teams catch that change before it ships.”

### 0:20–0:40 — How the gate works

**Show:** Scroll through the workflow steps.

**Say:** “The gate runs the actual Compact compiler, reads the generated contract metadata, and compares the ledger layout and pinned toolchain with a policy the team reviewed. This is the same kind of check a developer can run locally or add to CI.”

### 0:40–1:05 — Baseline PASS

**Show:** Click **Try the live compiler demo**, then **Run passing example**. Keep the report visible.

**Say:** “Here the baseline source compiles. Its observed public ledger matches the supplied policy, so the gate passes. The report includes the compiler-observed fields and version information.”

### 1:05–1:35 — Changed schema BLOCKED

**Show:** Click **Run schema-change example**. Point to `revision` in the report.

**Say:** “Now the source adds a public `revision` field, and I keep the same policy. The real compiler reports the new field. Because it has not been reviewed and approved in the policy, the gate blocks the change.”

### 1:35–1:50 — Compiler errors stay distinct

**Say:** “If Compact cannot compile the source, the gate reports a compilation failure. It never labels a compiler failure as a policy block.”

### 1:50–2:00 — Honest boundary

**Show:** Return to the trust-boundary note.

**Say:** “This is a focused schema and toolchain check, not a security audit or privacy certification. The hosted demo is for sample or non-sensitive code. It does not deploy contracts or submit transactions.”

## Submission notes

- Use the recorded hosted verification in [the evidence index](../evidence/README.md) to support the API/compiler claims.
- The `/deck` page can be exported as a PDF using its Print / save PDF control.
- Record and upload the video/video pitch through the signed-in AKINDO entry. Keep the actual final video and submission receipt; this guide does not mean either has been submitted.
- Do not claim customer adoption, a Mainnet contract, production security, or a transaction outcome.
