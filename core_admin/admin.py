from django.contrib import admin
from django.db.models import Count, Sum
from users.models import User
from products.models import Product
from orders.models import Order, OrderItem
from payment.models import Payment
from delivery.models import Delivery
from notifications.models import Notification
from core_admin.models import Complaint

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'role', 'is_approved', 'is_active', 'phone')
    list_filter = ('role', 'is_approved', 'is_active')
    search_fields = ('full_name', 'email', 'phone')
    actions = ['approve_vendors']
    readonly_fields = ('id', 'date_joined')

    def approve_vendors(self, request, queryset):
        queryset.filter(role='vendor').update(is_approved=True)
    approve_vendors.short_description = "Approve selected vendors"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == 'vendor':
            return qs.filter(id=request.user.id)
        return qs

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'vendor', 'type', 'category', 'price', 'quantity', 'created_at')
    list_filter = ('type', 'category', 'vendor')
    search_fields = ('name', 'description')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == 'vendor':
            return qs.filter(vendor=request.user)
        return qs

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'total_price', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('customer__full_name', 'customer__email')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == 'vendor':
            return qs.filter(orderitem__product__vendor=request.user).distinct()
        return qs

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity')
    list_filter = ('order__status',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == 'vendor':
            return qs.filter(product__vendor=request.user)
        return qs

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'amount', 'status', 'mpesa_code', 'timestamp')
    list_filter = ('status', 'timestamp')
    search_fields = ('order__id', 'mpesa_code')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == 'vendor':
            return qs.filter(order__orderitem__product__vendor=request.user).distinct()
        return qs

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

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == 'vendor':
            return qs.filter(order__orderitem__product__vendor=request.user).distinct()
        elif request.user.role == 'delivery_person':
            return qs.filter(delivery_person=request.user)
        return qs

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'recipient', 'type', 'channel', 'phone_number', 'status', 'created_at')
    list_filter = ('type', 'channel', 'status', 'created_at')
    search_fields = ('recipient__full_name', 'phone_number', 'message')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role in ('vendor', 'delivery_person', 'customer'):
            return qs.filter(recipient=request.user)
        return qs

@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'order', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__full_name', 'order__id', 'description')
    actions = ['resolve_complaints']

    def resolve_complaints(self, request, queryset):
        queryset.update(status='resolved')
        for complaint in queryset:
            Notification.objects.create(
                recipient=complaint.user,
                type='complaint_status',
                channel='in_app',
                message=f"Your complaint #{complaint.id} for Order #{complaint.order.id} has been resolved.",
                status='sent'
            )
    resolve_complaints.short_description = "Mark selected complaints as resolved"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == 'vendor':
            return qs.filter(order__orderitem__product__vendor=request.user).distinct()
        elif request.user.role == 'customer':
            return qs.filter(user=request.user)
        return qs

# Custom admin site for analytics
class CampusAdminSite(admin.AdminSite):
    site_header = "Campus Delivery Admin"
    site_title = "Campus Delivery Admin"
    index_title = "Admin Dashboard"

    def get_app_list(self, request):
        app_list = super().get_app_list(request)
        if request.user.role == 'vendor':
            allowed_apps = ['users', 'products', 'orders', 'orderitems', 'payments', 'deliveries', 'notifications', 'complaints']
            app_list = [app for app in app_list if app['app_label'] in allowed_apps]
        elif request.user.role == 'delivery_person':
            allowed_apps = ['deliveries', 'notifications']
            app_list = [app for app in app_list if app['app_label'] in allowed_apps]
        return app_list

    def index(self, request, extra_context=None):
        extra_context = extra_context or {}
        if request.user.role == 'admin':
            extra_context['analytics'] = {
                'total_users': User.objects.count(),
                'total_orders': Order.objects.count(),
                'total_revenue': Order.objects.aggregate(total=Sum('total_price'))['total'] or 0,
                'orders_by_status': Order.objects.values('status').annotate(count=Count('id')),
            }
        elif request.user.role == 'vendor':
            extra_context['analytics'] = {
                'total_products': Product.objects.filter(vendor=request.user).count(),
                'total_orders': Order.objects.filter(orderitem__product__vendor=request.user).count(),
                'total_revenue': Order.objects.filter(orderitem__product__vendor=request.user).aggregate(total=Sum('total_price'))['total'] or 0,
            }
        return super().index(request, extra_context)

admin_site = CampusAdminSite(name='campus_admin')
admin_site.register(User, UserAdmin)
admin_site.register(Product, ProductAdmin)
admin_site.register(Order, OrderAdmin)
admin_site.register(OrderItem, OrderItemAdmin)
admin_site.register(Payment, PaymentAdmin)
admin_site.register(Delivery, DeliveryAdmin)
admin_site.register(Notification, NotificationAdmin)
admin_site.register(Complaint, ComplaintAdmin)