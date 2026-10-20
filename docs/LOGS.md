# Nocturne Markets — Engineering Journey & Context Log (`LOGS.md`)

> **Note for Future AI Agents & Developers**:  
> Read this file first! It provides a dense, up-to-date summary of the project architecture, design decisions, current build state, and next actions so you can resume work without re-reading extensive raw transcripts or consuming excessive tokens.

---

## 1. Project Snapshot

- **Project**: Nocturne Markets (codename: Project Z | handle: `@nocmarkets` | domain: `nocturnemarkets.tech`)
- **Event**: [ZECATHON](https://thezecathon.com) (Privacy hackathon by zkSNARKs)
- **Track**: **Private Markets** ($15k track prize, $20k grand prize)
- **Timeline**:
  - Hackathon duration: Sep 28 – Oct 28, 2026 (23:59 UTC) / Lagos target: Oct 27 evening.
  - Start Date: Mon, Oct 12, 2026 (Day 1 of 17).
- **Tagline / Core Concept**: _"Public prices. Private people."_  
  A private prediction market mirroring real-world Polymarket markets (read-only reference data and resolution via public Gamma API) running on an independent **shielded Zcash parimutuel pool**. Bets, sides, and payouts are shielded; sides are hidden until close via commit-reveal; payouts are batched, delayed, and shielded.
- **Solo Builder**: Nebulaz (Olamide) with AI pair programming.

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

| Date           | Decision          | Choice                                                         | Rationale & Alternatives Considered                                                                                                        |
| :------------- | :---------------- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **2026-10-12** | Pool Model        | Parimutuel                                                     | Avoids continuous AMM price probe leaks, no USD peg needed, no house liquidity risk.                                                       |
| **2026-10-12** | Market Oracle     | Mirror Polymarket Gamma API                                    | Eliminates complex AI or multi-sig oracles. Outcome directly matches real Polymarket resolution. Void/50-50 triggers automatic refund.     |
| **2026-10-12** | Wallet Onboarding | External Zcash wallet (Zashi, Ywallet) via QR                  | Lowest build risk for hackathon timeline. Avoids complex in-browser WASM Zcash keys on MVP. No Privy/EVM login (avoids identity linkage).  |
| **2026-10-12** | Network           | Zcash Testnet                                                  | Free test ZEC, zero real-money regulatory friction, perfect for hackathon prototype. Mainnet shielded wallet used solely for prize payout. |
| **2026-10-12** | Database & Server | SQLite + Node.js/TS on Azure VM                                | Fits low-resource VM (2GB RAM, no heavy Docker or managed DBs). Data remains on VM disk.                                                   |
| **2026-10-12** | Web Stack         | Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript | Modern, high performance, native support for fast UI interactions and animations.                                                          |

---

## 4. Journey & Progress Log

### Day 1 — Mon, Oct 12, 2026

- **Status**: Planning complete, workspace initialized.
- **Accomplishments**:
  - Created foundational specifications in [`docs/ABOUT.md`](file:///C:/Users/PC/desktop/coding/nocture-markets/docs/ABOUT.md) and [`docs/PLAN.md`](file:///C:/Users/PC/desktop/coding/nocture-markets/docs/PLAN.md).
  - Outlined threat model, leak analysis, scoring criteria, and 17-day schedule.
  - Scaffolded Next.js 16 + Tailwind v4 frontend in [`app/`](file:///C:/Users/PC/desktop/coding/nocture-markets/app).
  - Initialized living log [`docs/LOGS.md`](file:///C:/Users/PC/desktop/coding/nocture-markets/docs/LOGS.md) for cross-session AI context persistence.
  - Configured Azure VM (`ssh nocturne`) with a 2 GB swapfile to guard against memory spikes on the 1 GiB RAM instance.
  - Created anti-hallucination reference repository in `docs/references/` (ZIP-321, ZIP-316, ZIP-317, Testnet Infrastructure, and Zcash Guardrails).
  - Built and unit-tested ZIP-321 memo engine in `scripts/zcash/memo.ts` (100% roundtrip pass).
  - Implemented bet preparation script (`02_prepare_bet_request.ts`), deposit watcher (`03_watch_deposits.ts`), and payout sender (`04_test_payout.ts`).
  - Created and executed `scripts/zcash/pipeline_simulation.test.ts` — verified end-to-end secret generation $\rightarrow$ commitment hashing $\rightarrow$ memo decode $\rightarrow$ reveal verification $\rightarrow$ parimutuel math.
  - Created VM environment setup script in `scripts/setup_vm_zcash.sh`.

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

---

## 8. Architectural Upgrade Log: Zero-POST Timelock + Dual-Envelope Architecture (Oct 13, 2026)

### Motivation & Strategic Value

Before crossing into Phase 2, we upgraded our core Zcash memo and settlement architecture to eliminate three major attack vectors:

1. **Free-Option Attack & IP Leaks**: In manual commit-reveal, bettors had to return online post-close to POST `(side, secret)` over HTTP. If losing bets were refunded, bettors could withhold reveals (free option); if confiscated, users suffered from connection drops. Moreover, HTTP POST leaked bettor IP addresses.
2. **IVK Audit Address Leak**: In the original design, publishing the Pot Incoming Viewing Key (IVK) for public post-settlement audits would expose all bettors' return addresses to the public in plaintext memos.
3. **VM OOM & Process Collisions**: The 1 GiB Azure VM encountered memory spikes and SQLite lock collisions during concurrent `zingo-cli` invocations.

### Implemented Upgrades & Verified Metrics

1. **Dual-Envelope Timelock Memos (`packages/shared/src/memo.ts`, `scripts/zcash/memo.ts`)**:
   - Packaged into valid ASCII UTF-8 strings (`NOC2:<base64url>~....`) strictly padded to 500 characters (`<= 512 bytes` per ZIP-302 / ZIP-321).
   - `tlock_envelope` (217 bytes): Encrypted with `tlock-js` pinned to drand Quicknet (`52db9ba7...`, 3s period). Unpacked from age IBE format into deterministic binary components (`round_number [8B] || cipher_ibe [128B] || header_mac [32B] || stream_body [49B]`).
   - `commitment` defined as `SHA-256(tlock_envelope)` (binds bet without wasting 32 bytes in the memo).
   - `payout_envelope` (110–130 bytes): Bettor's Orchard UA compressed via `@scure/base` Bech32m to raw bytes (110 chars $\rightarrow$ 61 bytes) and encrypted with `tweetnacl.box` to Coordinator static X25519 public key with deterministic nonce `SHA-256("NOC2_BOX_NONCE" || ephem_pk || market_id)[0..24]`.
   - **IVK Audit Safe**: Anyone with Pot IVK can decrypt `tlock_envelope` to verify pot tallies once the drand round publishes, while bettors' return addresses remain confidential inside `payout_envelope`.
2. **Fee-on-Profit Parimutuel Math (`packages/shared/src/parimutuel.ts`)**:
   - Calculations performed in exact `BigInt` zatoshis (`1 ZEC = 100_000_000n zats`).
   - **Fee on Profit Only**: Protocol fee (200 bps = 2%) taken strictly from the losing pot. Winning principal is never taxed.
   - **Single-Sided / Void Refund Rule**: If `yesPot === 0n`, `noPot === 0n`, or `outcome === 'VOID'`, status becomes `REFUNDED` with `netPayout = stake - zip317TxFee`.
   - Verified zero-dust invariant: `sum(grossPayouts) + protocolFee <= totalPot`.
3. **Memory-Safe Singleton Mutex Queue (`scripts/zcash/zingo_client.ts`)**:
   - In-process FIFO async queue (concurrency = 1) + cross-process filesystem lock (`/tmp/nocturne_zingo.lock` / OS temp).
   - Failover support: Primary `https://testnet.zec.rocks:443`, fallback `https://zaino.testnet.unsafe.zec.rocks:443`.
   - Birthday guardrail: Initialized with `--birthday <tip_height - 100>` to prevent full chain scans on the 1 GiB VM.
4. **Zero-POST Client Architecture (`scripts/zcash/02_prepare_bet_request.ts`)**:
   - Bettor generates `NOC2:` payment URI locally.
   - Receipt stored strictly in browser `localStorage`.
   - Zero HTTP write requests sent to server.
5. **5-Minute Blitz Market Engine (`scripts/blitz/blitz_market_engine.ts`)**:
   - Autonomous demo engine executing the complete lifecycle: `OPEN` (deposits) $\rightarrow$ `CLOSED` (drand round reached) $\rightarrow$ `TIMELOCK DECRYPT` (automated reveal) $\rightarrow$ `RESOLVED` (index price) $\rightarrow$ `SETTLED` (shielded payouts).
6. **Cross-Platform Verification & Test Results**:
   - Unit tests passed 100% locally on Windows 11 and remotely on Ubuntu 22.04 VM (`ssh nocturne`):
     - `memo_dual_envelope.test.ts`: PASSED (including live drand Quicknet beacon decryption)
     - `parimutuel.test.ts`: PASSED (all settlement invariants & refund rules)
     - `pipeline_simulation.test.ts`: PASSED (end-to-end zero-POST timelock pipeline)
     - `blitz_market_engine.ts`: PASSED (autonomous 5-minute lifecycle demo)

---

---

## 9. Phase 2 Step 1 Completed: SQLite Database Engine & Fastify Coordinator Backend (Oct 14, 2026)

### Achievements & Architecture

1. **Native SQLite Database Engine (`coordinator/src/db/`)**:
   - Implemented using Node's native `node:sqlite` (`DatabaseSync`), achieving zero native build friction, zero C++ compilation dependencies, and native WAL mode performance.
   - Comprehensive schema created:
     - `markets`: `id`, `polymarket_id`, `title`, `slug`, `close_time`, `drand_round`, `status`, `outcome`, `pot_address`, `pot_uvk`, `merkle_root`, `total_pot_zats`, `yes_pot_zats`, `no_pot_zats`.
     - `bets`: `id`, `market_id`, `commitment`, `amount_zats`, `tlock_envelope` (BLOB 217B), `payout_envelope` (BLOB), `deposit_txid`, `block_height`, `decrypted_side`, `status`.
     - `payouts`: `id`, `market_id`, `bet_id`, `amount_zats`, `destination_address`, `txid`, `status`.
     - `sync_state`: Key-value state tracking for light client sync height and oracle poll timestamps.
   - Verified 100% test pass rate in [`coordinator/src/db/db.test.ts`](file:///C:/Users/PC/desktop/coding/nocture-markets/coordinator/src/db/db.test.ts).

2. **Zero-POST Read-Only Fastify Backend (`coordinator/src/`)**:
   - Initialized Fastify server with `@fastify/cors` and zero-IP-logging for privacy.
   - Endpoints implemented:
     - `GET /api/health`: Health status and service timestamp.
     - `GET /api/markets`: Active and settled markets list with pots in Zats & ZEC.
     - `GET /api/markets/:id`: Market details with `drand_round`, `pot_address`, and `coordinator_public_key` so the browser can construct dual-envelope timelock bets purely client-side.
     - `GET /api/markets/:id/audit`: Post-settlement public audit endpoint returning revealed commitments, Merkle root, drand round, and published Pot UVK (while keeping user payout envelopes strictly confidential).
   - Zero HTTP write endpoints (no `/bets/prepare`, no `/reveal`), eliminating bettor IP write leaks.
   - Integration tests verified 100% in [`coordinator/src/coordinator.test.ts`](file:///C:/Users/PC/desktop/coding/nocture-markets/coordinator/src/coordinator.test.ts).

---

## 10. Phase 2 Step 2 Completed: Background Workers & Automated Settlement Pipeline (Oct 14, 2026)

### Achievements & Verification

1. **Deposit Watcher Job (`coordinator/src/jobs/depositWatcher.ts`)**:
   - Polls the pot wallet (via memory-safe `WalletBridgeLike` / `ZingoClient`), parses valid `NOC2:` dual-envelope memos, maps them to normalized market IDs via `normalizeMarketId()`, and idempotently commits bets to SQLite while atomically updating market pot totals.
   - Tested duplicate ingestion defense: re-polling the same notes results in zero duplicates and perfectly preserved pot state.

2. **Polymarket Sync & Rolling 5-Minute Blitz Engine (`coordinator/src/jobs/polymarketSync.ts`)**:
   - Fetches active prediction events from Polymarket Gamma API (`https://gamma-api.polymarket.com/events?closed=false&limit=6`) with graceful offline fallback seeds.
   - Computes deterministic `drand_round` for market close timestamps using drand Quicknet (`52db9ba7...`, 3s period).
   - Seeds a rolling **5-Minute ZEC Blitz Market** (`blitz-btc-XXXX`) so hackathon judges and demo testers can experience the complete bet -> close -> timelock decrypt -> fee-on-profit payout flow in under 5 minutes without waiting days for real-world Polymarket events.

3. **Automated Timelock Settlement Worker (`coordinator/src/jobs/settlement.ts`)**:
   - Evaluates expired markets at close time and transitions status from `OPEN` to `CLOSED`.
   - Batch decrypts all `tlock_envelope` payloads (using drand Quicknet beacon or mock fallback), revealing bettors' YES/NO sides.
   - Computes standard SHA-256 Merkle root across all commitments in the market for public receipt verification.
   - Resolves outcomes, computes fee-on-profit parimutuel shares ($2\%$ fee strictly on losing pot, 100% single-sided/void refund guarantee).
   - Decrypts each winner's payout envelope using the Coordinator's X25519 static settlement private key (`decryptPayoutEnvelope()`), revealing their shielded Orchard/Sapling destination address while keeping it hidden from the public.
   - Creates payout records and broadcasts shielded payments via `bridge.sendShieldedPayout()`.
   - Publishes Pot UVK (`pot_uvk`) for post-settlement auditability and transitions market status to `SETTLED`.

4. **Integrated Server Architecture (`coordinator/src/index.ts`)**:
   - Added `enableWorkers` configuration to `buildApp()` with graceful shutdown (`app.addHook("onClose", ...)`).
   - End-to-end integration test passing 100% on Windows and remote Ubuntu 22.04 LTS (Azure VM):
     - [`coordinator/src/jobs/jobs.test.ts`](file:///C:/Users/PC/desktop/coding/nocture-markets/coordinator/src/jobs/jobs.test.ts)
     - [`coordinator/src/coordinator.test.ts`](file:///C:/Users/PC/desktop/coding/nocture-markets/coordinator/src/coordinator.test.ts)
     - [`coordinator/src/db/db.test.ts`](file:///C:/Users/PC/desktop/coding/nocture-markets/coordinator/src/db/db.test.ts)

---

## 11. Zero-Leak "Shield Any Polymarket Link" Teleporter + URL Prefix Route (Oct 15, 2026)

### Achievements & Architecture

1. **Bulk Background Pre-Indexing (`coordinator/src/jobs/polymarketSync.ts`)**:
   - Paginates Polymarket Gamma API in batches of 100 up to 300 active events (~4,000+ binary sub-markets) every 5 minutes.
   - Extracts `event_slug`, `market_slug`, `condition_id`, `question`, `group_item_title`, and `ref_yes_price`.
   - Filters strictly for binary `["Yes", "No"]` markets.
   - SQLite schema migrated with non-destructive `ALTER TABLE` checks and indexed lookups on `event_slug`, `market_slug`, and `condition_id`.

2. **Pure In-Memory URL Parser & Matcher (`packages/shared/src/polymarket_url.ts` & `app/lib/polymarket_url.ts`)**:
   - **Zero-Network Guarantee**: Matching happens 100% locally in browser memory against pre-fetched active markets. No ad-hoc HTTP queries are ever sent to Polymarket or our coordinator when a user pastes or types a link, eliminating market interest profiling and IP timing attacks.
   - Handles all 9 URL variants: event URLs, nested sub-market URLs, query strings, anchor hashes, mobile/short links (`/e/`, `/m/`), address-bar prepends (`nocturnemarkets.cv/https://polymarket.com/...`), mangled double-slash paths, and raw slugs.
   - Fuzzy prefix/suffix slug matcher handles Polymarket's appended timestamps and hashes (e.g. `fed-decision-in-october` matches `fed-decision-in-october-20260617190323537`).
   - Automatically resolves single-market events directly, and provides structured sub-market disambiguation for multi-bracket events (e.g. FOMC rate cut brackets).
   - 100% test pass rate in [`packages/shared/src/polymarket_url.test.ts`](file:///C:/Users/PC/desktop/coding/nocture-markets/packages/shared/src/polymarket_url.test.ts).

3. **Command Bar & URL-Prefix Catch-All Route (`app/`)**:
   - [`app/components/ShieldUrlBar.tsx`](file:///C:/Users/PC/desktop/coding/nocture-markets/app/components/ShieldUrlBar.tsx): Sleek dark-mode command bar on homepage with live paste detection, neon verification badge (`🛡️ Zero-Leak Local Match — 100% in-memory resolution (No network query sent)`), and 1-click outcome selector.
   - [`app/app/[...polyUrl]/page.tsx`](file:///C:/Users/PC/desktop/coding/nocture-markets/app/app/%5B...polyUrl%5D/page.tsx): Next.js catch-all route supporting direct address bar prepend (`nocturnemarkets.cv/https://polymarket.com/event/...`) with automatic teleportation to the corresponding shielded market.
   - [`app/app/market/[id]/page.tsx`](file:///C:/Users/PC/desktop/coding/nocture-markets/app/app/market/%5Bid%5D/page.tsx): Market detail view with pot metrics, closing timestamps, drand Quicknet beacon round, and shielded pool status.
   - Successfully verified with Next.js 16.4.0 Turbopack production build (`pnpm --dir app build`).

---

## 13. Phase 3 Step 1 Completed: Zero-POST Bet Slip Modal & Local Storage Vault (Oct 15, 2026)

### Achievements & Architecture

1. **Pure In-Browser Cryptographic Bet Builder (`app/lib/bet_builder.ts`)**:
   - Runs 100% locally in browser client components with native WebCrypto (`globalThis.crypto.subtle`), `tweetnacl`, `@scure/base`, and `tlock-js`.
   - Generates 16-byte random secrets, computes deterministic SHA-256 commitments, and encrypts `(side, secret)` to target drand Quicknet rounds.
   - Compresses bettor's Orchard UA (`utest1...`) via Bech32m and boxes it with TweetNaCl to the Coordinator's X25519 static public key.
   - Packages into standard 500-char wire memos (`NOC2:<base64url>~....`) and standard ZIP-321 URIs (`zcash:utest1...?amount=X&memo=...`).
   - 100% roundtrip verified with Coordinator decoder in [`app/lib/bet_builder.test.ts`](file:///C:/Users/PC/desktop/coding/nocture-markets/app/lib/bet_builder.test.ts).

2. **Browser LocalStorage Private Vault (`app/lib/vault.ts`)**:
   - Zero-leak local receipt vault storing secrets, commitments, and payment URIs strictly on the bettor's device.
   - Emits custom `nocturne-vault-updated` events for reactive UI state synchronization without any network requests.

3. **Wireframe Bet Slip Modal & QR Code Generator (`app/components/BetSlipModal.tsx`)**:
   - Clean, functional wireframe UI focusing on cryptographic correctness and state clarity.
   - Features side toggle (YES/NO), stake amount with quick chips (0.5, 1.0, 2.0, 5.0 ZEC), and return address input with a demo testnet UA shortcut.
   - Renders a scannable QR code via `qrcode.react` (`QRCodeSVG`), 1-click "Copy Payment URI" and "Copy NOC2: Memo" buttons, and commitment verification details.

4. **"My Private Bets" Drawer & Header Counter (`app/components/MyBetsDrawer.tsx` & `app/components/HeaderNav.tsx`)**:
   - Persistent top navigation button with live bet count badge.
   - Slide-over drawer listing all local vaulted receipts with 1-click commitment/secret copying, direct market links, and deletion management.

5. **Integrated Market Trading View (`app/components/MarketTradeView.tsx` & `app/app/market/[id]/page.tsx`)**:
   - Prominent "Trade Private YES" and "Trade Private NO" action buttons on all market detail pages.
   - All tests passing 100% (`pnpm test`) and Next.js 16.4.0 Turbopack production build verified (`pnpm --dir app build`).

---

## 14. Phase 3 Step 2 Completed: Public Merkle Audit Drawer & Client-Side Proof Verifier (Oct 18, 2026)

### Achievements & Architecture

1. **Client-Side Merkle Engine & Proof Verifier ([`app/lib/merkle.ts`](file:///C:/Users/PC/desktop/coding/nocture-markets/app/lib/merkle.ts))**:
   - `computeMerkleRootClient(leaves)`: In-browser SHA-256 Merkle tree calculation matching Coordinator's `computeMerkleRoot()` 100%. Handles empty trees, single leaves, even, and odd duplicate leaf layers.
   - `generateMerkleProof(leaves, targetLeaf, expectedRoot)`: Traverses the Merkle tree to produce the exact cryptographic inclusion path (`{ sibling, position, level }`).
   - `verifyMerkleProof(targetLeaf, steps, expectedRoot)`: Reconstructs the root from the leaf and sibling path using native browser WebCrypto (`crypto.subtle.digest`).
   - Rejects all tamper attempts (tampered leaf, tampered sibling, tampered root).
   - 100% test pass rate in [`app/lib/merkle.test.ts`](file:///C:/Users/PC/desktop/coding/nocture-markets/app/lib/merkle.test.ts).

2. **Public Merkle Audit Drawer ([`app/components/AuditDrawer.tsx`](file:///C:/Users/PC/desktop/coding/nocture-markets/app/components/AuditDrawer.tsx))**:
   - Fetches public audit packages from `GET /api/markets/:id/audit`.
   - Displays published SHA-256 Merkle root, settlement outcome, drand Quicknet close round, and published Pot UVK (Unified Viewing Key) post-settlement.
   - Auto-detects user's vaulted bets for the current market and provides a 1-click `"Verify My Bet"` shortcut.
   - Allows verifying any commitment hash with interactive step-by-step Merkle path inspection.
   - Displays a public table of all pool commitments with decrypted sides (`SEALED`, `YES`, `NO`) and 1-click row verification.

3. **Integrated Navigation & Vault Linking**:
   - [`app/components/MarketTradeView.tsx`](file:///C:/Users/PC/desktop/coding/nocture-markets/app/components/MarketTradeView.tsx): Added `"🔍 Public Audit & Proofs"` button in top navigation and in the Technical Parameters card.
   - [`app/components/MyBetsDrawer.tsx`](file:///C:/Users/PC/desktop/coding/nocture-markets/app/components/MyBetsDrawer.tsx): Added `"Audit Proof 🔍"` action on every vaulted bet card to directly open the audit drawer with the bet's commitment pre-loaded into the verifier.
   - All tests passing 100% (`pnpm test`) and Next.js 16.4.0 Turbopack production build verified (`pnpm --dir app build`).

---

## 15. Active Focus & Immediate Next Actions

### Next Priority: Phase 4 — Production VM Daemon & Remote Deployment (Days 14 - 15)

1. **Remote Azure VM Coordinator Daemonization (`ssh nocturne`)**:
   - Configure Coordinator under `pm2` or `systemd` daemon on Ubuntu 22.04 LTS VM.
   - Ensure `zingo-cli` is active and syncing with testnet lightwalletd (`testnet.zec.rocks:443`).
   - Configure public API access or domain (`api.nocturnemarkets.cv` or VM port 3001).
2. **Deploy Next.js Frontend to Vercel**:
   - Connect GitHub repository to Vercel with `NEXT_PUBLIC_COORDINATOR_URL` pointed to the Azure VM.
3. **Phase 5: Hackathon Submission Artifacts**:
   - Final threat model whitepaper / leak audit (`docs/LEAK_AUDIT.md`).
   - 5-minute Blitz testnet demo run for ZECATHON judges.
   - Demo video recording and submission text.
