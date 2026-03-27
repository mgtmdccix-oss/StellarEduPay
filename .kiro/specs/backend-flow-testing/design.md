# Design Document: Backend Flow Testing

## Overview

This document describes the design for a comprehensive automated test suite covering the full backend payment flow of StellarEduPay. The test suite validates the complete lifecycle of a school fee payment — from fee structure creation through Stellar blockchain transaction submission, verification, and final balance reconciliation.

The existing test suite in `tests/` uses Jest with manual mocks for Mongoose models and the Stellar SDK. This design extends that pattern into a structured, multi-file integration test suite that covers all requirements: happy-path flows, error conditions, idempotency, retry behavior, fee validation, multi-school isolation, blockchain sync, and report generation.

The key design decision is to keep the existing mock-based approach (no live network, no real MongoDB) rather than introducing a full in-memory database like `mongodb-memory-server`. This keeps tests fast, deterministic, and consistent with the existing codebase patterns. Where state needs to accumulate across steps (e.g., the happy-path flow), tests are organized into ordered `describe` blocks with shared state via module-level variables.

---

## Architecture

The test suite is organized as a set of Jest test files under `tests/`, each covering a distinct concern. All files share a common mock setup pattern: Mongoose models are mocked at the module level, the Stellar SDK and `stellarService` are mocked, and the Express app is loaded after mocks are in place.

```
tests/
  integration/
    happyPath.test.js          — Req 1: Full end-to-end payment flow
    paymentIntent.test.js      — Req 2: Intent lifecycle, idempotency, expiry
    verifyErrors.test.js       — Req 3: All verification error conditions
    retryQueue.test.js         — Req 4: Stellar network failure and retry behavior
    feeValidation.test.js      — Req 5: Underpayment, overpayment, partial payments
    multiSchool.test.js        — Req 6: School-scoped data isolation
    syncFinalize.test.js       — Req 7: Blockchain sync and finalization
    reports.test.js            — Req 8: Report generation and filtering
```

Each test file is self-contained: it sets up its own mocks, loads the app, and tears down after. This enables parallel execution without cross-test contamination.

