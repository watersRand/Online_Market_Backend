from django.contrib import admin
from users.models import User
from products.models import Product
from orders.models import Order, OrderItem

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