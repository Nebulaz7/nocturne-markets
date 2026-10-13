#!/usr/bin/env bash
# Nocturne Markets: Setup Zcash VM environment on Azure (nocturne)
set -euo pipefail

echo "=== Setting up Nocturne Zcash Environment on VM ==="

# 1. Verify swap is active (2 GB swap on 1 GiB RAM VM)
SWAP_SIZE=$(free -m | awk '/Swap:/ {print $2}')
if [ "$SWAP_SIZE" -lt 1000 ]; then
  echo "[!] Swap is less than 1 GB. Setting up 2 GB swapfile..."
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
echo "[OK] Swap active: ${SWAP_SIZE} MB"

# 2. Install essential system dependencies
sudo apt-get update -y
sudo apt-get install -y build-essential libsqlite3-dev protobuf-compiler curl jq

# 3. Create wallet and log directories
mkdir -p "$HOME/.zcash-testnet-wallet"
mkdir -p "$HOME/nocturne-data"
mkdir -p "/tmp"

# 4. Birthday Guardrail for Zingo Wallet Initialization
# Fetch current chain tip to avoid scanning from genesis on 1 GiB VM
SERVER_URL="https://testnet.zec.rocks:443"
BACKUP_SERVER_URL="https://zaino.testnet.unsafe.zec.rocks:443"

echo "[*] Querying current testnet chain tip..."
CURRENT_HEIGHT=$(curl -s --connect-timeout 5 https://testnet.zec.rocks/api/v1/network 2>/dev/null | jq -r '.height // empty' || true)

if [ -z "$CURRENT_HEIGHT" ]; then
  # Fallback to height from zingo-cli if already initialized
  CURRENT_HEIGHT=$(zingo-cli --chain testnet --server "$SERVER_URL" --nosync height 2>/dev/null || echo "4498800")
fi

SAFE_BIRTHDAY=$(( CURRENT_HEIGHT > 100 ? CURRENT_HEIGHT - 100 : CURRENT_HEIGHT ))
echo "[OK] Safe birthday height computed: $SAFE_BIRTHDAY (Current tip: $CURRENT_HEIGHT)"

echo "[OK] VM environment and birthday guardrail ready for Nocturne Zcash engine."
