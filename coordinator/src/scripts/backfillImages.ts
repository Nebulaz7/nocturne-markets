import { CoordinatorDatabase } from "../db/index.ts";
import { COORDINATOR_CONFIG } from "../config.ts";

async function backfillImages() {
  console.log("[Backfill] Connecting to database:", COORDINATOR_CONFIG.dbPath);
  const db = new CoordinatorDatabase(COORDINATOR_CONFIG.dbPath);

  console.log("[Backfill] Fetching active events from Polymarket Gamma API...");
  let page = 0;
  const limit = 100;
  let totalUpdated = 0;

  // Fetch top 3 pages (300 events, thousands of markets)
  for (page = 0; page < 3; page++) {
    const offset = page * limit;
    const url = `https://gamma-api.polymarket.com/events?limit=${limit}&offset=${offset}&closed=false`;
    console.log(`[Backfill] Requesting ${url}...`);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      });
      if (!res.ok) {
        console.warn(`[Backfill] API returned ${res.status}: ${res.statusText}`);
        break;
      }
      const events: any[] = await res.json();
      if (!events || events.length === 0) {
        console.log("[Backfill] No more events returned.");
        break;
      }

      console.log(`[Backfill] Processing ${events.length} events from page ${page + 1}...`);

      const updateStmt = (db as any).db.prepare(`
        UPDATE markets 
        SET image = COALESCE(?, image),
            icon = COALESCE(?, icon)
        WHERE id = ? OR polymarket_id = ? OR market_slug = ?
      `);

      const updateEventStmt = (db as any).db.prepare(`
        UPDATE markets 
        SET image = COALESCE(?, image),
            icon = COALESCE(?, icon)
        WHERE event_slug = ?
      `);

      for (const evt of events) {
        const evtImage = evt.image || null;
        const evtIcon = evt.icon || evt.image || null;

        if (evt.slug && (evtImage || evtIcon)) {
          updateEventStmt.run(evtImage, evtIcon, evt.slug);
        }

        if (Array.isArray(evt.markets)) {
          for (const m of evt.markets) {
            const mImage = m.image || evtImage || null;
            const mIcon = m.icon || m.image || evtIcon || evtImage || null;
            if (mImage || mIcon) {
              const res = updateStmt.run(mImage, mIcon, m.id, m.id, m.slug || null);
              if (res.changes > 0) {
                totalUpdated += res.changes;
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error(`[Backfill] Error on page ${page}:`, err.message);
      break;
    }
  }

  console.log(`[Backfill] Successfully backfilled image/icon for ${totalUpdated} market records!`);
  db.close();
}

backfillImages().catch((err) => {
  console.error("[Backfill] Fatal error:", err);
  process.exit(1);
});
