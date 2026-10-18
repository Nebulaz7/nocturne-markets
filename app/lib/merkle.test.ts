import assert from "assert";
import { computeMerkleRootClient, generateMerkleProof, verifyMerkleProof } from "./merkle.ts";
import { computeMerkleRoot } from "../../packages/shared/src/memo.ts";

async function runTests() {
  console.log("=== Testing Browser Merkle Engine & Proof Verifier (app/lib/merkle.ts) ===\n");

  // Sample commitment hashes (32 bytes = 64 hex characters)
  const testLeaves = [
    "c62f4f536321e090f9dc806c79ebe9c213836e7fb8efa2d204f143537208b9c6",
    "228a17492c393053ef9c1b4c20749646564bda9decd170c5bcad6fc0feb6db61",
    "af0ff130e6d59b1f688d833cbff8a6186aeb2e87917a6b14cbdf955fcd5e3764",
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
  ];

  console.log("1. Testing mathematical equivalence with packages/shared computeMerkleRoot()...");
  for (let count of [0, 1, 2, 3, 4, 5]) {
    const subset = testLeaves.slice(0, count);
    const expectedRoot = computeMerkleRoot(subset);
    const clientRoot = await computeMerkleRootClient(subset);

    assert.strictEqual(
      clientRoot,
      expectedRoot,
      `Client Merkle root must match for ${count} leaves`
    );
  }
  console.log("   ✔ All tree sizes (0, 1, 2, 3, 4, 5 leaves) produce identical Merkle roots.\n");

  console.log("2. Testing Merkle proof generation and verification for every leaf in a 5-leaf tree...");
  const root5 = await computeMerkleRootClient(testLeaves);

  for (let i = 0; i < testLeaves.length; i++) {
    const target = testLeaves[i];
    const proof = await generateMerkleProof(testLeaves, target, root5);

    assert.ok(proof, `Proof should be generated for leaf #${i}`);
    assert.strictEqual(proof.leafIndex, i);
    assert.strictEqual(proof.totalLeaves, 5);
    assert.strictEqual(proof.isValid, true);
    assert.strictEqual(proof.computedRoot, root5);

    // Verify independently using verifyMerkleProof
    const isVerified = await verifyMerkleProof(target, proof.steps, root5);
    assert.strictEqual(isVerified, true, `Proof verification failed for leaf #${i}`);
  }
  console.log("   ✔ All 5 leaves generated valid inclusion proofs that verify against the root.\n");

  console.log("3. Testing tamper rejection...");
  const validProof = await generateMerkleProof(testLeaves, testLeaves[0], root5);
  assert.ok(validProof);

  // Tampered leaf
  const fakeLeaf = "0000000000000000000000000000000000000000000000000000000000000000";
  const fakeLeafVerified = await verifyMerkleProof(fakeLeaf, validProof.steps, root5);
  assert.strictEqual(fakeLeafVerified, false, "Tampered leaf must be rejected");

  // Tampered expected root
  const fakeRoot = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const fakeRootVerified = await verifyMerkleProof(testLeaves[0], validProof.steps, fakeRoot);
  assert.strictEqual(fakeRootVerified, false, "Tampered root must be rejected");

  // Tampered sibling in proof step
  const tamperedSteps = JSON.parse(JSON.stringify(validProof.steps));
  tamperedSteps[0].sibling = fakeRoot;
  const tamperedStepVerified = await verifyMerkleProof(testLeaves[0], tamperedSteps, root5);
  assert.strictEqual(tamperedStepVerified, false, "Tampered sibling step must be rejected");

  // Non-existent leaf in tree
  const nonExistentProof = await generateMerkleProof(testLeaves, fakeLeaf);
  assert.strictEqual(nonExistentProof, null, "Non-existent leaf must return null");

  console.log("   ✔ All tamper attempts (fake leaf, fake root, tampered step, missing leaf) correctly rejected.\n");

  console.log(">>> ALL BROWSER MERKLE TESTS PASSED SUCCESSFULLY! <<<\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
