# Implementation Plan: Backend Flow Testing

## Overview

Build a structured Jest integration test suite under `tests/integration/` that covers the full StellarEduPay payment lifecycle. All tests use mock-based isolation (no live network, no real MongoDB). `supertest` and `fast-check` are added as dev dependencies.

## Tasks

- [ ] 1. Install dependencies and create shared test helpers
  - Add `supertest` and `fast-check` to `devDependencies` in `backend/package.json`
  - Create `tests/integration/helpers.js` with `makeApi(app)`, `makeTxHash(char)`, `makeStudent(overrides)`, `makePayment(overrides)`, and `makeIntent(overrides)` utilities
  - `makeApi` wraps supertest and always attaches `X-School-ID: SCH001` and `Content-Type: application/json` headers
  - `makeTxHash` returns a deterministic 64-char hex string
  - _Requirements: 9.1, 9.2, 9.5_

- [ ] 2. Implement happy-path flow tests
  - [ ] 2.1 Create `tests/integration/happyPath.test.js`
    - Mock all Mongoose models and `stellarService` at module level
    - Set `process.env.MONGO_URI` and `process.env.SCHOOL_WALLET_ADDRESS` before loading app
    - Write ordered `describe` steps: create fee structure → register student → create payment intent → verify transaction → check balance → check payment history
    - Assert HTTP 201 on creation endpoints, HTTP 200 on retrieval and verify
    - Assert `feePaid: true` and `remainingBalance: 0` after verification
    - Assert payment record has `feeValidationStatus: "valid"`, non-null `txHash`, non-null `confirmedAt`
    - Assert payment history returns exactly one entry matching the submitted `txHash`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write property test for verified payment record completeness
    - **Property 1: Verified payment record completeness**
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 2.3 Write property test for payment history round trip
    - **Property 2: Payment history round trip**
    - **Validates: Requirements 1.5**

- [ ] 3. Implement payment intent lifecycle tests
  - [ ] 3.1 Create `tests/integration/paymentIntent.test.js`
    - Example: missing `Idempotency-Key` header returns HTTP 400 with `code: "MISSING_IDEMPOTENCY_KEY"`
    - Example: expired intent returns HTTP 410 with `code: "INTENT_EXPIRED"`
    - _Requirements: 2.2, 2.4_

  - [ ]* 3.2 Write property test for intent field completeness
    - **Property 3: Payment intent field completeness** — for any registered student, intent creation returns non-empty `memo`, future `expiresAt`, and `status: "PENDING"`
    - **Validates: Requirements 2.1**

  - [ ]* 3.3 Write property test for idempotency key caching
    - **Property 4: Idempotency key caching** — same key returns identical cached response without creating a new record
    - **Validates: Requirements 2.3**

  - [ ]* 3.4 Write property test for fee amount limit enforcement on intent creation
    - **Property 5: Fee amount limit enforcement on intent creation** — fee below min returns `AMOUNT_TOO_LOW`, fee above max returns `AMOUNT_TOO_HIGH`
    - **Validates: Requirements 2.5**

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement transaction verification error condition tests
  - [ ] 5.1 Create `tests/integration/verifyErrors.test.js`
    - Mock `Payment.findOne` to return an existing record for duplicate-TX tests
    - Configure `stellarService.verifyTransaction` mock to throw errors with specific `code` values for each structural violation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 5.2 Write property test for duplicate transaction rejection
    - **Property 6: Duplicate transaction rejection** — any already-recorded `txHash` returns HTTP 409 with `code: "DUPLICATE_TX"`
    - **Validates: Requirements 3.1**

  - [ ]* 5.3 Write property test for transaction validation error codes
    - **Property 7: Transaction validation error codes** — each structural violation maps to the correct HTTP 400 error code
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

