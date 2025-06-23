from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User
from .models import Product

class ProductTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.vendor = User.objects.create_user(
            username='vendor@example.com',
            email='vendor@example.com',
            password='testpass123',
            full_name='Vendor User',
            phone='1234567890',
            role='vendor',
            is_approved=True
        )
        self.customer = User.objects.create_user(
            username='customer@example.com',
            email='customer@example.com',
            password='testpass123',
            full_name='Customer User',
            phone='0987654321',
            role='customer'
        )
        self.client.force_authenticate(user=self.vendor)
        self.product_data = {
            'vendor': self.vendor,  # Pass the User instance directly
            'name': 'Test Product',
            'description': 'A test product',
            'price': 10.00,
            'quantity': 100,
            'type': 'tangible',
            'category': 'vegetable'
        }

        self.post_data = {
            'vendor': self.vendor.id,  # For API requests
            'name': 'Test Product',
            'description': 'A test product',
            'price': 10.00,
            'quantity': 100,
            'type': 'tangible',
            'category': 'vegetable'
        }

    def test_create_product_with_ID(self):
        response = self.client.post('/api/products/', self.post_data)  # Use post_data here
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Product.objects.filter(name='Test Product').exists())

    def test_unauthorized_create_product(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.post('/api/products/', self.product_data)
        self.assertEqual(response.status_code, 403)

    def test_list_products(self):
        Product.objects.create(**self.product_data)
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_filter_products(self):
        Product.objects.create(**self.product_data)
        response = self.client.get('/api/products/filter/?type=tangible&category=vegetable')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)