import africastalking
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from orders.models import Order
from payment.models import Payment
from delivery.models import Delivery
from .models import Notification

# Initialize Africa's Talking SMS
africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
sms = africastalking.SMS

# Helper function to send in-app notification
def send_in_app_notification(recipient, notification_type, message):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_{recipient.id}",
        {
            'type': 'send_notification',
            'message': {
                'type': notification_type,
                'message': message,
                'created_at': str(Notification.objects.latest('created_at').created_at)
            }
        }
    )
    Notification.objects.create(
        recipient=recipient,
        type=notification_type,
        channel='in_app',
        message=message,
        status='sent'
    )

@receiver(post_save, sender=Order)
def send_order_placed_notification(sender, instance, created, **kwargs):
    if created:
        # SMS Notification
        message = f"Dear {instance.customer.full_name}, your order #{instance.id} has been placed successfully."
        phone_number = instance.customer.phone
        try:
            sms.send(message, [phone_number])
            Notification.objects.create(
                recipient=instance.customer,
                type='order_placed',
                channel='sms',
                message=message,
                phone_number=phone_number,
                status='sent'
            )
        except Exception as e:
            Notification.objects.create(
                recipient=instance.customer,
                type='order_placed',
                channel='sms',
                message=message,
                phone_number=phone_number,
                status='failed'
            )
        # In-App Notification
        send_in_app_notification(instance.customer, 'order_placed', message)

@receiver(post_save, sender=Payment)
def send_payment_completed_notification(sender, instance, created, **kwargs):
    if instance.status == 'completed':
        # SMS Notification
        message = f"Dear {instance.order.customer.full_name}, payment of KES {instance.amount} for Order #{instance.order.id} received. M-Pesa Code: {instance.mpesa_code}."
        phone_number = instance.order.customer.phone
        try:
            sms.send(message, [phone_number])
            Notification.objects.create(
                recipient=instance.order.customer,
                type='payment_completed',
                channel='sms',
                message=message,
                phone_number=phone_number,
                status='sent'
            )
        except Exception as e:
            Notification.objects.create(
                recipient=instance.order.customer,
                type='payment_completed',
                channel='sms',
                message=message,
                phone_number=phone_number,
                status='failed'
            )
        # In-App Notification
        send_in_app_notification(instance.order.customer, 'payment_completed', message)

@receiver(post_save, sender=Delivery)
def send_delivery_notifications(sender, instance, created, **kwargs):
    if created:
        # Customer SMS and In-App
        customer_message = f"Dear {instance.order.customer.full_name}, your Order #{instance.order.id} has been assigned for delivery."
        try:
            sms.send(customer_message, [instance.order.customer.phone])
            Notification.objects.create(
                recipient=instance.order.customer,
                type='delivery_assigned',
                channel='sms',
                message=customer_message,
                phone_number=instance.order.customer.phone,
                status='sent'
            )
        except Exception as e:
            Notification.objects.create(
                recipient=instance.order.customer,
                type='delivery_assigned',
                channel='sms',
                message=customer_message,
                phone_number=instance.order.customer.phone,
                status='failed'
            )
        send_in_app_notification(instance.order.customer, 'delivery_assigned', customer_message)

        # Delivery Person SMS and In-App
        delivery_message = f"Dear {instance.delivery_person.full_name}, you have been assigned to deliver Order #{instance.order.id}."
        try:
            sms.send(delivery_message, [instance.delivery_person.phone])
            Notification.objects.create(
                recipient=instance.delivery_person,
                type='delivery_assigned',
                channel='sms',
                message=delivery_message,
                phone_number=instance.delivery_person.phone,
                status='sent'
            )
        except Exception as e:
            Notification.objects.create(
                recipient=instance.delivery_person,
                type='delivery_assigned',
                channel='sms',
                message=delivery_message,
                phone_number=instance.delivery_person.phone,
                status='failed'
            )
        send_in_app_notification(instance.delivery_person, 'delivery_assigned', delivery_message)

    elif instance.status in ['picked_up', 'in_transit', 'delivered', 'cancelled']:
        # Customer SMS and In-App
        message = f"Dear {instance.order.customer.full_name}, your Order #{instance.order.id} is now {instance.status} at {instance.location or 'unknown location'}."
        try:
            sms.send(message, [instance.order.customer.phone])
            Notification.objects.create(
                recipient=instance.order.customer,
                type='delivery_status',
                channel='sms',
                message=message,
                phone_number=instance.order.customer.phone,
                status='sent'
            )
        except Exception as e:
            Notification.objects.create(
                recipient=instance.order.customer,
                type='delivery_status',
                channel='sms',
                message=message,
                phone_number=instance.order.customer.phone,
                status='failed'
            )
        send_in_app_notification(instance.order.customer, 'delivery_status', message)