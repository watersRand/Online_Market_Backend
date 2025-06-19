from django.shortcuts import render
from .models import Product
from .serializers import ProductSerializer
# Create your views here.
from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

# Create your views here.

# Product API Views
class ProductList(generics.ListAPIView):
    """
    API view to list all products.
    GET /api/products/
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class ProductDetail(generics.RetrieveAPIView):
    """
    API view to retrieve a single product by ID.
    GET /api/products/<int:pk>/
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer