export const ZCASH_CONFIG = {
  network: "testnet",
  server: "https://testnet.zec.rocks:443",
  backupServer: "https://zaino.testnet.unsafe.zec.rocks:443",
  // Standard ZIP-317 conventional marginal fee
  baseFeeZats: 10000, // 0.0001 ZEC
  // Fixed bet chip sizes in Zatoshis
  chipSizesZats: {
    "1_ZEC": 100_000_000,
    "5_ZEC": 500_000_000,
    "10_ZEC": 1_000_000_000,
  },
  // Maximum unencoded memo size defined in protocol
  maxMemoBytes: 512,
  // Single pot address placeholder (populated dynamically)
  dataDir: "./.zcash-testnet-wallet",
};
