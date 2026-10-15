# Hosted verification — 2026-10-15

**URL:** <https://compact-privacy-change-gate.onrender.com/>  
**Command:** `PUBLIC_BASE_URL=https://compact-privacy-change-gate.onrender.com npm run verify:hosted`

**Observed output:**

```text
PASS: deployed app verified at https://compact-privacy-change-gate.onrender.com (HTTPS, ready compiler, baseline PASS, schema BLOCKED, compiler error, no local deployment route).
```

The verifier checks the landing and upload pages, security headers, `/api/status` (ready Compact compiler 0.31.1), a compiler-backed baseline policy match, a `revision` field mutation blocked by the same policy, malformed Compact compilation failure as a separate error, and the absence of a local contract deployment route.

This check exercised the deployed HTTP/API path and actual compiler. It did not exercise Playwright/browser rendering, accessibility on assistive technology, GitHub Actions, an on-chain transaction, or future uptime. It is not a security audit.
