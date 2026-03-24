const crypto = require('crypto');
const Payment = require('../models/paymentModel');
const PaymentIntent = require('../models/paymentIntentModel');
const Student = require('../models/studentModel');
const {
  syncPayments,
  verifyTransaction,
  recordPayment,
  finalizeConfirmedPayments,
} = require('../services/stellarService');
const { SCHOOL_WALLET, ACCEPTED_ASSETS } = require('../config/stellarConfig');

// Tag errors that originate from Stellar network calls
function wrapStellarError(err) {
  if (!err.code) {
    err.code = 'STELLAR_NETWORK_ERROR';
    err.message = `Stellar network error: ${err.message}`;
  }
  return err;
}

// GET /api/payments/instructions/:studentId
async function getPaymentInstructions(req, res, next) {
  try {
    res.json({
      walletAddress: SCHOOL_WALLET,
      memo: req.params.studentId,
      acceptedAssets: Object.values(ACCEPTED_ASSETS).map(a => ({
        code: a.code,
        type: a.type,
        displayName: a.displayName,
      })),
      note: 'Include the payment intent memo exactly when sending payment to ensure your fees are credited.',
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/intent
async function createPaymentIntent(req, res, next) {
  try {
    const { studentId } = req.body;
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found', code: 'NOT_FOUND' });
    }

    const memo = crypto.randomBytes(4).toString('hex').toUpperCase();
    const intent = await PaymentIntent.create({
      studentId,
      amount: student.feeAmount,
      memo,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    });

    res.status(201).json(intent);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/verify
 *
 * Accepts a Stellar transaction hash, queries the Stellar network to verify
 * the payment, records it if valid, and returns the verification result.
 *
 * Request body: { txHash: string }  — 64-char hex string (validated by middleware)
 *
 * Success response (200):
 *   {
 *     verified: true,
 *     hash, memo, studentId, amount, assetCode, assetType,
 *     feeAmount, feeValidation: { status, excessAmount, message },
 *     date, alreadyRecorded: boolean
 *   }
 *
 * Error responses follow the global error handler format:
 *   { error: string, code: string }
 *   400 — TX_FAILED | MISSING_MEMO | INVALID_DESTINATION | UNSUPPORTED_ASSET
 *   409 — DUPLICATE_TX
 *   404 — transaction not found / no valid payment
 *   502 — STELLAR_NETWORK_ERROR
 */
async function verifyPayment(req, res, next) {
  try {
    const { txHash } = req.body;

    // Check if we've already recorded this transaction
    const existing = await Payment.findOne({ txHash });
    if (existing) {
      const err = new Error(`Transaction ${txHash} has already been processed`);
      err.code = 'DUPLICATE_TX';
      return next(err);
    }

    // Query Stellar network — throws structured errors on any failure
    let result;
    try {
      result = await verifyTransaction(txHash);
    } catch (stellarErr) {
      const knownFailCodes = ['TX_FAILED', 'MISSING_MEMO', 'INVALID_DESTINATION', 'UNSUPPORTED_ASSET'];
      // Record a failed payment entry for known failure codes so we have an audit trail
      if (knownFailCodes.includes(stellarErr.code)) {
        await Payment.create({
          studentId: 'unknown',
          txHash,
          amount: 0,
          status: 'failed',
          feeValidationStatus: 'unknown',
        }).catch(() => {}); // non-fatal — don't mask the original error
      }
      return next(knownFailCodes.includes(stellarErr.code) ? stellarErr : wrapStellarError(stellarErr));
    }

    // verifyTransaction returns null if the tx exists but has no valid payment to the school wallet
    if (!result) {
      return res.status(404).json({
        error: 'Transaction found but contains no valid payment to the school wallet',
        code: 'NOT_FOUND',
      });
    }

    // Persist the verified payment
    await recordPayment({
      studentId: result.studentId,
      txHash: result.hash,
      amount: result.amount,
      feeAmount: result.feeAmount,
      feeValidationStatus: result.feeValidation.status,
      excessAmount: result.feeValidation.excessAmount,
      status: 'confirmed',
      memo: result.memo,
      senderAddress: result.senderAddress || null,
      ledger: result.ledger || null,
      confirmationStatus: 'confirmed',
      confirmedAt: new Date(result.date),
    });

    res.json({
      verified: true,
      hash: result.hash,
      memo: result.memo,
      studentId: result.studentId,
      amount: result.amount,
      assetCode: result.assetCode,
      assetType: result.assetType,
      feeAmount: result.feeAmount,
      feeValidation: result.feeValidation,
      date: result.date,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/sync
async function syncAllPayments(req, res, next) {
  try {
    await syncPayments();
    res.json({ message: 'Sync complete' });
  } catch (err) {
    next(wrapStellarError(err));
  }
}

// POST /api/payments/finalize
async function finalizePayments(req, res, next) {
  try {
    await finalizeConfirmedPayments();
    res.json({ message: 'Finalization complete' });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/:studentId
async function getStudentPayments(req, res, next) {
  try {
    const payments = await Payment.find({ studentId: req.params.studentId }).sort({ confirmedAt: -1 });
    res.json(payments);
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/accepted-assets
async function getAcceptedAssets(req, res, next) {
  try {
    res.json({
      assets: Object.values(ACCEPTED_ASSETS).map(a => ({
        code: a.code,
        type: a.type,
        displayName: a.displayName,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/overpayments
async function getOverpayments(req, res, next) {
  try {
    const overpayments = await Payment.find({ feeValidationStatus: 'overpaid' }).sort({ confirmedAt: -1 });
    const totalExcess = overpayments.reduce((sum, p) => sum + (p.excessAmount || 0), 0);
    res.json({ count: overpayments.length, totalExcess, overpayments });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/balance/:studentId
async function getStudentBalance(req, res, next) {
  try {
    const { studentId } = req.params;
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found', code: 'NOT_FOUND' });
    }

    const result = await Payment.aggregate([
      { $match: { studentId } },
      { $group: { _id: null, totalPaid: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const totalPaid = result.length ? parseFloat(result[0].totalPaid.toFixed(7)) : 0;
    const remainingBalance = parseFloat(Math.max(0, student.feeAmount - totalPaid).toFixed(7));
    const excessAmount = totalPaid > student.feeAmount
      ? parseFloat((totalPaid - student.feeAmount).toFixed(7))
      : 0;

    res.json({
      studentId,
      feeAmount: student.feeAmount,
      totalPaid,
      remainingBalance,
      excessAmount,
      feePaid: totalPaid >= student.feeAmount,
      installmentCount: result.length ? result[0].count : 0,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/suspicious
async function getSuspiciousPayments(req, res, next) {
  try {
    const suspicious = await Payment.find({ isSuspicious: true }).sort({ confirmedAt: -1 });
    res.json({ count: suspicious.length, suspicious });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/pending
async function getPendingPayments(req, res, next) {
  try {
    const pending = await Payment.find({ confirmationStatus: 'pending_confirmation' }).sort({ confirmedAt: -1 });
    res.json({ count: pending.length, pending });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPaymentInstructions,
  createPaymentIntent,
  verifyPayment,
  syncAllPayments,
  finalizePayments,
  getStudentPayments,
  getAcceptedAssets,
  getOverpayments,
  getStudentBalance,
  getSuspiciousPayments,
  getPendingPayments,
};
