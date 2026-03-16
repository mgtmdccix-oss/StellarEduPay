const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  txHash: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  memo: { type: String },
  confirmedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
