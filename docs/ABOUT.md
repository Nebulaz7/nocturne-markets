# Nocturne Markets (codename: Project Z)

Domain: nocturnemarkets.cv
Short handle: nocmarkets
Tagline idea: Public prices. Private people.

A private prediction market on Zcash. It mirrors real Polymarket markets (read-only market data) but runs its own separate pool where bets are shielded, sides are sealed until close, and payouts are shielded too.

Built by Nebulaz (Olamide) for ZECATHON. Solo build, with AI assistance on parts of the code.

Status: planning (as of Oct 12, 2026). Nothing built yet.

---

## 1. The hackathon: ZECATHON

- Organizer: zkSNARKs
- Site: https://thezecathon.com
- Theme: a Zcash privacy hackathon. "Thirty days to build something on Zcash that does not leak."
- Prize pool: $100,000, paid in ZEC to a shielded address given at submission
- Help contact: bladet928@gmail.com (say what you tried and what happened)

### Timeline (all UTC)

| Event              | Date                    |
| ------------------ | ----------------------- |
| Registration opens | Sep 28, 2026            |
| Submissions open   | Sep 28, 2026            |
| Submissions due    | Oct 28, 2026, 23:59 UTC |
| Judges revealed    | Oct 29, 2026            |
| Judging            | Oct 29 to Nov 22, 2026  |
| Winners announced  | Nov 23, 2026            |

Note: we are in Lagos (UTC+1), so the deadline is 00:59 on Oct 29 local time. Plan to submit well before that. Target: submit by the evening of Oct 27.

### Tracks and prizes

| Track              | Prize   | What it is                                                                     |
| ------------------ | ------- | ------------------------------------------------------------------------------ |
| Shielded Payments  | $15,000 | Point of sale, payroll, remittance, subscriptions                              |
| Private Markets    | $15,000 | Sealed-bid auctions, order flow, settlement. Price public, participants hidden |
| Cross-Chain        | $15,000 | Swaps, bridges, intents without unshielding on the way                         |
| Core & Tooling     | $15,000 | Zebra, librustzcash, indexers, wallet SDKs, provers                            |
| Wildcard           | $15,000 | Art, games, social, hardware                                                   |
| Grand Prize        | $20,000 | Best overall, awarded on top of its track prize                                |
| Community Bounties | $5,000  | Smaller bounties posted during the build window                                |

Our track: **Private Markets**.

### What judges score

1. **Privacy**: does it actually preserve privacy or only look like it. Leaks are disqualifying, not deductions.
2. **Usefulness**: would someone use this on Monday.
3. **Execution**: does it run. Working beats ambitious.
4. **Originality**: built for this hackathon, not repackaged.

### Rules (summary)

1. One person registers and submits. The prize goes to that account. You can build with anyone.
2. All code written during the build window. Libraries are fine, existing products are not.
3. Open source at submission. A private repo made public on Oct 28 counts.
4. One submission per account, in exactly one track.
5. Submissions stay sealed until judging opens. Edits allowed until the deadline.
6. Organizers and judges cannot enter.

Judges are not announced yet (as of Oct 11).

---

## 2. The idea

### One line

Polymarket's markets, but your bet, your side and your payout are private.

### Inspiration

GhostMarket, a confidential dark pool prediction market built on Zama FHEVM (Sepolia) with an ERC-7984 vault, an encrypted AMM, sealed-bid windows and an AI oracle quorum. Its privacy came from FHE inside smart contracts.

### Why Project Z is different

- Zcash has no smart contracts and no FHE. So privacy comes from shielded transfers plus careful off-chain design, not encrypted contract state.
- We do not create markets. We mirror existing Polymarket markets via their public API (market list, prices, resolution status).
- The pool is ours, separate from Polymarket's, and private.
- Resolution comes from Polymarket's own outcome, so we do not need an AI oracle quorum.

### Pool design: parimutuel, not an AMM

- All YES money and all NO money go into per-market pots.
- After Polymarket resolves, winners split the total pot pro rata to their stake.
- Payout = stake x (total pot / winning side pot), minus any fee.
- Why this fits:
  - No continuous price, so no price-probe side channel.
  - No USD peg needed. ZEC volatility does not matter because payouts are relative shares.
  - No house bankroll that can get wiped out.
- Polymarket's live price is shown as a public reference line. Our own pot sizes stay hidden until the market closes.

---

## 3. How it works (user flow)

No accounts, no login, no Privy, no wallet-connect.

1. **Browse** mirrored markets. No signup.
2. **Place a bet**: pick market, side, chip size. The browser generates a random secret and a commitment (hash of side + secret). The user saves a receipt code and provides a fresh shielded address for payout.
3. **Pay** from any Zcash wallet (Zashi, Ywallet, etc.) to the market's single pot address. A payment request QR carries the memo (commitment + return address). The pot address is the same for YES and NO so the address never leaks the side.
4. **Confirm**: the coordinator sees the deposit, waits for confirmations, and returns a signed receipt.
5. **Reveal** after the market closes: the browser submits side + secret. The coordinator checks it against the stored commitment.
6. **Resolve and payout**: Polymarket resolves. Winners are paid by shielded send to their return address, batched and delayed. Users check status with their receipt code.

Lost receipt code means lost ability to reveal. The UI must warn loudly and let users export a backup.

---

## 4. Key decisions made so far

