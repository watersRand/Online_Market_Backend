from django.db import models

# Create your models here.
class Product(models.Model):
    """
    Represents a product available for sale.
    """
    name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=7, decimal_places=2)
    # Using a placeholder image URL for simplicity.
    # In a real app, you'd handle image uploads via storage services.
    image_url = models.URLField(max_length=2000, null=True, blank=True,
                                default="https://placehold.co/600x400/000000/FFFFFF?text=Product")
    description = models.TextField(null=True, blank=True)
    digital = models.BooleanField(default=False, null=True, blank=True) # True for digital products, False for physical

    def __str__(self):
        return self.name

    @property
    def imageURL(self):
        """Returns the image URL, or a placeholder if not set."""
        if self.image_url:
            return self.image_url
        return 'https://placehold.co/600x400/000000/FFFFFF?text=Product' # Placeholder image
