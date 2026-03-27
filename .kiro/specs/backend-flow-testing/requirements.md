# Requirements Document

## Introduction

This feature covers end-to-end testing of the full backend payment flow for the StellarEduPay system. The goal is to simulate and verify the complete lifecycle of a school fee payment — from student registration through Stellar blockchain transaction submission, verification, and final balance reconciliation — using automated integration and end-to-end tests. Tests must cover the happy path, error conditions, idempotency, retry behavior, and edge cases across all major backend subsystems.

## Glossary

- **Test_Suite**: The collection of automated tests covering the full backend payment flow
- **Payment_Flow**: The end-to-end sequence: fee structure creation → student registration → payment intent → transaction submission → verification → balance update
- **Stellar_Mock**: A test double that simulates the Stellar Horizon API without hitting the live network
- **School**: A registered institution with a Stellar wallet address and associated students
- **Student**: A registered learner with an assigned fee amount and payment status
- **Payment_Intent**: A time-limited, unique memo generated for a specific student payment
- **Transaction**: A Stellar blockchain payment operation referencing a student via memo
- **Fee_Structure**: A class-level fee configuration that determines the required payment amount
- **Retry_Queue**: The background worker that re-attempts verification of transactions that failed due to transient Stellar network errors
- **Idempotency_Key**: A client-supplied header that prevents duplicate processing of the same request

---

## Requirements

### Requirement 1: Full Happy-Path Payment Flow

**User Story:** As a QA engineer, I want an end-to-end test that simulates the complete successful payment flow, so that I can confirm all backend subsystems integrate correctly.

#### Acceptance Criteria

1. WHEN the Test_Suite runs the happy-path scenario, THE Test_Suite SHALL execute the following steps in order: create a fee structure, register a student, create a payment intent, submit a signed transaction, verify the transaction hash, and retrieve the student balance.
2. WHEN each step in the happy-path scenario completes, THE Test_Suite SHALL assert that the HTTP response status matches the documented API contract (201 for creation, 200 for retrieval and verification).
3. WHEN the transaction is verified successfully, THE Test_Suite SHALL assert that the student's `feePaid` field is `true` and `remainingBalance` is `0`.
4. WHEN the payment is recorded, THE Test_Suite SHALL assert that the payment record contains `feeValidationStatus: "valid"`, a non-null `txHash`, and a non-null `confirmedAt` timestamp.
5. WHEN the Test_Suite retrieves payment history for the student, THE Test_Suite SHALL assert that the returned array contains exactly one entry matching the submitted transaction hash.

---

### Requirement 2: Payment Intent Lifecycle

**User Story:** As a QA engineer, I want tests that cover payment intent creation and expiry, so that I can confirm time-limited memos are enforced correctly.

#### Acceptance Criteria

1. WHEN a payment intent is created for a registered student, THE Test_Suite SHALL assert that the response contains a `memo`, an `expiresAt` timestamp in the future, and `status: "PENDING"`.
2. WHEN a payment intent is created without an `Idempotency-Key` header, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "MISSING_IDEMPOTENCY_KEY"`.
3. WHEN the same `Idempotency-Key` is used for two payment intent requests, THE Test_Suite SHALL assert that the second request returns the cached response without creating a new intent.
4. WHEN a payment intent has expired and a transaction verification is attempted using its memo, THE Test_Suite SHALL assert that the API returns HTTP 410 with `code: "INTENT_EXPIRED"`.
5. WHEN a payment intent is created for a student whose fee amount falls outside the configured payment limits, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "AMOUNT_TOO_HIGH"` or `code: "AMOUNT_TOO_LOW"`.

---

### Requirement 3: Transaction Verification Error Conditions

**User Story:** As a QA engineer, I want tests for all documented transaction verification failure modes, so that I can confirm the backend rejects invalid transactions with the correct error codes.

#### Acceptance Criteria

1. WHEN a transaction hash that has already been recorded is submitted for verification, THE Test_Suite SHALL assert that the API returns HTTP 409 with `code: "DUPLICATE_TX"`.
2. WHEN a transaction with no memo field is submitted for verification, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "MISSING_MEMO"`.
3. WHEN a transaction whose payment operation targets a wallet address other than the school wallet is submitted, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "INVALID_DESTINATION"`.
4. WHEN a transaction using an asset not in the accepted assets list is submitted, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "UNSUPPORTED_ASSET"`.
5. WHEN a transaction amount is below the configured minimum payment limit, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "AMOUNT_TOO_LOW"`.
6. WHEN a transaction amount exceeds the configured maximum payment limit, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "AMOUNT_TOO_HIGH"`.
7. WHEN a transaction amount is less than the student's required fee, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "UNDERPAID"`.

---

### Requirement 4: Stellar Network Retry Behavior

**User Story:** As a QA engineer, I want tests that simulate transient Stellar network failures, so that I can confirm the retry queue correctly handles and eventually resolves failed verifications.

#### Acceptance Criteria

