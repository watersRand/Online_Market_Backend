from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User
from products.models import Product
from rest_framework import serializers
from .models import Order, OrderItem

class OrderTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='customer@example.com',
            email='customer@example.com',
            password='testpass123',
            full_name='Customer User',
            phone='0987654321',
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
        self.client.force_authenticate(user=self.customer)

    def test_add_to_cart(self):
        response = self.client.post('/api/cart/', {'product_id': self.product.id, 'quantity': 2})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.session['cart'][str(self.product.id)], 2)

    def test_create_order(self):
        # First simulate adding item to cart
        session = self.client.session
        session['cart'] = {str(self.product.id): 2}
        session.save()
        
        # Then create order (should use cart from session)
        response = self.client.post('/api/orders/')
        
        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(customer=self.customer)
        self.assertEqual(order.total_price, 20.00)
        self.assertEqual(order.items.count(), 1)

    def test_update_order_status(self):
        order = Order.objects.create(customer=self.customer, total_price=20.00)
        OrderItem.objects.create(order=order, product=self.product, quantity=2)
        self.client.force_authenticate(user=self.vendor)
        response = self.client.put(f'/api/orders/{order.id}/status/', {'status': 'delivered'})
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, 'delivered')

    def test_unauthorized_status_update(self):
        order = Order.objects.create(customer=self.customer, total_price=20.00)
        self.client.force_authenticate(user=self.customer)
        response = self.client.put(f'/api/orders/{order.id}/status/', {'status': 'delivered'})
        self.assertEqual(response.status_code, 403)
