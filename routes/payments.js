const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/authMiddleware');
const { generateDigitalReceipt } = require('../utils/receipts')
const { initiateStk, mpesaCallback, checkoutRequestId, getAllPayments, getUserPayments } = require('../utils/payments')
router.post('/initiate-stk', protect, initiateStk)
    .post('/mcallback', protect, mpesaCallback);

router.get('/status/:checkoutRequestId', protect, checkoutRequestId)
    .get('/', protect, authorize(['admin']), getAllPayments)
    .get('/my-payments', protect, getUserPayments)

module.exports = router