from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Product
from .serializers import ProductSerializer
from .permissions import IsVendorOrReadOnly

class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsVendorOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(vendor=self.request.user)

class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsVendorOrReadOnly]

class ProductFilterView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsVendorOrReadOnly]

    def get_queryset(self):
        queryset = Product.objects.all()
        type_filter = self.request.query_params.get('type')
        category_filter = self.request.query_params.get('category')
        if type_filter:
            queryset = queryset.filter(type=type_filter)
        if category_filter:
            queryset = queryset.filter(category=category_filter)
        return queryset