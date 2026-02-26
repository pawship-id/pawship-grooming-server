# Pawship Grooming Server - API Documentation

Base URL: `http://localhost:3000`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Options](#options)
4. [Stores](#stores)
5. [Services](#services)
6. [Pets](#pets)
7. [Memberships](#memberships)
8. [Bookings](#bookings)
9. [Grooming Sessions](#grooming-sessions)

---

## Authentication

### 1. Register User

**Endpoint:** `POST /auth/register`

**Request Body:**

```json
{
  "username": "string (required)",
  "email": "string (required, valid email format)",
  "phone_number": "string (required)",
  "password": "string (required, min 6 characters)",
  "role": "admin | ops | groomer | customer (optional)",
  "is_active": "boolean (optional)"
}
```

**Success Response (201):**

```json
{
  "message": "Successfully Created"
}
```

**Error Responses:**

- **400 Bad Request:** Validation error

```json
{
  "statusCode": 400,
  "message": ["email is required", "invalid email format"],
  "error": "Bad Request"
}
```

---

### 2. Login

**Endpoint:** `POST /auth/login`

**Request Body:**

```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Success Response (200):**

```json
{
  "message": "login berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- **400 Bad Request:** Missing fields

```json
{
  "statusCode": 400,
  "message": "email is required",
  "error": "Bad Request"
}
```

- **401 Unauthorized:** Invalid credentials

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

---

## Users

### 1. Get All Users

**Endpoint:** `GET /users`

**Query Parameters:**

- `page` (optional, number): Page number for pagination (default: 1, min: 1)
- `limit` (optional, number): Number of items per page (default: 10, min: 1)
- `search` (optional, string): Search keyword to filter users by username, email, or phone_number (case-insensitive)
- `role` (optional, enum): Filter by user role
  - `admin` | `ops` | `groomer` | `customer`
- `is_active` (optional, boolean): Filter by active status (true/false)

**Example Requests:**

```bash
# Basic pagination
GET /users?page=1&limit=10

# Search users
GET /users?search=john

# Filter by role
GET /users?role=admin

# Filter by active status
GET /users?is_active=true

# Combined filters
GET /users?page=2&limit=20&search=john&role=customer&is_active=true
```

**Success Response (200):**

```json
{
  "message": "Fetch users successfully",
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "john@example.com",
      "phone_number": "+628123456789",
      "role": "customer",
      "is_active": true,
      "createdAt": "2026-02-19T10:00:00.000Z",
      "updatedAt": "2026-02-19T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

**Notes:**

- All query parameters are optional
- Search performs case-insensitive pattern matching across username, email, and phone_number fields
- Results are sorted by creation date (newest first)
- Users with `isDeleted: true` are excluded from results

---

### 2. Get Current User (Me)

**Endpoint:** `GET /users/me`

**Authentication:** Required (JWT Token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Success Response (200):**

```json
{
  "message": "Fetch current user successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "phone_number": "+628123456789",
    "role": "customer",
    "is_active": true,
    "isDeleted": false,
    "createdAt": "2026-02-19T10:00:00.000Z",
    "updatedAt": "2026-02-20T15:30:00.000Z"
  }
}
```

**Error Responses:**

- **401 Unauthorized:** Missing or invalid token

```json
{
  "statusCode": 401,
  "message": "User not authenticated",
  "error": "Unauthorized"
}
```

- **404 Not Found:** User not found or deleted

```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

**Notes:**

- This endpoint retrieves information about the currently authenticated user based on JWT token
- Password field is excluded from the response
- Useful for profile pages or checking current user permissions

---

### 3. Get User By ID

**Endpoint:** `GET /users/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch user successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "phone_number": "+628123456789",
    "role": "customer",
    "is_active": true
  }
}
```

**Error Responses:**

- **400 Bad Request:** Invalid ID

```json
{
  "statusCode": 400,
  "message": "id is required",
  "error": "Bad Request"
}
```

- **404 Not Found:** User not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

---

### 4. Create User

**Endpoint:** `POST /users`

**Request Body:**

```json
{
  "username": "string (required)",
  "email": "string (required, valid email)",
  "phone_number": "string (required)",
  "password": "string (required, min 6 chars)",
  "role": "admin | ops | groomer | customer (optional)",
  "is_active": "boolean (optional)"
}
```

**Success Response (201):**

```json
{
  "message": "Create user successfully"
}
```

---

### 5. Update User

**Endpoint:** `PUT /users/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** (All fields optional)

```json
{
  "username": "string",
  "email": "string",
  "phone_number": "string",
  "role": "admin | ops | groomer | customer",
  "is_active": "boolean"
}
```

**Success Response (200):**

```json
{
  "message": "Update user successfully"
}
```

**Error Responses:**

- **404 Not Found:** User not found

**Notes:**

- Password cannot be updated through this endpoint. Use the Update Password endpoint instead.

---

### 6. Update User Password

**Endpoint:** `PATCH /users/update-password/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:**

```json
{
  "password": "string (required, min 6 characters)"
}
```

**Success Response (200):**

```json
{
  "message": "Update password successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Missing or invalid password

```json
{
  "statusCode": 400,
  "message": ["password is required", "Password must be at least 6 characters"],
  "error": "Bad Request"
}
```

- **404 Not Found:** User not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

**Notes:**

- This endpoint is specifically for updating user passwords
- Password is hashed before storing in database
- Minimum password length is 6 characters

---

### 7. Toggle User Status (Activate/Deactivate)

**Endpoint:** `PATCH /users/toggle-status/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:**

```json
{
  "is_active": "boolean (required)"
}
```

**Success Response (200):**

When activating user:

```json
{
  "message": "User activated successfully"
}
```

When deactivating user:

```json
{
  "message": "User deactivated successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Missing or invalid fields

```json
{
  "statusCode": 400,
  "message": ["is_active is required", "is_active must be a boolean"],
  "error": "Bad Request"
}
```

- **404 Not Found:** User not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

**Notes:**

- Use this endpoint to activate or deactivate user accounts
- When `is_active` is `false`, the user account is deactivated but not deleted
- Deactivated users can be reactivated by setting `is_active` to `true`

---

### 8. Delete User (Soft Delete)

**Endpoint:** `DELETE /users/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete user successfully"
}
```

**Error Responses:**

- **404 Not Found:** User not found

---

## Options

Options are master data categories like pet types, sizes, breeds, etc.

### 1. Get All Options

**Endpoint:** `GET /options?category={category}`

**Query Parameters:**

- `category` (optional): Filter by category
  - `feather category`
  - `size category`
  - `breed category`
  - `member category`
  - `customer category`
  - `pet type`
  - `service type`

**Success Response (200):**

```json
{
  "message": "Fetch options successfully",
  "options": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Small",
      "category_options": "size category",
      "is_active": true,
      "createdAt": "2026-02-19T10:00:00.000Z"
    }
  ]
}
```

---

### 2. Get Option By ID

**Endpoint:** `GET /options/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch option successfully",
  "option": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Small",
    "category_options": "size category",
    "is_active": true
  }
}
```

**Error Responses:**

- **404 Not Found:** Option not found

---

### 3. Create Option

**Endpoint:** `POST /options`

**Request Body:**

```json
{
  "name": "string (required)",
  "category_options": "feather category | size category | breed category | member category | customer category | pet type | service type (required)",
  "is_active": "boolean (optional)"
}
```

**Success Response (200):**

```json
{
  "message": "Create option successfully"
}
```

---

### 4. Update Option

**Endpoint:** `PUT /options/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** (All fields optional)

```json
{
  "name": "string",
  "category_options": "string",
  "is_active": "boolean"
}
```

**Success Response (200):**

```json
{
  "message": "Update option successfully"
}
```

---

### 5. Delete Option

**Endpoint:** `DELETE /options/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete option successfully"
}
```

---

## Stores

### 1. Get All Stores

**Endpoint:** `GET /stores`

**Query Parameters:**

- `page` (optional, number): Page number for pagination (default: 1, min: 1)
- `limit` (optional, number): Number of items per page (default: 10, min: 1)
- `search` (optional, string): Search keyword to filter stores by name, code, description, or address (case-insensitive)
- `is_active` (optional, boolean): Filter by active status (true/false)
- `city` (optional, string): Filter by city name (case-insensitive)
- `province` (optional, string): Filter by province name (case-insensitive)

**Example Requests:**

```bash
# Basic pagination
GET /stores?page=1&limit=10

# Search stores
GET /stores?search=jakarta

# Filter by active status
GET /stores?is_active=true

# Filter by city
GET /stores?city=jakarta

# Filter by province
GET /stores?province=DKI Jakarta

# Combined filters
GET /stores?page=1&limit=5&search=grooming&is_active=true&city=jakarta
```

**Success Response (200):**

```json
{
  "message": "Fetch stores successfully",
  "stores": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "code": "STR001",
      "name": "Pawship Store Jakarta",
      "description": "Main store in Jakarta",
      "location": {
        "address": "Jl. Sudirman No. 123",
        "city": "Jakarta",
        "province": "DKI Jakarta",
        "postal_code": "12345",
        "latitude": -6.2088,
        "longitude": 106.8456
      },
      "contact": {
        "phone_number": "+628123456789",
        "whatsapp": "+628123456789",
        "email": "jakarta@pawship.com"
      },
      "operational": {
        "opening_time": "09:00",
        "closing_time": "18:00",
        "operational_days": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday"
        ],
        "timezone": "Asia/Jakarta"
      },
      "capacity": {
        "default_daily_capacity_minutes": 480,
        "overbooking_limit_minutes": 60
      },
      "is_active": true,
      "createdAt": "2024-01-15T08:00:00.000Z",
      "updatedAt": "2024-01-15T08:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

**Notes:**

- All query parameters are optional
- Search performs case-insensitive pattern matching across name, code, description, and address fields
- Results are sorted by creation date (newest first)
- Stores with `isDeleted: true` are excluded from results
- The `capacity.default_daily_capacity_minutes` value may be overridden by today's `StoreDailyCapacity` if configured

---

### 2. Get Store By ID

**Endpoint:** `GET /stores/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch store successfully",
  "store": {
    "_id": "507f1f77bcf86cd799439011",
    "code": "STR001",
    "name": "Pawship Store Jakarta",
    "description": "Main store in Jakarta",
    "location": {
      "address": "Jl. Sudirman No. 123",
      "city": "Jakarta",
      "province": "DKI Jakarta",
      "postal_code": "12345",
      "latitude": -6.2088,
      "longitude": 106.8456
    },
    "contact": {
      "phone_number": "+628123456789",
      "whatsapp": "+628123456789",
      "email": "jakarta@pawship.com"
    },
    "operational": {
      "opening_time": "09:00",
      "closing_time": "18:00",
      "operational_days": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
      ],
      "timezone": "Asia/Jakarta"
    },
    "capacity": {
      "default_daily_capacity_minutes": 480,
      "overbooking_limit_minutes": 60
    },
    "is_active": true,
    "createdAt": "2024-01-15T08:00:00.000Z",
    "updatedAt": "2024-01-15T08:00:00.000Z"
  }
}
```

**Error Responses:**

- **404 Not Found:** Store not found

---

### 3. Create Store

**Endpoint:** `POST /stores`

**Request Body:**

```json
{
  "code": "string (required)",
  "name": "string (required)",
  "description": "string (optional)",
  "location": {
    "address": "string (optional)",
    "city": "string (optional)",
    "province": "string (optional)",
    "postal_code": "string (optional)",
    "latitude": "number (optional)",
    "longitude": "number (optional)"
  },
  "contact": {
    "phone_number": "string (optional)",
    "whatsapp": "string (optional)",
    "email": "string (optional)"
  },
  "operational": {
    "opening_time": "string (optional)",
    "closing_time": "string (optional)",
    "operational_days": ["Monday", "Tuesday", ...] (optional),
    "timezone": "string (optional, default: Asia/Jakarta)"
  },
  "capacity": {
    "default_daily_capacity_minutes": "number (required)",
    "overbooking_limit_minutes": "number (required)"
  },
  "is_active": "boolean (optional, default: true)"
}
```

**Success Response (200):**

```json
{
  "message": "Create store successfully"
}
```

**Notes:**

- `code`: Must be unique (e.g., STR001, STR002)
- `name`: Store name
- `capacity.default_daily_capacity_minutes`: Total minutes available per day (e.g., 480 for 8 hours)
- `capacity.overbooking_limit_minutes`: Additional minutes allowed beyond default capacity (e.g., 60 for up to 1 hour overbooking)
- `operational_days`: Valid values are Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday

---

### 4. Update Store

**Endpoint:** `PUT /stores/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** Same as Create Store (all fields optional)

