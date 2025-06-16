from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone', 'id_number', 'role', 'is_approved', 'location']
        read_only_fields = ['id', 'is_approved']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['full_name', 'email', 'phone', 'id_number', 'password', 'role', 'location']

    def create(self, validated_data):
        user = User(
            username=validated_data['email'],  # Use email as username
            full_name=validated_data['full_name'],
            email=validated_data['email'],
            phone=validated_data['phone'],
            id_number=validated_data.get('id_number'),
            role=validated_data['role'],
            location=validated_data.get('location', ''),
        )
        user.set_password(validated_data['password'])
        if user.role != 'vendor':
            user.is_approved = True  # Auto-approve non-vendors
        user.save()
        return user