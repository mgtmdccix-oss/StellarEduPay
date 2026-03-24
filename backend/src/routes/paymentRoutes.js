const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/paymentController');
const { validateStudentIdParam, validateVerifyPayment } = require('../middleware/validate');

// Static routes must come before parameterized ones to avoid route shadowing
router.get('/accepted-assets', getAcceptedAssets);
router.get('/overpayments', getOverpayments);
router.get('/suspicious', getSuspiciousPayments);
router.get('/pending', getPendingPayments);
router.get('/balance/:studentId', validateStudentIdParam, getStudentBalance);
router.get('/instructions/:studentId', validateStudentIdParam, getPaymentInstructions);

// POST routes
router.post('/verify', validateVerifyPayment, verifyPayment);
router.post('/sync', syncAllPayments);
router.post('/finalize', finalizePayments);
router.post('/intent', createPaymentIntent);

// Parameterized route last to avoid swallowing static paths
router.get('/:studentId', validateStudentIdParam, getStudentPayments);

module.exports = router;