**Success Response (200):**

```json
{
  "message": "Update store successfully"
}
```

---

### 5. Delete Store

**Endpoint:** `DELETE /stores/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete store successfully"
}
```

---

## Services

Services support multi-size pricing (different prices for different pet sizes).

### 1. Get All Services

**Endpoint:** `GET /services`

**Success Response (200):**

```json
{
  "message": "Fetch services successfully",
  "services": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "code": "SVC001",
      "name": "Basic Grooming",
      "description": "Basic grooming package",
      "service_type_id": "507f1f77bcf86cd799439012",
      "pet_type_ids": ["507f1f77bcf86cd799439013"],
      "size_category_ids": [
        "507f1f77bcf86cd799439014",
        "507f1f77bcf86cd799439015"
      ],
      "prices": [
        {
          "size_id": "507f1f77bcf86cd799439014",
          "price": 100000
        },
        {
          "size_id": "507f1f77bcf86cd799439015",
          "price": 150000
        }
      ],
      "duration": 60,
      "available_for_unlimited": false,
      "available_store_ids": ["507f1f77bcf86cd799439016"],
      "is_active": true
    }
  ]
}
```

---

### 2. Get Service By ID

**Endpoint:** `GET /services/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch service successfully",
  "service": {
    "_id": "507f1f77bcf86cd799439011",
    "code": "SVC001",
    "name": "Basic Grooming",
    "prices": [...],
    "duration": 60,
    "is_active": true
  }
}
```

