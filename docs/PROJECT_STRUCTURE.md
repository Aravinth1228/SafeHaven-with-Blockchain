# SafeHaven Project Structure

## Root Directory
```
SafeHaven-with-Blockchain/
├── src/                    # Frontend React/TypeScript code
├── server/                 # Backend Node.js API
├── contracts/              # Solidity smart contracts
├── scripts/                # Utility scripts
├── docs/                   # Documentation
├── public/                 # Static assets
└── [config files]          # Project configuration
```

## Frontend (src/)
```
src/
├── components/             # React components
│   ├── ui/                # Shadcn UI components
│   └── blockchain/        # Blockchain-specific components
├── contexts/              # React context providers
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── api.ts            # API client
│   └── contract/         # Contract interaction
├── pages/                 # Page components
└── types/                 # TypeScript type definitions
```

## Backend (server/)
```
server/
├── blockchain/            # Blockchain relayer & services
├── models/                # MongoDB models
├── routes/                # API routes
├── scripts/               # Deployment & setup scripts
├── tests/                 # Test scripts
├── utils/                 # Utility functions
└── index.js              # Main server entry point
```

## Scripts
- `scripts/clear-user-data.js` - Clear user data from localStorage
- `scripts/reset-everything.js` - Full system reset
- `server/scripts/add-relayer-as-admin.js` - Add relayer as admin
- `server/scripts/clear-db.js` - Clear MongoDB
- `server/scripts/drop-database.js` - Drop database

## Tests
- `server/tests/test-forwarder.js` - Test forwarder contract
- `server/tests/test-registration-flow.js` - Test registration
- `server/tests/verify-forwarder.js` - Verify forwarder setup

## Configuration Files
- `package.json` - Frontend dependencies
- `server/package.json` - Backend dependencies
- `vite.config.ts` - Vite build config
- `tailwind.config.ts` - Tailwind CSS config
- `tsconfig.json` - TypeScript config
- `.env` - Environment variables
