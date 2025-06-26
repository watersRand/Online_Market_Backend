const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    assignDelivery,
    updateDeliveryStatus,
    getAllDeliveries,
    getMyDeliveries,
    getDeliveryById
} = require('../controllers/deliveryController');

// Admin only: Assign a delivery to a delivery person
router.post('/assign', protect, authorize(['admin']), assignDelivery);

// Delivery Person or Admin: Update the status of a specific delivery
router.put('/:id/status', protect, authorize(['admin', 'deliveryPerson']), updateDeliveryStatus);

// Admin only: Get all delivery assignments (with optional filters)
router.get('/', protect, authorize(['admin']), getAllDeliveries);

// Delivery Person: Get deliveries assigned to them
router.get('/my-deliveries', protect, authorize(['deliveryPerson', 'admin']), getMyDeliveries);

// Get a single delivery by ID (Admin, Delivery Person, or Order User)
router.get('/:id', protect, getDeliveryById);


module.exports = router;