- [ ] 6. Implement retry queue behavior tests
  - [ ] 6.1 Create `tests/integration/retryQueue.test.js`
    - Example: retry queue endpoint shows pending entry with non-zero `attempts` after queuing
    - Example: successful retry moves entry to `recently_resolved` with `status: "SUCCESS"`
    - _Requirements: 4.2, 4.3_

  - [ ]* 6.2 Write property test for Stellar network failure queuing
    - **Property 8: Stellar network failure queuing** — transient Stellar error returns HTTP 202 with `status: "queued_for_retry"` and entry appears in retry queue
    - **Validates: Requirements 4.1**

  - [ ]* 6.3 Write property test for max retry exhaustion
    - **Property 9: Max retry exhaustion transitions to dead letter** — entry exceeding max attempts transitions to `dead_letter` status
    - **Validates: Requirements 4.4**

- [ ] 7. Implement fee validation and overpayment tests
  - [ ] 7.1 Create `tests/integration/feeValidation.test.js`
    - Configure payment mocks to simulate exact-match, overpaid, and underpaid scenarios
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 7.2 Write property test for fee validation status correctness
    - **Property 10: Fee validation status correctness** — exact match → `valid`/`excessAmount: 0`; overpaid → `overpaid`/positive excess; underpaid → rejected with `UNDERPAID`
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 7.3 Write property test for overpayment record accuracy
    - **Property 11: Overpayment record accuracy** — overpayments endpoint includes the record and `totalExcess` equals sum of all `excessAmount` values
    - **Validates: Requirements 5.4**

  - [ ]* 7.4 Write property test for cumulative balance tracking
    - **Property 12: Cumulative balance tracking** — `totalPaid` equals arithmetic sum of all payments; `feePaid` is `true` iff `totalPaid >= feeAmount`
    - **Validates: Requirements 5.5**

- [ ] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement multi-school isolation tests
  - [ ] 9.1 Create `tests/integration/multiSchool.test.js`
    - Configure two separate school mocks (`SCH001`, `SCH002`) with overlapping student IDs
    - Assert payments recorded under `SCH001` do not appear in `SCH002` queries and vice versa
    - _Requirements: 6.1, 6.2_

  - [ ]* 9.2 Write property test for school-scoped data isolation
    - **Property 13: School-scoped data isolation** — payment records from one school never appear in another school's history or balance queries
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 9.3 Write property test for missing school context rejection
    - **Property 14: Missing school context rejection** — any school-scoped request without `X-School-ID` returns HTTP 400 with `code: "MISSING_SCHOOL_CONTEXT"`
    - **Validates: Requirements 6.3**

- [ ] 10. Implement blockchain sync and finalization tests
  - [ ] 10.1 Create `tests/integration/syncFinalize.test.js`
    - Mock `stellarService` to return a list of transactions for the school wallet
    - Example: failed on-chain transaction creates a record with `status: "FAILED"` and `confirmationStatus: "failed"`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 10.2 Write property test for sync idempotency
    - **Property 15: Sync creates records for new transactions** — sync creates exactly one record per new transaction; re-running sync does not create duplicates
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 10.3 Write property test for finalization promotion
    - **Property 16: Finalization promotes pending payments** — payments with `confirmationStatus: "pending_confirmation"` at threshold are updated to `"confirmed"`
    - **Validates: Requirements 7.3**

- [ ] 11. Implement report generation tests
  - [ ] 11.1 Create `tests/integration/reports.test.js`
    - Mock `Payment.find` to return a known set of payment records
    - Example: `format=csv` returns `Content-Type: text/csv` with expected summary headers
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 11.2 Write property test for report aggregation accuracy
    - **Property 17: Report aggregation accuracy** — `summary.totalAmount` equals sum of all payment amounts; `summary.paymentCount` equals count; date range filter excludes out-of-range payments
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 11.3 Write property test for report date range validation
    - **Property 18: Report date range validation** — `startDate` after `endDate` returns HTTP 400 with `code: "VALIDATION_ERROR"`
    - **Validates: Requirements 8.4**

- [ ] 12. Final checkpoint — Ensure all tests pass
  - Run `cd backend && npx jest tests/integration --runInBand --forceExit` and confirm all tests pass.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each property test must include the tag comment: `// Feature: backend-flow-testing, Property N: <property_text>`
- Each property-based test must run a minimum of 100 iterations via `{ numRuns: 100 }`
- Run tests with `cd backend && npx jest tests/integration --runInBand --forceExit`
