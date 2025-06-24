from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Payment
from .serializers import PaymentSerializer, PaymentInitiateSerializer
from orders.models import Order
from django.core.mail import send_mail
from django.conf import settings
import requests
import base64
import datetime

class PaymentInitiateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PaymentInitiateSerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            phone_number = serializer.validated_data['phone_number']
            try:
                order = Order.objects.get(id=order_id, customer=request.user)
                if order.payments.filter(status='completed').exists():
                    return Response({"detail": "Order already paid"}, status=status.HTTP_400_BAD_REQUEST)
                
                # M-Pesa STK Push
                access_token = self.get_mpesa_access_token()
                if not access_token:
                    return Response({"detail": "Failed to obtain M-Pesa token"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
                payment = Payment.objects.create(
                    order=order,
                    amount=order.total_price,
                    status='pending'
                )
                
                response = self.initiate_stk_push(access_token, phone_number, order.total_price, payment.id)
                if response.get('ResponseCode') == '0':
                    return Response({"message": "Payment initiated, awaiting user confirmation"}, status=status.HTTP_200_OK)
                else:
                    payment.status = 'failed'
                    payment.save()
                    return Response({"detail": response.get('ResponseDescription', 'Payment initiation failed')}, status=status.HTTP_400_BAD_REQUEST)
            except Order.DoesNotExist:
                return Response({"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get_mpesa_access_token(self):
        consumer_key = settings.MPESA_CONSUMER_KEY
        consumer_secret = settings.MPESA_CONSUMER_SECRET
        api_url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        headers = {
            'Authorization': 'Basic ' + base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
        }
        try:
            response = requests.get(api_url, headers=headers)
            return response.json().get('access_token')
        except:
            return None

    def initiate_stk_push(self, access_token, phone_number, amount, payment_id):
        api_url = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        headers = {'Authorization': f'Bearer {access_token}'}
        timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
        business_short_code = settings.MPESA_SHORT_CODE
        passkey = settings.MPESA_PASSKEY
        password = base64.b64encode(f"{business_short_code}{passkey}{timestamp}".encode()).decode()
        payload = {
            'BusinessShortCode': business_short_code,
            'Password': password,
            'Timestamp': timestamp,
            'TransactionType': 'CustomerPayBillOnline',
            'Amount': int(amount),
            'PartyA': phone_number,
            'PartyB': business_short_code,
            'PhoneNumber': phone_number,
            'CallBackURL': settings.MPESA_CALLBACK_URL + f'/api/payment/callback/{payment_id}/',
            'AccountReference': f'Order_{payment_id}',
            'TransactionDesc': 'Payment for order'
        }
        response = requests.post(api_url, json=payload, headers=headers)
        return response.json()

class PaymentCallbackView(APIView):
    def post(self, request, payment_id):
        try:
            payment = Payment.objects.get(id=payment_id)
            data = request.data.get('Body', {}).get('stkCallback', {})
            result_code = data.get('ResultCode')
            if result_code == 0:
                payment.status = 'completed'
                payment.mpesa_code = data.get('CallbackMetadata', {}).get('Item', [{}])[1].get('Value')
                payment.save()
                payment.order.status = 'in_progress'  # Update order status
                payment.order.save()
                self.send_receipt(payment)
                return Response({"message": "Payment processed successfully"}, status=status.HTTP_200_OK)
            else:
                payment.status = 'failed'
                payment.save()
                return Response({"message": "Payment failed"}, status=status.HTTP_400_BAD_REQUEST)
        except Payment.DoesNotExist:
            return Response({"detail": "Payment not found"}, status=status.HTTP_404_NOT_FOUND)

    def send_receipt(self, payment):
        subject = f'Payment Receipt for Order {payment.order.id}'
        message = (
            f"Dear {payment.order.customer.full_name},\n\n"
            f"Thank you for your payment of KES {payment.amount} for Order {payment.order.id}.\n"
            f"M-Pesa Transaction Code: {payment.mpesa_code}\n"
            f"Date: {payment.timestamp}\n\n"
            f"Best regards,\nCampus Delivery Team"
        )
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [payment.order.customer.email],
            fail_silently=True
        )