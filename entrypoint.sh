#!/bin/sh

# Apply database migrations
echo "Applying database migrations..."
poetry run python manage.py migrate

# Start the Django development server
echo "Starting Django development server..."
poetry run python manage.py runserver 0.0.0.0:8000
