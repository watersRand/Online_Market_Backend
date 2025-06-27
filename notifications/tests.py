from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User
from orders.models import Order
from products.models import Product
from payment.models import Payment
from delivery.models import Delivery
from .models import Notification
from unittest.mock import patch
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from notifications.consumers import NotificationConsumer
from campus_delivery.asgi import application

class NotificationTests(TestCase):
    async def asyncSetUp(self):
        self.customer = await database_sync_to_async(User.objects.create_user)(
            username='customer@example.com',
            email='customer@example.com',
            password='testpass123',
            full_name='Customer User',
            phone='+254712345678',
            role='customer'
        )
        self.delivery_person = await database_sync_to_async(User.objects.create_user)(
            username='delivery@example.com',
            email='delivery@example.com',
            password='testpass123',
            full_name='Delivery Person',
            phone='+254798765432',
            role='delivery_person'
        )
        self.admin = await database_sync_to_async(User.objects.create_user)(
            username='admin@example.com',
            email='admin@example.com',
            password='testpass123',
            full_name='Admin User',
            phone='+254723456789',
            role='admin'
        )
        self.vendor = await database_sync_to_async(User.objects.create_user)(
            username='vendor@example.com',
            email='vendor@example.com',
            password='testpass123',
            full_name='Vendor User',
            phone='+254734567890',
            role='vendor',
            is_approved=True
        )
        self.product = await database_sync_to_async(Product.objects.create)(
            vendor=self.vendor,
            name='Test Product',
            price=10.00,
            quantity=100,
            type='tangible',
            category='vegetable'
        )
        self.order = await database_sync_to_async(Order.objects.create)(customer=self.customer, total_price=20.00)
        self.client = APIClient()
        await database_sync_to_async(self.client.force_authenticate)(user=self.customer)

    def setUp(self):
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self.asyncSetUp())

    @patch('africastalking.SMS.send')
    def test_order_placed_notification(self, mock_sms):
        mock_sms.return_value = {'SMSMessageData': {'Message': 'Sent to 1/1'}}
        order = Order.objects.create(customer=self.customer, total_price=30.00)
        notifications = Notification.objects.filter(type='order_placed', recipient=self.customer)
        self.assertEqual(notifications.count(), 2)  # SMS and in-app
        sms_notification = notifications.get(channel='sms')
        in_app_notification = notifications.get(channel='in_app')
        self.assertEqual(sms_notification.status, 'sent')
        self.assertEqual(in_app_notification.status, 'sent')
        mock_sms.assert_called_with(
            f"Dear {self.customer.full_name}, your order #{order.id} has been placed successfully.",
            [self.customer.phone]
        )

    @patch('africastalking.SMS.send')
    async def test_websocket_notification(self, mock_sms):
        mock_sms.return_value = {'SMSMessageData': {'Message': 'Sent to 1/1'}}
        communicator = WebsocketCommunicator(application, "/ws/notifications/")
        communicator.scope['user'] = self.customer
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await database_sync_to_async(Order.objects.create)(customer=self.customer, total_price=30.00)
        message = await communicator.receive_json_from()
        self.assertEqual(message['type'], 'order_placed')
        self.assertIn(f"Dear {self.customer.full_name}, your order #", message['message'])
        await communicator.disconnect()

    def test_notification_list(self):
        Notification.objects.create(
            recipient=self.customer,
            type='order_placed',
            channel='in_app',
            message='Test in-app notification',
            status='sent'
        )
        self.client.force_authenticate(user=self.customer)
        response = self.client.get('/api/notifications/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)