from rest_framework import permissions

class IsAdminOrDeliveryPerson(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'admin':
            return True
        if request.method in permissions.SAFE_METHODS and request.user.role == 'delivery_person':
            return True
        return False

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        return request.user == obj.delivery_person
