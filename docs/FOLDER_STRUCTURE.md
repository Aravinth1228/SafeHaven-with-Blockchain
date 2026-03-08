# 🏗️ SafeHaven - Organized Project Structure

## 📁 Complete Folder Structure

```
SafeHaven-with-Blockchain/
│
├── 📂 src/                          # Frontend (React + TypeScript + Vite)
│   ├── components/                  # React components
│   │   ├── ui/                     # Shadcn UI components (buttons, cards, etc.)
│   │   └── blockchain/             # Blockchain-specific components
│   ├── contexts/                    # React Context providers
│   │   ├── AuthContext.tsx         # Authentication & user management
│   │   └── WalletContext.tsx       # MetaMask wallet connection
│   ├── hooks/                       # Custom React hooks
│   │   ├── useBlockchain.ts        # Blockchain interaction hooks
│   │   ├── useContract.ts          # Smart contract hooks
│   │   └── useLocationUpdate.ts    # Location tracking hooks
│   ├── lib/                         # Utility libraries
│   │   ├── api.ts                  # API client configuration
│   │   └── contract/               # Contract interaction services
│   ├── pages/                       # Page components
│   │   ├── Index.tsx               # Home page
│   │   ├── Dashboard.tsx           # User dashboard
│   │   ├── AdminDashboard.tsx      # Admin dashboard
│   │   ├── SignUp.tsx              # Registration page
│   │   └── Login.tsx               # Login page
│   └── types/                       # TypeScript type definitions
│
├── 📂 server/                       # Backend (Node.js + Express + MongoDB)
│   ├── blockchain/                  # Blockchain integration
│   │   ├── relayer.js              # Transaction relayer (ERC-2771)
│   │   └── services/               # Blockchain services
│   ├── models/                      # MongoDB schemas
│   │   └── index.js                # All database models
│   ├── routes/                      # API routes
│   │   ├── blockchain.js           # Blockchain meta-transaction routes
│   │   └── blockchain-danger-zones.js
│   ├── scripts/                     # Deployment & setup scripts
│   │   ├── add-relayer-as-admin.js
│   │   ├── clear-db.js
│   │   └── drop-database.js
│   ├── tests/                       # Test scripts
│   │   ├── test-forwarder.js
│   │   ├── test-registration-flow.js
│   │   └── verify-forwarder.js
│   ├── utils/                       # Utility functions
│   │   ├── check-abi.js
│   │   ├── decode-data.js
│   │   └── simulate-call.js
│   └── index.js                     # Main server entry point
│
├── 📂 contracts/                    # Solidity Smart Contracts
│   └── [Smart contract files]
│
├── 📂 scripts/                      # Root utility scripts
│   ├── clear-user-data.js          # Clear browser localStorage
│   └── reset-everything.js         # Full system reset
│
├── 📂 docs/                         # Documentation
│   ├── PROJECT_STRUCTURE.md        # This file
│   └── [Other documentation]
│
├── 📂 public/                       # Static assets
│   └── [Images, icons, etc.]
│
└── [Configuration Files]
    ├── package.json                # Frontend dependencies
    ├── server/package.json         # Backend dependencies
    ├── vite.config.ts              # Vite build configuration
    ├── tailwind.config.ts          # Tailwind CSS configuration
    ├── tsconfig.json               # TypeScript configuration
    ├── .env                        # Environment variables
    └── .gitignore                  # Git ignore rules
```

---

## 🎯 Key Directories

### Frontend (`src/`)
- **components/** - Reusable UI components
- **contexts/** - Global state management (Auth, Wallet)
- **hooks/** - Custom React hooks for blockchain & API
- **pages/** - Full page components (routes)
- **lib/** - API clients and utilities

### Backend (`server/`)
- **blockchain/** - Smart contract interaction
- **models/** - MongoDB database schemas
- **routes/** - Express API endpoints
- **scripts/** - One-time setup/maintenance scripts
- **tests/** - Testing scripts
- **utils/** - Helper functions

### Scripts
- **Root scripts/** - Frontend utilities
- **Server scripts/** - Backend utilities & deployment

---

## 🚀 Quick Start

### 1. Start Backend
```bash
cd server
npm run dev
```

### 2. Start Frontend
```bash
npm run dev
```

### 3. Access Application
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3000
- **Admin Dashboard**: http://localhost:8080/admin-login

---

## 📝 Common Tasks

### Clear User Data
```bash
node scripts/clear-user-data.js
```

### Clear Database
```bash
cd server
node scripts/clear-db.js
```

### Add Relayer as Admin
```bash
cd server
node scripts/add-relayer-as-admin.js
```

### Run Tests
```bash
cd server
node tests/test-forwarder.js
```

---

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Frontend dependencies & scripts |
| `server/package.json` | Backend dependencies & scripts |
| `vite.config.ts` | Vite bundler configuration |
| `tailwind.config.ts` | Tailwind CSS customization |
| `tsconfig.json` | TypeScript compiler options |
| `.env` | Environment variables (API URLs, keys) |
| `.gitignore` | Files to ignore in Git |

---

## 📊 Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Shadcn UI** - Component library
- **React Router** - Navigation
- **Ethers.js** - Blockchain interaction

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Ethers.js** - Blockchain interaction
- **Nodemon** - Auto-restart

### Blockchain
- **Solidity** - Smart contracts
- **Hardhat** - Development environment
- **OpenZeppelin** - Secure contracts
- **Sepolia Testnet** - Testing network

---

## 🎨 Code Organization Principles

1. **Separation of Concerns** - Frontend/Backend/Contracts separate
2. **Modular Structure** - Each feature in its own folder
3. **Clear Naming** - Descriptive file and folder names
4. **Documentation** - README files for complex sections
5. **Test Organization** - Tests grouped by feature

---

## 📞 Support

For questions or issues, refer to:
- Main README.md
- docs/ folder
- API documentation

---

**Last Updated**: 2026-03-08
**Version**: 1.0.0
