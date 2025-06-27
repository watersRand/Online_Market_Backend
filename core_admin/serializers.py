from rest_framework import serializers
from .models import Complaint
from orders.models import Order
from orders.serializers import OrderSerializer
from users.models import User

class ComplaintSerializer(serializers.ModelSerializer):
    order = OrderSerializer(read_only=True)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = Complaint
        fields = ['id', 'user', 'order', 'description', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class ComplaintCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ['order', 'description']

class AnalyticsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    total_orders = serializers.IntegerField()
    total_revenue = serializers.FloatField()
    orders_by_status = serializers.ListField(child=serializers.DictField())