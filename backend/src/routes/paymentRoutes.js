'use strict';

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
  getPaymentLimitsEndpoint,
  getOverpayments,
  getStudentBalance,
  getSuspiciousPayments,
  getPendingPayments,
  getRetryQueue,
  getExchangeRates,
  getAllPayments,
  getDeadLetterJobs,
  retryDeadLetterJob,
  lockPaymentForUpdate,
  unlockPayment,
} = require('../controllers/paymentController');

const {
  validateStudentIdParam,
  validateCreatePaymentIntent,
  validateSubmitTransaction,
  validateVerifyPayment,
} = require('../middleware/validate');
const { resolveSchool } = require('../middleware/schoolContext');

// All payment routes require school context
router.use(resolveSchool);

// ── Static routes (before parameterised ones) ────────────────────────────────
router.get('/accepted-assets',               getAcceptedAssets);
router.get('/limits',                        getPaymentLimitsEndpoint);
router.get('/overpayments',                  getOverpayments);
router.get('/suspicious',                    getSuspiciousPayments);
router.get('/pending',                       getPendingPayments);
router.get('/retry-queue',                   getRetryQueue);
router.get('/rates',                         getExchangeRates);

// #93 — Transaction Filtering API
router.get('/',                              getAllPayments);

// #94 — Dead Letter Queue endpoints
router.get('/dlq',                           getDeadLetterJobs);
router.post('/dlq/:id/retry',                retryDeadLetterJob);

// ── Parameterised GET routes ─────────────────────────────────────────────────
router.get('/balance/:studentId',            validateStudentIdParam, getStudentBalance);
router.get('/instructions/:studentId',       validateStudentIdParam, getPaymentInstructions);
router.get('/:studentId',                    validateStudentIdParam, getStudentPayments);

// ── POST routes ──────────────────────────────────────────────────────────────
router.post('/intent',                       validateCreatePaymentIntent, createPaymentIntent);
router.post('/verify',                       validateVerifyPayment, verifyPayment);
router.post('/sync',                         syncAllPayments);
router.post('/finalize',                     finalizePayments);

// #91 — Payment Locking Mechanism
router.post('/:paymentId/lock',              lockPaymentForUpdate);
router.post('/:paymentId/unlock',            unlockPayment);

module.exports = router;
