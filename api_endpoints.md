## Product Endpoints

### 1. List/Create Products
- **Method**: GET, POST
- **URL**: `/products/`
- **Description**: Lists all products (GET) or creates a new product (POST, vendor-only).
- **Authentication**: Required for POST (JWT in `Authorization: Bearer <access_token>`); optional for GET.
- **Request Body (POST)**:
  ```json
  {
    "vendor": integer,
    "name": "string",
    "description": "string (optional)",
    "price": number,
    "quantity": integer,
    "type": "string (tangible, service)",
    "category": "string (vegetable, fruit, meal, salon, cobbler, other)",
    "image": "file (optional)"
  }
  ```
- **Response**:
  - **200 OK (GET)**:
    ```json
    [
      {
        "id": integer,
        "vendor": integer,
        "name": "string",
        "description": "string",
        "price": number,
        "quantity": integer,
        "image": "string (URL) or null",
        "type": "string",
        "category": "string",
        "created_at": "string (datetime)"
      }
    ]
    ```
  - **201 Created (POST)**:
    ```json
    {
      "id": integer,
      "vendor": integer,
      "name": "string",
      "description": "string",
      "price": number,
      "quantity": integer,
      "image": "string (URL) or null",
      "type": "string",
      "category": "string",
      "created_at": "string (datetime)"
    }
    ```
  - **403 Forbidden (POST)**:
    ```json
    {
      "detail": "You do not have permission to perform this action."
    }
    ```
- **Notes**:
  - Only approved vendors can create products.
  - The `vendor` field must match the authenticated user’s ID.

### 2. Retrieve/Update/Delete Product
- **Method**: GET, PUT, DELETE
- **URL**: `/products/<id>/`
- **Description**: Retrieves, updates, or deletes a specific product by ID (vendor-only for PUT/DELETE).
- **Authentication**: Required for PUT/DELETE (JWT in `Authorization: Bearer <access_token>`); optional for GET.
- **Request Body (PUT)**:
  ```json
  {
    "name": "string (optional)",
    "description": "string (optional)",
    "price": number (optional),
    "quantity": integer (optional),
    "type": "string (optional)",
    "category": "string (optional)",
    "image": "file (optional)"
  }
  ```
- **Response**:
  - **200 OK (GET/PUT)**:
    ```json
    {
      "id": integer,
      "vendor": integer,
      "name": "string",
      "description": "string",
      "price": number,
      "quantity": integer,
      "image": "string (URL) or null",
      "type": "string",
      "category": "string",
      "created_at": "string (datetime)"
    }
    ```
  - **204 No Content (DELETE)**:
  - **403 Forbidden (PUT/DELETE)**:
    ```json
    {
      "detail": "You do not have permission to perform this action."
    }
    ```
- **Notes**:
  - Only the product’s vendor can update or delete it.

### 3. Filter Products
- **Method**: GET
- **URL**: `/products/filter/?type=<type>&category=<category>`
- **Description**: Lists products filtered by type and/or category.
- **Authentication**: Optional.
- **Query Parameters**:
  - `type`: `tangible` or `service`
  - `category`: `vegetable`, `fruit`, `meal`, `salon`, `cobbler`, `other`
- **Response**:
  - **200 OK**:
    ```json
    [
      {
        "id": integer,
        "vendor": integer,
        "name": "string",
        "description": "string",
        "price": number,
        "quantity": integer,
        "image": "string (URL) or null",
        "type": "string",
        "category": "string",
        "created_at": "string (datetime)"
      }
    ]
    ```
- **Notes**:
  - Combine `type` and `category` for specific filtering (e.g., `/products/filter/?type=tangible&category=vegetable`).

Notification Endpoints
1. List Notifications

Method: GET
URL: /notifications/
Description: Lists notifications (filtered by user role: admins see all, users see their own).
Authentication: Required (JWT in Authorization: Bearer <access_token>).
Response:
200 OK:[
  {
    "id": integer,
    "recipient": integer,
    "type": "string (order_placed, payment_completed, delivery_assigned, delivery_status)",
    "channel": "string (sms, in_app)",
    "message": "string",
    "phone_number": "string",
    "status": "string (sent, failed)",
    "created_at": "string (datetime)"
  }
]


403 Forbidden:{
  "detail": "You do not have permission to perform this action."
}




Notes:
Admins see all notifications; customers, vendors, and delivery persons see only their own.



2. Real-Time Notifications (WebSocket)

Protocol: WebSocket
URL: ws://<domain>/ws/notifications/
Description: Establishes a WebSocket connection to receive real-time in-app notifications.
Authentication: Required (JWT in Authorization: Bearer <access_token> header or as a subprotocol).
Message Format:{
  "type": "string (order_placed, payment_completed, delivery_assigned, delivery_status)",
  "message": "string",
  "created_at": "string (datetime)"
}


Notes:
Connect using a WebSocket client with the user’s JWT token.
Notifications are sent for order placement, payment completion, delivery assignment, and status updates.
Example client (JavaScript):const socket = new WebSocket('ws://<domain>/ws/notifications/', ['jwt', '<your_jwt_token>']);
socket.onmessage = (event) => console.log(JSON.parse(event.data));