**Error Responses:**

- **404 Not Found:** Service not found

---

### 3. Create Service

**Endpoint:** `POST /services`

**Request Body:**

```json
{
  "code": "string (required)",
  "name": "string (required)",
  "description": "string (optional)",
  "service_type_id": "MongoDB ObjectId (required)",
  "pet_type_ids": ["MongoDB ObjectId"] (optional array),
  "size_category_ids": ["MongoDB ObjectId"] (required array),
  "prices": [
    {
      "size_id": "MongoDB ObjectId (required)",
      "price": "number (required, min: 0)"
    }
  ] (required array),
  "duration": "number (required, min: 1, in minutes)",
  "available_for_unlimited": "boolean (optional)",
  "available_store_ids": ["MongoDB ObjectId"] (optional array),
  "is_active": "boolean (optional, default: true)"
}
```

**Success Response (200):**

```json
{
  "message": "Create service successfully"
}
```

**Validation Notes:**

- `prices` array must match with `size_category_ids`
- Each size must have a corresponding price

---

### 4. Update Service

**Endpoint:** `PUT /services/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** Same as Create Service (all fields optional)

**Success Response (200):**

```json
{
  "message": "Update service successfully"
}
```

---

### 5. Delete Service

**Endpoint:** `DELETE /services/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete service successfully"
}
```

---

## Pets

### 1. Get All Pets

**Endpoint:** `GET /pets`

**Success Response (200):**

```json
{
  "message": "Fetch pets successfully",
  "pets": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Buddy",
      "description": "Friendly dog",
      "internal_note": "Sensitive to loud noises",
      "profile_image": {
        "secure_url": "https://cloudinary.com/...",
        "public_id": "pets/buddy123"
      },
      "pet_type_id": "507f1f77bcf86cd799439012",
      "feather_category_id": "507f1f77bcf86cd799439013",
      "birthday": "2020-01-15T00:00:00.000Z",
      "size_category_id": "507f1f77bcf86cd799439014",
      "breed_category_id": "507f1f77bcf86cd799439015",
      "weight": 15,
      "member_category_id": "507f1f77bcf86cd799439016",
      "tags": ["friendly", "energetic"],
      "last_grooming_at": "2026-01-15T00:00:00.000Z",
      "last_visit_at": "2026-02-01T00:00:00.000Z",
      "customer_id": "507f1f77bcf86cd799439017",
      "memberships": [
        {
          "membership_id": "507f1f77bcf86cd799439018",
          "start_date": "2026-01-01T00:00:00.000Z",
          "end_date": "2026-12-31T00:00:00.000Z",
          "status": "active",
          "usage_count": 2,
          "max_usage": 12
        }
      ],
      "is_active": true
    }
  ]
}
```

---

### 2. Get Pet By ID

**Endpoint:** `GET /pets/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch pet successfully",
  "pet": { ... }
}
```

**Error Responses:**

- **404 Not Found:** Pet not found

---

### 3. Create Pet

**Endpoint:** `POST /pets`

**Request Body:**

```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "internal_note": "string (optional)",
  "profile_image": {
    "secure_url": "string (optional)",
    "public_id": "string (optional)"
  },
  "pet_type_id": "MongoDB ObjectId (required)",
  "feather_category_id": "MongoDB ObjectId (optional)",
  "birthday": "Date (optional)",
  "size_category_id": "MongoDB ObjectId (required)",
  "breed_category_id": "MongoDB ObjectId (required)",
  "weight": "number (optional)",
  "member_category_id": "MongoDB ObjectId (optional)",
  "tags": ["string"] (optional array),
  "last_grooming_at": "Date (optional)",
  "last_visit_at": "Date (optional)",
  "customer_id": "MongoDB ObjectId (required)",
  "memberships": [
    {
      "membership_id": "MongoDB ObjectId (required)",
      "start_date": "Date (required)",
      "end_date": "Date (required)",
      "status": "string (required)",
      "usage_count": "number (optional)",
      "max_usage": "number (optional)"
    }
  ] (optional array),
  "is_active": "boolean (optional)"
}
```

**Success Response (200):**

```json
{
  "message": "Create pet successfully"
}
```

---

### 4. Update Pet

**Endpoint:** `PUT /pets/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** Same as Create Pet (all fields optional)

