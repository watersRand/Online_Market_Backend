from django.contrib import admin
from users.models import User
from products.models import Product

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