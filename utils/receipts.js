// const nodemailer = require('nodemailer'); // If sending emails

const generateDigitalReceipt = async (order, payment) => {
    try {
        const receiptDetails = `
        ----- DIGITAL RECEIPT -----

        Order ID: ${order._id}
        Customer: ${order.user.name} (${order.user.email})
        Total Amount: KES ${order.totalAmount.toFixed(2)}

        Payment Details:
        Transaction Type: M-Pesa STK Push
        M-Pesa Receipt No: ${payment.mpesaCallback.MpesaReceiptNumber}
        Amount Paid: KES ${payment.mpesaCallback.Amount.toFixed(2)}
        Phone Number: ${payment.mpesaCallback.PhoneNumber}
        Transaction Date: ${payment.mpesaCallback.TransactionDate.toLocaleString()}
        Payment Status: ${payment.status.toUpperCase()}

        Items:
        ${order.items.map(item => `- ${item.product.name} x ${item.quantity} @ KES ${item.price.toFixed(2)}`).join('\n')}

        ---------------------------
        Thank you for your purchase!
        `;

        console.log('\n' + receiptDetails + '\n'); // Log to console

        // --- Option 1: Save to file (for logging/auditing) ---
        const fs = require('fs/promises');
        const fileName = `receipts/order_${order._id}_${Date.now()}.txt`;
        await fs.mkdir('receipts', { recursive: true }); // Ensure directory exists
        await fs.writeFile(fileName, receiptDetails);
        console.log(`Receipt saved to ${fileName}`);

        // --- Option 2: Send email (requires Nodemailer and email credentials) ---
        /*
        const transporter = nodemailer.createTransport({
            service: 'Gmail', // or your SMTP details
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: order.user.email,
            subject: `Your Receipt for Order ${order._id}`,
            text: receiptDetails,
            // html: `<p>HTML version of receipt</p>` // For richer emails
        };

        await transporter.sendMail(mailOptions);
        console.log(`Receipt email sent to ${order.user.email}`);
        */

    } catch (error) {
        console.error('Error generating or sending digital receipt:', error);
    }
};

module.exports = { generateDigitalReceipt };