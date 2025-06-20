from django.shortcuts import render

# Create your views here.
# users/views.py

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, logout # Import login and logout functions
from .forms import CustomUserCreationForm
from django.contrib import messages # For displaying messages to the user

# View for user registration
def register(request):
    if request.method == 'POST':
        # If the request method is POST, it means the form has been submitted.
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            # If the form data is valid, save the new user.
            user = form.save()
            # Log the user in immediately after successful registration.
            login(request, user)
            messages.success(request, f"Account created for {user.username}!")
            # Redirect to the home page after registration and login.
            return redirect('home')
        else:
            # If the form is not valid, display error messages.
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f"Error in {field}: {error}")
    else:
        # If the request method is GET, display an empty registration form.
        form = CustomUserCreationForm()
    # Render the registration template with the form.
    return render(request, 'templates/register.html', {'form': form})

# View for the home page.
# @login_required decorator ensures that only authenticated users can access this view.
@login_required
def home(request):
    # Render the home page template.
    return render(request, 'userauth/home.html')

# Note: Django provides built-in views for login and logout (`django.contrib.auth.views`).
# We will use these in the URLs, so you don't need to write custom views for them unless
# you want highly customized logic.
# However, for logout, it's often good to have a simple view to handle messages.
def custom_logout(request):
    logout(request)
    messages.info(request, "You have been logged out.")
    return redirect('login') # Redirect to the login page after logout
