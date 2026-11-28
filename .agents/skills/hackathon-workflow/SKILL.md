---
name: hackathon-workflow
description: Hackathon shipping defaults for this repo. Use when starting a feature, opening a PR, choosing a chain, creating wallets or ramps, or deploying. Covers Solana devnet, the Pollar SDK, feature-branch pull requests to main, and Cloudflare Workers plus Supabase.
---

# Hackathon workflow

Team defaults, verbatim:

> We build in solana devnet. We use pollar.xyz sdk to create wallets and integrate ramps for our users. For every change we create a PR from a feature branch to main. We use cloudflare workers + supabase for the deployment.

Shipping a working devnet demo comes before production hardening (KYC, rate limits, audits, extra auth on a link). It does not come before these:

- Cluster is Solana **devnet** unless the user explicitly says otherwise. Do not point a demo at mainnet.
- Wallets and ramps go through the Pollar SDK (`@pollar/core` / `@pollar/react`, docs at https://docs.pollar.xyz). Read the address from the SDK. Do not invent a second wallet stack.
- Every change is a feature branch and a pull request into `main`. Do not commit straight to `main`.
- Deploy and data: Cloudflare Workers and Supabase. Debug those with the `integrators` skill.
- Secrets stay in the host env. Never commit API keys, treasury keys, or service-role keys.
- A balance that spends money moves only after the payment provider reports the payment approved, read with the server token. Do not add a browser call that marks a request paid.

## Pull request

1. Branch from `main`: `feat/<short-name>`.
2. Keep the diff to that feature.
3. Open one PR into `main`. GitHub text in English. Say what the demo shows.
4. Do not push to `main` yourself.

## What to build

One path a judge can watch. Reuse the app that already exists. Read `dev3pack` before a submission and `solana-dev` before Solana program or transaction code.
