from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Order, OrderItem
from .serializers import OrderSerializer, OrderStatusSerializer
from .permissions import IsCustomerOrReadOnly, IsVendorOrAdmin
from products.models import Product
from django.contrib.sessions.models import Session

class CartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = request.session.get('cart', {})
        items = []
        for product_id, quantity in cart.items():
            product = Product.objects.get(id=product_id)
            items.append({'product': product, 'quantity': quantity})
        return Response({'cart': items})

    def post(self, request):
        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity', 1)
        cart = request.session.get('cart', {})
        cart[product_id] = cart.get(product_id, 0) + int(quantity)
        request.session['cart'] = cart
        request.session.modified = True
        return Response({'message': 'Item added to cart'})

    def delete(self, request):
        request.session['cart'] = {}
        request.session.modified = True
        return Response({'message': 'Cart cleared'})

class OrderListCreateView(generics.ListCreateAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsCustomerOrReadOnly]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Order.objects.all()
        if self.request.user.role == 'vendor' and self.request.user.is_approved:
            return Order.objects.filter(items__product__vendor=self.request.user).distinct()
        return Order.objects.filter(customer=self.request.user)

    def perform_create(self, serializer):
        cart = self.request.session.get('cart', {})
        if not cart:
            raise serializers.ValidationError("Cart is empty")
        items_data = [{'product_id': int(pid), 'quantity': qty} for pid, qty in cart.items()]
        serializer.save(items=items_data, customer=self.request.user)
        self.request.session['cart'] = {}
        self.request.session.modified = True

class OrderDetailView(generics.RetrieveAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

class OrderStatusView(generics.UpdateAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderStatusSerializer
    permission_classes = [IsVendorOrAdmin]