**Success Response (200):**

```json
{
  "message": "Update pet successfully"
}
```

---

### 5. Delete Pet

**Endpoint:** `DELETE /pets/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete pet successfully"
}
```

---

## Memberships

### 1. Get All Memberships

**Endpoint:** `GET /memberships`

**Success Response (200):**

```json
{
  "message": "Fetch memberships successfully",
  "memberships": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Gold Membership",
      "description": "Premium membership package",
      "pet_type_ids": ["507f1f77bcf86cd799439012"],
      "duration_months": 12,
      "price": 1200000,
      "max_usage": 12,
      "service_include_ids": [
        "507f1f77bcf86cd799439013",
        "507f1f77bcf86cd799439014"
      ],
      "is_active": true
    }
  ]
}
```

---

### 2. Get Membership By ID

**Endpoint:** `GET /memberships/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch membership successfully",
  "membership": { ... }
}
```

**Error Responses:**

- **404 Not Found:** Membership not found

---

### 3. Create Membership

**Endpoint:** `POST /memberships`

**Request Body:**

```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "pet_type_ids": ["MongoDB ObjectId"] (optional array),
  "duration_months": "number (required, min: 1)",
  "price": "number (required, min: 0)",
  "max_usage": "number (optional)",
  "service_include_ids": ["MongoDB ObjectId"] (optional array),
  "is_active": "boolean (optional, default: true)"
}
```

**Success Response (200):**

```json
{
  "message": "Create membership successfully"
}
```

---

### 4. Update Membership

**Endpoint:** `PUT /memberships/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** Same as Create Membership (all fields optional)

**Success Response (200):**

```json
{
  "message": "Update membership successfully"
}
```

---

### 5. Delete Membership

**Endpoint:** `DELETE /memberships/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete membership successfully"
}
```

---

## Store Daily Capacities

Store daily capacity allows overriding the default store capacity for specific dates (e.g., holidays, special events).

### 1. Create Store Daily Capacity

**Endpoint:** `POST /store-daily-capacities`

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "store_id": "MongoDB ObjectId (required)",
  "date": "Date (required, format: YYYY-MM-DD)",
  "total_capacity_minutes": "number (required, total minutes available for this date)",
  "notes": "string (optional, e.g., 'Holiday reduced hours')",
  "created_by": "MongoDB ObjectId (optional, auto-assigned from authenticated user)"
}
```

**Success Response (200):**

```json
{
  "message": "Create store daily capacity successfully"
}
```

**Business Logic:**

- Overrides the default store capacity for a specific date
- System automatically assigns `created_by` from authenticated user
- Used by booking system to validate capacity constraints
- Date is normalized to UTC midnight for consistent querying

---

### 2. Get All Store Daily Capacities

**Endpoint:** `GET /store-daily-capacities`

**Authentication:** Required (JWT)

**Success Response (200):**

```json
{
  "message": "Fetch store daily capacities successfully",
  "capacities": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "store_id": "507f1f77bcf86cd799439012",
      "date": "2026-02-25T00:00:00.000Z",
      "total_capacity_minutes": 600,
      "notes": "Holiday reduced hours",
      "created_by": "507f1f77bcf86cd799439013",
      "createdAt": "2026-02-19T10:00:00.000Z",
      "updatedAt": "2026-02-19T10:00:00.000Z"
    }
  ]
}
```

---

### 3. Get Store Daily Capacity By ID

**Endpoint:** `GET /store-daily-capacities/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch store daily capacity successfully",
  "capacity": { ... }
}
```

**Error Responses:**

- **404 Not Found:** Store daily capacity not found

---

### 4. Update Store Daily Capacity

