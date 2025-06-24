from django.urls import path
from .views import PaymentInitiateView, PaymentCallbackView

urlpatterns = [
    path('payment/initiate/', PaymentInitiateView.as_view(), name='payment-initiate'),
    path('payment/callback/<int:payment_id>/', PaymentCallbackView.as_view(), name='payment-callback'),
]