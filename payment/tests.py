from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User
from orders.models import Order
from products.models import Product
from .models import Payment
from unittest.mock import patch
from rest_framework.test import APITestCase
from rest_framework import status
from django.core import mail

class PaymentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='customer@example.com',
            email='customer@example.com',
            password='testpass123',
            full_name='Customer User',
            phone='254758635561',
            role='customer'
        )
        self.vendor = User.objects.create_user(
            username='vendor@example.com',
            email='vendor@example.com',
            password='testpass123',
            full_name='Vendor User',
            phone='1234567890',
            role='vendor',
            is_approved=True
        )
        self.product = Product.objects.create(
            vendor=self.vendor,
            name='Test Product',
            price=10.00,
            quantity=100,
            type='tangible',
            category='vegetable'
        )
        self.order = Order.objects.create(customer=self.customer, total_price=20.00)
        self.client.force_authenticate(user=self.customer)

    @patch('payment.views.requests.get')
    @patch('payment.views.requests.post')
    def test_initiate_payment(self, mock_post, mock_get):
        mock_get.return_value.json.return_value = {'access_token': 'test_token'}
        mock_post.return_value.json.return_value = {'ResponseCode': '0'}
        response = self.client.post('/api/payment/initiate/', {
            'order_id': self.order.id,
            'phone_number': '254758635561'
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Payment.objects.filter(order=self.order, status='pending').exists())

    @patch('django.core.mail.send_mail')
    def test_payment_callback(self, mock_send_mail):
        payment = Payment.objects.create(order=self.order, amount=20.00, status='pending')
        callback_data = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": "test_merchant_id",
                    "CheckoutRequestID": "test_checkout_id",
                    "ResultCode": 0,
                    "ResultDesc": "Success",
                    "CallbackMetadata": {
                        "Item": [
                            {"Name": "Amount", "Value": 100},
                            {"Name": "MpesaReceiptNumber", "Value": "test_receipt"}
                        ]
                    }
                }
            }
        }
        mail.outbox = []
        response = self.client.post(
            f'/api/payment/callback/{payment.id}/',
            callback_data,
            format='json'  
        )
        # Assertions
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'completed')

        # Check email was sent via locmem backend
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'Payment Receipt for Order 2')
        self.assertEqual(email.to, [self.customer.email])