| Decision        | Choice                                                                                       | Reason                                                                              |
| --------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Smart contracts | None                                                                                         | Zcash base layer has no EVM-style contracts. Logic lives in the coordinator backend |
| Login / wallet  | No Privy, no login                                                                           | Privy is for EVM/Solana and ties a real identity to the user, which breaks privacy  |
| Wallet approach | Pay from any Zcash wallet (Option A). In-browser wallet is a stretch                         | Simplest, least build risk                                                          |
| Network         | Testnet                                                                                      | Free test ZEC, no real-money betting, no legal grey area                            |
| Mainnet use     | Only a shielded wallet to receive the prize                                                  | Prizes are paid in ZEC to a shielded address at submission                          |
| Pool type       | Parimutuel                                                                                   | See section 2                                                                       |
| Resolution      | Mirror Polymarket's result                                                                   | Removes oracle work. Void or 50/50 means refunds                                    |
| Backend         | One TypeScript service (Fastify or Hono)                                                     | Small, familiar, fast to build                                                      |
| Database        | SQLite on the VM                                                                             | 2 GB RAM VM, no Docker, no third party holding bet data                             |
| Hosting         | Azure VM, Node + pm2, Caddy for HTTPS                                                        | Already available. No Docker                                                        |
| Frontend        | Next.js, Tailwind, shadcn/ui, Framer Motion                                                  | Our strongest area                                                                  |
| Zcash code      | TypeScript first (CLI or wallet service plus public lightwalletd), small Rust only if needed | Time. Rust only if TS cannot do something                                           |

---

## 5. Privacy and trust model

Three watchers: the public chain, the network/app layer, and our own coordinator. The coordinator is the hard one because it can read incoming memos and holds the spending key.

### Leak map and fixes

| Leak                      | How it happens                       | Fix                                                                               |
| ------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| Operator sees side        | Side in plaintext memo               | Commit-reveal: memo has only a hash of side + secret                              |
| Operator sees size        | Decrypts every incoming note         | Fixed chip sizes                                                                  |
| Deposit linked to payout  | Amounts and timing match             | Fresh payout address, batching, random delays, split payouts                      |
| Operator steals pot       | One party holds spending key         | Stretch: TEE or FROST threshold custody                                           |
| Operator lies about tally | Nobody can check                     | Signed receipts, Merkle root of commitments, published totals and formula         |
| Transparent address leak  | Deposit from a t-address or exchange | Shielded-only deposits, warn in UI                                                |
| Network leak              | IP logs, per-market Polymarket calls | Serve cached market list from our backend, no analytics, no IP logs, optional Tor |
| Live pot sizes            | Pot growth reveals bet sizes         | Hide pots until close                                                             |
| Memo size patterns        | Different lengths stand out          | Pad all memos to the same size                                                    |

### Honest trust statement (goes in the README)

The chain sees nothing about who bet what. The coordinator sees deposits and, after reveal, sides. Bets are not tied to real identities. We state this plainly and show the mitigations instead of claiming "fully private".

### Verifiability instead of contracts

- Signed receipt per bet.
- Merkle root of all commitments published at close.
- Pot totals and the payout formula published at settlement.
- Optional: publish the pot address incoming viewing key after settlement for full audit (reveals amounts and sides, not identities). Decide as a stated policy.
- Void or 50/50 Polymarket outcome: everyone refunded.

---

## 6. Stretch options (pick one later, or none)

1. **Commit-reveal on the side**: this is core, already in the MVP.
2. **TEE coordinator**: keys sealed in an enclave so even we cannot read bets or move funds. Strongest privacy, heaviest setup, trusts hardware. A normal Azure VM has no enclave. Azure sells confidential VM sizes, but even then the admin with SSH can read memory unless the image is locked down with attestation. A managed TEE platform is the alternative. Check current availability before committing.
3. **FROST threshold custody**: spending key split across signers. Stops theft, does not hide bets from signers. Check tooling maturity first.

Decision deferred. Pick only after the full flow works once.

---

## 7. Risks

- **Zcash tooling is the main schedule risk.** Day-3 gate exists for this (see plan.md).
- **AI is weakest on Zcash libraries.** It may invent API calls. Verify against real docs and run everything on testnet immediately.
- **Not trustless.** There is a coordinator. Handle with honest threat model and verifiability.
- **Legal.** It is effectively a betting pool. Keep it clearly labeled as a testnet prototype. Do not use Polymarket branding. Say "mirrors public market data".
- **Competition.** Others may have a similar private-market idea. Differentiators are execution quality, the Polymarket mirror, and the threat model write-up.
- **Own server logs are a leak.** No IP logging, no plaintext memo or commitment logs.
- **Polymarket edge cases.** Disputed, delayed or voided resolutions.
- **ZEC price risk** between submission and Nov 23 payout (prizes in ZEC).

---

## 8. Open questions

- Rust comfort level vs JS/TS wallet library: decided by the day-3 gate.
- Which stretch option: TEE or FROST or neither.
- Whether to publish the viewing key after settlement as an audit policy.
- Which chip sizes to use (draft: 1, 5, 10 test ZEC).
- Whether to do the in-browser wallet (Option B) at all.

---

## 9. Links and contacts

- Hackathon site: https://thezecathon.com
- Help: bladet928@gmail.com
- Resources page on the hackathon site: use it to get current testnet faucet, lightwalletd endpoints and developer docs.
