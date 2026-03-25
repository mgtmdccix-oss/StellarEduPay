# StellarEduPay

A decentralized school fee payment system built on the Stellar blockchain. Parents pay school fees digitally; every transaction is recorded transparently and immutably on-chain — eliminating manual reconciliation, reducing fraud, and giving schools and parents instant, verifiable proof of payment.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Future Scope](#future-scope)

---

## How It Works

1. **Admin creates a fee structure** for each class (`POST /api/fees`)
2. **Admin registers students** — fee is auto-assigned from the class fee structure (`POST /api/students`)
3. **Parent requests payment instructions** — receives the school wallet address, memo (student ID), and accepted assets (`GET /api/payments/instructions/:studentId`)
4. **Parent sends XLM or USDC** to the school wallet with the student ID as the memo field
5. **Admin syncs the ledger** — backend queries Horizon, matches memos to students, validates amounts, and records payments (`POST /api/payments/sync`)
6. **Payment is confirmed** — student's `feePaid` status updates; transaction hash is stored for audit

---

## Project Structure

```
StellarEduPay/
├── backend/
│   ├── .env.example                     # Required env vars template
│   └── src/
│       ├── app.js                       # Express app entry point
│       ├── config/
│       │   ├── index.js                 # Env var validation and export
│       │   └── stellarConfig.js         # Horizon server, accepted assets
│       ├── controllers/                 # Route handlers
│       ├── middleware/
│       │   ├── idempotency.js           # Idempotency-Key enforcement
│       │   └── validate.js              # Request body/param validation
│       ├── models/                      # Mongoose schemas
│       ├── routes/                      # Express routers
│       └── services/
│           ├── stellarService.js        # Ledger sync, tx verification, fee validation
│           └── transactionService.js    # Background polling
├── frontend/
│   ├── .env.example
│   └── src/
│       ├── components/
│       ├── pages/
│       └── services/api.js              # Axios API client
├── tests/
│   ├── payment.test.js                  # API integration tests
│   └── stellar.test.js                  # Stellar service unit tests
├── scripts/
│   └── create-school-wallet.js          # Keypair generator
├── docs/
│   ├── architecture.md                  # System design and data flow
│   ├── api-spec.md                      # Full API reference
│   └── stellar-integration.md           # Stellar-specific details
└── docker-compose.yml
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Stellar Network (Testnet / Mainnet) |
| Backend | Node.js 18+, Express, Mongoose |
| Database | MongoDB 7 |
| Frontend | Next.js 14 (React 18) |
| Testing | Jest, Supertest |
| DevOps | Docker, Docker Compose |

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB running locally or a [MongoDB Atlas](https://www.mongodb.com/atlas) connection string
- A Stellar wallet — generate one with the script below

### 1. Clone the repo

```bash
git clone <repo-url>
cd StellarEduPay
```

### 2. Generate a school wallet

```bash
node scripts/create-school-wallet.js
```

This prints a new Stellar keypair. Copy the **public key** — this is your `SCHOOL_WALLET_ADDRESS`. Keep the secret key offline; the backend never needs it.

To fund the wallet on testnet:

```bash
curl "https://friendbot.stellar.org?addr=<YOUR_PUBLIC_KEY>"
```

### 3. Configure environment variables

**`backend/.env`** (copy from `backend/.env.example`):

```env
MONGO_URI=mongodb://localhost:27017/stellaredupay
STELLAR_NETWORK=testnet
SCHOOL_WALLET_ADDRESS=<your_stellar_public_key>
PORT=5000
```

**`frontend/.env.local`** (copy from `frontend/.env.example`):

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 4. Install dependencies and run locally

```bash
# Backend
cd backend
npm install
npm run dev        # starts on http://localhost:5000

# Frontend — open a second terminal
cd frontend
npm install
npm run dev        # starts on http://localhost:3000
```

### 5. Run with Docker (alternative)

Requires Docker and Docker Compose.

```bash
SCHOOL_WALLET_ADDRESS=<your_public_key> docker-compose up
```

Services started:
- Backend → http://localhost:5000
- Frontend → http://localhost:3000
- MongoDB → localhost:27017

### 6. Seed initial data (optional)

```bash
# Create a fee structure for a class
curl -X POST http://localhost:5000/api/fees \
  -H "Content-Type: application/json" \
  -d '{"className": "5A", "feeAmount": 250, "academicYear": "2026"}'

# Register a student (fee auto-assigned from class structure)
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{"studentId": "STU001", "name": "Alice Johnson", "class": "5A"}'

# Get payment instructions for the student
curl http://localhost:5000/api/payments/instructions/STU001
```

### 7. Verify everything is running

```bash
curl http://localhost:5000/health
# → {"status":"ok"}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `SCHOOL_WALLET_ADDRESS` | Yes | — | School's Stellar public key |
| `STELLAR_NETWORK` | No | `testnet` | `testnet` or `mainnet` |
| `PORT` | No | `5000` | Backend HTTP port |
| `HORIZON_URL` | No | Auto-selected | Override Stellar Horizon API URL |
| `USDC_ISSUER` | No | Auto-selected | USDC issuer address (testnet/mainnet defaults applied) |
| `CONFIRMATION_THRESHOLD` | No | `2` | Ledger confirmations required before finalizing a payment |
| `POLL_INTERVAL_MS` | No | `30000` | Background sync interval in milliseconds |
| `NEXT_PUBLIC_API_URL` | Yes (frontend) | — | Backend API base URL |

---

## API Reference

> POST endpoints that create records require an `Idempotency-Key` header (any unique string, e.g. a UUID). See [docs/api-spec.md](docs/api-spec.md) for details.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/students` | Register a student |
| GET | `/api/students` | List all students |
| GET | `/api/students/:studentId` | Get a student |
| POST | `/api/fees` | Create / update a fee structure |
| GET | `/api/fees` | List all fee structures |
| GET | `/api/fees/:className` | Get fee for a class |
| DELETE | `/api/fees/:className` | Deactivate a fee structure |
| GET | `/api/payments/instructions/:studentId` | Get wallet address + memo |
| GET | `/api/payments/accepted-assets` | List accepted assets (XLM, USDC) |
| POST | `/api/payments/intent` | Create a payment intent *(requires Idempotency-Key)* |
| POST | `/api/payments/verify` | Verify a transaction by hash *(requires Idempotency-Key)* |
| POST | `/api/payments/sync` | Sync latest payments from ledger |
| POST | `/api/payments/finalize` | Finalize pending confirmed payments |
| GET | `/api/payments/:studentId` | Get payment history for a student |
| GET | `/api/payments/balance/:studentId` | Get student's cumulative balance |
| GET | `/api/payments/overpayments` | List all overpaid transactions |
| GET | `/api/payments/suspicious` | List flagged suspicious payments |
| GET | `/api/payments/pending` | List payments pending confirmation |

See [docs/api-spec.md](docs/api-spec.md) for full request/response examples.

---

## Running Tests

Tests mock both the Stellar SDK and MongoDB — no real network or database required.

```bash
# From the project root
npm install
npm test
```

Expected output:

```
PASS tests/stellar.test.js
PASS tests/payment.test.js

Test Suites: 2 passed, 2 total
Tests:       33 passed, 33 total
```

**Test coverage:**
- `stellar.test.js` — unit tests for `stellarService`: asset detection, fee validation, amount normalization, transaction verification, sync
- `payment.test.js` — API integration tests: full payment flow, all endpoints, idempotency, error handling

---

## Documentation

| Doc | Description |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System design, component overview, data flow |
| [docs/api-spec.md](docs/api-spec.md) | Full API reference with request/response examples |
| [docs/stellar-integration.md](docs/stellar-integration.md) | Memo field, accepted assets, fee validation, testnet setup |

---

## Future Scope

- **Hostel & exam fee payments** — separate fee categories per student
- **Scholarship disbursement** — outbound XLM payments to student wallets
- **Donation tracking** — transparent fund collection for school projects
- **Multi-school support** — isolated wallet and student records per institution
- **Email/SMS notifications** — alert parents when payment is confirmed on-chain

---

## License

MIT

---

## Contributing
Please read [](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.
