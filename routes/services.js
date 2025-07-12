// routes/servicesRoutes.js

const express = require('express');
const { User } = require('../models/User')
const { getServices, getServiceById, registerService, deleteServiceById, updateServiceById } = require('../controllers/serviceController');
const { authorize, protect } = require('../middleware/authMiddleware')
const { cacheResponse } = require('../controllers/cacheController')

const router = express.Router();

router.post('/', protect, authorize(['admin']), registerService)
    .post('/delete/:id', protect, authorize(['admin']), deleteServiceById)
    .post('/update/:id', protect, authorize(['admin']), updateServiceById)

router.get('/', cacheResponse('services', 300), getServices)
    .get('/:id', cacheResponse('services', 300), getServiceById);


module.exports = router;