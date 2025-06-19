from rest_framework import serializers
from models import  Order,OrderItem

class OrderSerializer(serializers.ModelSerializer):
    """Serializer for the Order model."""
    orderitem_set = OrderItemSerializer(many=True, read_only=True) # Nested serializer for order items
    class Meta:
        model = Order
        fields = '__all__'

class OrderSerializer(serializers.ModelSerializer):
    """Serializer for the Order model."""
    orderitem_set = OrderItemSerializer(many=True, read_only=True) # Nested serializer for order items
    class Meta:
        model = Order
        fields = '__all__'