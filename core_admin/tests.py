from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User
from products.models import Product
from orders.models import Order
from .models import Complaint
from notifications.models import Notification
from django.urls import reverse

class AdminTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin@example.com',
            email='admin@example.com',
            password='testpass123',
            full_name='Admin User',
            phone='+254723456789',
            role='admin',
            is_staff=True
        )
        self.vendor = User.objects.create_user(
            username='vendor@example.com',
            email='vendor@example.com',
            password='testpass123',
            full_name='Vendor User',
            phone='+254734567890',
            role='vendor',
            is_approved=True,
            is_staff=True
        )
        self.customer = User.objects.create_user(
            username='customer@example.com',
            email='customer@example.com',
            password='testpass123',
            full_name='Customer User',
            phone='+254712345678',
            role='customer'
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

    def test_create_complaint(self):
        response = self.client.post(reverse('complaint-create'), {
            'order': self.order.id,
            'description': 'Product was not delivered on time.'
        })
        self.assertEqual(response.status_code, 201)
        complaint = Complaint.objects.get(order=self.order)
        self.assertEqual(complaint.user, self.customer)
        notification = Notification.objects.get(type='complaint_status', recipient=self.customer, channel='in_app')
        self.assertEqual(notification.message, f"Dear {self.customer.full_name}, your complaint #{complaint.id} for Order #{self.order.id} has been received.")

    def test_vendor_complaint_list(self):
        Complaint.objects.create(user=self.customer, order=self.order, description='Test complaint')
        self.client.force_authenticate(user=self.vendor)
        response = self.client.get(reverse('complaint-list'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_resolve_complaint(self):
        complaint = Complaint.objects.create(user=self.customer, order=self.order, description='Test complaint')
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(reverse('complaint-resolve', kwargs={'pk': complaint.id}), {'status': 'resolved'})
        self.assertEqual(response.status_code, 200)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'resolved')
        notification = Notification.objects.get(type='complaint_status', recipient=self.customer, channel='in_app', status='sent')
        self.assertEqual(notification.message, f"Dear {self.customer.full_name}, your complaint #{complaint.id} for Order #{complaint.order.id} has been resolved.")

    def test_analytics_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('analytics'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('total_users', response.data)
        self.assertIn('total_orders', response.data)
        self.assertIn('total_revenue', response.data)
        self.assertIn('orders_by_status', response.data)

    def test_analytics_vendor(self):
        self.client.force_authenticate(user=self.vendor)
        response = self.client.get(reverse('analytics'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('total_products', response.data)
        self.assertIn('total_orders', response.data)
        self.assertIn('total_revenue', response.data)
        self.assertIn('orders_by_status', response.data)
        self.assertEqual(response.data['total_users'], 0)