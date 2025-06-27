from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User
from orders.models import Order
from products.models import Product
from .models import Delivery

class DeliveryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin@example.com',
            email='admin@example.com',
            password='testpass123',
            full_name='Admin User',
            phone='1234567890',
            role='admin'
        )
        self.delivery_person = User.objects.create_user(
            username='delivery@example.com',
            email='delivery@example.com',
            password='testpass123',
            full_name='Delivery Person',
            phone='0987654321',
            role='delivery_person'
        )
        self.customer = User.objects.create_user(
            username='customer@example.com',
            email='customer@example.com',
            password='testpass123',
            full_name='Customer User',
            phone='1122334455',
            role='customer'
        )
        self.vendor = User.objects.create_user(
            username='vendor@example.com',
            email='vendor@example.com',
            password='testpass123',
            full_name='Vendor User',
            phone='2233445566',
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
        self.client.force_authenticate(user=self.admin)

    def test_assign_delivery(self):
        response = self.client.post('/api/deliveries/assign/', {
            'order_id': self.order.id,
            'delivery_person_id': self.delivery_person.id
        })
        self.assertEqual(response.status_code, 200)
        delivery = Delivery.objects.get(order=self.order)
        self.assertEqual(delivery.delivery_person, self.delivery_person)

    def test_update_delivery_status(self):
        delivery = Delivery.objects.create(
            order=self.order,
            delivery_person=self.delivery_person,  # Make sure this is set
            status='pending'
        )
        self.client.force_authenticate(user=self.delivery_person)
        response = self.client.put(
            f'/api/deliveries/{delivery.id}/status/',
            {
                'status': 'in_transit',
                'location': 'Campus B'
            },
            format='json'
        )
        print(response.content)
        
        self.assertEqual(response.status_code, 200)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'in_transit')
        self.assertEqual(delivery.location, 'Campus B')
        
    def test_unauthorized_delivery_assignment(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.post('/api/deliveries/assign/', {
            'order_id': self.order.id,
            'delivery_person_id': self.delivery_person.id
        })
        self.assertEqual(response.status_code, 403)