```
┌─────────────────────────────────────────────────────────────┐
│                     Jest Test Runner                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ happyPath    │  │ verifyErrors │  │ retryQueue       │  │
│  │ .test.js     │  │ .test.js     │  │ .test.js         │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                   │             │
│         └─────────────────┴───────────────────┘             │
│                           │                                 │
│              ┌────────────▼────────────┐                    │
│              │   Express App (app.js)  │                    │
│              └────────────┬────────────┘                    │
│                           │                                 │
│         ┌─────────────────┼─────────────────┐               │
│         ▼                 ▼                 ▼               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Mongoose    │  │ stellarService│  │ retryService │       │
│  │ Model Mocks │  │ Mock         │  │ Mock         │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### Test Helpers

A shared `tests/integration/helpers.js` module provides:

- `makeApi(app)` — wraps supertest to always send `X-School-ID` and `Content-Type` headers
- `makeTxHash(char)` — generates a valid 64-char hex transaction hash
- `makeStudent(overrides)` — returns a mock student object with sensible defaults
- `makePayment(overrides)` — returns a mock payment object with sensible defaults
- `makeIntent(overrides)` — returns a mock payment intent object

### Mock Strategy

**Stellar Mock**: `stellarService` is mocked at the module level in each test file. The mock's `verifyTransaction` function is configurable per-test via `mockResolvedValueOnce` / `mockRejectedValueOnce`, allowing tests to simulate success, specific error codes, and network failures.

**Database Mock**: All Mongoose models (`Payment`, `Student`, `PaymentIntent`, `FeeStructure`, `PendingVerification`, `IdempotencyKey`) are mocked. Tests that need to simulate state (e.g., a payment already existing for duplicate detection) use `mockResolvedValueOnce` to override the default mock for a single call.

**School Context**: The `schoolModel` mock always returns a valid school object with `schoolId: 'SCH001'` and `stellarAddress: 'GSCHOOL123'`. The `X-School-ID: SCH001` header is sent on every request via the `makeApi` helper.

### Key Interfaces Under Test

| Interface | Method | Test Files |
|---|---|---|
| `POST /api/fees` | Create fee structure | happyPath, feeValidation |
| `POST /api/students` | Register student | happyPath, multiSchool |
| `POST /api/payments/intent` | Create payment intent | paymentIntent |
| `POST /api/payments/verify` | Verify transaction | happyPath, verifyErrors, feeValidation |
| `POST /api/payments/sync` | Sync from blockchain | syncFinalize |
| `POST /api/payments/finalize` | Finalize pending payments | syncFinalize |
| `GET /api/payments/balance/:studentId` | Student balance | happyPath, feeValidation |
| `GET /api/payments/:studentId` | Payment history | happyPath |
| `GET /api/payments/retry-queue` | Retry queue status | retryQueue |
| `GET /api/payments/overpayments` | Overpayment records | feeValidation |
| `GET /api/reports` | Payment report | reports |

---

## Data Models

The test suite works with the existing data models. Mock objects used in tests must conform to these shapes:

**Student mock**
```js
{
  _id: '507f1f77bcf86cd799439011',
  studentId: 'STU001',
  name: 'Alice Johnson',
  class: 'Grade 5A',
  feeAmount: 250,
  feePaid: false,
  schoolId: 'SCH001',
}
```

**Payment mock**
```js
{
  _id: '507f1f77bcf86cd799439012',
  schoolId: 'SCH001',
  studentId: 'STU001',
  txHash: '<64-char hex>',
  amount: 250,
  feeAmount: 250,
  feeValidationStatus: 'valid',
  excessAmount: 0,
  status: 'SUCCESS',
  memo: 'STU001',
  confirmedAt: new Date(),
  confirmationStatus: 'confirmed',
}
```

**PaymentIntent mock**
```js
{
  _id: '507f1f77bcf86cd799439013',
  schoolId: 'SCH001',
  studentId: 'STU001',
  amount: 250,
  memo: 'A3F1C2B4',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 86400000),
}
```

**PendingVerification mock** (retry queue entry)
```js
{
  txHash: '<64-char hex>',
  schoolId: 'SCH001',
  studentId: 'STU001',
  status: 'pending',
  attempts: 1,
  nextRetryAt: new Date(Date.now() + 60000),
  lastError: 'Stellar network timeout',
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Verified payment record completeness

*For any* successfully verified transaction, the resulting payment record must have `feeValidationStatus: "valid"`, a non-null `txHash`, and a non-null `confirmedAt` timestamp, and the student's `feePaid` must be `true` with `remainingBalance` equal to `0`.

**Validates: Requirements 1.3, 1.4**

---

### Property 2: Payment history round trip

*For any* transaction hash that has been successfully verified, querying the payment history for the associated student must return an array containing exactly one entry with that transaction hash.

**Validates: Requirements 1.5**

---

### Property 3: Payment intent field completeness

*For any* registered student, creating a payment intent must return a response containing a non-empty `memo`, an `expiresAt` timestamp strictly in the future, and `status: "PENDING"`.

**Validates: Requirements 2.1**

---

### Property 4: Idempotency key caching

*For any* idempotency key used in a successful payment intent or verify request, sending the same request again with the same key must return the identical cached response body and status code without creating a new database record.

**Validates: Requirements 2.3**

---

### Property 5: Fee amount limit enforcement on intent creation

*For any* student whose `feeAmount` is below the configured minimum or above the configured maximum payment limit, creating a payment intent must return HTTP 400 with `code: "AMOUNT_TOO_LOW"` or `code: "AMOUNT_TOO_HIGH"` respectively.

**Validates: Requirements 2.5**

---

### Property 6: Duplicate transaction rejection

*For any* transaction hash that already exists in the payment records, submitting it again for verification must return HTTP 409 with `code: "DUPLICATE_TX"`.

**Validates: Requirements 3.1**

---

### Property 7: Transaction validation error codes

*For any* transaction that violates a structural constraint (missing memo, wrong destination, unsupported asset, amount outside limits, or underpayment), the verify endpoint must return HTTP 400 with the corresponding error code (`MISSING_MEMO`, `INVALID_DESTINATION`, `UNSUPPORTED_ASSET`, `AMOUNT_TOO_LOW`, `AMOUNT_TOO_HIGH`, or `UNDERPAID`).

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

---

### Property 8: Stellar network failure queuing

*For any* transaction verification attempt where the Stellar network returns a transient error, the verify endpoint must return HTTP 202 with `status: "queued_for_retry"` and the transaction must appear in the retry queue.

**Validates: Requirements 4.1**

---

### Property 9: Max retry exhaustion transitions to dead letter

*For any* transaction in the retry queue that has exceeded the configured maximum retry attempts, the retry entry must transition to `dead_letter` status.

**Validates: Requirements 4.4**

---

### Property 10: Fee validation status correctness

*For any* payment amount relative to the student's required fee: if the amount equals the fee, `feeValidationStatus` must be `"valid"` and `excessAmount` must be `0`; if the amount exceeds the fee, `feeValidationStatus` must be `"overpaid"` and `excessAmount` must equal the positive difference; if the amount is less than the fee, the payment must be rejected with `code: "UNDERPAID"`.

**Validates: Requirements 5.1, 5.2, 5.3**

---

### Property 11: Overpayment record accuracy

*For any* overpaid transaction, querying the overpayments endpoint must include that record and `totalExcess` must equal the sum of all `excessAmount` values across all overpaid records.

**Validates: Requirements 5.4**

---

### Property 12: Cumulative balance tracking

*For any* sequence of partial payments for the same student, the balance endpoint must return `totalPaid` equal to the arithmetic sum of all payment amounts, and `feePaid` must be `true` if and only if `totalPaid >= feeAmount`.

**Validates: Requirements 5.5**

---

### Property 13: School-scoped data isolation

*For any* two schools with overlapping student IDs, payment records created under one school's context must not appear in the other school's payment history or balance queries.

**Validates: Requirements 6.1, 6.2**

---

### Property 14: Missing school context rejection

*For any* request to a school-scoped endpoint that omits the `X-School-ID` header, the API must return HTTP 400 with `code: "MISSING_SCHOOL_CONTEXT"`.

**Validates: Requirements 6.3**

---

### Property 15: Sync creates records for new transactions

*For any* set of transactions returned by the Stellar mock for a school wallet, calling the sync endpoint must create exactly one payment record per new transaction, and calling sync again must not create duplicate records for already-recorded transactions.

**Validates: Requirements 7.1, 7.2**

---

### Property 16: Finalization promotes pending payments

*For any* payment with `confirmationStatus: "pending_confirmation"` that has reached the ledger confirmation threshold, calling the finalize endpoint must update that payment's `confirmationStatus` to `"confirmed"`.

**Validates: Requirements 7.3**

---

### Property 17: Report aggregation accuracy

*For any* set of recorded payments, the report endpoint must return `summary.totalAmount` equal to the arithmetic sum of all payment amounts and `summary.paymentCount` equal to the count of payments. When a date range filter is applied, only payments within that range must be included.

**Validates: Requirements 8.1, 8.2**

---

### Property 18: Report date range validation

*For any* report request where `startDate` is strictly after `endDate`, the API must return HTTP 400 with `code: "VALIDATION_ERROR"`.

**Validates: Requirements 8.4**

---

## Error Handling

The test suite must verify that all error paths produce the correct HTTP status codes and `code` fields as documented in the API spec. The global error handler in `app.js` maps error codes to status codes via a static map — tests rely on this mapping being correct.

**Error code to HTTP status mapping under test:**

| Code | Expected HTTP Status |
|---|---|
| `MISSING_IDEMPOTENCY_KEY` | 400 |
| `MISSING_MEMO` | 400 |
| `INVALID_DESTINATION` | 400 |
| `UNSUPPORTED_ASSET` | 400 |
| `AMOUNT_TOO_LOW` | 400 |
| `AMOUNT_TOO_HIGH` | 400 |
| `UNDERPAID` | 400 |
| `MISSING_SCHOOL_CONTEXT` | 400 |
| `VALIDATION_ERROR` | 400 |
| `INTENT_EXPIRED` | 410 |
| `DUPLICATE_TX` | 409 |
| `STELLAR_NETWORK_ERROR` | 502 |

**Transient vs permanent errors**: The `stellarService` mock must be configurable to throw either a transient error (no `code`, or a network-level error) to trigger the retry path, or a permanent error (with a `PERMANENT_FAIL_CODES` code) to trigger immediate rejection. Tests for Requirement 4 use the transient path; tests for Requirement 3 use the permanent path.

---

## Testing Strategy

### Framework and Libraries

- **Test runner**: Jest 29 (already in `devDependencies`)
- **HTTP assertions**: `supertest` (add to `devDependencies`)
- **Property-based testing**: `fast-check` (add to `devDependencies`)

`fast-check` is chosen because it integrates natively with Jest via `fc.assert(fc.property(...))`, requires no additional test runner configuration, and has strong TypeScript support for future migration.

### Dual Testing Approach

Both unit/example tests and property-based tests are used. They are complementary:

- **Example tests** verify specific scenarios with known inputs and outputs (happy path, specific error codes, CSV format)
- **Property tests** verify universal invariants across randomly generated inputs (fee validation logic, amount boundary checks, report aggregation)

Unit tests should be kept focused — avoid writing many unit tests for cases already covered by property tests.

### Property-Based Test Configuration

Each property-based test must run a minimum of **100 iterations**. Each test must include a comment referencing the design property it validates.

Tag format: `// Feature: backend-flow-testing, Property N: <property_text>`

Each correctness property must be implemented by a single `fc.assert(fc.property(...))` call.

**Example property test structure:**

```js
// Feature: backend-flow-testing, Property 10: Fee validation status correctness
test('fee validation: valid when amount equals fee', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 1, max: 10000, noNaN: true }),
      (fee) => {
        const result = validatePaymentAgainstFee(fee, fee);
        return result.status === 'valid' && result.excessAmount === 0;
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: backend-flow-testing, Property 10: Fee validation status correctness
test('fee validation: overpaid when amount exceeds fee', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 1, max: 9999, noNaN: true }),
      fc.float({ min: 0.01, max: 1000, noNaN: true }),
      (fee, excess) => {
        const amount = fee + excess;
        const result = validatePaymentAgainstFee(amount, fee);
        return result.status === 'overpaid' && result.excessAmount > 0;
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test File Organization

**`tests/integration/happyPath.test.js`** — Example tests for Req 1
- Ordered steps: create fee structure → register student → create intent → verify transaction → check balance → check history
- Asserts HTTP status codes at each step
- Asserts `feePaid: true`, `remainingBalance: 0` after verification
- Asserts payment record fields

**`tests/integration/paymentIntent.test.js`** — Example + property tests for Req 2
- Example: missing idempotency key returns 400
- Example: expired intent returns 410
- Property: intent creation always returns memo, expiresAt, status (Property 3)
- Property: idempotency key caching (Property 4)
- Property: fee limit enforcement on intent (Property 5)

**`tests/integration/verifyErrors.test.js`** — Property tests for Req 3
- Property: duplicate transaction rejection (Property 6)
- Property: all structural validation error codes (Property 7)

**`tests/integration/retryQueue.test.js`** — Example + property tests for Req 4
- Property: transient error queuing returns 202 (Property 8)
- Example: retry queue endpoint shows pending entry after queuing
- Example: successful retry moves entry to recently_resolved
- Property: max retries transitions to dead_letter (Property 9)

**`tests/integration/feeValidation.test.js`** — Property tests for Req 5
- Property: fee validation status correctness (Property 10)
- Property: overpayment record accuracy (Property 11)
- Property: cumulative balance tracking (Property 12)

**`tests/integration/multiSchool.test.js`** — Property tests for Req 6
- Property: school-scoped data isolation (Property 13)
- Property: missing school context rejection (Property 14)

**`tests/integration/syncFinalize.test.js`** — Property tests for Req 7
- Property: sync creates records for new transactions, idempotent on re-run (Property 15)
- Property: finalization promotes pending payments (Property 16)
- Example: failed on-chain transaction recorded with FAILED status

**`tests/integration/reports.test.js`** — Example + property tests for Req 8
- Property: report aggregation accuracy (Property 17)
- Property: date range validation (Property 18)
- Example: CSV format returns correct Content-Type and headers

### Test Isolation

Each test file must:
1. Set `process.env.MONGO_URI` and `process.env.SCHOOL_WALLET_ADDRESS` before loading the app
2. Mock all Mongoose models and external services at the module level using `jest.mock()`
3. Use `beforeEach` to reset mock return values to safe defaults
4. Use `mockResolvedValueOnce` / `mockRejectedValueOnce` for per-test overrides
5. Not share state between `describe` blocks except within ordered happy-path flows

### Running the Tests

```bash
# Run all integration tests (single pass, no watch)
cd backend && npx jest tests/integration --runInBand --forceExit

# Run a specific file
cd backend && npx jest tests/integration/happyPath.test.js --runInBand

# Run with coverage
cd backend && npx jest tests/integration --coverage --runInBand
```

The `--runInBand` flag is recommended during initial development to avoid port conflicts from multiple app instances. Once tests are confirmed isolated, parallel execution can be enabled by removing it.
