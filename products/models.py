from django.db import models
from users.models import User
from cloudinary.models import CLoudinaryField

class Product(models.Model):
    TYPE_CHOICES = (
        ('tangible', 'Tangible Product'),
        ('service', 'Service'),
    )
    CATEGORY_CHOICES = (
        ('vegetable', 'Vegetable'),
        ('fruit', 'Fruit'),
        ('meal', 'Meal'),
        ('salon', 'Salon Service'),
        ('cobbler', 'Cobbler Service'),
        ('other', 'Other'),
    )

    vendor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=0)  # For tangible products; 0 for services
    image = CLoudinaryField('image',blank=True,null=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='tangible')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.type}) by {self.vendor.full_name}"