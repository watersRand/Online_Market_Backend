const axios = require('axios');
const moment = require('moment'); // For timestamp generation
const dotenv = require('dotenv');
const { Buffer } = require('buffer'); // Node.js built-in module

dotenv.config();

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_LIPA_NA_MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_LIPA_NA_MPESA_PASSKEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL; // Your public URL for M-Pesa callbacks

const MPESA_AUTH_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const MPESA_STK_PUSH_URL = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
const MPESA_QUERY_STATUS_URL = 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/queryid';

// Use sandbox URLs for development:
if (process.env.NODE_ENV !== 'production') {
    MPESA_AUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    MPESA_STK_PUSH_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
    MPESA_QUERY_STATUS_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/queryid';
}


// Function to get M-Pesa Daraja Access Token
const getAccessToken = async () => {
    try {
        const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
        const response = await axios.get(MPESA_AUTH_URL, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting M-Pesa access token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to get M-Pesa access token.');
    }
};

// Function to initiate STK Push
const initiateSTKPush = async (amount, phoneNumber, accountReference, transactionDesc) => {
    try {
        const accessToken = await getAccessToken();
        const timestamp = moment().format('YYYYMMDDHHmmss');
        const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

        const requestBody = {
            BusinessShortCode: SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline', // Or 'CustomerBuyGoodsOnline' for Till numbers
            Amount: Math.ceil(amount), // M-Pesa only accepts whole numbers
            PartyA: phoneNumber, // Customer's phone number
            PartyB: SHORTCODE, // Your Paybill/Till number
            PhoneNumber: phoneNumber, // Customer's phone number
            CallBackURL: CALLBACK_URL,
            AccountReference: accountReference, // e.g., Order ID
            TransactionDesc: transactionDesc // e.g., "Payment for Order XYZ"
        };

        const response = await axios.post(MPESA_STK_PUSH_URL, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data; // Contains MerchantRequestID, CheckoutRequestID, ResponseCode, etc.

    } catch (error) {
        console.error('Error initiating STK Push:', error.response ? error.response.data : error.message);
        throw new Error('Failed to initiate M-Pesa STK Push.');
    }
};

// Function to query STK Push status (optional, but good for robust systems)
const querySTKPushStatus = async (checkoutRequestId) => {
    try {
        const accessToken = await getAccessToken();
        const timestamp = moment().format('YYYYMMDDHHmmss');
        const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

        const requestBody = {
            BusinessShortCode: SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestId
        };

        const response = await axios.post(MPESA_QUERY_STATUS_URL, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data; // Contains ResultCode, ResultDesc etc.

    } catch (error) {
        console.error('Error querying STK Push status:', error.response ? error.response.data : error.message);
        throw new Error('Failed to query M-Pesa STK Push status.');
    }
};


module.exports = {
    initiateSTKPush,
    querySTKPushStatus,
    getAccessToken // Export for testing or if needed elsewhere
};