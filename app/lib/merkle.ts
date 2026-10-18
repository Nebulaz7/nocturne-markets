import { hex, utf8 } from "@scure/base";

export interface MerkleProofStep {
  sibling: string; // 64-char hex
  position: "left" | "right";
  level: number;
}

export interface MerkleProofResult {
  isValid: boolean;
  leaf: string;
  leafIndex: number;
  totalLeaves: number;
  steps: MerkleProofStep[];
  computedRoot: string;
  expectedRoot?: string;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", data as any);
  return new Uint8Array(hash);
}

function leafToBytes(leaf: string): Uint8Array {
  const trimmed = leaf.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return hex.decode(trimmed);
  }
  return utf8.decode(trimmed);
}

/**
 * Computes a standard SHA-256 Merkle root from an array of hex leaves (commitments).
 * Duplicates odd leaf if odd number of elements per level.
 * 100% mathematical match to packages/shared/src/memo.ts computeMerkleRoot().
 */
export async function computeMerkleRootClient(leaves: string[]): Promise<string> {
  if (leaves.length === 0) {
    return "0".repeat(64);
  }

  let layer: Uint8Array[] = await Promise.all(
    leaves.map(async (leaf) => {
      const buf = leafToBytes(leaf);
      return sha256(buf);
    })
  );

  while (layer.length > 1) {
    if (layer.length % 2 === 1) {
      layer.push(layer[layer.length - 1]);
    }
    const nextLayer: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const combined = concatBytes(layer[i], layer[i + 1]);
      nextLayer.push(await sha256(combined));
    }
    layer = nextLayer;
  }

  return hex.encode(layer[0]);
}

/**
 * Generates an inclusion proof (audit path) for a target commitment leaf
 * within the given set of leaves.
 */
export async function generateMerkleProof(
  leaves: string[],
  targetLeaf: string,
  expectedRoot?: string
): Promise<MerkleProofResult | null> {
  if (leaves.length === 0) return null;

  const normalizedTarget = targetLeaf.toLowerCase().trim();
  const targetIndex = leaves.findIndex(
    (l) => l.toLowerCase().trim() === normalizedTarget
  );

  if (targetIndex === -1) {
    return null; // Leaf not found in this leaf set
  }

  let layer: Uint8Array[] = await Promise.all(
    leaves.map(async (leaf) => sha256(leafToBytes(leaf)))
  );

  let currentIndex = targetIndex;
  const steps: MerkleProofStep[] = [];
  let level = 0;

  while (layer.length > 1) {
    if (layer.length % 2 === 1) {
      layer.push(layer[layer.length - 1]);
    }

    const isLeft = currentIndex % 2 === 0;
    const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;

    steps.push({
      sibling: hex.encode(layer[siblingIndex]),
      position: isLeft ? "right" : "left",
      level,
    });

    const nextLayer: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const combined = concatBytes(layer[i], layer[i + 1]);
      nextLayer.push(await sha256(combined));
    }

    currentIndex = Math.floor(currentIndex / 2);
    layer = nextLayer;
    level++;
  }

  const computedRoot = hex.encode(layer[0]);
  const isValid = expectedRoot
    ? computedRoot.toLowerCase() === expectedRoot.toLowerCase().trim()
    : true;

  return {
    isValid,
    leaf: targetLeaf,
    leafIndex: targetIndex,
    totalLeaves: leaves.length,
    steps,
    computedRoot,
    expectedRoot,
  };
}

/**
 * Verifies a Merkle proof path against an expected root without rebuilding the full tree.
 */
export async function verifyMerkleProof(
  targetLeaf: string,
  steps: MerkleProofStep[],
  expectedRoot: string
): Promise<boolean> {
  if (!expectedRoot) return false;

  let current = await sha256(leafToBytes(targetLeaf));

  for (const step of steps) {
    const siblingBytes = hex.decode(step.sibling);
    const combined =
      step.position === "right"
        ? concatBytes(current, siblingBytes)
        : concatBytes(siblingBytes, current);
    current = await sha256(combined);
  }

  const finalRoot = hex.encode(current);
  return finalRoot.toLowerCase() === expectedRoot.toLowerCase().trim();
}
