# Nocturne Markets (Project Z): Implementation Plan

Domain: nocturnemarkets.tech (point an A record at the Azure VM, Caddy handles HTTPS automatically).

Companion to about.md. This is the build plan: architecture, structure, resources to check, and a day-by-day schedule.

Dates: today is Mon Oct 12, 2026. Deadline is Oct 28, 23:59 UTC (00:59 Oct 29 in Lagos). Aim to submit the evening of Oct 27.

---

## 1. MVP definition

One market working end to end, on testnet:

1. Mirrored Polymarket market shown in the UI
2. User bets with a commitment, pays shielded ZEC to the pot address with a memo
3. Coordinator detects the deposit and verifies the on-chain commitment
4. At close, coordinator fetches the public `drand` Quicknet beacon and automatically decrypts all `tlock` side envelopes
5. Polymarket resolves, coordinator settles
6. Winners get shielded payouts, batched and delayed
7. Merkle root and totals published, receipts verifiable
8. README with a clear threat model, repo open source

Everything else is a stretch. If something is not on this list, it waits until the list works once.

---

## 2. Architecture

```
 Browser (Next.js - Zero-POST Client)         Backend / Coordinator (Azure VM, Node + pm2, Caddy)
 -----------------------------------         --------------------------------------------------
 - Fetches markets & audits         HTTPS    - Polymarket sync job (mirrors public events)
   (Read-Only GETs)               <-------   - ZingoClient singleton (mutex queue & lockfile)
 - Generates local 16B secret                - Deposit watcher (scans pot Orchard UA)
 - Timelock encrypts (side || secret)        - Automated Timelock Decryption (drand Quicknet beacon)
   to drand Quicknet round                   - Private Settlement (Coordinator X25519 SK)
 - Encrypts return address via tweetnacl     - Parimutuel Settlement (fee-on-profit only)
   to Coordinator settlement PK              - Shielded Payout dispatcher
 - Displays ZIP-321 QR / URI                 - SQLite (encrypted disk)
 - Receipt stored in localStorage                     |
            |                                +--------+--------+
            | Zcash Testnet Shielded Memo    |                 |
            | (ZIP-321 QR / Payment URI)     |                 |
            +------------------------------->+                 |
             Orchard Pot UA (utest1...)     Polymarket Gamma  Zcash testnet via lightwalletd
             (Zero HTTP POSTs to server!)   (read-only)       (testnet.zec.rocks / zaino failover)
```

Notes:

- No smart contracts anywhere.
- Zero-POST Client: Bettors NEVER submit bets, receipts, or reveal data over HTTP. The server learns zero bettor IPs!
- Memory-Safe VM execution: Single-concurrency mutex queue around `zingo-cli` + `/tmp/nocturne_zingo.lock` prevents OOM on the 1 GiB Azure VM.
- Safe Public IVK Auditing: Publishing the Pot IVK allows anyone to verify `tlock_envelope` and audit pot tallies, while the winner's return address remains securely encrypted inside `payout_envelope`.

---

## 3. Stack

| Part            | Choice                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Frontend        | Next.js, TypeScript, Tailwind, shadcn/ui, Framer Motion. Zero-POST bet preparation via WebCrypto                               |
| Backend         | Node + TypeScript, Fastify or Hono                                                                                             |
| DB              | SQLite with Drizzle or Prisma                                                                                                  |
| Process manager | pm2 (or systemd)                                                                                                               |
| Reverse proxy   | Caddy, access logs off or IP-stripped                                                                                          |
| Zcash Wallet    | `zingo-cli` singleton mutex queue (`ZingoClient`) + birthday guardrail (`tip_height - 100`)                                     |
| Timelock Crypto | `tlock-js` pinned to drand Quicknet (`52db9ba7...`, 3s period)                                                                 |
| Privacy Box     | `tweetnacl.box` with ephemeral X25519 keypair and deterministic nonce `SHA-256("NOC2_BOX_NONCE" \|\| ephem_pk \|\| market_id)`  |
| Compression     | `@scure/base` Bech32m address compression (compresses Orchard UAs from ~110 chars to 61 bytes)                                 |


---

## 4. Repo structure (current & aligned)

