from django.urls import path
from .views import ProductListCreateView, ProductDetailView, ProductFilterView

urlpatterns = [
    path('products/', ProductListCreateView.as_view(), name='product-list-create'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('products/filter/', ProductFilterView.as_view(), name='product-filter'),
]