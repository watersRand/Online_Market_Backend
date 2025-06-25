from rest_framework import serializers
from .models import Delivery
from orders.serializers import OrderSerializer
from users.models import User

class DeliverySerializer(serializers.ModelSerializer):
    order = OrderSerializer(read_only=True)
    delivery_person = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role='delivery_person'), allow_null=True)

    class Meta:
        model = Delivery
        fields = ['id', 'order', 'delivery_person', 'status', 'location', 'assigned_at', 'updated_at']
        read_only_fields = ['id', 'assigned_at', 'updated_at']

class DeliveryAssignSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    delivery_person_id = serializers.IntegerField()

class DeliveryStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Delivery
        fields=['status', 'location']