**Endpoint:** `PUT /store-daily-capacities/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** Same as Create Store Daily Capacity (all fields optional)

**Success Response (200):**

```json
{
  "message": "Update store daily capacity successfully"
}
```

---

### 5. Delete Store Daily Capacity

**Endpoint:** `DELETE /store-daily-capacities/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete store daily capacity successfully"
}
```

**Notes:**

- This is a hard delete (permanently removes the record)
- After deletion, booking system will use the default store capacity

---

## Guest Booking Flow

Guest endpoints allow unauthenticated users to browse and create bookings without pre-registration.

### 1. Get All Stores (Guest)

**Endpoint:** `GET /guest/stores`

**Authentication:** Not Required (Public)

**Success Response (200):**

```json
{
  "message": "Fetch stores successfully",
  "stores": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Pawship Jakarta",
      "address": { ... },
      "capacity": {
        "default_daily_capacity_minutes": 720,
        "overbooking_limit_minutes": 120
      },
      "is_active": true
    }
  ]
}
```

---

### 2. Get Services (Guest)

**Endpoint:** `GET /guest/services`

**Authentication:** Not Required (Public)

**Query Parameters:**

- `store_id` (optional): Filter services by store
- `type` (optional): Filter by service type ("grooming" or "addon")

**Success Response (200):**

```json
{
  "message": "Fetch services successfully",
  "services": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Basic Grooming",
      "description": "Full grooming service",
      "prices": [
        {
          "size_category_id": "507f1f77bcf86cd799439012",
          "price": 150000
        }
      ],
      "duration": 60,
      "is_active": true
    }
  ]
}
```

---

### 3. Check User By Phone

**Endpoint:** `GET /guest/check-user/phone/:phone_number`

**Authentication:** Not Required (Public)

**Parameters:**

- `phone_number` (path): User's phone number

**Success Response (200):**

If user exists:

```json
{
  "message": "User found",
  "exists": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "phone_number": "+628123456789"
  },
  "pets": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Buddy",
      "pet_type_id": "507f1f77bcf86cd799439013",
      "size_category_id": "507f1f77bcf86cd799439014"
    }
  ]
}
```

If user not found:

```json
{
  "message": "User not found, please register",
  "exists": false
}
```

---

### 4. Register Guest User

**Endpoint:** `POST /guest/register`

**Authentication:** Not Required (Public)

**Request Body:**

```json
{
  "username": "string (required)",
  "email": "string (required, valid email format)",
  "phone_number": "string (required)",
  "address": "string (optional)",
  "pet_name": "string (required)",
  "pet_type_id": "MongoDB ObjectId (required)",
  "size_category_id": "MongoDB ObjectId (required)",
  "breed_category_id": "MongoDB ObjectId (required)"
}
```

**Success Response (200):**

```json
{
  "message": "User and pet registered successfully. Welcome email has been sent.",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "phone_number": "+628123456789"
  },
  "pet": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Buddy",
    "customer_id": "507f1f77bcf86cd799439011"
  }
}
```

**Business Logic:**

- Creates new user with default password "pawship123"
- Password is hashed with bcrypt
- Automatically creates first pet for the user
- Assigns default role "customer"

---

### 5. Create Pet For Guest

**Endpoint:** `POST /guest/pets`

**Authentication:** Not Required (Public)

**Request Body:**

```json
{
  "customer_id": "MongoDB ObjectId (required)",
  "name": "string (required)",
  "pet_type_id": "MongoDB ObjectId (required)",
  "size_category_id": "MongoDB ObjectId (required)",
  "breed_category_id": "MongoDB ObjectId (required)",
  "weight": "number (optional)",
  "birthday": "Date (optional)"
}
```

**Success Response (200):**

```json
{
  "message": "Pet created successfully",
  "pet": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Max",
    "customer_id": "507f1f77bcf86cd799439011"
  }
}
```

---

### 6. Create Guest Booking

**Endpoint:** `POST /guest/bookings`

**Authentication:** Not Required (Public)

**Request Body:**

```json
{
  "customer_id": "MongoDB ObjectId (required)",
  "pet_id": "MongoDB ObjectId (required)",
  "store_id": "MongoDB ObjectId (required for in store type)",
  "date": "Date (required, format: YYYY-MM-DD)",
  "time_range": "string (required, format: HH:mm - HH:mm)",
  "type": "in home | in store (required)",
  "service_id": "MongoDB ObjectId (required)",
  "service_addon_ids": ["MongoDB ObjectId"] (optional array),
  "travel_fee": "number (optional)",
  "note": "string (optional)"
}
```

**Success Response (200):**

```json
{
  "message": "Guest booking created successfully"
}
```

**Business Logic:**

- Same capacity validation as authenticated booking
- If capacity exceeded beyond overbooking limit, booking is created as WAITLIST
- System automatically calculates pricing based on pet size
- Creates pet_snapshot automatically
- Initial booking_status is "requested"

---

## Bookings

### 1. Get All Bookings

**Endpoint:** `GET /bookings`

**Success Response (200):**

```json
{
  "message": "Fetch bookings successfully",
  "bookings": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "customer_id": "507f1f77bcf86cd799439012",
      "pet_snapshot": {
        "name": "Buddy",
        "member_type": "VIP"
      },
      "pet_id": "507f1f77bcf86cd799439013",
      "store_id": "507f1f77bcf86cd799439014",
      "date": "2026-02-25T00:00:00.000Z",
      "time_range": "10:00 - 11:00",
      "type": "in store",
      "booking_status": "confirmed",
      "status_logs": [
        {
          "status": "requested",
          "timestamp": "2026-02-19T10:00:00.000Z",
          "note": "Customer requested booking"
        },
        {
          "status": "confirmed",
          "timestamp": "2026-02-19T11:00:00.000Z",
          "note": "Booking confirmed by admin"
        }
      ],
      "service_id": "507f1f77bcf86cd799439015",
      "service_addon_ids": ["507f1f77bcf86cd799439016"],
      "travel_fee": 50000,
      "sub_total_service": 150000,
      "total_price": 200000,
      "discount_ids": [],
      "assigned_groomers": [
        {
          "task": "washing",
          "groomer_id": "507f1f77bcf86cd799439017"
        },
        {
          "task": "drying",
          "groomer_id": "507f1f77bcf86cd799439018"
        }
      ],
      "sessions": [
        {
          "_id": "507f1f77bcf86cd799439020",
          "type": "washing",
          "groomer_id": "507f1f77bcf86cd799439017",
          "status": "in progress",
          "started_at": "2026-02-25T10:30:00.000Z",
          "finished_at": null,
          "notes": null,
          "internal_note": null,
          "order": 0,
          "media": []
        },
        {
          "_id": "507f1f77bcf86cd799439021",
          "type": "drying",
          "groomer_id": "507f1f77bcf86cd799439018",
          "status": "not started",
          "started_at": null,
          "finished_at": null,
          "notes": null,
          "internal_note": null,
          "order": 1,
          "media": []
        }
      ],
      "referal_code": "FRIEND20",
      "note": "Please be gentle, first time grooming",
      "payment_method": "cash",
      "grooming_session": {
        "status": "not started",
        "arrived_at": null,
        "started_at": null,
        "finished_at": null,
        "notes": "",
        "internal_note": "",
        "media": []
      },
      "isDeleted": false,
      "createdAt": "2026-02-19T10:00:00.000Z",
      "updatedAt": "2026-02-19T11:00:00.000Z"
    }
  ]
}
```

---

### 2. Get Booking By ID

**Endpoint:** `GET /bookings/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch booking successfully",
  "booking": { ... }
}
```

**Error Responses:**

- **404 Not Found:** Booking not found

---

### 3. Create Booking

**Endpoint:** `POST /bookings`

**Request Body:**

```json
{
  "customer_id": "MongoDB ObjectId (required)",
  "pet_id": "MongoDB ObjectId (required)",
  "pet_snapshot": {
    "name": "string (optional)",
    "member_type": "string (optional)"
  },
  "store_id": "MongoDB ObjectId (optional, required for in store type)",
  "date": "Date (required)",
  "time_range": "string (required, format: HH:mm - HH:mm)",
  "type": "in home | in store (required)",
  "booking_status": "requested | confirmed | arrived | grooming in progress | grooming finished | rescheduled | cancelled (optional)",
  "service_id": "MongoDB ObjectId (required)",
  "service_addon_ids": ["MongoDB ObjectId"] (optional array),
  "travel_fee": "number (optional)",
  "sub_total_service": "number (optional)",
  "total_price": "number (optional)",
  "discount_ids": ["MongoDB ObjectId"] (optional array),
  "assigned_groomer_ids": ["MongoDB ObjectId"] (optional array),
  "referal_code": "string (optional)",
  "note": "string (optional)",
  "payment_method": "string (optional)"
}
```

**Success Response (200):**

```json
{
  "message": "Create booking successfully"
}
```

**Business Logic:**

- System automatically creates `pet_snapshot` from pet data
- System calculates pricing based on service and pet size (including addons)
- Initial `booking_status` is "requested"
- Creates initial status log entry
- **Capacity Management:**
  - Validates against store's daily capacity (checks StoreDailyCapacity override or uses default)
  - Atomically increments StoreDailyUsage for the date
  - If capacity exceeded beyond overbooking_limit_minutes, creates WAITLIST booking
  - If within overbooking limit, creates CONFIRMED booking with overbooked note
  - Uses MongoDB transactions to ensure data consistency
- All operations are atomic - if any step fails, entire transaction is rolled back

---

### 4. Update Booking

**Endpoint:** `PUT /bookings/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** Same as Create Booking (all fields optional)

