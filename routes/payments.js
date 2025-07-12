const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/authMiddleware');
const { generateDigitalReceipt } = require('../utils/receipts')
const { cacheResponse } = require('../controllers/cacheController')

const { initiateStk, mpesaCallback, checkoutRequestId, getAllPayments, getUserPayments } = require('../utils/payments')
router.post('/initiate-stk', protect, initiateStk)
    .post('/mcallback', mpesaCallback);

router.get('/status/:checkoutRequestId', protect, cacheResponse('paymnets', 300), checkoutRequestId)
    .get('/', protect, authorize(['admin']), cacheResponse('paymnets', 300), getAllPayments)
    .get('/my-payments', protect, cacheResponse('paymnets', 300), getUserPayments)

module.exports = router