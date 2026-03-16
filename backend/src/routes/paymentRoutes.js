const express = require('express');
const router = express.Router();
const { getPaymentInstructions, verifyPayment, syncAllPayments, getStudentPayments } = require('../controllers/paymentController');

router.get('/instructions/:studentId', getPaymentInstructions);
router.get('/:studentId', getStudentPayments);
router.post('/verify', verifyPayment);
router.post('/sync', syncAllPayments);

module.exports = router;
