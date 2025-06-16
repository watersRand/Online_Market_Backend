from django.test import TestCase
from rest_framework.test import APIClient
from .models import User

class UserTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_data = {
            'full_name': 'Test User',
            'email': 'test@example.com',
            'phone': '1234567890',
            'id_number': 'ID123',
            'password': 'testpass123',
            'role': 'customer',
            'location': 'Campus A'
        }

    def test_register_customer(self):
        response = self.client.post('/api/register/', self.user_data)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email='test@example.com').exists())

    def test_register_vendor_unapproved(self):
        vendor_data = {**self.user_data, 'role': 'vendor', 'email': 'vendor@example.com'}
        response = self.client.post('/api/register/', vendor_data)
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email='vendor@example.com')
        self.assertFalse(user.is_approved)