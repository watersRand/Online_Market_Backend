from rest_framework import serializers
from .models import Product
from users.models import User

class ProductSerializer(serializers.ModelSerializer):
    vendor = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role='vendor', is_approved=True))

    class Meta:
        model = Product
        fields = ['id', 'vendor', 'name', 'description', 'price', 'quantity', 'image', 'type', 'category', 'created_at']
        read_only_fields = ['id', 'created_at']