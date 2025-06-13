# Campus Delivery System
These python/django based repo contains the backend logic for the system that connects vendors and service provides (mama fua, hair dressers etc.) to potential customers within a local area. It aims to connect the normal market place in an online environment ensuring delivery of goods and services .(A Django-based web application for enabling small-scale vendors to sell goods and services to local buyers within a campus environment.)
Prerequisites

Python 3.10+
Poetry 1.5+
PostgreSQL 15+
Git

Setup Instructions

Clone the Repository:
git clone https://github.com/Legacy-Core/Online_Market_Backend.git


Install Poetry:Follow the instructions at python-poetry.org.

Install Dependencies:
poetry install


Set Up Environment Variables:Create a .env file in the root directory with the following:
DATABASE_URL=postgresql://user:password@localhost:5432/campus_delivery
SECRET_KEY=your-django-secret-key
DEBUG=True


Set Up PostgreSQL Database:Create a database named campus_delivery in PostgreSQL:
psql -U postgres -c "CREATE DATABASE campus_delivery;"


Run Migrations:
poetry run python manage.py migrate


Start the Development Server:
poetry run python manage.py runserver


Access the Application:Open http://localhost:8000 in your browser.


Project Structure

campus_delivery/: Main Django project directory.
users/: User management and role creation.
auth/: Authentication and authorization (JWT, Allauth).
admin/: Dashboards for super admins and vendor admins.
delivery/: Delivery personnel dashboards and order assignments.
orders/: Shopping cart and order management.
products/: Product and service management.
payment/: M-Pesa Daraja API integration.
notifications/: SMS and in-app notifications with Django Channels.

Contributing

Fork the repository.
Create a new branch: git checkout -b feature/your-feature-name.
Commit your changes: git commit -m "Add your feature".
Push to the branch: git push origin feature/your-feature-name.
Create a pull request.

