# users/forms.py

from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from users.models import User

class CustomUserCreationForm(UserCreationForm):
    # This form is used for creating new users (e.g., registration).
    # It extends Django's built-in UserCreationForm.

    class Meta(UserCreationForm.Meta):
        # Specify the custom user model to use.
        model = User
        # Define the fields that will be displayed in the registration form.
        # 'username' and 'password' fields are automatically handled by UserCreationForm.
        # If you added extra fields to CustomUser, list them here.
        fields = UserCreationForm.Meta.fields # + ('email', 'date_of_birth',) # Example for extra fields

class CustomUserChangeForm(UserChangeForm):
    # This form is used for changing existing user information in the admin panel.
    # It extends Django's built-in UserChangeForm.

    class Meta:
        # Specify the custom user model to use.
        model = User
        # Define the fields that will be displayed when editing a user.
        # Include all fields from your custom user model.
        fields = UserChangeForm.Meta.fields # + ('email', 'date_of_birth',) # Example for extra fields