**Success Response (200):**

```json
{
  "message": "Update booking successfully"
}
```

**Business Logic:**

- Cannot update `customer_id` through this endpoint
- **Capacity Tracking on Update:**
  - If date or service/addons changed, capacity is recalculated
  - Rolls back old capacity usage (decrements old date's usage)
  - Increments new capacity usage (validates against new date's limit)
  - If new capacity would be exceeded, update is rejected with error
  - All capacity operations use MongoDB transactions for atomicity
- **Session Synchronization:**
  - If `assigned_groomers` array is updated, sessions are automatically synchronized
  - Sessions are matched by order/index with assigned groomers
  - Existing sessions are updated, new sessions are created as needed
- Status logs are automatically appended when `booking_status` changes
- Use specific endpoints for status updates

**Error Responses:**

- **400 Bad Request:** Capacity exceeded for the new date

```json
{
  "statusCode": 400,
  "message": "Cannot update booking: capacity exceeded for 2026-02-25. Available capacity: 720 minutes, would be used: 800 minutes.",
  "error": "Bad Request"
}
```

---

### 5. Delete Booking

**Endpoint:** `DELETE /bookings/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete booking successfully"
}
```

---

### 6. Assign Groomer to Booking

**Endpoint:** `PATCH /bookings/assign-groomer/:id`

**Parameters:**

- `id` (path): Booking MongoDB ObjectId

**Request Body:**

```json
{
  "assigned_groomers": [
    {
      "task": "string (required, e.g., 'washing', 'drying', 'cutting')",
      "groomer_id": "MongoDB ObjectId (required)"
    }
  ] (required array)
}
```

**Success Response (200):**

```json
{
  "message": "Assign groomer successfully"
}
```

**Business Logic:**

- Assigns groomers to the booking with specific tasks
- Automatically creates/syncs sessions array based on assigned_groomers
- Each groomer assignment creates a corresponding session with:
  - `order`: Matches the index in assigned_groomers array
  - `type`: The task assigned to the groomer
  - `status`: NOT_STARTED initially
  - `groomer_id`: The assigned groomer
- Sessions are synchronized by order/index when groomers are updated

---

### 7. Update Booking Status

**Endpoint:** `PATCH /bookings/update-status/:id`

**Parameters:**

- `id` (path): Booking MongoDB ObjectId

**Request Body:**

```json
{
  "status": "requested | confirmed | arrived | grooming in progress | grooming finished | rescheduled | cancelled (required)",
  "date": "Date (optional, required for rescheduled status)",
  "time_range": "string (optional, required for rescheduled status)",
  "note": "string (optional)"
}
```

**Success Response (200):**

```json
{
  "message": "Update status booking successfully"
}
```

**Business Logic:**

- Updates booking_status
- Adds entry to status_logs with timestamp
- If status is "rescheduled", updates date and time_range
- If status is "rescheduled", requires date and time_range

**Error Responses:**

- **400 Bad Request:** Missing required fields for rescheduled status

---

## Grooming Sessions

Grooming sessions track individual grooming tasks within a booking. Sessions are automatically created when groomers are assigned to a booking, with each session representing one groomer's task.

### Session Lifecycle

- **Creation**: Sessions are auto-created when groomers are assigned via PATCH `/bookings/assign-groomer/:id`
- **Synchronization**: Sessions sync with `assigned_groomers` by order/index
- **States**: NOT_STARTED → IN_PROGRESS → FINISHED

### 1. Update Session

**Endpoint:** `PATCH /bookings/:bookingId/session/:sessionId`

**Authentication:** Required (JWT)

**Parameters:**

- `bookingId` (path): Booking MongoDB ObjectId
- `sessionId` (path): Session MongoDB ObjectId

**Request Body:**

```json
{
  "notes": "string (optional)",
  "internal_note": "string (optional)"
}
```

**Success Response (200):**

```json
{
  "message": "Session updated successfully"
}
```

---

### 2. Start Session

**Endpoint:** `PATCH /bookings/:bookingId/session/:sessionId/start`

**Authentication:** Required (JWT)

**Parameters:**

- `bookingId` (path): Booking MongoDB ObjectId
- `sessionId` (path): Session MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Session started successfully"
}
```

**Business Logic:**

- Updates session `status` to "in progress"
- Sets `started_at` to current timestamp
- Records user who started the session

---

### 3. Finish Session

**Endpoint:** `PATCH /bookings/:bookingId/session/:sessionId/finish`

**Authentication:** Required (JWT)

**Parameters:**

- `bookingId` (path): Booking MongoDB ObjectId
- `sessionId` (path): Session MongoDB ObjectId

**Request Body:**

```json
{
  "notes": "string (optional, grooming notes)"
}
```

**Success Response (200):**

```json
{
  "message": "Session finished successfully"
}
```

**Business Logic:**

- Updates session `status` to "finished"
- Sets `finished_at` to current timestamp
- Optionally updates notes
- Records user who finished the session

---

### 4. Delete Session

**Endpoint:** `DELETE /bookings/:bookingId/session/:sessionId`

**Authentication:** Required (JWT)

**Parameters:**

- `bookingId` (path): Booking MongoDB ObjectId
- `sessionId` (path): Session MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Session deleted successfully"
}
```

**Business Logic:**

- Removes the session from the booking's sessions array
- Use with caution - ensure groomer assignment is also updated

---

### 5. Upload Session Media

**Endpoint:** `POST /bookings/:bookingId/session/:sessionId/media`

**Content-Type:** `multipart/form-data`

**Authentication:** Required (JWT)

**Parameters:**

- `bookingId` (path): Booking MongoDB ObjectId
- `sessionId` (path): Session MongoDB ObjectId

**Request Body (Form-Data):**

- `image`: File (required) - Image file to upload
- `type`: "before" | "after" (required)
- `note`: string (optional) - Additional note about the image

**Success Response (200):**

```json
{
  "message": "Media uploaded successfully"
}
```

**Business Logic:**

- Uploads image to Cloudinary (folder: grooming-session)
- Stores media info in session's `media` array
- Automatically captures uploader info from authenticated user
- Each session can have multiple before/after photos

**Example Form-Data in Postman:**

```
Key: image         | Type: File | Value: [Select file]
Key: type          | Type: Text | Value: before
Key: note          | Type: Text | Value: Pet condition before washing
```

**Error Responses:**

- **400 Bad Request:** Missing required fields or file

```json
{
  "statusCode": 400,
  "message": "image file is required",
  "error": "Bad Request"
}
```

- **404 Not Found:** Booking or session not found
- **500 Internal Server Error:** Cloudinary upload failed

---

## Legacy Grooming Session Endpoints (Deprecated)

The following endpoints are maintained for backward compatibility but are deprecated. Use the new session endpoints above instead.

### 1. Groomer Arrived (For In-Home Service)

**Endpoint:** `PATCH /booking/grooming-session/arrive/:id`

**Parameters:**

- `id` (path): Booking MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Grooming session finished successfully"
}
```

**Business Logic:**

- Updates `booking_status` to "arrived"
- Sets `grooming_session.arrived_at` to current timestamp
- Adds entry to `status_logs`

**Error Responses:**

- **400 Bad Request:** ID is required
- **404 Not Found:** Booking not found

---

### 2. Start Grooming Session

**Endpoint:** `PATCH /booking/grooming-session/start/:id`

**Parameters:**

- `id` (path): Booking MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Grooming session started successfully"
}
```

