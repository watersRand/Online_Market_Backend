// routes/servicesRoutes.js

const express = require('express');
const { User } = require('../models/User')
const { getServices, getServiceById, registerService, deleteServiceById, updateServiceById } = require('../controllers/serviceController');
const { authorize, protect } = require('../middleware/authMiddleware')
const router = express.Router();

router.post('/', protect, authorize(['admin']), registerService)
    .post('/id', protect, authorize(['admin']), deleteServiceById)
    .post('/id', protect, authorize(['admin']), updateServiceById)

router.get('/', getServices)
    .get('/:id', getServiceById);


module.exports = router;