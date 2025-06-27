from django.contrib import admin
from users.models import User
from products.models import Product
from orders.models import Order, OrderItem
from payment.models import Payment
from delivery.models import Delivery
from notifications.models import Notification

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'role', 'is_approved', 'is_active')
    list_filter = ('role', 'is_approved', 'is_active')
    search_fields = ('full_name', 'email', 'phone')
    actions = ['approve_vendors']

    def approve_vendors(self, request, queryset):
        queryset.filter(role='vendor').update(is_approved=True)
    approve_vendors.short_description = "Approve selected vendors"

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'vendor', 'type', 'category', 'price', 'quantity', 'created_at')
    list_filter = ('type', 'category', 'vendor')
    search_fields = ('name', 'description')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'total_price', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('customer__full_name', 'customer__email')

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity')
    list_filter = ('order__status',)

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'amount', 'status', 'mpesa_code', 'timestamp')
    list_filter = ('status', 'timestamp')
    search_fields = ('order__id', 'mpesa_code')

@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'delivery_person', 'status', 'location', 'assigned_at')
    list_filter = ('status', 'delivery_person')
    search_fields = ('order__id', 'delivery_person__full_name')
    actions = ['assign_delivery_person']

    def assign_delivery_person(self, request, queryset):
        if not request.POST.get('delivery_person_id'):
            self.message_user(request, "Please select a delivery person.")
            return
        try:
            delivery_person = User.objects.get(id=request.POST['delivery_person_id'], role='delivery_person')
            queryset.update(delivery_person=delivery_person)
            self.message_user(request, f"Assigned {delivery_person.full_name} to selected deliveries.")
        except User.DoesNotExist:
            self.message_user(request, "Delivery person not found.")
    assign_delivery_person.short_description = "Assign selected deliveries to a delivery person"

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'recipient', 'type', 'channel', 'phone_number', 'status', 'created_at')
    list_filter = ('type', 'channel', 'status', 'created_at')
    search_fields = ('recipient__full_name', 'phone_number', 'message')