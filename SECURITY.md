# Security Policy

## Reporting a Vulnerability

If you believe you have found a security vulnerability in Steinz Labs, please email **security@nakalabs.xyz** instead of opening a public issue or pull request. Do not disclose the vulnerability publicly until we have responded and shipped a fix.

We will acknowledge receipt within 72 hours and aim to provide a substantive update (status, severity assessment, fix timeline) within 7 days. Please include:

- A description of the vulnerability and the affected component
- Steps to reproduce, ideally with a minimal proof of concept
- The impact you believe an attacker could achieve
- Your assessment of severity (Critical / High / Medium / Low) — we will calibrate
- Whether you would like credit in the public advisory

## Scope

In scope:
- The Steinz Labs production deployment at https://nakalabs.xyz and any subdomains
- The Steinz Labs API endpoints
- The Steinz Labs Telegram bot
- The Naka Labs internal wallet (browser-side AES-256-GCM, BIP39)
- Authentication and authorization flows
- Webhook handlers (Alchemy, Helius)
- Smart contracts and on-chain integrations

Out of scope:
- Third-party services we depend on (CoinGecko, Alchemy, Helius, Anthropic, 0x, Jupiter, GoPlus, Supabase) — please report directly to those vendors
- Social engineering of staff
- Physical attacks
- Denial of service via traffic flooding (we will accept reports of logic-level DoS — for example, a single request that consumes disproportionate resources)
- Issues that require an already-compromised user device or browser session
- Theoretical risks without a demonstrable exploit

## Safe Harbor

We will not pursue legal action against researchers who:
- Make a good-faith effort to avoid privacy violations, data destruction, or service disruption
- Only test against accounts they own or have explicit permission to test
- Give us reasonable time to remediate before any public disclosure
- Do not exploit a finding beyond what is necessary to demonstrate the issue

## What We Take Seriously

- Cryptographic flaws, key handling failures, or any path that exposes user wallets, seed phrases, or private keys
- Authentication or authorization bypasses (vertical or horizontal)
- Tier-gate bypasses (Free → Pro / Pro → Max / NakaCult forgery)
- Cross-user data exposure (IDOR / BOLA)
- SQL injection, NoSQL injection, command injection, template injection
- Stored / reflected / DOM XSS
- CSRF on state-changing endpoints
- SSRF
- Webhook signature bypass (Alchemy, Helius)
- Sniper bot abuse: cross-user execution, kill-switch bypass, platform-fund drain
- Copy-trading rule manipulation that could drain a user's wallet
- VTX Agent prompt injection that overrides tier gating, leaks system prompts, or exfiltrates other users' data
- Hardcoded secrets, secrets in git history, secrets in client bundles

## What We Take Less Seriously

- Vulnerabilities that require physical access to an unlocked device
- Self-XSS
- Missing security headers without a working exploit
- Outdated client libraries without a working exploit
- Best-practice violations without demonstrable impact (e.g., HSTS preload)

## Disclosure

After a fix has shipped to production we will publish an advisory acknowledging the reporter (with their consent) and describing the issue at a level of detail appropriate to the severity and the deployment population.
