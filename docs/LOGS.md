# Nocturne Markets — Engineering Journey & Context Log (`LOGS.md`)

> **Note for Future AI Agents & Developers**:  
> Read this file first! It provides a dense, up-to-date summary of the project architecture, design decisions, current build state, and next actions so you can resume work without re-reading extensive raw transcripts or consuming excessive tokens.

---

## 1. Project Snapshot

* **Project**: Nocturne Markets (codename: Project Z | handle: `@nocmarkets` | domain: `nocturnemarkets.cv`)
* **Event**: [ZECATHON](https://thezecathon.com) (Privacy hackathon by zkSNARKs)
* **Track**: **Private Markets** ($15k track prize, $20k grand prize)
* **Timeline**:
  * Hackathon duration: Sep 28 – Oct 28, 2026 (23:59 UTC) / Lagos target: Oct 27 evening.
  * Start Date: Mon, Oct 12, 2026 (Day 1 of 17).
* **Tagline / Core Concept**: *"Public prices. Private people."*  
  A private prediction market mirroring real-world Polymarket markets (read-only reference data and resolution via public Gamma API) running on an independent **shielded Zcash parimutuel pool**. Bets, sides, and payouts are shielded; sides are hidden until close via commit-reveal; payouts are batched, delayed, and shielded.
* **Solo Builder**: Nebulaz (Olamide) with AI pair programming.

---

## 2. System Architecture & Mechanics

```
  Browser (Next.js 16 + Tailwind)         Coordinator Backend (Node/TS + SQLite)
  ================================        ======================================
  - Browse mirrored markets               - Polymarket Gamma API syncer
  - Generate secret + commitment   HTTPS  - Zcash testnet deposit watcher (lightwalletd)
  - Unified deposit QR (fixed memo)<----->- Receipt signer (Ed25519) & Merkle tree generator
  - Reveal side + secret                  - Reveal validator
  - Check status with receipt code        - Delayed, batched shielded payout sender
```

### Core Privacy & Trust Properties
1. **No Smart Contracts**: Zcash base layer lacks EVM smart contracts; pool and settlement logic runs off-chain in the coordinator backend.
2. **Parimutuel Pool (not AMM)**:
   - Eliminates continuous price discovery side-channels (cannot probe the pool with micro-bets).
   - No USD peg needed (payouts are proportional shares of the total ZEC pot: $\text{Payout} = \text{Stake} \times \frac{\text{Total Pot}}{\text{Winning Pot}} - \text{Fee}$).
   - No house bankroll risk.
3. **Commit-Reveal Side Secrecy**:
   - Memo contains: `version (1B) || commitment (32B: SHA-256(side || secret || market_id)) || return_address || padding`.
   - Both YES and NO bets send to the **exact same pot address** per market, preventing address-based side inference.
   - After market close, the user reveals `(side, secret)`.
4. **Side-Channel Mitigations**:
   - **Fixed chip sizes** (e.g. 1, 5, 10 test ZEC) to prevent note-size fingerprinting.
   - **Fixed-length padded memos** to prevent length analysis.
   - **Shielded-only deposits & payouts** with random delays and batching to avoid timing/amount linkage.
   - **Public Merkle root** of all valid commitments published at close + signed receipts given to users for verifiability.
5. **No 3rd-Party Leaks**: The frontend queries our backend cache only; never calls Polymarket directly (preventing IP-level market interest leakage). No IP or plaintext memo logging.

---

## 3. Architecture & Design Decision Log

| Date | Decision | Choice | Rationale & Alternatives Considered |
| :--- | :--- | :--- | :--- |
| **2026-10-12** | Pool Model | Parimutuel | Avoids continuous AMM price probe leaks, no USD peg needed, no house liquidity risk. |
| **2026-10-12** | Market Oracle | Mirror Polymarket Gamma API | Eliminates complex AI or multi-sig oracles. Outcome directly matches real Polymarket resolution. Void/50-50 triggers automatic refund. |
| **2026-10-12** | Wallet Onboarding | External Zcash wallet (Zashi, Ywallet) via QR | Lowest build risk for hackathon timeline. Avoids complex in-browser WASM Zcash keys on MVP. No Privy/EVM login (avoids identity linkage). |
| **2026-10-12** | Network | Zcash Testnet | Free test ZEC, zero real-money regulatory friction, perfect for hackathon prototype. Mainnet shielded wallet used solely for prize payout. |
| **2026-10-12** | Database & Server | SQLite + Node.js/TS on Azure VM | Fits low-resource VM (2GB RAM, no heavy Docker or managed DBs). Data remains on VM disk. |
| **2026-10-12** | Web Stack | Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript | Modern, high performance, native support for fast UI interactions and animations. |

---

## 4. Journey & Progress Log

### Day 1 — Mon, Oct 12, 2026
* **Status**: Planning complete, workspace initialized.
* **Accomplishments**:
  * Created foundational specifications in [`docs/ABOUT.md`](file:///C:/Users/PC/desktop/coding/nocture-markets/docs/ABOUT.md) and [`docs/PLAN.md`](file:///C:/Users/PC/desktop/coding/nocture-markets/docs/PLAN.md).
  * Outlined threat model, leak analysis, scoring criteria, and 17-day schedule.
  * Scaffolded Next.js 16 + Tailwind v4 frontend in [`app/`](file:///C:/Users/PC/desktop/coding/nocture-markets/app).
  * Initialized living log [`docs/LOGS.md`](file:///C:/Users/PC/desktop/coding/nocture-markets/docs/LOGS.md) for cross-session AI context persistence.
  * Configured Azure VM (`ssh nocturne`) with a 2 GB swapfile to guard against memory spikes on the 1 GiB RAM instance.
  * Created anti-hallucination reference repository in `docs/references/` (ZIP-321, ZIP-316, ZIP-317, Testnet Infrastructure, and Zcash Guardrails).

---

## 5. Master Build Sequence (What We Work On & In What Order)

To de-risk the project early and avoid building a frontend for a backend that can't talk to Zcash, we build in strictly gated phases:

```
[Phase 1: Zcash Core Engine] ──> [Phase 2: Coordinator Backend] ──> [Phase 3: Frontend UI] ──> [Phase 4: Hardening & Demo]
  (Days 1 - 3: Wed Oct 14)          (Days 4 - 8: Mon Oct 19)          (Days 9 - 12: Fri Oct 23)     (Days 13 - 17: Submission)
  * Hard Gate: Deposit,              * Fastify/Hono API + SQLite       * Next.js on Vercel           * Leak audits, IP stripping
    Memo Decode, Payout              * Polymarket sync & cache         * Bet slip & ZIP-321 QR       * Merkle verifier, Readme
    all scripted on testnet          * Merkle root & receipts          * Reveal portal & status      * Demo video & ZECATHON submit
```

1. **Phase 1: Zcash Core & Testnet Scripting (CURRENT PRIORITY — Days 1 to 3)**
   - Testnet connectivity to `lightwalletd` (`testnet.lightwalletd.com:9067`).
   - Run CLI / testnet wallet (`zingo-cli`), generate pot address (`utest1...`).
   - Fund test wallet via faucet (`zcashfaucet.jinolabs.xyz`).
   - **Day 3 Gate**: Execute end-to-end test script: detect shielded deposit $\rightarrow$ decode memo commitment $\rightarrow$ send programmatic shielded payout back.
2. **Phase 2: Coordinator Backend & Data Pipeline (Days 4 to 8)**
   - Node.js (Fastify/Hono) + SQLite on VM (`ssh nocturne`).
   - Polymarket Gamma API synchronization (caching markets, reference prices, and outcome resolution).
   - Automated background deposit watcher job.
   - Commitment verification & Ed25519 receipt signer.
   - Parimutuel settlement engine & delayed payout scheduler.
3. **Phase 3: Frontend Web Application (Days 9 to 12)**
   - Deployed on Vercel (free, 0 RAM footprint on VM).
   - Market explorer with live Polymarket reference lines.
   - Bet slip: browser-side secret generation, commitment hashing, ZIP-321 QR code generator, receipt export.
   - Reveal portal & bet tracker.
4. **Phase 4: Privacy Hardening, Verifiability, & Submission (Days 13 to 17)**
   - Audit leak map (no IP logging, padded memos, shielded-only enforcement).
   - Public Merkle root verification tool.
   - Comprehensive README with honest threat model.
   - Demo video recording and official ZECATHON submission.

---

## 6. Current Workspace Layout

```
nocture-markets/
├── docs/
│   ├── ABOUT.md              # Product spec, leak map, threat model & hackathon guidelines
│   ├── PLAN.md               # 17-day timeline, data schema, milestones & cut list
│   ├── LOGS.md               # [THIS FILE] Context & decision log for agents & devs
│   └── references/           # Anti-hallucination ground truth docs
│       ├── ZCASH-GUARDRAILS.md      # Strict AI rules against imaginary libraries
│       ├── ZIP-321.md               # Payment Request URI spec & base64url memo format
│       ├── ZIP-316.md               # Unified Addresses (utest1...)
│       ├── ZIP-317.md               # Proportional transfer fee rules
│       └── TESTNET-INFRASTRUCTURE.md# Live testnet lightwalletd endpoints & faucets
├── app/                      # Next.js 16 frontend (React 19, Tailwind v4, pnpm)
└── README.md                 # Repo root stub
```

---

## 7. Active Focus & Immediate Next Actions

1. **Zcash Testnet Connectivity**:
   - Test connection to `testnet.lightwalletd.com:9067` or `zaino.testnet.unsafe.zec.rocks:443`.
   - Acquire testnet TAZ from the faucet into a test wallet.
   - Stand up `zingo-cli` test script for Day 3 Gate.
2. **Polymarket Gamma API Test**:
   - Run a test script to inspect Polymarket's public API structure (`https://gamma-api.polymarket.com/events`).
