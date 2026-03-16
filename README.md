# StellarEduPay

A decentralized school fee payment system built on the Stellar blockchain. StellarEduPay enables parents to pay school fees digitally while every transaction is recorded transparently and immutably on the blockchain — eliminating manual reconciliation, reducing fraud, and giving both schools and parents instant, verifiable proof of payment.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Features](#features)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [Future Scope](#future-scope)

---

## Overview

Traditional school payment systems rely on bank transfers, receipts, and manual bookkeeping — all of which are slow, error-prone, and difficult to audit. StellarEduPay replaces this with a blockchain-backed system where:

- Every payment is recorded on the Stellar ledger and cannot be altered
- Schools can verify payments instantly without waiting for bank confirmations
- Parents can independently confirm their payment using any Stellar blockchain explorer
- Student identification is embedded directly in the transaction via Stellar's memo field

---

## How It Works

### Step 1 — Student Registration
A school administrator registers a student with their name, student ID, class, and fee amount. This creates a record in the database.

### Step 2 — Payment Instruction Generation
When a parent wants to pay, they enter the student ID on the platform. The system returns:
- The school's Stellar wallet address
- The exact fee amount in XLM
- The student ID to use as the transaction memo

### Step 3 — Parent Sends Payment
The parent opens their Stellar wallet, sends the specified XLM amount to the school wallet, and includes the student ID as the memo field.

### Step 4 — Blockchain Transaction
The Stellar network processes and records the transaction on the ledger within seconds.

### Step 5 — Backend Verification
The backend queries the Stellar Horizon API, scans incoming transactions to the school wallet, reads the memo field, and matches it to a registered student.

### Step 6 — Payment Confirmation
Once a valid matching transaction is found:
- The transaction hash, amount, and timestamp are saved to the database
- The student's payment status is updated to **Paid**
- The admin dashboard reflects the change immediately

---

## Features

- **Memo-based student identification** — each Stellar transaction carries the student ID in the memo field, enabling automatic payment assignment
- **Instant blockchain verification** — payments settle on Stellar in seconds, far faster than traditional bank transfers
- **Immutable payment records** — blockchain transactions cannot be modified or deleted, providing permanent proof of payment
- **Manual sync + verify** — admins can trigger a ledger sync or verify a specific transaction hash on demand
- **Parent payment interface** — parents look up their student, get payment instructions, and view past transactions
- **Admin dashboard** — schools see all students, payment statuses, transaction hashes, and outstanding fees
- **Fraud prevention** — payments are publicly verifiable on the Stellar blockchain explorer

---

## Project Structure

```
StellarEduPay/
├── backend/
│   └── src/
│       ├── app.js                    # Express server entry point
│       ├── config/
│       │   └── stellarConfig.js      # Stellar SDK setup (testnet/mainnet)
│       ├── controllers/
│       │   ├── paymentController.js
│       │   └── studentController.js
│       ├── models/
│       │   ├── paymentModel.js       # Payment schema (txHash, amount, memo)
│       │   └── studentModel.js       # Student schema (ID, name, class, fee)
│       ├── routes/
│       │   ├── paymentRoutes.js
│       │   └── studentRoutes.js
│       └── services/
│           ├── stellarService.js     # Ledger sync + transaction verification
│           └── transactionService.js
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── PaymentForm.jsx       # Student lookup + payment instructions
│       │   └── TransactionCard.jsx
│       ├── pages/
│       │   ├── index.jsx             # Landing page
│       │   ├── pay-fees.jsx          # Parent payment page
│       │   └── dashboard.jsx         # Admin dashboard
│       └── services/
│           └── api.js                # Axios API client
├── tests/
│   ├── payment.test.js               # API endpoint tests
│   └── stellar.test.js               # Stellar service unit tests
├── scripts/
│   └── create-school-wallet.js       # Utility to generate a Stellar wallet
├── docs/
│   ├── architecture.md
│   ├── api-spec.md
│   └── stellar-integration.md
├── docker-compose.yml
└── package.json
```

---

## Tech Stack

| Layer       | Technology                           |
|-------------|--------------------------------------|
| Blockchain  | Stellar Network (Testnet / Mainnet)  |
| Backend     | Node.js, Express, Mongoose           |
| Database    | MongoDB                              |
| Frontend    | Next.js (React)                      |
| HTTP Client | Axios                                |
| Testing     | Jest, Supertest                      |
| DevOps      | Docker, Docker Compose               |

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- A Stellar wallet address — use [Stellar Laboratory](https://laboratory.stellar.org) to generate one on testnet

### Run Locally

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Run with Docker

```bash
SCHOOL_WALLET_ADDRESS=your_wallet_address docker-compose up
```

---

## Environment Variables

**`backend/.env`**
```
MONGO_URI=mongodb://localhost:27017/stellaredupay
STELLAR_NETWORK=testnet
SCHOOL_WALLET_ADDRESS=your_school_stellar_wallet_address
PORT=5000
```

**`frontend/.env.local`**
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

> Set `STELLAR_NETWORK=mainnet` to switch from testnet to the live Stellar network.

---

## API Reference

| Method | Endpoint                                | Description                               |
|--------|-----------------------------------------|-------------------------------------------|
| POST   | `/api/students`                         | Register a new student                    |
| GET    | `/api/students`                         | List all students                         |
| GET    | `/api/students/:studentId`              | Get a single student's details            |
| GET    | `/api/payments/instructions/:studentId` | Get wallet address + memo for payment     |
| GET    | `/api/payments/:studentId`              | Get payment history for a student         |
| POST   | `/api/payments/verify`                  | Verify a transaction by hash              |
| POST   | `/api/payments/sync`                    | Sync latest payments from Stellar ledger  |

### Example: Register a Student
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{"studentId": "STU1023", "name": "Alice Johnson", "class": "Grade 5A", "feeAmount": 250}'
```

### Example: Get Payment Instructions
```bash
curl http://localhost:5000/api/payments/instructions/STU1023
```
```json
{
  "walletAddress": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "memo": "STU1023",
  "note": "Include the student ID exactly as the memo when sending payment."
}
```

### Example: Verify a Transaction
```bash
curl -X POST http://localhost:5000/api/payments/verify \
  -H "Content-Type: application/json" \
  -d '{"txHash": "your_transaction_hash"}'
```

---

## Running Tests

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
Tests:       6 passed, 6 total
```

Tests cover:
- Stellar ledger sync and transaction verification (mocked Horizon API)
- All payment and student API endpoints (mocked MongoDB)

---

## Future Scope

The current version handles core school fee payments. Planned extensions include:

- **Hostel & exam fee payments** — separate fee categories per student
- **Scholarship disbursement** — outbound XLM payments to student wallets
- **Donation tracking** — transparent fund collection for school projects
- **Financial reporting** — exportable payment summaries for administrators
- **Multi-school support** — isolated wallet and student records per institution
- **Email/SMS notifications** — alert parents when payment is confirmed on-chain

---

## License

MIT
