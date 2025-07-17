const express = require('express');
const router = express.Router();
const { registerService, getServices, getServiceById, deleteServiceById, updateServiceById } = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/authMiddleware');
const Service = require('../models/services'); // For rendering

// Render service list
router.get('/services', async (req, res) => {
    const services = await Service.find({}); // Simulate fetching all services
    res.render('services/services', { title: 'All Services', services, user: req.user });
});

// Render service registration form
router.get('/services/register', protect, authorize('Admin'), (req, res) => {
    res.render('services/services_new', { title: 'Register Service', service: null, user: req.user });
});

// Handle service registration
router.post('/services', protect, authorize('Admin'), registerService);

// Render service edit form
router.get('/services/edit/:id', protect, authorize('Admin'), async (req, res) => {
    const service = await Service.findById(req.params.id);
    if (!service) {
        return res.status(404).render('error', { title: 'Service Not Found', message: 'Service not found.' });
    }
    res.render('services/services_edit', { title: `Edit ${service.name}`, service, user: req.user });
});

// Handle service update
router.put('/services/:id', protect, authorize('Admin'), updateServiceById);

// Render single service details
router.get('/services/:id', async (req, res) => {
    const service = await Service.findById(req.params.id);
    if (!service) {
        return res.status(404).render('error', { title: 'Service Not Found', message: 'Service not found.' });
    }
    res.render('/services/services_detail', { title: service.name, service, user: req.user });
});

// Handle service deletion
router.delete('/services/:id', protect, authorize('Admin'), deleteServiceById);

module.exports = router;