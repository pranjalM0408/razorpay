const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const Order = require('./models/Order');

const app = express();
const port = 5000;

app.use(express.json());
app.use(cors());

const invoiceDir = path.join(__dirname, 'invoices');
if (!fs.existsSync(invoiceDir)) {
    fs.mkdirSync(invoiceDir);
}

app.use('/invoices', express.static(invoiceDir));

console.log('Connecting to MongoDB...');

mongoose.connect('mongodb://localhost:27017/orders', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('Failed to connect to MongoDB:', err);
    });

app.get('/', (req, res) => {
    res.send('Server is running');
});

// Webhook endpoint to receive webhook events from Razorpay
app.post('/api/webhook', (req, res) => {
    const secret = 'dfl123'; // Razorpay webhook secret (found in dashboard)
    
    const signature = req.headers['x-razorpay-signature']; // Razorpay sends the signature in this header
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto.createHmac('sha256', secret)
        .update(body)
        .digest('hex');

    if (expectedSignature === signature) {
        console.log('Webhook signature verified.');
        // Process the webhook payload here
        console.log('Webhook payload:', req.body);

        res.status(200).send('Webhook received successfully');
    } else {
        console.error('Invalid signature');
        res.status(400).send('Invalid signature');
    }
});

app.post('/api/order', async (req, res) => {
    console.log('Received request to /api/order endpoint');
    const { userId, customerId, field, orderId, price } = req.body;
    const numericPrice = parseFloat(price);

    try {
        const newOrder = new Order({ userId, customerId, field, orderId, price });
        await newOrder.save();
        console.log('Order saved to MongoDB:', newOrder);

        const doc = new PDFDocument();
        const fileName = `invoice_${orderId}.pdf`;
        const outputPath = path.join(invoiceDir, fileName);

        console.log('Saving invoice to:', outputPath);

        doc.pipe(fs.createWriteStream(outputPath));

        doc.fontSize(20).text('Invoice', { align: 'center' });
        doc.fontSize(12).text(`Order ID: ${orderId}`);
        doc.text(`Customer ID: ${customerId}`);
        doc.text(`Order Date: ${newOrder.orderDate.toLocaleDateString()}`);
        doc.text(`Field: ${field}`);
        doc.text(`Price: ₹${numericPrice.toFixed(2)}`);
        doc.fontSize(10).text('\nThank You for your Order!', { align: 'center' });

        doc.end();
        console.log('Invoice PDF generated:', outputPath);

        res.json({ message: 'Order placed and invoice generated', invoice: fileName });
    } catch (error) {
        
        console.error('Error processing order:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/razorpay_callback', async (req, res) => {
    const { code, state } = req.query;

    const clientId = 'OszdAlBYHp1avP';
    const clientSecret = 'XecbMAYn9Pms6zIF7GRiVWWJ'; 
    const redirectUri = 'http://localhost:5000/razorpay_callback';

    const tokenUrl = 'https://api.razorpay.com/v1/oauth/token';

    try {
        const response = await axios.post(tokenUrl,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token } = response.data;
        console.log('Access Token:', access_token);

        res.send('Authorization successful! Access token received.');
    } catch (error) {
       
        console.error('Error obtaining access token:', error.response ? error.response.data : error.message);
        res.status(500).send('Error obtaining access token');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
