from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum
from .models import Complaint
from .serializers import ComplaintSerializer, ComplaintCreateSerializer, AnalyticsSerializer
from users.models import User
from orders.models import Order
from django.contrib.auth import get_user_model

User = get_user_model()

class ComplaintCreateView(generics.CreateAPIView):
    queryset = Complaint.objects.all()
    serializer_class = ComplaintCreateSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ComplaintListView(generics.ListAPIView):
    serializer_class = ComplaintSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Complaint.objects.all()
        elif self.request.user.role == 'vendor':
            return Complaint.objects.filter(order__orderitem__product__vendor=self.request.user).distinct()
        return Complaint.objects.filter(user=self.request.user)

class ComplaintResolveView(generics.UpdateAPIView):
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in ('admin', 'vendor'):
            return Complaint.objects.all()
        return Complaint.objects.none()

    def perform_update(self, serializer):
        serializer.save(status='resolved')

class AnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'admin':
            data = {
                'total_users': User.objects.count(),
                'total_orders': Order.objects.count(),
                'total_revenue': Order.objects.aggregate(total=Sum('total_price'))['total'] or 0,
                'orders_by_status': list(Order.objects.values('status').annotate(count=Count('id'))),
            }
        elif request.user.role == 'vendor':
            data = {
                'total_users': 0,  # Vendors don't see user counts
                'total_products': Product.objects.filter(vendor=request.user).count(),
                'total_orders': Order.objects.filter(orderitem__product__vendor=request.user).count(),
                'total_revenue': Order.objects.filter(orderitem__product__vendor=request.user).aggregate(total=Sum('total_price'))['total'] or 0,
                'orders_by_status': list(Order.objects.filter(orderitem__product__vendor=request.user).values('status').annotate(count=Count('id'))),
            }
        else:
            return Response({"detail": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        serializer = AnalyticsSerializer(data)
        return Response(serializer.data)