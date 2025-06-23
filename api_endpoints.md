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