```
nocturne-markets/
  README.md                 threat model, setup, honest trust statement
  docs/
    ABOUT.md                product spec, leak map, threat model & hackathon guidelines
    PLAN.md                 [THIS FILE] implementation roadmap & data schema
    LOGS.md                 continuous decision & trajectory log
    references/             anti-hallucination ground truth docs (ZIP-321, ZIP-316, ZIP-317, etc.)
  app/                      Next.js frontend (React 19, Tailwind v4, pnpm)
    page.tsx                browse mirrored markets & rolling 5-min blitz
    components/             market cards, bet slip (ZIP-321 QR), audit drawer, verifier
    lib/                    WebCrypto tlock/tweetnacl client helpers, localStorage receipt store
  coordinator/              Fastify / Node backend service
    src/
      index.ts              server bootstrap (zero write endpoints, read-only GETs)
      routes/               markets, audit
      jobs/
        polymarketSync.ts   mirrors public Polymarket events & 5-min blitz
        depositWatcher.ts   scans pot Orchard notes via ZingoClient
        settlement.ts       automated drand timelock decrypter & fee-on-profit payouts
      zcash/                wallet wrapper (ZingoClient mutex queue)
      db/                   schema, SQLite queries
      config.ts             endpoints, keys, chip sizes
  packages/
    shared/                 types, memo format (NOC2: dual envelope), parimutuel math
      src/
        memo.ts             dual-envelope timelock packer/unpacker, Bech32m address compression
        parimutuel.ts       exact BigInt zatoshis, fee-on-profit, refund invariants
        types.ts            market models, bet positions, receipts
  scripts/
    zcash/                  core Zcash engine scripts & unit tests
      memo.ts               dual-envelope memo wrapper
      02_prepare_bet_request.ts zero-POST bet preparation helper
      03_watch_deposits.ts  shielded deposit scanner
      04_test_payout.ts     shielded payout broadcaster
      zingo_client.ts       memory-safe singleton mutex client (/tmp/nocturne_zingo.lock)
      wallet_bridge.ts      wallet interface
      config.ts             testnet infrastructure configuration
      memo_dual_envelope.test.ts  dual-envelope timelock unit tests
      parimutuel.test.ts    settlement math unit tests
      pipeline_simulation.test.ts end-to-end pipeline test
    blitz/
      blitz_market_engine.ts 5-minute autonomous blitz market demo
    polymarket/
      fetch_markets.ts      Polymarket Gamma API test client
    setup_vm_zcash.sh       VM initialization script with birthday guardrail
```

---

## 5. Data model

- `markets`: `id`, `polymarket_id`, `title`, `close_time`, `drand_round`, `status`, `outcome`, `pot_address`, `pot_uvk`, `merkle_root`
- `bets`: `id`, `market_id`, `commitment`, `amount`, `tlock_envelope`, `payout_envelope`, `deposit_txid`, `confirmed_at`, `decrypted_side`, `status`
- `payouts`: `id`, `bet_id`, `amount`, `address`, `scheduled_at`, `sent_at`, `txid`
- `sync_state`: `last_scanned_height`, `last_polymarket_poll`

Never log commitments, memos, or envelopes in plaintext application logs.

### Memo Format (Finalized V2 Dual-Envelope Specification)

Valid ASCII UTF-8 string format (`NOC2:<base64url>~....`) padded to exactly 500 characters (strictly `<= 512 bytes` per ZIP-302):

1. **`version` (1B)**: `0x02`
2. **`market_id` (4B)**: `UInt32BE` (numeric ID or SHA-256 slug prefix)
3. **`tlock_envelope` (217B - Public Audit Envelope)**:
   - Encrypted via `tlock-js` pinned to drand Quicknet (`52db9ba7...`, 3-sec period).
   - Plaintext inside: `side (1B: 0x01=YES, 0x00=NO) || secret (16B random)`.
   - Deterministic binary packing: `round_number (8B) || cipher_ibe (128B) || header_mac (32B) || stream_body (49B)`.
   - `commitment = SHA-256(tlock_envelope)` (binds bet without wasting 32B in memo).
4. **`payout_envelope` (110–130B - Private Settlement Envelope)**:
   - User's Orchard UA compressed via `@scure/base` Bech32m to raw bytes (`~61 bytes`).
   - Encrypted with `tweetnacl.box` using ephemeral X25519 keypair and Coordinator settlement public key.
   - Nonce derived deterministically: `SHA-256("NOC2_BOX_NONCE" || ephem_pk || market_id_bytes)[0..24]`.
   - Store: `ephem_pk (32B) || cipher_length (1B) || boxed_address (16B MAC + N bytes)`.

### Parimutuel Payout Formula (Fee-on-Profit Only)

All calculations executed in exact `BigInt` zatoshis (`1 ZEC = 100_000_000n zats`):
1. **Fee-on-Profit Formula**:
   - `distributableLosingPot = (losingPot * (10000n - feeBps)) / 10000n`
   - `grossPayout_i = stake_i + (stake_i * distributableLosingPot) / winningPot`
   - `netPayout_i = grossPayout_i - zip317FeePerRecipient`
   - Conservation Invariant: `sum(grossPayout_i) + protocolFee <= totalPot`.
