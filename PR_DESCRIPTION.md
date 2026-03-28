# Add Verify Transaction UI to Pay Fees Page

Closes #230

## Summary

`POST /api/payments/verify` existed but had no frontend interface. Parents had no way to confirm their payment was recorded without contacting the school. This PR adds a Verify Payment section to the pay-fees page.

## Changes

### New Files

| File | Description |
| ---- | ----------- |
| [`frontend/src/components/VerifyPayment.jsx`](frontend/src/components/VerifyPayment.jsx) | Self-contained verify form — input, submit, result display, error handling |

### Modified Files

| File | Description |
| ---- | ----------- |
| [`frontend/src/pages/pay-fees.jsx`](frontend/src/pages/pay-fees.jsx) | Renders `<VerifyPayment />` below the payment instructions section |

## Behaviour

- Parent enters a transaction hash and clicks Verify
- On success: shows amount, asset, student ID (memo), date, fee validation status, and network fee
- On error: displays the API error message (e.g. `MISSING_MEMO`, `TX_FAILED`, `INVALID_DESTINATION`) or a fallback message
- Fee validation status is colour-coded: green (valid), orange (overpaid), red (underpaid)

## Acceptance Criteria

- [x] Parents can enter a tx hash and see confirmation details
- [x] Invalid or unrecognised hashes show a clear error
- [x] Successful verification shows amount, memo, and date
