from rest_framework import serializers
from .models import Payment

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'order', 'amount', 'status', 'mpesa_code', 'timestamp']
        read_only = fields=['id', 'status', 'mpesa_code', 'timestamp']

class PaymentInitiateSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    phone_number = serializers.CharField(max_length=12)  # e.g., 2547XXXXXXXX