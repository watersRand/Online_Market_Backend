from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Delivery
from .serializers import DeliverySerializer, DeliveryAssignSerializer, DeliveryStatusSerializer
from .permissions import IsAdminOrDeliveryPerson
from orders.models import Order
from users.models import User

class DeliveryListView(generics.ListAPIView):
    serializer_class = DeliverySerializer
    permission_classes = [IsAdminOrDeliveryPerson]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Delivery.objects.all()
        return Delivery.objects.filter(delivery_person=self.request.user)

class DeliveryAssignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != 'admin':
            return Response({"detail": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        serializer = DeliveryAssignSerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            delivery_person_id = serializer.validated_data['delivery_person_id']
            try:
                order = Order.objects.get(id=order_id)
                delivery_person = User.objects.get(id=delivery_person_id, role='delivery_person')
                delivery, created = Delivery.objects.get_or_create(
                    order=order,
                    defaults={'delivery_person': delivery_person}
                )
                if not created:
                    delivery.delivery_person = delivery_person
                    delivery.save()
                return Response(DeliverySerializer(delivery).data, status=status.HTTP_200_OK)
            except (Order.DoesNotExist, User.DoesNotExist):
                return Response({"detail": "Order or delivery person not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DeliveryStatusView(generics.UpdateAPIView):
    queryset = Delivery.objects.all()
    serializer_class = DeliveryStatusSerializer
    permission_classes = [IsAdminOrDeliveryPerson]
    
    def perform_update(self, serializer):
        serializer.save()