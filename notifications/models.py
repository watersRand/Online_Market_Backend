from django.db import models
from users.models import User

class Notification(models.Model):
    TYPE_CHOICES = (
        ('order_placed', 'Order Placed'),
        ('payment_completed', 'Payment Completed'),
        ('delivery_assigned', 'Delivery Assigned'),
        ('delivery_status', 'Delivery Status Update'),
    )
    CHANNEL_CHOICES = (
        ('sms', 'SMS'),
        ('in_app', 'In-App'),
    )

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    message = models.TextField()
    phone_number = models.CharField(max_length=15, blank=True)  # Used for SMS only
    status = models.CharField(max_length=20, default='sent')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} notification ({self.channel}) to {self.recipient.full_name} at {self.created_at}"