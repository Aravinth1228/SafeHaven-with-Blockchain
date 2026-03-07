# Contract Deployment Guide

## Error: Invalid Project ID

The error occurs because Infura API key is missing or invalid.

## Solution 1: Use Public RPC (Easiest) ⭐

The hardhat config has been updated to use public RPC automatically!

Just run:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

It will use: `https://rpc.sepolia.org` (no API key needed!)

---

## Solution 2: Get Infura Project ID (Optional)

If you want to use Infura:

### Step 1: Create Infura Account
```
1. Go to: https://app.infura.io/
2. Sign up / Login
3. Click "Create New Project"
4. Name: "SafeHaven"
5. Click "Create"
```

### Step 2: Get Project ID
```
1. Click your project
2. Go to "Settings" tab
3. Copy "Project ID"
```

### Step 3: Create .env file
```bash
cd contracts
nano .env
```

Add this:
```env
INFURA_PROJECT_ID=your_copied_project_id
ADMIN_PRIVATE_KEY=your_wallet_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

### Step 4: Deploy
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## Solution 3: Use Alternative Public RPC

Edit `hardhat.config.js`:
```javascript
sepolia: {
  url: "https://rpc.sepolia.org",  // Public RPC
  // OR
  url: "https://ethereum-sepolia-rpc.publicnode.com",  // Another option
  accounts: ["your_private_key"],
  chainId: 11155111
}
```

---

## Get Test ETH

Before deploying, you need Sepolia ETH for gas!

### Faucets:
1. **Alchemy Faucet**: https://sepoliafaucet.com/
2. **Infura Faucet**: https://www.infura.io/faucet/sepolia
3. **Google Cloud Faucet**: https://cloud.google.com/application/web3/faucet/ethereum/sepolia

### How to Use:
```
1. Connect your MetaMask wallet
2. Paste your wallet address
3. Complete captcha / verification
4. Click "Send"
5. Wait 1-2 minutes
6. Check balance in MetaMask
```

---

## Deploy Contract

### With Public RPC (Recommended):
```bash
cd contracts

# No .env needed!
npx hardhat run scripts/deploy.js --network sepolia
```

### With Infura:
```bash
cd contracts

# Create .env first
echo "INFURA_PROJECT_ID=your_id" > .env
echo "ADMIN_PRIVATE_KEY=your_key" >> .env

# Deploy
npx hardhat run scripts/deploy.js --network sepolia
```

---

## Expected Output

```
🚀 Deploying SafeHeaven ERC-2771 Contracts...
Deploying TrustedForwarder...
✅ TrustedForwarder deployed to: 0x1234...5678
Deploying TouristSafetyERC2771...
✅ TouristSafetyERC2771 deployed to: 0xabcd...efgh

📝 Contract Addresses:
TrustedForwarder: 0x1234...5678
TouristSafety: 0xabcd...efgh

💾 Saving to deployments.json...
✅ Deployment complete!
```

---

## Update Frontend

After deployment, update `.env` in root folder:

```env
VITE_CONTRACT_ADDRESS=0xabcd...efgh
VITE_FORWARDER_ADDRESS=0x1234...5678
```

Then restart frontend:
```bash
npm run dev
```

---

## Verify Contract (Optional)

```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS FORWARDER_ADDRESS
```

---

## Troubleshooting

### "Invalid project id"
- Use public RPC: `https://rpc.sepolia.org`
- Or get valid Infura project ID

### "Insufficient funds"
- Get test ETH from faucet
- Check wallet balance: https://sepolia.etherscan.io/

### "Nonce too low"
- Wait for previous transaction to confirm
- Or restart MetaMask

### "Gas price too low"
```javascript
// Add to hardhat.config.js
sepolia: {
  gasPrice: 20000000000, // 20 gwei
}
```

---

## Quick Fix (Already Applied!)

The hardhat config has been updated to use public RPC automatically!

Just run:
```bash
cd contracts
npx hardhat run scripts/deploy.js --network sepolia
```

No Infura key needed! 🎉

---

## Summary

**Before:**
```
❌ Invalid project id
```

**After:**
```
✅ Uses public RPC automatically
✅ No API key required
✅ Just deploy!
```

**Command:**
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

**Public RPC will be used automatically!** 🚀
