// models/productModel.js

const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    imageUrl: {
        type: String,
        required: false,
    },
    category: {
        type: String,
        enum: ['Barber and Beauty', 'Computer repair', 'Landscape']
    },
    review: {
        type: String,
        required: false
    },
    choice: {
        type: String,
        enum: ['Independent', 'Company']
    }
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;