from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Notification
from .serializers import NotificationSerializer
from .permissions import IsAdminOrRecipient

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, IsAdminOrRecipient]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Notification.objects.all()
        return Notification.objects.filter(recipient=self.request.user)