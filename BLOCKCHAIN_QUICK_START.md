# SafeHeaven Blockchain Quick Start

## Quick Setup (5 Minutes)

### 1. Install All Dependencies

```bash
# Root directory
npm install

# Server
cd server
npm install

# Contracts
cd ../contracts
npm install
cd ..
```

### 2. Start Local Blockchain (Hardhat Network)

```bash
cd contracts
npm run node
```

Keep this terminal open. The local blockchain runs at `http://127.0.0.1:8545`

### 3. Deploy Smart Contracts

Open a **new terminal**:

```bash
cd contracts
npm run deploy:local
```

This will:
- Deploy `TrustedForwarder` contract
- Deploy `TouristSafetyERC2771` contract
- Save deployment info to `server/blockchain-deployment.json`

### 4. Start Backend Server

Open a **new terminal**:

```bash
cd server
npm run dev
```

You should see:
```
✅ Blockchain Relayer initialized
⛓️  Blockchain: localhost (Chain ID: 31337)
📝 Contract: 0x...
```

### 5. Start Frontend

Open a **new terminal**:

```bash
npm run dev
```

### 6. Configure MetaMask

1. Open MetaMask
2. Add Network:
   - Network Name: Localhost 8545
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency Symbol: ETH
3. Import Account:
   - Copy a private key from Hardhat node output
   - Paste in MetaMask: Settings → Import Account

### 7. Test the Integration

1. Open frontend in browser
2. Connect wallet
3. Register as a tourist
4. Check backend logs for transaction confirmations

---

## Testing with Sepolia Testnet

### Prerequisites

1. Infura account (get project ID from https://infura.io)
2. Sepolia ETH (get from faucet: https://sepoliafaucet.com)

### Setup

1. Update `contracts/.env`:
   ```env
   ADMIN_PRIVATE_KEY=your_admin_wallet_private_key
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
   ```

2. Deploy to Sepolia:
   ```bash
   cd contracts
   npm run deploy:sepolia
   ```

3. Update frontend `.env`:
   ```env
   VITE_CONTRACT_ADDRESS=<deployed_contract_address>
   VITE_CHAIN_ID=11155111
   ```

4. Add Sepolia to MetaMask (automatically added when visiting faucet)

---

## Common Commands

```bash
# Compile contracts
cd contracts && npm run compile

# Run contract tests
cd contracts && npm test

# Deploy to local
cd contracts && npm run deploy:local

# Deploy to Sepolia
cd contracts && npm run deploy:sepolia

# Start local blockchain
cd contracts && npm run node

# Start server
cd server && npm run dev

# Start frontend
npm run dev
```

---

## Verify Deployment

Check `server/blockchain-deployment.json`:

```json
{
  "network": "localhost",
  "chainId": 31337,
  "contracts": {
    "TrustedForwarder": {
      "address": "0x..."
    },
    "TouristSafetyERC2771": {
      "address": "0x..."
    }
  }
}
```

---

## Test Accounts (Local Hardhat)

Hardhat provides 20 test accounts with 10000 ETH each:

```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
  Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
  Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

⚠️ **Never use these accounts on public networks!**

---

## Next Steps

1. ✅ Test user registration
2. ✅ Test status updates (Safe → Alert → Emergency)
3. ✅ Test location tracking
4. ✅ Create danger zones (admin only)
5. ✅ Test emergency alerts

For detailed usage, see [BLOCKCHAIN_INTEGRATION_GUIDE.md](./BLOCKCHAIN_INTEGRATION_GUIDE.md)
