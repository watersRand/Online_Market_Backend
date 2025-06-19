from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

# Order and Cart API Views
class CartView(APIView):
    """
    API view to get or create a customer's active cart (Order).
    Requires authentication or handles anonymous users.
    GET /api/cart/
    POST /api/cart/ (to create/get cart for anonymous user)
    """
    def get(self, request, format=None):
        if request.user.is_authenticated:
            customer, created = Customer.objects.get_or_create(user=request.user, defaults={'name': request.user.username, 'email': request.user.email})
        else:
            # Handle anonymous user (e.g., based on session or unique identifier)
   
            order, created = Order.objects.get_or_create(customer=customer, complete=False)
            serializer = OrderSerializer(order)
            return Response(serializer.data)

    def post(self, request, format=None):
        # This can be used to explicitly create a cart for an anonymous user
        # or to get the current cart if it exists.
        return self.get(request, format) # Re-use the get logic

class AddToCartView(APIView):
    """
    API view to add/update items in the cart.
    POST /api/add-to-cart/
    Request body: {"productId": 1, "action": "add" or "remove"}
    """
    def post(self, request, format=None):
        product_id = request.data.get('productId')
        action = request.data.get('action') # 'add' or 'remove' or 'delete'

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.is_authenticated:
            customer, created = Customer.objects.get_or_create(user=request.user, defaults={'name': request.user.username, 'email': request.user.email})
        else:
            # Simplistic guest handling
            customer, created = Customer.objects.get_or_create(name='Guest', email='guest@example.com')

        order, created = Order.objects.get_or_create(customer=customer, complete=False)
        orderItem, created = OrderItem.objects.get_or_create(order=order, product=product)

        if action == 'add':
            orderItem.quantity += 1
        elif action == 'remove':
            orderItem.quantity -= 1
        elif action == 'delete': # Completely remove item from cart
            orderItem.quantity = 0

        orderItem.save()

        if orderItem.quantity <= 0:
            orderItem.delete()

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ProcessOrderView(APIView):
    """
    API view to finalize an order (e.g., after checkout).
    POST /api/process-order/
    """
    def post(self, request, format=None):
        # In a real application, you'd handle payment processing here.
        # For this basic setup, we'll just mark the order as complete.
        transaction_id = request.data.get('transaction_id', 'N/A') # Example transaction ID

        if request.user.is_authenticated:
            customer = Customer.objects.get(user=request.user)
        else:
            customer = Customer.objects.get(name='Guest') # Again, simplistic guest handling

        order, created = Order.objects.get_or_create(customer=customer, complete=False)

        if order.get_cart_items == 0:
            return Response({'error': 'Cart is empty'}, status=status.HTTP_400_BAD_REQUEST)

        order.complete = True
        order.transaction_id = transaction_id
        order.save()

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)
         # For simplicity, we'll create a generic customer for now.
            # In a real app, you'd use sessions or local storage to track anonymous carts.
        customer, created = Customer.objects.get_or_crate(name='Guest', email='guest@example.com') # Simplistic guest handling