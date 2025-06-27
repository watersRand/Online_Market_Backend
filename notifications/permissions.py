from rest_framework import permissions

class IsAdminOrRecipient(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.role == 'admin' or request.user.role in ('customer', 'delivery_person', 'vendor'))

    def has_object_permission(self, request, view, obj):
        return request.user.role == 'admin' or obj.recipient == request.user