import type { PreparedBetReceipt } from "./bet_builder";
export type { PreparedBetReceipt };

const STORAGE_KEY = "nocturne_private_vault_v1";

/**
 * Retrieves all private bet receipts from browser localStorage.
 * Guaranteed zero network calls.
 */
export function getBetReceipts(): PreparedBetReceipt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Retrieves a single private bet receipt by commitment prefix ID.
 */
export function getBetReceipt(id: string): PreparedBetReceipt | null {
  const receipts = getBetReceipts();
  return receipts.find((r) => r.id === id || r.commitment === id) || null;
}

/**
 * Saves a newly constructed bet receipt to the private vault.
 */
export function saveBetReceipt(receipt: PreparedBetReceipt): void {
  if (typeof window === "undefined") return;
  try {
    const receipts = getBetReceipts();
    const filtered = receipts.filter((r) => r.id !== receipt.id && r.commitment !== receipt.commitment);
    const updated = [receipt, ...filtered];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom event so listeners (e.g. badge counters) can update reactively
    window.dispatchEvent(new Event("nocturne-vault-updated"));
  } catch (err) {
    console.warn("[Vault] Failed to save receipt to localStorage:", err);
  }
}

/**
 * Updates the status of an existing bet receipt.
 */
export function updateBetReceiptStatus(
  id: string,
  status: PreparedBetReceipt["status"]
): void {
  if (typeof window === "undefined") return;
  try {
    const receipts = getBetReceipts();
    const updated = receipts.map((r) => {
      if (r.id === id || r.commitment === id) {
        return { ...r, status };
      }
      return r;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("nocturne-vault-updated"));
  } catch (err) {
    console.warn("[Vault] Failed to update receipt in localStorage:", err);
  }
}

/**
 * Removes a receipt from the local vault.
 */
export function deleteBetReceipt(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const receipts = getBetReceipts();
    const updated = receipts.filter((r) => r.id !== id && r.commitment !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("nocturne-vault-updated"));
  } catch (err) {
    console.warn("[Vault] Failed to delete receipt from localStorage:", err);
  }
}

/**
 * Exports all local vault receipts as a JSON string for offline backup.
 */
export function exportVaultJson(): string {
  const receipts = getBetReceipts();
  return JSON.stringify(receipts, null, 2);
}

/**
 * Imports bet receipts from a JSON backup string into the local vault.
 */
export function importVaultJson(jsonStr: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return 0;
    const current = getBetReceipts();
    const existingIds = new Set(current.map((r) => r.id || r.commitment));
    const newItems: PreparedBetReceipt[] = parsed.filter(
      (r: any) => r && (r.id || r.commitment) && !existingIds.has(r.id || r.commitment)
    );
    const merged = [...newItems, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event("nocturne-vault-updated"));
    return newItems.length;
  } catch (err) {
    console.warn("[Vault] Failed to import vault JSON:", err);
    return 0;
  }
}

/**
 * Clears all receipts from the local vault.
 */
export function clearVault(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("nocturne-vault-updated"));
}

