# Campus Delivery System API Endpoints

This document provides a comprehensive overview of the API endpoints for the Campus Delivery System, covering user management, authentication, product management, cart and order processing, payment integration, delivery management, notifications, complaint handling, and analytics. These endpoints are designed to facilitate integration between the frontend application and the Django backend.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Register](#register)
  - [Login](#login)
  - [Profile](#profile)
  - [Token Refresh](#token-refresh)
  - [Product Endpoints](#product-endpoints)
    - [/products/](#products)
    - [/products/<id>/](#productsid)
    - [/products/filter/](#productsfilter)
  - [Cart and Order Endpoints](#cart-and-order-endpoints)
    - [/cart/](#cart)
    - [/orders/](#orders)
    - [/orders/<id>/](#ordersid)
    - [/orders/<id>/status/](#ordersidstatus)
  - [Payment Endpoints](#payment-endpoints)
    - [/payment/initiate/](#paymentinitiate)
    - [/payment/callback/<payment_id>/](#paymentcallbackpayment_id)
  - [Delivery Endpoints](#delivery-endpoints)
    - [/deliveries/](#deliveries)
    - [/deliveries/assign/](#deliveriesassign)
    - [/deliveries/<id>/status/](#deliveriesidstatus)
  - [Notification Endpoints](#notification-endpoints)
    - [/notifications/](#notifications)
    - [WebSocket: ws://<domain>/ws/notifications/](#websocket-wsdomainwsnotifications)
  - [Complaint Endpoints](#complaint-endpoints)
    - [/complaints/create/](#complaintscreate)
    - [/complaints/](#complaints)
    - [/complaints/<id>/resolve/](#complaintsidresolve)
  - [Analytics Endpoints](#analytics-endpoints)
    - [/analytics/](#analytics)
- [General Notes](#general-notes)
- [Contact](#contact)

## Base URL

All endpoints are relative to the base URL: `http://localhost:8000/api/` (update for production).

## Authentication

- Endpoints requiring authentication use JWT (JSON Web Tokens).
- Include the token in the `Authorization` header: `Bearer <access_token>`.
- Obtain tokens via the `/api/login/` endpoint.
- Refresh tokens using `/api/token/refresh/`.

## Endpoints

### Register

**Method:** POST  
**URL:** `/register/`  
**Description:** Creates a new user account with a specified role. Vendors require admin approval (`is_approved=True`) to access vendor-specific features.

**Request Body:**

The request body should be a JSON object with the following fields:

| Field       | Type   | Required | Description                     |
|-------------|--------|----------|---------------------------------|
| full_name   | string | Yes      | The user's full name            |
| email       | string | Yes      | A valid email address (unique)  |
| phone       | string | Yes      | A unique phone number           |
| id_number   | string | No       | Unique ID number                |
| password    | string | Yes      | Minimum 8 characters            |
| role        | string | Yes      | One of: customer, vendor, delivery_person, admin |
| location    | string | No       | User's location                 |

**Example:**

```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "id_number": "ID12345",
  "password": "securepassword",
  "role": "customer",
  "location": "Campus A"
}
```

**Response:**

- **201 Created:**

```json
{
  "id": 1,
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "id_number": "ID12345",
  "role": "customer",
  "is_approved": true,
  "location": "Campus A"
}
```

- **400 Bad Request:**

```json
{
  "email": ["A user with that email already exists."],
  "phone": ["A user with that phone number already exists."]
}
```

**Notes:**

- Non-vendor users are auto-approved (`is_approved=True`).
- Email is used as the username for login.

### Login

**Method:** POST  
**URL:** `/login/`  
**Description:** Authenticates a user and returns JWT access and refresh tokens.

**Request Body:**

The request body should be a JSON object with the following fields:

| Field    | Type   | Required | Description          |
|----------|--------|----------|----------------------|
| email    | string | Yes      | User's email address |
| password | string | Yes      | User's password      |

**Example:**

```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**

- **200 OK:**

```json
{
  "refresh": "string (refresh token)",
  "access": "string (access token)"
}
```

- **401 Unauthorized:**

```json
{
  "detail": "No active account found with the given credentials"
}
```

**Notes:**

- Use the access token for authenticated requests.
- Refresh tokens can be used at `/token/refresh/` to obtain a new access token.

### Profile

**URL:** `/profile/`  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).

- **Method:** GET  
  **Description:** Retrieves the authenticated user’s profile information.  
  **Response:**  
  - **200 OK:**  
    ```json
    {
      "id": 1,
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "1234567890",
      "id_number": "ID12345",
      "role": "customer",
      "is_approved": true,
      "location": "Campus A"
    }
    ```

- **Method:** PUT  
  **Description:** Updates the authenticated user’s profile information.  
  **Request Body:**  
  The request body should be a JSON object with the following fields (all optional):  

  | Field       | Type   | Description                     |
  |-------------|--------|---------------------------------|
  | full_name   | string | The user's full name            |
  | phone       | string | A unique phone number           |
  | id_number   | string | Unique ID number                |
  | location    | string | User's location                 |

  **Example:**  
  ```json
  {
    "full_name": "John Updated",
    "phone": "0987654321"
  }
  ```  
  **Response:**  
  - **200 OK:**  
    ```json
    {
      "id": 1,
      "full_name": "John Updated",
      "email": "john@example.com",
      "phone": "0987654321",
      "id_number": "ID12345",
      "role": "customer",
      "is_approved": true,
      "location": "Campus A"
    }
    ```  
  - **400 Bad Request:**  
    ```json
    {
      "phone": ["A user with that phone number already exists."]
    }
    ```  
  - **401 Unauthorized:**  
    ```json
    {
      "detail": "Authentication credentials were not provided."
    }
    ```

**Notes:**

- Only the authenticated user can access or update their profile.
- The `is_approved` field is read-only and managed by admins.

### Token Refresh

**Method:** POST  
**URL:** `/token/refresh/`  
**Description:** Refreshes an expired access token using a refresh token.

**Request Body:**

The request body should be a JSON object with the following field:

| Field    | Type   | Required | Description          |
|----------|--------|----------|----------------------|
| refresh  | string | Yes      | Refresh token        |

**Example:**

```json
{
  "refresh": "string (refresh token)"
}
```

**Response:**

- **200 OK:**

```json
{
  "access": "string (new access token)"
}
```

- **401 Unauthorized:**

```json
{
  "detail": "Token is invalid or expired"
}
```

### Product Endpoints

#### /products/

- **Method:** GET  
  **Description:** Lists all products.  
  **Authentication:** Optional.  
  **Response:**  
  - **200 OK:**  
    ```json
    [
      {
        "id": 1,
        "vendor": 2,
        "name": "Product Name",
        "description": "Product Description",
        "price": 10.00,
        "quantity": 100,
        "image": "http://example.com/image.jpg",
        "type": "tangible",
        "category": "vegetable",
        "created_at": "2023-01-01T00:00:00Z"
      }
    ]
    ```

- **Method:** POST  
  **Description:** Creates a new product.  
  **Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
  **Request Body:**  
  The request body should be a JSON object with the following fields:  

  | Field       | Type   | Required | Description                     |
  |-------------|--------|----------|---------------------------------|
  | vendor      | integer| Yes      | Vendor ID (must match authenticated user) |
  | name        | string | Yes      | Product name                    |
  | description | string | No       | Product description             |
  | price       | number | Yes      | Product price                   |
  | quantity    | integer| Yes      | Available quantity              |
  | type        | string | Yes      | "tangible" or "service"         |
  | category    | string | Yes      | One of: vegetable, fruit, meal, salon, cobbler, other |
  | image       | file   | No       | Product image                   |

  **Example:**  
  ```json
  {
    "vendor": 2,
    "name": "New Product",
    "description": "Description",
    "price": 15.00,
    "quantity": 50,
    "type": "tangible",
    "category": "fruit",
    "image": "file"
  }
  ```  
  **Response:**  
  - **201 Created:**  
    ```json
    {
      "id": 2,
      "vendor": 2,
      "name": "New Product",
      "description": "Description",
      "price": 15.00,
      "quantity": 50,
      "image": "http://example.com/new_image.jpg",
      "type": "tangible",
      "category": "fruit",
      "created_at": "2023-01-02T00:00:00Z"
    }
    ```  
  - **403 Forbidden:**  
    ```json
    {
      "detail": "You do not have permission to perform this action."
    }
    ```

**Notes:**

- Only approved vendors can create products.
- The `vendor` field must match the authenticated user’s ID.

#### /products/<id>/

- **Method:** GET  
  **Description:** Retrieves a specific product by ID.  
  **Authentication:** Optional.  
  **Response:**  
  - **200 OK:**  
    ```json
    {
      "id": 1,
      "vendor": 2,
      "name": "Product Name",
      "description": "Product Description",
      "price": 10.00,
      "quantity": 100,
      "image": "http://example.com/image.jpg",
      "type": "tangible",
      "category": "vegetable",
      "created_at": "2023-01-01T00:00:00Z"
    }
    ```

- **Method:** PUT  
  **Description:** Updates a specific product by ID.  
  **Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
  **Request Body:**  
  The request body should be a JSON object with the following fields (all optional):  

  | Field       | Type   | Description                     |
  |-------------|--------|---------------------------------|
  | name        | string | Product name                    |
  | description | string | Product description             |
  | price       | number | Product price                   |
  | quantity    | integer| Available quantity              |
  | type        | string | "tangible" or "service"         |
  | category    | string | One of: vegetable, fruit, meal, salon, cobbler, other |
  | image       | file   | Product image                   |

  **Example:**  
  ```json
  {
    "name": "Updated Product",
    "price": 12.00
  }
  ```  
  **Response:**  
  - **200 OK:**  
    ```json
    {
      "id": 1,
      "vendor": 2,
      "name": "Updated Product",
      "description": "Product Description",
      "price": 12.00,
      "quantity": 100,
      "image": "http://example.com/image.jpg",
      "type": "tangible",
      "category": "vegetable",
      "created_at": "2023-01-01T00:00:00Z"
    }
    ```  
  - **403 Forbidden:**  
    ```json
    {
      "detail": "You do not have permission to perform this action."
    }
    ```

- **Method:** DELETE  
  **Description:** Deletes a specific product by ID.  
  **Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
  **Response:**  
  - **204 No Content:** (No body)  
  - **403 Forbidden:**  
    ```json
    {
      "detail": "You do not have permission to perform this action."
    }
    ```

**Notes:**

- Only the product’s vendor can update or delete it.

#### /products/filter/

**Method:** GET  
**URL:** `/products/filter/?type=<type>&category=<category>`  
**Description:** Lists products filtered by type and/or category.  
**Authentication:** Optional.  
**Query Parameters:**  
- `type`: tangible or service  
- `category`: vegetable, fruit, meal, salon, cobbler, other  

**Response:**  
- **200 OK:**  
  ```json
  [
    {
      "id": 1,
      "vendor": 2,
      "name": "Product Name",
      "description": "Product Description",
      "price": 10.00,
      "quantity": 100,
      "image": "http://example.com/image.jpg",
      "type": "tangible",
      "category": "vegetable",
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
  ```

**Notes:**  
- Combine `type` and `category` for specific filtering (e.g., `/products/filter/?type=tangible&category=vegetable`).

### Cart and Order Endpoints

#### /cart/

- **Method:** POST  
  **Description:** Adds a product to the user’s session-based cart.  
  **Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
  **Request Body:**  
  The request body should be a JSON object with the following fields:  

  | Field       | Type   | Required | Description                     |
  |-------------|--------|----------|---------------------------------|
  | product_id  | integer| Yes      | ID of the product to add        |
  | quantity    | integer| Yes      | Quantity to add                 |

  **Example:**  
  ```json
  {
    "product_id": 1,
    "quantity": 2
  }
  ```  
  **Response:**  
  - **200 OK:**  
    ```json
    {
      "message": "Item added to cart"
    }
    ```  
  - **400 Bad Request:**  
    ```json
    {
      "detail": "Invalid product_id or quantity"
    }
    ```

- **Method:** GET  
  **Description:** Retrieves the current cart contents.  
  **Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
  **Response:**  
  - **200 OK:**  
    ```json
    {
      "cart": [
        {
          "product": {
            "id": 1,
            "name": "Product Name",
            "price": 10.00,
            "type": "tangible",
            "category": "vegetable"
          },
          "quantity": 2
        }
      ]
    }
    ```

- **Method:** DELETE  
  **Description:** Clears all items from the user’s cart.  
  **Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
  **Response:**  
  - **200 OK:**  
    ```json
    {
      "message": "Cart cleared"
    }
    ```

**Notes:**

- Only authenticated customers can add to cart.
- Cart is stored in the session and persists until cleared or converted to an order.
- GET returns an empty list if the cart is empty.

#### /orders/

- **Method:** GET  
  **Description:** Lists orders (filtered by user role).  
  **Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
  **Response:**  
  - **200 OK:**  
    ```json
    [
      {
        "id": 1,
        "customer": 1,
        "items": [
          {
            "id": 1,
            "product": {
              "id": 1,
              "name": "Product Name",
              "price": 10.00
            },
            "quantity": 2
          }
        ],
        "total_price": 20.00,
        "status": "in_progress",
        "created_at": "2023-01-01T00:00:00Z"
      }
    ]
    ```

- **Method:** POST  
  **Description:** Creates a new order from the cart.  
  **Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
  **Request Body:**  
  The request body should be a JSON object with the following field:  

  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | items | array| Yes      | List of items to order |

  Each item in the array should have:  

  | Field       | Type   | Required | Description                     |
  |-------------|--------|----------|---------------------------------|
  | product_id  | integer| Yes      | ID of the product               |
  | quantity    | integer| Yes      | Quantity to order               |

  **Example:**  
  ```json
  {
    "items": [
      {
        "product_id": 1,
        "quantity": 2
      }
    ]
  }
  ```  
  **Response:**  
  - **201 Created:**  
    ```json
    {
      "id": 1,
      "customer": 1,
      "items": [
        {
          "id": 1,
          "product": {
            "id": 1,
            "name": "Product Name",
            "price": 10.00
          },
          "quantity": 2
        }
      ],
      "total_price": 20.00,
      "status": "in_progress",
      "created_at": "2023-01-01T00:00:00Z"
    }
    ```  
  - **400 Bad Request:**  
    ```json
    {
      "detail": "Cart is empty"
    }
    ```

**Notes:**

- Customers see their own orders; vendors see orders for their products; admins see all orders.
- Placing an order clears the cart.

#### /orders/<id>/

**Method:** GET  
**Description:** Retrieves details of a specific order.  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Response:**  
- **200 OK:**  
  ```json
  {
    "id": 1,
    "customer": 1,
    "items": [
      {
        "id": 1,
        "product": {
          "id": 1,
          "name": "Product Name",
          "price": 10.00
        },
        "quantity": 2
      }
    ],
    "total_price": 20.00,
    "status": "in_progress",
    "created_at": "2023-01-01T00:00:00Z"
  }
  ```  
- **404 Not Found:**  
  ```json
  {
    "detail": "Not found"
  }
  ```

#### /orders/<id>/status/

**Method:** PUT  
**Description:** Updates the status of an order (vendor/admin-only).  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Request Body:**  
The request body should be a JSON object with the following field:  

| Field  | Type   | Required | Description          |
|--------|--------|----------|----------------------|
| status | string | Yes      | New status: "in_progress", "delivered", "cancelled" |

**Example:**  
```json
{
  "status": "delivered"
}
```  
**Response:**  
- **200 OK:**  
  ```json
  {
    "status": "delivered"
  }
  ```  
- **403 Forbidden:**  
  ```json
  {
    "detail": "You do not have permission to perform this action."
  }
  ```

**Notes:**

- Only admins or the vendor associated with the order’s products can update the status.

### Payment Endpoints

#### /payment/initiate/

**Method:** POST  
**URL:** `/payment/initiate/`  
**Description:** Initiates an M-Pesa STK Push payment for an order.  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Request Body:**  
The request body should be a JSON object with the following fields:  

| Field        | Type   | Required | Description                     |
|--------------|--------|----------|---------------------------------|
| order_id     | integer| Yes      | ID of the order to pay for      |
| phone_number | string | Yes      | Phone number for M-Pesa (e.g., 254712345678) |

**Example:**  
```json
{
  "order_id": 1,
  "phone_number": "254712345678"
}
```  
**Response:**  
- **200 OK:**  
  ```json
  {
    "message": "Payment initiated, awaiting user confirmation"
  }
  ```  
- **400 Bad Request:**  
  ```json
  {
    "detail": "Order already paid"
  }
  ```  
- **404 Not Found:**  
  ```json
  {
    "detail": "Order not found"
  }
  ```

**Notes:**

- Only the order’s customer can initiate payment.
- The phone number must be in the format 2547XXXXXXXX.
- Triggers an STK Push prompt on the user’s phone (in sandbox, use test numbers).

#### /payment/callback/<payment_id>/

**Method:** POST  
**URL:** `/payment/callback/<payment_id>/`  
**Description:** Handles M-Pesa callback to confirm or reject payment (not called directly by frontend).  
**Authentication:** None (M-Pesa server-initiated).  
**Request Body:** (Example)  
```json
{
  "Body": {
    "stkCallback": {
      "ResultCode": 0,
      "CallbackMetadata": {
        "Item": [
          {"Name": "MpesaCode", "Value": "TEST123"},
          {"Name": "Amount", "Value": 20.00}
        ]
      }
    }
  }
}
```  
**Response:**  
- **200 OK:**  
  ```json
  {
    "message": "Payment processed successfully"
  }
  ```  
- **400 Bad Request:**  
  ```json
  {
    "message": "Payment failed"
  }
  ```

**Notes:**

- Automatically updates payment and order status.
- Sends a receipt email to the customer upon success.

### Delivery Endpoints

#### /deliveries/

**Method:** GET  
**Description:** Lists deliveries (filtered by user role: admins see all, delivery persons see their own).  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Response:**  
- **200 OK:**  
  ```json
  [
    {
      "id": 1,
      "order": {
        "id": 1,
        "customer": 1,
        "total_price": 20.00,
        "status": "in_progress",
        "created_at": "2023-01-01T00:00:00Z"
      },
      "delivery_person": 3,
      "status": "pending",
      "location": "Location A",
      "assigned_at": "2023-01-01T01:00:00Z",
      "updated_at": "2023-01-01T01:00:00Z"
    }
  ]
  ```  
- **403 Forbidden:**  
  ```json
  {
    "detail": "You do not have permission to perform this action."
  }
  ```

**Notes:**

- Admins see all deliveries; delivery persons see only their assigned deliveries.

#### /deliveries/assign/

**Method:** POST  
**Description:** Assigns a delivery person to an order (admin-only).  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Request Body:**  
The request body should be a JSON object with the following fields:  

| Field              | Type   | Required | Description                     |
|--------------------|--------|----------|---------------------------------|
| order_id           | integer| Yes      | ID of the order to assign       |
| delivery_person_id | integer| Yes      | ID of the delivery person       |

**Example:**  
```json
{
  "order_id": 1,
  "delivery_person_id": 3
}
```  
**Response:**  
- **200 OK:**  
  ```json
  {
    "id": 1,
    "order": {
      "id": 1,
      "customer": 1,
      "total_price": 20.00,
      "status": "in_progress",
      "created_at": "2023-01-01T00:00:00Z"
    },
    "delivery_person": 3,
    "status": "pending",
    "location": "Location A",
    "assigned_at": "2023-01-01T01:00:00Z",
    "updated_at": "2023-01-01T01:00:00Z"
  }
  ```  
- **400 Bad Request:**  
  ```json
  {
    "detail": "Order or delivery person not found"
  }
  ```  
- **403 Forbidden:**  
  ```json
  {
    "detail": "Not authorized"
  }
  ```

**Notes:**

- Only admins can assign deliveries.
- The `delivery_person_id` must correspond to a user with `role='delivery_person'`.

#### /deliveries/<id>/status/

**Method:** PUT  
**Description:** Updates the status and location of a delivery (delivery person or admin).  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Request Body:**  
The request body should be a JSON object with the following fields:  

| Field    | Type   | Required | Description                     |
|----------|--------|----------|---------------------------------|
| status   | string | Yes      | New status: "pending", "picked_up", "in_transit", "delivered", "cancelled" |
| location | string | No       | Updated location                |

**Example:**  
```json
{
  "status": "in_transit",
  "location": "Location B"
}
```  
**Response:**  
- **200 OK:**  
  ```json
  {
    "status": "in_transit",
    "location": "Location B"
  }
  ```  
- **403 Forbidden:**  
  ```json
  {
    "detail": "You do not have permission to perform this action."
  }
  ```  
- **404 Not Found:**  
  ```json
  {
    "detail": "Not found"
  }
  ```

**Notes:**

- Delivery persons can only update their assigned deliveries.
- Admins can update any delivery.

### Notification Endpoints

#### /notifications/

**Method:** GET  
**Description:** Lists notifications (filtered by user role: admins see all, users see their own).  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Response:**  
- **200 OK:**  
  ```json
  [
    {
      "id": 1,
      "recipient": 1,
      "type": "order_placed",
      "channel": "in_app",
      "message": "Your order has been placed.",
      "phone_number": "1234567890",
      "status": "sent",
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
  ```  
- **403 Forbidden:**  
  ```json
  {
    "detail": "You do not have permission to perform this action."
  }
  ```

**Notes:**

- Admins see all notifications; customers, vendors, and delivery persons see only their own.

#### WebSocket: ws://<domain>/ws/notifications/

**Protocol:** WebSocket  
**URL:** `ws://<domain>/ws/notifications/`  
**Description:** Establishes a WebSocket connection to receive real-time in-app notifications.  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>` header or as a subprotocol).  
**Message Format:**  
```json
{
  "type": "order```json
{
  "type": "order_placed",
  "message": "Your order has been placed.",
  "created_at": "2023-01-01T00:00:00Z"
}
```

**Notes:**

- Connect using a WebSocket client with the user’s JWT token.
- Notifications are sent for order placement, payment completion, delivery assignment, and status updates.
- Example client (JavaScript):  
  ```javascript
  const socket = new WebSocket('ws://<domain>/ws/notifications/', ['jwt', '<your_jwt_token>']);
  socket.onmessage = (event) => console.log(JSON.parse(event.data));
  ```

### Complaint Endpoints

#### /complaints/create/

**Method:** POST  
**Description:** Allows authenticated users (customers) to submit a complaint for an order.  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Request Body:**  
The request body should be a JSON object with the following fields:  

| Field       | Type   | Required | Description                     |
|-------------|--------|----------|---------------------------------|
| order       | integer| Yes      | ID of the order                 |
| description | string | Yes      | Description of the complaint    |

**Example:**  
```json
{
  "order": 1,
  "description": "Order was delayed."
}
```  
**Response:**  
- **201 Created:**  
  ```json
  {
    "id": 1,
    "user": 1,
    "order": {
      "id": 1,
      "customer": 1,
      "total_price": 20.00,
      "status": "in_progress",
      "created_at": "2023-01-01T00:00:00Z"
    },
    "description": "Order was delayed.",
    "status": "pending",
    "created_at": "2023-01-01T01:00:00Z",
    "updated_at": "2023-01-01T01:00:00Z"
  }
  ```  
- **400 Bad Request:**  
  ```json
  {
    "detail": "Invalid data"
  }
  ```  
- **403 Forbidden:**  
  ```json
  {
    "detail": "You do not have permission to perform this action."
  }
  ```

**Notes:**

- Only authenticated customers can submit complaints.
- Triggers SMS and in-app notifications to the customer.

#### /complaints/

**Method:** GET  
**Description:** Lists complaints (admins see all, vendors see complaints for their products, customers see their own).  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Response:**  
- **200 OK:**  
  ```json
  [
    {
      "id": 1,
      "user": 1,
      "order": {
        "id": 1,
        "customer": 1,
        "total_price": 20.00,
        "status": "in_progress",
        "created_at": "2023-01-01T00:00:00Z"
      },
      "description": "Order was delayed.",
      "status": "pending",
      "created_at": "2023-01-01T01:00:00Z",
      "updated_at": "2023-01-01T01:00:00Z"
    }
  ]
  ```  
- **403 Forbidden:**  
  ```json
  {
    "detail": "You do not have permission to perform this action."
  }
  ```

**Notes:**

- Role-based filtering applies.

#### /complaints/<id>/resolve/

**Method:** PUT  
**Description:** Allows admins or vendors to mark a complaint as resolved.  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Request Body:**  
The request body should be a JSON object with the following field:  

| Field  | Type   | Required | Description          |
|--------|--------|----------|----------------------|
| status | string | Yes      | "resolved"           |

**Example:**  
```json
{
  "status": "resolved"
}
```  
**Response:**  
- **200 OK:**  
  ```json
  {
    "id": 1,
    "user": 1,
    "order": {
      "id": 1,
      "customer": 1,
      "total_price": 20.00,
      "status": "in_progress",
      "created_at": "2023-01-01T00:00:00Z"
    },
    "description": "Order was delayed.",
    "status": "resolved",
    "created_at": "2023-01-01T01:00:00Z",
    "updated_at": "2023-01-02T01:00:00Z"
  }
  ```  
- **403 Forbidden:**  
  ```json
  {
    "detail": "You do not have permission to perform this action."
  }
  ```  
- **404 Not Found:**  
  ```json
  {
    "detail": "Not found"
  }
  ```

**Notes:**

- Only admins and vendors can resolve complaints.
- Triggers SMS and in-app notifications to the customer.

### Analytics Endpoints

#### /analytics/

**Method:** GET  
**Description:** Provides analytics data (admin: users, orders, revenue; vendor: products, orders, revenue).  
**Authentication:** Required (JWT in `Authorization: Bearer <access_token>`).  
**Response:**  
- **200 OK (Admin):**  
  ```json
  {
    "total_users": 100,
    "total_orders": 50,
    "total_revenue": 1000.00,
    "orders_by_status": [
      {
        "status": "in_progress",
        "count": 20
      },
      {
        "status": "delivered",
        "count": 25
      },
      {
        "status": "cancelled",
        "count": 5
      }
    ]
  }
  ```  
- **200 OK (Vendor):**  
  ```json
  {
    "total_users": 0,
    "total_products": 10,
    "total_orders": 15,
    "total_revenue": 300.00,
    "orders_by_status": [
      {
        "status": "in_progress",
        "count": 5
      },
      {
        "status": "delivered",
        "count": 10
      }
    ]
  }
  ```  
- **403 Forbidden:**  
  ```json
  {
    "detail": "Not authorized"
  }
  ```

**Notes:**

- Only admins and vendors can access analytics.
- Vendors see.ilnly their products’ data.

## General Notes

- **Error Handling:** All endpoints return standard HTTP status codes and JSON error messages.
- **Security:** Use HTTPS in production to secure data in transit.
- **Role-Based Access:** The `role` field determines user permissions (e.g., vendors need `is_approved=True` to manage products).
- **Testing:** Test endpoints using tools like Postman or curl. Ensure JWT tokens are included for authenticated requests.

## Contact

For questions or issues, contact the backend team at [bentheaya@gmail.com].