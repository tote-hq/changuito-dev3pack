---
name: dev3pack
description: Prepares a Dev3pack Global Hackathon submission on Solana. Use when the user mentions Dev3pack, the hackathon, the jury, the demo video, the README, or the submission form. Checks the required artifacts and the judging bar.
---

# Dev3pack submission

Sources, re-check before submitting: [hack.dev3pack.xyz](https://hack.dev3pack.xyz/), [FAQ](https://hack.dev3pack.xyz/faq), [this edition's Chile build station](https://luma.com/ovbwi0fj), [Superteam Türkiye brief](https://tr.superteam.fun/dev3pack/en).

This edition runs 27–29 Nov 2026. The Chile brief says submissions close Sunday 29 Nov 2026 at 04:00 America/Santiago. The dashboard wins if it disagrees.

## What the form requires

| Artifact | Rule |
|---|---|
| Rust program on Solana devnet | Program address is mandatory |
| Public GitHub repo | Mandatory. README is what the jury's AI reads |
| Live demo | Required for the main prize (Vercel or the existing deploy) |
| Video | Under 3 minutes, product actually working. Mandatory |

README and live demo are what the main prize adds on top of program, repo, and video.

## What scores

- One use case. Solana and the AI both have to be load-bearing. If either can be removed and the demo still works, say so and fix the story before submitting.
- Do not demo against a public RPC endpoint.
- This repo already existed. The README must separate what was already here from what this hackathon added. Do not present the grocery agent as a weekend build.
- Judges score product and technical rubrics. The top 100 get code inspection, so the program address in the README must be the one deployed.
- Prefer hosted services over new infrastructure. Pollar for wallets and ramps, the existing app for the shopper.

## Before the form

1. Program id, cluster `devnet`, and one transaction signature a stranger can open.
2. README: problem, what the demo does, program id, how to run, what is new this weekend.
3. Video under 3:00. Record the running app with the `test-coto` skill, then cut.
4. Live URL loads without a private env the judge does not have. Devnet only.

Solana program and transaction code: use the installed `solana-dev` skill (Solana Foundation, [solana.com/skills](https://solana.com/skills)).
