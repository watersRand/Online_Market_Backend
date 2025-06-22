from waitress import serve
from campus_delivery.wsgi import application

if __name__ == '__main__':
    serve(application, port='10000')