**Business Logic:**

- Updates `booking_status` to "grooming in progress"
- Updates `grooming_session.status` to "in progress"
- Sets `grooming_session.started_at` to current timestamp
- Adds entry to `status_logs`

**Error Responses:**

- **400 Bad Request:** ID is required
- **404 Not Found:** Booking not found

---

### 3. Finish Grooming Session

**Endpoint:** `PATCH /booking/grooming-session/finish/:id`

**Parameters:**

- `id` (path): Booking MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Grooming session finished successfully"
}
```

**Business Logic:**

- Updates `booking_status` to "grooming finished"
- Updates `grooming_session.status` to "finished"
- Sets `grooming_session.finished_at` to current timestamp
- Adds entry to `status_logs`

**Error Responses:**

- **400 Bad Request:** ID is required
- **404 Not Found:** Booking not found

---

### 4. Upload Grooming Media (Before/After Photos)

**Endpoint:** `POST /booking/grooming-session/media/:id`

**Content-Type:** `multipart/form-data`

**Parameters:**

- `id` (path): Booking MongoDB ObjectId

**Request Body (Form-Data):**

- `image`: File (required) - Image file to upload
- `type`: "before" | "after" (required)
- `user_id`: MongoDB ObjectId (required) - User who uploads the image
- `user_name`: string (required) - Name snapshot of the user
- `note`: string (optional) - Additional note about the image

**Success Response (200):**

```json
{
  "message": "Media uploaded successfully"
}
```

**Business Logic:**

- Uploads image to Cloudinary (folder: grooming-session)
- Stores media info in `grooming_session.media` array
- Includes creator information (user_id, name_snapshot)
- Stores optional note

**Example Form-Data in Postman:**

```
Key: image         | Type: File | Value: [Select file]
Key: type          | Type: Text | Value: before
Key: user_id       | Type: Text | Value: 507f1f77bcf86cd799439011
Key: user_name     | Type: Text | Value: John Doe
Key: note          | Type: Text | Value: Pet condition before grooming
```

**Error Responses:**

- **400 Bad Request:** Missing required fields or file

```json
{
  "statusCode": 400,
  "message": "image file is required",
  "error": "Bad Request"
}
```

- **404 Not Found:** Booking not found
- **500 Internal Server Error:** Cloudinary upload failed (check environment variables)

---

## Enums Reference

### SessionStatus

```typescript
NOT_STARTED = 'not started';
IN_PROGRESS = 'in progress';
FINISHED = 'finished';
```

### BookingStatus

```typescript
REQUESTED = 'requested';
CONFIRMED = 'confirmed';
ARRIVED = 'arrived';
GROOMING_IN_PROGRESS = 'grooming in progress';
GROOMING_FINISHED = 'grooming finished';
RESCHEDULED = 'rescheduled';
CANCELLED = 'cancelled';
```

### GroomingType

```typescript
IN_HOME = 'in home';
IN_STORE = 'in store';
```

### MediaType

```typescript
BEFORE = 'before';
AFTER = 'after';
```

### UserRole

```typescript
ADMIN = 'admin';
OPS = 'ops';
GROOMER = 'groomer';
CUSTOMER = 'customer';
```

### CategoryOption

```typescript
FEATHER = 'feather category';
SIZE = 'size category';
BREED = 'breed category';
MEMBER = 'member category';
CUSTOMER = 'customer category';
PET_TYPE = 'pet type';
SERVICE_TYPE = 'service type';
```

---

## Common Error Responses

### 400 Bad Request

Returned when validation fails or required fields are missing.

```json
{
  "statusCode": 400,
  "message": "id is required",
  "error": "Bad Request"
}
```

### 404 Not Found

Returned when requested resource doesn't exist or has been deleted.

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

### 500 Internal Server Error

Returned when server encounters an unexpected error.

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Environment Variables Required

```env
# Database
MONGODB_URI=mongodb://localhost:27017/pawship-grooming
MONGODB_DATABASE_NAME=pawship-grooming

