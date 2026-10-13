#!/usr/bin/env bash
# Nocturne Markets: Setup Zcash VM environment on Azure (nocturne)
set -euo pipefail

echo "=== Setting up Nocturne Zcash Environment on VM ==="

# 1. Verify swap is active
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
sudo apt-get install -y build-essential libsqlite3-dev protobuf-compiler curl

# 3. Create wallet and log directories
mkdir -p "$HOME/.zcash-testnet-wallet"
mkdir -p "$HOME/nocturne-data"

echo "[OK] VM environment ready for Nocturne Zcash engine."
