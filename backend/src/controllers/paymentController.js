const Payment = require('../models/paymentModel');
const { syncPayments, verifyTransaction } = require('../services/stellarService');
const { SCHOOL_WALLET } = require('../config/stellarConfig');

// GET /api/payments/instructions/:studentId
async function getPaymentInstructions(req, res) {
  try {
    const { studentId } = req.params;
    res.json({
      walletAddress: SCHOOL_WALLET,
      memo: studentId,
      note: 'Include the student ID exactly as the memo when sending payment.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/payments/verify
async function verifyPayment(req, res) {
  try {
    const { txHash } = req.body;
    const result = await verifyTransaction(txHash);
    if (!result) return res.status(404).json({ error: 'Payment not found or invalid' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/payments/sync
async function syncAllPayments(req, res) {
  try {
    await syncPayments();
    res.json({ message: 'Sync complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/payments/:studentId
async function getStudentPayments(req, res) {
  try {
    const payments = await Payment.find({ studentId: req.params.studentId }).sort({ confirmedAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getPaymentInstructions, verifyPayment, syncAllPayments, getStudentPayments };