# Cloudinary (Required for media upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# JWT
JWT_SECRET=your_jwt_secret

# Server
PORT=3000
```

---

## Notes for Frontend Developers

1. **Authentication**: Save JWT token from login response and include in Authorization header for protected routes
2. **MongoDB ObjectIds**: All IDs are 24-character hex strings (e.g., "507f1f77bcf86cd799439011")
3. **Dates**: All dates are in ISO 8601 format (e.g., "2026-02-19T10:00:00.000Z")
4. **Soft Delete**: Deleted items are not actually removed, just marked with `isDeleted: true`
5. **File Upload**: Use `multipart/form-data` for media upload endpoints
6. **Pricing**: Service prices vary by pet size - always check pet's size_category_id against service prices
7. **Status Logs**: All status changes are tracked in `status_logs` array with timestamps
8. **Grooming Workflow**:
   - For In-Home: Requested → Confirmed → Arrived → In Progress → Finished
   - For In-Store: Requested → Confirmed → In Progress → Finished
9. **Capacity Management**:
   - Bookings validate against store daily capacity (default or override)
   - When capacity exceeded within overbooking limit: booking is CONFIRMED with note
   - When capacity exceeded beyond limit: booking is WAITLIST status
   - Use StoreDailyCapacity API to override default capacity for specific dates
10. **Guest Booking Flow**:
    - Check if user exists by phone → If not, register → Create pet → Create booking
    - All guest endpoints are public (no authentication required)
    - Default password "pawship123" assigned to new users
11. **Sessions vs Grooming Session**:
    - New: `sessions` array - multiple sessions per booking (one per groomer task)
    - Legacy: `grooming_session` object - single session per booking (deprecated)
    - Sessions are auto-created and synced when assigning groomers
12. **Transaction Safety**:
    - Booking create/update use MongoDB transactions for atomic operations
    - Capacity tracking is atomic - prevents race conditions
    - If any validation fails, entire transaction is rolled back

---

**Last Updated:** February 26, 2026
**API Version:** 1.0.0