2. **Single-Sided or Void Refund Rule**:
   If `yesPot === 0n` OR `noPot === 0n` OR `outcome === 'VOID'`, market status becomes `REFUNDED`. Every bettor receives `stake - zip317TxFee` automatically. Protocol fee is `0`.
   *(Note: Because drand Quicknet automatically reveals 100% of valid deposited `tlock` envelopes after close, there is no unrevealed bet confiscation or free-option withholding!)*

### API (Zero-POST Design)

- `GET /api/markets`: Cached list of mirrored Polymarket events.
- `GET /api/markets/:id`: Market details, close time, drand round, coordinator public key, and pot address.
- `GET /api/markets/:id/audit`: (Post-close) Pot totals, commitments list, drand beacon, and Merkle root.
- **ZERO WRITE ENDPOINTS**: No `/api/bets`, no `/api/reveal`, no HTTP receipts. Bettors generate URIs locally and pay on-chain!

---

## 6. Resources to check (find current versions yourself)

I cannot verify exact URLs or package states, so search for these and trust the hackathon Resources page first.

- ZECATHON site, Resources section: https://thezecathon.com (testnet faucet, lightwalletd endpoints, starter docs)
- Polymarket public Gamma API docs (markets, events, outcomes, resolution fields)
- Zcash developer docs: shielded transactions, Orchard, unified addresses, memos, payment URIs (ZIP-321 style)
- lightwalletd and the light client protocol docs
- librustzcash repo and examples (reference for scanning and memo decryption)
- Any maintained JS/TS or WASM Zcash wallet library (check last commit date and testnet support)
- A Zcash CLI wallet that supports testnet and scripted sends (check what the Resources page recommends)
- Zcash testnet faucet
- For stretch: FROST for Zcash (ZF FROST repo), and Azure confidential VM docs or a managed TEE platform docs
- Merkle tree library for TS
- Public Zcash repos for shielded payment or point-of-sale demos to read as examples

AI usage rules for this project:

- Paste real docs or example code into the prompt and make it code against them.
- Run every Zcash call on testnet immediately. Never trust unrun generated Zcash code.
- Ask AI to explain any crypto step before accepting it. A subtle bug here is a privacy leak.

---

## 7. Day-by-day plan

Total: 17 calendar days including today and deadline day.

### Day 1: Mon Oct 12 (today)

- Register on the ZECATHON site, choose the Private Markets track, read the rules and Resources page
- Set up the repo (monorepo above), install tooling, create the VM user and Node, pm2, Caddy
- Find the testnet faucet and lightwalletd endpoints, get test ZEC
- Pull the Polymarket market list in a script, confirm fields (id, title, close time, outcome, resolved flag)

### Day 2: Tue Oct 13

- Get a Zcash testnet wallet running via `zingo-cli` and memory-safe mutex queue (`zingo_client.ts`) against `https://testnet.zec.rocks:443`
- Generate shielded pot address (Orchard UA: `utest1...`) and transparent faucet address
- Send shielded tx with `NOC2:` dual-envelope memo
- Detect deposit programmatically and decode the dual-envelope memo
- Finalize 500-byte valid ASCII UTF-8 memo format

### Day 3: Wed Oct 14 (GATE)

- Send a shielded payout from the pot wallet to a return address programmatically via `zingo_client.ts` mutex `quicksend`
- **Gate: deposit detected + NOC2 memo decoded + payout sent, all on testnet via zingo-cli mutex, all scripted.**
- Verified memory safety under 1 GiB RAM + 2 GB swap on Azure VM (`ssh nocturne`).

### Day 4: Thu Oct 15

- SQLite schema and db module (`markets`, `bets`, `payouts`, `sync_state`)
- Deposit watcher job writes detected bets and dual envelopes to DB with confirmations
- Local receipt verification helper

### Day 5: Fri Oct 16

- Automated `drand` Quicknet round fetcher + `tlock` batch decrypter
- Eliminate manual reveal endpoint: Coordinator unlocks sides automatically at market close
- Unit tests for `tlock` age IBE packing, deterministic unarmoring, and local receipt verification

### Day 6: Sat Oct 17

- Polymarket Gamma API sync job and cached read-only market API
- Rolling **5-Minute ZEC Blitz Market** (`scripts/blitz/blitz_market_engine.ts`) so hackathon judges can test the full lifecycle in 5 minutes
- Market lifecycle states: `OPEN`, `CLOSED`, `RESOLVED`, `SETTLED`, `REFUNDED` (no manual `REVEALING` window)

### Day 7: Sun Oct 18

- Parimutuel settlement logic: exact BigInt zatoshis, fee-on-profit math, Merkle root, single-sided / void refund path
- Simulation script verifying zero dust leak and conservation invariant (`sum(payouts) + fee <= totalPot`)

### Day 8: Mon Oct 19