1. WHEN the Stellar_Mock returns a network error during transaction verification, THE Test_Suite SHALL assert that the API returns HTTP 202 with `status: "queued_for_retry"`.
2. WHEN a transaction is placed in the Retry_Queue, THE Test_Suite SHALL assert that the retry queue endpoint (`GET /api/payments/retry-queue`) reflects the pending entry with a non-zero `attempts` count after the first retry attempt.
3. WHEN the Stellar_Mock recovers and the retry worker processes a queued transaction successfully, THE Test_Suite SHALL assert that the payment is recorded with `status: "SUCCESS"` and the retry entry moves to `recently_resolved`.
4. WHEN a transaction exceeds the maximum retry attempts, THE Test_Suite SHALL assert that the retry entry transitions to `dead_letter` status.

---

### Requirement 5: Fee Validation and Overpayment Handling

**User Story:** As a QA engineer, I want tests for underpayment and overpayment scenarios, so that I can confirm fee validation logic is applied correctly.

#### Acceptance Criteria

1. WHEN a transaction amount exactly matches the student's required fee, THE Test_Suite SHALL assert that `feeValidationStatus` is `"valid"` and `excessAmount` is `0`.
2. WHEN a transaction amount exceeds the student's required fee, THE Test_Suite SHALL assert that `feeValidationStatus` is `"overpaid"`, `excessAmount` is the positive difference, and `feePaid` is `true`.
3. WHEN a transaction amount is less than the student's required fee, THE Test_Suite SHALL assert that the payment is rejected with `code: "UNDERPAID"` and the student's `feePaid` remains `false`.
4. WHEN the overpayments endpoint is queried after an overpaid transaction, THE Test_Suite SHALL assert that the response includes the overpaid record and `totalExcess` reflects the correct excess amount.
5. WHEN multiple partial payments are made for the same student, THE Test_Suite SHALL assert that the student balance endpoint returns a `totalPaid` equal to the sum of all payment amounts and `feePaid` is `true` once the cumulative total meets or exceeds the fee.

---

### Requirement 6: Multi-School Isolation

**User Story:** As a QA engineer, I want tests that verify school-scoped data isolation, so that I can confirm payments and students from one school are not visible to another.

#### Acceptance Criteria

1. WHEN two schools are registered and each has a student with the same `studentId`, THE Test_Suite SHALL assert that payment records for one school are not returned when querying under the other school's context.
2. WHEN a transaction is verified under School A's context, THE Test_Suite SHALL assert that the payment is recorded with School A's `schoolId` and does not appear in School B's payment history.
3. WHEN the `X-School-ID` header is missing from a request that requires school context, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "MISSING_SCHOOL_CONTEXT"`.

---

### Requirement 7: Blockchain Sync and Finalization

**User Story:** As a QA engineer, I want tests for the payment sync and finalization endpoints, so that I can confirm background polling correctly reconciles on-chain transactions with the database.

#### Acceptance Criteria

1. WHEN the sync endpoint is called and the Stellar_Mock returns new transactions for the school wallet, THE Test_Suite SHALL assert that new payment records are created in the database for each matched transaction.
2. WHEN the sync endpoint is called and a transaction has already been recorded, THE Test_Suite SHALL assert that no duplicate payment record is created.
3. WHEN the finalize endpoint is called, THE Test_Suite SHALL assert that payments with `confirmationStatus: "pending_confirmation"` that have reached the confirmation threshold are updated to `confirmationStatus: "confirmed"`.
4. WHEN a failed on-chain transaction is encountered during sync, THE Test_Suite SHALL assert that a payment record is created with `status: "FAILED"` and `confirmationStatus: "failed"`.

---

### Requirement 8: Report Generation

**User Story:** As a QA engineer, I want tests for the report generation endpoint, so that I can confirm payment summaries are accurate after a series of transactions.

#### Acceptance Criteria

1. WHEN the report endpoint is called after a set of known payments are recorded, THE Test_Suite SHALL assert that `summary.totalAmount` equals the sum of all recorded payment amounts and `summary.paymentCount` equals the number of payments.
2. WHEN the report endpoint is called with a `startDate` and `endDate` filter, THE Test_Suite SHALL assert that only payments within the specified date range are included in the summary.
3. WHEN the report endpoint is called with `format=csv`, THE Test_Suite SHALL assert that the response `Content-Type` is `text/csv` and the body contains the expected summary headers.
4. WHEN the report endpoint is called with `startDate` after `endDate`, THE Test_Suite SHALL assert that the API returns HTTP 400 with `code: "VALIDATION_ERROR"`.

---

### Requirement 9: Test Infrastructure and Isolation

**User Story:** As a QA engineer, I want the test suite to use proper mocking and database isolation, so that tests are deterministic, fast, and do not depend on live external services.

#### Acceptance Criteria

1. THE Test_Suite SHALL use a Stellar_Mock to simulate all Stellar Horizon API calls, ensuring no live network requests are made during test execution.
2. THE Test_Suite SHALL use an in-memory or isolated test database so that each test run starts from a known clean state.
3. WHEN any test in the Test_Suite fails, THE Test_Suite SHALL report the failing test name, the expected value, and the actual value in the test output.
4. THE Test_Suite SHALL complete the full happy-path scenario within 10 seconds on a standard CI environment.
5. WHERE the test environment supports parallel execution, THE Test_Suite SHALL ensure each test file uses independent data fixtures to prevent cross-test contamination.
