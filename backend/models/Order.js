const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    customerId: { type: String, required: true },
    orderDate: { type: Date, default: Date.now },
    field: { type: String, required: true },
    orderId: { type: String, required: true },
    price: { type: Number, required: true }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