- Payout sender: batching, random delays, fresh addresses, retries via `ZingoClient` mutex
- End-to-end backend test on testnet with 3 to 5 bets (the whole flow once, without UI)

### Day 9: Tue Oct 20

- Frontend: market list and market detail, Polymarket reference price line
- Pot sizes hidden until close

### Day 10: Wed Oct 21

- Frontend: bet slip, chip sizes, payment request QR with 500-byte `NOC2:` memo, local receipt saved to browser `localStorage`
- Return address input and Bech32m validation
- Zero-POST: No HTTP write requests sent from bettor browser

### Day 11: Thu Oct 22

- Frontend: **Client-Side Receipt & Merkle Proof Verifier + Public Viewing Key Audit Drawer**
- Results page: totals, Merkle root, fee-on-profit formula, public audit verification helper

### Day 12: Fri Oct 23

- Full end-to-end run through the UI on testnet (including rolling 5-minute blitz demo)
- Fix everything that breaks
- Deploy backend to the VM with pm2 and Caddy, frontend deployed

### Day 13: Sat Oct 24

- Privacy hardening pass: Caddy zero-IP logging (`log { output discard }`), no plaintext logs, 500-byte padded memos, shielded-only warnings, cached Polymarket data, headers and analytics removed
- Review the leak map in about.md line by line and tick each item

### Day 14: Sun Oct 25

- Stretch day (choose one only if the full flow is stable): TEE, FROST, or in-browser wallet. Otherwise polish and bug fixing
- Mainnet shielded wallet set up to receive the prize

### Day 15: Mon Oct 26

- README: problem, solution, architecture diagram, honest threat model table, setup steps, testnet demo notes
- Record the demo video (full flow, plus a short explanation of what is private and what is not)

### Day 16: Tue Oct 27

- Final test run from scratch on a clean checkout
- Make the repo public, double check no keys in git history
- Submit on the ZECATHON site: pick the Private Markets track, add the shielded prize address, demo link, repo, video

### Day 17: Wed Oct 28 (deadline day, buffer only)

- Fix only critical issues. Edits are allowed until the deadline but avoid risky changes
- Deadline: 23:59 UTC Oct 28 (00:59 Oct 29 Lagos). Do not rely on the last hour

---

## 8. Gates and cut list

Gates:

- **Day 3**: shielded deposit detection, memo decode, and payout all scripted on testnet via `zingo_client.ts`. If this fails, change approach the same day.
- **Day 8**: full backend flow works without UI. If late, cut the stretch day and shorten polish.
- **Day 12**: full UI flow works once. If late, drop everything except the single demo market.

Cut order if time runs short (cut from the top first):

1. Stretch options (TEE, FROST, in-browser wallet)
2. Multiple long-running markets (keep rolling 5-min blitz + 1 Polymarket demo)
3. Fancy animations
4. Payout batching complexity (keep a simple delayed batch)

*(Note: Public Viewing-Key Audit Drawer is NOT on the cut list — it is a core privacy differentiator safely enabled by `payout_envelope` encryption).*

Never cut: Zero-POST Timelock (`tlock-js`), Dual-Envelope memos, public IVK audit drawer, shielded-only flow, receipts and Merkle root, threat model README, 5-minute blitz demo.

---

## 9. Testing checklist

- drand Quicknet beacon decryption verifies side and secret automatically without user reveal
- Payout address in `payout_envelope` decrypts strictly with Coordinator X25519 secret key
- Public Pot IVK audit decrypts `tlock_envelope` without exposing any user's return address
- Memo adheres to `<= 512B` UTF-8 `NOC2:` format (padded to exactly 500 characters)
- Single-sided pot (`yesPot === 0` or `noPot === 0`) and Void market trigger 100% refund (minus ZIP-317 fee)
- Parimutuel math takes protocol fee (2%) strictly from losing pot (profit), never from winning principal
- `zingo-cli` mutex locking (`/tmp/nocturne_zingo.lock`) enforces single concurrency and prevents VM OOM crashes
- Caddy zero-IP logging active (`log { output discard }`)
- Duplicate deposit, wrong chip size, or invalid memo format handled safely
- Restarting the backend mid-scan does not double-count a deposit
- No secrets or keys in the repo or git history
- Logs contain no IPs, memos, commitments or return addresses
- Fresh clone setup works from the README

---

## 10. Submission checklist

- [ ] Registered on the ZECATHON site
- [ ] Track chosen: Private Markets (one submission, one track)
- [ ] All code written inside the build window
- [ ] Repo public, open source license added
- [ ] README with threat model and setup
- [ ] Demo video
- [ ] Live demo link (testnet) running on the VM
- [ ] Mainnet shielded address ready for the prize payout
- [ ] Submitted before Oct 28, 23:59 UTC (aim: evening of Oct 27)
