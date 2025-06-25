// routes/servicesRoutes.js

const express = require('express');
const { User } = require('../models/User')
const { getServices, getServiceById, registerService, deleteServiceById, updateServiceById } = require('../controllers/serviceController');
const { authorize } = require('../middleware/authMiddleware')
const router = express.Router();

router.post('/', authorize(['admin']), registerService)
    .post('/id', authorize(['admin']), deleteServiceById)
    .post('/id', authorize(['admin']), updateServiceById)

router.get('/', getServices)
    .get('/:id', getServiceById);


module.exports = router;