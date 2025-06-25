from django.urls import path
from .views import DeliveryListView, DeliveryAssignView, DeliveryStatusView

urlpatterns = [
    path('deliveries/', DeliveryListView.as_view(), name='delivery-list'),
    path('deliveries/assign/', DeliveryAssignView.as_view(), name='delivery-assign'),
    path('deliveries/<int:pk>/status/', DeliveryStatusView.as_view(), name='delivery-status'),
]