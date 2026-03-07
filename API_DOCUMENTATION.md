# Pawship Grooming Server - API Documentation

Base URL: `http://localhost:3000`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Options](#options)
4. [Stores](#stores)
5. [Services](#services)
6. [Service Types](#service-types)
7. [Zones](#zones)
8. [Banners](#banners)
9. [Upload File](#upload-file)
10. [Pets](#pets)
11. [Memberships](#memberships)
12. [Bookings](#bookings) _(includes public/guest endpoints)_
13. [Grooming Sessions](#grooming-sessions)

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
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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

### 3. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Request Body:**

```json
{
  "refresh_token": "string (required)"
}
```

**Success Response (200):**

```json
{
  "message": "token refreshed successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- **401 Unauthorized:** Invalid or expired refresh token

```json
{
  "statusCode": 401,
  "message": "refresh token is invalid",
  "error": "Unauthorized"
}
```

**Notes:**

- Refresh token is rotated on every successful refresh
- If refresh token is expired or revoked, user must login again

---

### 4. Logout

**Endpoint:** `POST /auth/logout`

**Authentication:** Required (JWT Token)

**Headers:**

```
Authorization: Bearer <access_token>
```

**Success Response (200):**

```json
{
  "message": "logout successfully"
}
```

**Notes:**

- Logout will revoke the current refresh token
- Access token remains valid until it expires

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
      "isDeleted": false,
      "deletedAt": null,
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

For non-customer users (admin, staff, etc.):

```json
{
  "message": "Fetch current user successfully",
  "user": {
    "_id": "698da2e219b8a1bbac7aabbb",
    "username": "Jhon",
    "email": "jhon@gmail.com",
    "phone_number": "081234567809",
    "role": "admin",
    "is_active": true,
    "isDeleted": false,
    "createdAt": "2026-02-12T09:52:34.717Z",
    "updatedAt": "2026-02-26T14:57:33.032Z"
  }
}
```

For customer users:

```json
{
  "message": "Fetch current user successfully",
  "user": {
    "_id": "698da2e219b8a1bbac7aabbb",
    "username": "Jane Doe",
    "email": "jane@gmail.com",
    "phone_number": "081234567890",
    "role": "customer",
    "is_active": true,
    "isDeleted": false,
    "createdAt": "2026-02-12T09:52:34.717Z",
    "updatedAt": "2026-02-26T14:57:33.032Z",
    "pets": [
      {
        "_id": "699a6285a99f14a4be787c77",
        "name": "Pet 1",
        "tags": [
            "cat",
            "grooming"
        ],
        "memberships": [
            {
                "membership_id": "698d8244218e6539ee47383f",
                "start_date": "2026-02-12T00:00:00.000Z",
                "end_date": "2026-08-12T00:00:00.000Z",
                "status": "active",
                "usage_count": 0,
                "max_usage": 0
            }
        ],
        "is_active": true,
        "isDeleted": false,
        "deletedAt": null,
        "createdAt": "2026-02-22T01:57:25.554Z",
        "updatedAt": "2026-02-22T02:06:37.220Z",
        "weight": 3,
        "pet_type": {
            "_id": "698bf0d362f5760ac021c595",
            "name": "Cat"
        },
        "hair": null,
        "size": {
            "_id": "698bf0e462f5760ac021c597",
            "name": "Small"
        },
        "breed": {
            "_id": "698da2bb19b8a1bbac7aabb6",
            "name": "Pom"
        },
        "member_category": {
            "_id": "699456cf429638a275fb0456",
            "name": "Vip - In Store"
        }
    }
  ]
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
- Sensitive fields (`password`, `refresh_token`, `refresh_token_expires_at`) are automatically excluded from response
- If user role is `customer`, the response includes a `pets` array with all their pets (non-deleted only)
- Pets are populated with their relationships: pet_type, hair_category, size_category, breed_category, and member_category
- Useful for profile pages or checking current user permissions

---

### 3. Get User By ID

**Endpoint:** `GET /users/:id`

**Authentication:** Required (JWT Token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

For non-customer users (admin, staff, etc.):

```json
{
  "message": "Fetch user successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "phone_number": "+628123456789",
    "role": "admin",
    "is_active": true,
    "isDeleted": false,
    "createdAt": "2026-02-12T09:52:34.717Z",
    "updatedAt": "2026-02-26T14:57:33.032Z"
  }
}
```

For customer users:

```json
{
  "message": "Fetch user successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "phone_number": "+628123456789",
    "role": "customer",
    "is_active": true,
    "isDeleted": false,
    "createdAt": "2026-02-12T09:52:34.717Z",
    "updatedAt": "2026-02-26T14:57:33.032Z",
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
        "pet_type": {
          "_id": "507f1f77bcf86cd799439012",
          "name": "Dog"
        },
        "hair": {
          "_id": "507f1f77bcf86cd799439013",
          "name": "Short"
        },
        "birthday": "2020-01-15T00:00:00.000Z",
        "size": {
          "_id": "507f1f77bcf86cd799439014",
          "name": "Medium"
        },
        "breed": {
          "_id": "507f1f77bcf86cd799439015",
          "name": "Golden Retriever"
        },
        "weight": 15,
        "member_category": {
          "_id": "507f1f77bcf86cd799439016",
          "name": "Gold"
        },
        "tags": ["friendly", "energetic"],
        "last_grooming_at": "2026-01-15T00:00:00.000Z",
        "last_visit_at": "2026-02-01T00:00:00.000Z",
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
        "is_active": true,
        "createdAt": "2026-01-10T10:30:00.000Z",
        "updatedAt": "2026-02-01T10:30:00.000Z"
      }
    ]
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

**Notes:**

- Sensitive fields (`password`, `refresh_token`, `refresh_token_expires_at`) are automatically excluded from response
- If user role is `customer`, the response includes a `pets` array with all their pets (non-deleted only)
- Pets are populated with their relationships: pet_type, hair, size, breed, and member_category

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
  - `hair category`
  - `size category`
  - `breed category`
  - `member category`
  - `customer category`
  - `pet type`

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
  "category_options": "hair category | size category | breed category | member category | customer category | pet type (required)",
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
      "_id": "698be0cd80c319b74fe2f073",
      "code": "PW-0001",
      "name": "Pawship.id",
      "description": "Cabang pertama di Surabaya",
      "location": {
        "address": "Jl. Klampis Jaya No.A6",
        "city": "Surabaya",
        "province": "Jawa Timur",
        "postal_code": "60284"
      },
      "contact": {
        "phone_number": "080987654321",
        "whatsapp": "080987654321",
        "email": "pawshipid@gmail.com"
      },
      "operational": {
        "opening_time": "09.00",
        "closing_time": "18.00",
        "operational_days": ["Monday", "Tuesday", "Sunday"],
        "timezone": "Asia/Jakarta"
      },
      "capacity": {
        "default_daily_capacity_minutes": 960,
        "overbooking_limit_minutes": 120
      },
      "is_active": true,
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-02-11T01:52:13.002Z",
      "updatedAt": "2026-03-06T04:54:14.821Z",
      "__v": 0,
      "sessions": ["09.00 - 12.00", "13.00 - 16.00", "17.00 - 20.00"]
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
    "session": [],
    "is_active": true,
    "createdAt": "2024-01-15T08:00:00.000Z",
    "updatedAt": "2024-01-15T08:00:00.000Z",
    "services": [
      {
        "_id": "69946d03d658fb630058e22c",
        "code": "SVC-0002",
        "name": "Teeth Brushing",
        "description": "Gentle teeth cleaning to promote dental health and fresh breath. Uses pet-safe toothpaste.",
        "prices": [
          {
            "pet_id": "698bf0e462f5760ac021c596",
            "pet_name": "Dog",
            "size_id": "698bf0e462f5760ac021c597",
            "size_name": "Small",
            "hair_id": "698bf0e462f5760ac021c598",
            "hair_name": "Short",
            "price": 40000
          },
          {
            "pet_id": "698bf0e462f5760ac021c596",
            "pet_name": "Dog",
            "size_id": "698bf0e862f5760ac021c599",
            "size_name": "Medium",
            "hair_id": "698bf0e462f5760ac021c598",
            "hair_name": "Short",
            "price": 40000
          },
          {
            "pet_id": "698bf0e462f5760ac021c596",
            "pet_name": "Dog",
            "size_id": "698bf0ea62f5760ac021c59b",
            "name": "Large",
            "price": 45000
          }
        ],
        "duration": 10,
        "available_for_unlimited": true,
        "is_active": true,
        "isDeleted": false,
        "deletedAt": null,
        "createdAt": "2026-02-17T13:28:35.231Z",
        "updatedAt": "2026-02-17T13:28:35.231Z",
        "service_type": {
          "_id": "698c038520d26d4a72925a10",
          "name": "Addon"
        },
        "size_categories": [
          {
            "_id": "698bf0e462f5760ac021c597",
            "name": "Small"
          },
          {
            "_id": "698bf0e862f5760ac021c599",
            "name": "Medium"
          },
          {
            "_id": "698bf0ea62f5760ac021c59b",
            "name": "Large"
          }
        ],
        "pet_types": []
      }
    ]
  }
}
```

**Notes:**

- Returns store details along with all services available at this store
- Only active and non-deleted services are returned
- Service details include populated `service_type`, `pet_types`, `size_categories` and `prices` fields (`pet_id`, `size_id`, `hair_id`) for easy display

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
  "session": ["string"] ,
  "is_active": "boolean (optional, default: true)"
}
```

**Success Response (200):**

```json
{
  "message": "Create store successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Duplicate code or validation error

```json
{
  "statusCode": 400,
  "message": "code already exists",
  "error": "Bad Request"
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

**Request Body:** (All fields optional)

```json
{
  "code": "string (optional)",
  "name": "string (optional)",
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
    "timezone": "string (optional)"
  },
  "capacity": {
    "default_daily_capacity_minutes": "number (optional)",
    "overbooking_limit_minutes": "number (optional)"
  },
  "session": ["string"],
  "is_active": "boolean (optional)"
}
```

**Success Response (200):**

```json
{
  "message": "Update store successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Invalid ID or duplicate code

```json
{
  "statusCode": 400,
  "message": "code already exists",
  "error": "Bad Request"
}
```

- **404 Not Found:** Store not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

---

### 5. Delete Store (Soft Delete)

**Endpoint:** `DELETE /stores/:id`

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete store successfully"
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

- **404 Not Found:** Store not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

**Notes:**

- This is a soft delete operation
- Store is marked with `isDeleted: true` and `deletedAt` timestamp
- Deleted stores are excluded from GET endpoints

---

## Services

Services support flexible pricing per entry with optional `pet_id`, `size_id`, and `hair_id` combination. All responses include populated relationships for service_type, size_categories, pet_types, available_store, addons, and price option names.

### 1. Get All Services

**Endpoint:** `GET /services`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Query Parameters (optional):**

- `page` (number, default: 1)
- `limit` (number, default: 10)
- `search` (string) — search by `name`, `code`, or `description`
- `is_active` (boolean)
- `available_for_unlimited` (boolean)
- `service_type_id` (MongoDB ObjectId)
- `pet_type_id` (MongoDB ObjectId)
- `size_category_id` (MongoDB ObjectId)
- `store_id` (MongoDB ObjectId)

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
      "service_type": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "Grooming"
      },
      "pet_types": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "name": "Dog"
        }
      ],
      "size_categories": [
        {
          "_id": "507f1f77bcf86cd799439014",
          "name": "Small"
        },
        {
          "_id": "507f1f77bcf86cd799439015",
          "name": "Medium"
        }
      ],
      "prices": [
        {
          "pet_id": "507f1f77bcf86cd799439013",
          "pet_name": "Dog",
          "size_id": "507f1f77bcf86cd799439014",
          "size_name": "Small",
          "hair_id": "507f1f77bcf86cd799439017",
          "hair_name": "Short",
          "price": 100000
        },
        {
          "pet_id": "507f1f77bcf86cd799439013",
          "pet_name": "Dog",
          "size_id": "507f1f77bcf86cd799439015",
          "size_name": "Medium",
          "hair_id": "507f1f77bcf86cd799439017",
          "hair_name": "Short",
          "price": 150000
        }
      ],
      "duration": 60,
      "available_for_unlimited": false,
      "image_url": "https://res.cloudinary.com/example/image/upload/v1/services/basic-grooming.jpg",
      "public_id": "pawship-grooming/services/basic-grooming",
      "avaiable_store": [
        {
          "_id": "507f1f77bcf86cd799439016",
          "name": "Store Jakarta Pusat"
        }
      ],
      "addons": [
        {
          "_id": "507f1f77bcf86cd799439022",
          "code": "ADD001",
          "name": "Ear Cleaning",
          "image_url": "https://res.cloudinary.com/example/image/upload/v1/services/ear-cleaning.jpg"
        }
      ],
      "include": ["Bath", "Nail Trim", "Ear Cleaning"],
      "show_in_homepage": false,
      "order": 0,
      "service_location_type": "in store",
      "is_active": true,
      "isDeleted": false,
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 2,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**Notes:**

- Returns only non-deleted services (`isDeleted: false`)
- All relationships are populated with their respective names
- Service names are automatically capitalized
- Use query parameters to filter and paginate results

---

### 2. Get Service By ID

**Endpoint:** `GET /services/:id`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch service successfully",
  "service": {
    "_id": "698d47e80085e35cb26fcab4",
    "code": "SVC-0001",
    "name": "Full Grooming Package",
    "description": "Complete grooming service including bath, haircut, nail trimming, ear cleaning, and blow dry. Perfect for keeping your pet looking and feeling their best.",
    "duration": 90,
    "is_active": true,
    "isDeleted": false,
    "deletedAt": null,
    "createdAt": "2026-02-12T03:24:24.372Z",
    "updatedAt": "2026-02-17T13:23:16.199Z",
    "available_for_unlimited": true,
    "image_url": "https://res.cloudinary.com/example/image/upload/v1/services/full-grooming.jpg",
    "public_id": "pawship-grooming/services/full-grooming",
    "prices": [
      {
        "pet_id": "698bf0e462f5760ac021c596",
        "pet_name": "Dog",
        "size_id": "698bf0e462f5760ac021c597",
        "size_name": "Small",
        "hair_id": "698bf0e462f5760ac021c598",
        "hair_name": "Short",
        "price": 120000
      },
      {
        "pet_id": "698bf0e462f5760ac021c596",
        "pet_name": "Dog",
        "size_id": "698bf0e862f5760ac021c599",
        "size_name": "Medium",
        "hair_id": "698bf0e462f5760ac021c598",
        "hair_name": "Short",
        "price": 150000
      },
      {
        "pet_id": "698bf0e462f5760ac021c596",
        "pet_name": "Dog",
        "size_id": "698bf0ea62f5760ac021c59b",
        "size_name": "Large",
        "hair_id": "698bf0e462f5760ac021c598",
        "hair_name": "Short",
        "price": 170000
      }
    ],
    "service_type": {
      "_id": "698c037b20d26d4a72925a0d",
      "name": "Grooming"
    },
    "size_categories": [
      {
        "_id": "698bf0e462f5760ac021c597",
        "name": "Small"
      },
      {
        "_id": "698bf0e862f5760ac021c599",
        "name": "Medium"
      },
      {
        "_id": "698bf0ea62f5760ac021c59b",
        "name": "Large"
      }
    ],
    "pet_types": [
      {
        "_id": "698d5573b70c2a3711e368dd",
        "name": "Dog"
      }
    ],
    "avaiable_store": [
      {
        "_id": "698be0cd80c319b74fe2f073",
        "name": "Pawship.id"
      }
    ],
    "addons": [
      {
        "_id": "507f1f77bcf86cd799439022",
        "code": "ADD001",
        "name": "Ear Cleaning",
        "image_url": "https://res.cloudinary.com/example/image/upload/v1/services/ear-cleaning.jpg"
      }
    ],
    "include": ["Bath", "Nail Trim", "Ear Cleaning"],
    "show_in_homepage": false,
    "order": 0,
    "service_location_type": "in_store"
  }
}
```

**Error Responses:**

- **404 Not Found:** Service not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

---

### 3. Create Service

**Endpoint:** `POST /services`

**Content-Type:** `application/json`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Request Body (JSON):**

```json
{
  "code": "SVC001",
  "name": "basic grooming",
  "description": "Basic grooming package",
  "service_type_id": "507f1f77bcf86cd799439012",
  "pet_type_ids": ["507f1f77bcf86cd799439013"],
  "size_category_ids": ["507f1f77bcf86cd799439014", "507f1f77bcf86cd799439015"],
  "prices": [
    {
      "pet_id": "507f1f77bcf86cd799439013",
      "size_id": "507f1f77bcf86cd799439014",
      "hair_id": "507f1f77bcf86cd799439017",
      "price": 100000
    },
    {
      "pet_id": "507f1f77bcf86cd799439013",
      "size_id": "507f1f77bcf86cd799439015",
      "hair_id": "507f1f77bcf86cd799439017",
      "price": 150000
    }
  ],
  "duration": 60,
  "available_for_unlimited": false,
  "available_store_ids": ["507f1f77bcf86cd799439016"],
  "addon_ids": ["507f1f77bcf86cd799439022"],
  "include": ["Bath", "Nail Trim", "Ear Cleaning"],
  "image_url": "https://res.cloudinary.com/example/image/upload/v1/services/basic-grooming.jpg",
  "public_id": "pawship-grooming/services/basic-grooming",
  "show_in_homepage": false,
  "order": 0,
  "service_location_type": "in_store",
  "is_active": true
}
```

**Field Descriptions:**

- `code`: Unique service code (required)
- `name`: Service name — will be auto-capitalized (required)
- `description`: Service description (optional)
- `service_type_id`: Reference to a Service Type document (required)
- `pet_type_ids`: Array of pet type Option IDs (optional, default: all active pet types)
- `size_category_ids`: Array of size category Option IDs (optional, default: all active size categories)
- `prices`: Array of `{ pet_id, size_id, hair_id, price }` — all three ID fields are optional per entry (optional, default: `[]`)
- `duration`: Duration in minutes, minimum 1 (required)
- `available_for_unlimited`: Whether available for unlimited membership (optional)
- `available_store_ids`: Stores where service is available (optional, default: all active stores)
- `addon_ids`: Other service IDs available as add-ons to this service (optional)
- `include`: List of what is included in the service — free-text strings (optional)
- `image_url`: Cloudinary image URL (optional) — set manually or via the upload endpoint
- `public_id`: Cloudinary public ID (optional) — set manually or via the upload endpoint
- `show_in_homepage`: Whether to show this service on the homepage (optional, default: false)
- `order`: Display order/sort priority (optional, default: 0)
- `service_location_type`: Location where the service is performed — `in_home` or `in_store` (optional, default: `in_store`)
- `is_active`: Active status (optional, default: true)

**Success Response (201):**

```json
{
  "message": "Create service successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Duplicate service code

```json
{
  "statusCode": 400,
  "message": "code already exists",
  "error": "Bad Request"
}
```

- **400 Bad Request:** Validation errors

```json
{
  "statusCode": 400,
  "message": [
    "code is required",
    "name service is required",
    "service type must be a valid ID",
    "Duration must be at least 1 minute"
  ],
  "error": "Bad Request"
}
```

**Notes:**

- Service name will be automatically capitalized (e.g., "basic grooming" → "Basic Grooming")
- Code must be unique across all services
- If `available_store_ids` is not provided or empty, defaults to all active stores
- If `size_category_ids` is not provided or empty, defaults to all active size categories
- If `pet_type_ids` is not provided or empty, defaults to all active pet types
- If `prices` is not provided, defaults to `[]`
- To upload an image, use the dedicated `POST /upload-file?folder=services` endpoint, then pass the returned `image_url` and `public_id` into the request body

---

### 4. Update Service

**Endpoint:** `PUT /services/:id`

**Content-Type:** `application/json`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body (JSON):** (All fields optional — same structure as Create Service)

```json
{
  "name": "Full Grooming Package",
  "description": "Updated description",
  "image_url": "https://res.cloudinary.com/example/image/upload/v1/services/full-grooming.jpg",
  "public_id": "pawship-grooming/services/full-grooming",
  "prices": [
    {
      "pet_id": "507f1f77bcf86cd799439013",
      "size_id": "507f1f77bcf86cd799439014",
      "price": 120000
    }
  ],
  "show_in_homepage": true,
  "order": 1,
  "is_active": true
}
```

**Success Response (200):**

```json
{
  "message": "Update service successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Duplicate service code

```json
{
  "statusCode": 400,
  "message": "code already exists",
  "error": "Bad Request"
}
```

- **404 Not Found:** Service not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

**Notes:**

- All fields are optional — only send fields you want to update
- Service name will be automatically capitalized
- Code must remain unique if updated
- If `available_store_ids` is updated with an empty array, it defaults to all active stores
- If `size_category_ids` is updated with an empty array, it defaults to all active size categories
- If `pet_type_ids` is updated with an empty array, it defaults to all active pet types
- To update the image, use `POST /upload-file?folder=services`, then pass the returned `image_url` and `public_id` in this request body

---

### 5. Delete Service

**Endpoint:** `DELETE /services/:id`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete service successfully"
}
```

**Error Responses:**

- **404 Not Found:** Service not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

**Notes:**

- This is a soft delete operation
- Service is marked with `isDeleted: true` and `deletedAt` timestamp
- Deleted services are excluded from GET endpoints

---

## Service Types

Service Types represent the categories of grooming/hotel/addon services offered (e.g., Grooming, Hotel, Addon).

### 1. Get All Service Types

**Endpoint:** `GET /service-types`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Query Parameters (optional):**

- `page` (number, default: 1)
- `limit` (number, default: 10)
- `search` (string) — search by `title` or `desc`
- `is_active` (boolean)
- `show_in_homepage` (boolean)

**Example Requests:**

```bash
GET /service-types?page=1&limit=10
GET /service-types?search=grooming
GET /service-types?is_active=true
GET /service-types?show_in_homepage=true
GET /service-types?search=grooming&is_active=true&page=1&limit=5
```

**Success Response (200):**

```json
{
  "message": "Fetch service types successfully",
  "serviceTypes": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Grooming",
      "desc": "Full grooming service for pets",
      "image_url": "pawship-grooming/service-types/grooming",
      "secure_url": "https://res.cloudinary.com/example/image/upload/v1/service-types/grooming.jpg",
      "is_active": true,
      "show_in_homepage": true,
      "store_ids": ["507f1f77bcf86cd799439020", "507f1f77bcf86cd799439021"],
      "isDeleted": false,
      "createdAt": "2026-02-19T10:00:00.000Z",
      "updatedAt": "2026-02-19T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 2. Get Service Type By ID

**Endpoint:** `GET /service-types/:id`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch service type successfully",
  "serviceType": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Grooming",
    "desc": "Full grooming service for pets",
    "image_url": "https://res.cloudinary.com/example/image/upload/v1/service-types/grooming.jpg",
    "secure_url": "https://res.cloudinary.com/example/image/upload/v1/service-types/grooming.jpg",
    "is_active": true,
    "show_in_homepage": true,
    "store_ids": ["507f1f77bcf86cd799439020", "507f1f77bcf86cd799439021"],
    "isDeleted": false,
    "createdAt": "2026-02-19T10:00:00.000Z",
    "updatedAt": "2026-02-19T10:00:00.000Z"
  }
}
```

**Error Responses:**

- **404 Not Found:** Service type not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

---

### 3. Create Service Type

**Endpoint:** `POST /service-types`

**Content-Type:** `multipart/form-data`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Request Body (Form-Data):**

- `title`: string (required)
- `desc`: string (optional)
- `image`: File (optional) — image to upload to Cloudinary
- `is_active`: boolean string `"true"` or `"false"` (optional, default: `false`)
- `show_in_homepage`: boolean string `"true"` or `"false"` (optional, default: `false`)
- `store_ids`: array of MongoDB ObjectId strings (optional) — list of stores where this service type is available

**Example Form-Data in Postman:**

```
Key: title            | Type: Text | Value: Grooming
Key: desc             | Type: Text | Value: Full grooming service for pets
Key: image            | Type: File | Value: [Select file]
Key: is_active        | Type: Text | Value: true
Key: show_in_homepage | Type: Text | Value: false
Key: store_ids[0]     | Type: Text | Value: 507f1f77bcf86cd799439020
Key: store_ids[1]     | Type: Text | Value: 507f1f77bcf86cd799439021
```

**Success Response (201):**

```json
{
  "message": "Create service type successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Validation error

```json
{
  "statusCode": 400,
  "message": ["title is required"],
  "error": "Bad Request"
}
```

- **500 Internal Server Error:** Cloudinary upload failed

---

### 4. Update Service Type

**Endpoint:** `PUT /service-types/:id`

**Content-Type:** `multipart/form-data`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body (Form-Data):** (All fields optional)

- `title`: string
- `desc`: string
- `image`: File — new image to upload (replaces `image_url` and `secure_url`)
- `is_active`: boolean string `"true"` or `"false"`
- `show_in_homepage`: boolean string `"true"` or `"false"`
- `store_ids`: array of MongoDB ObjectId strings — list of stores where this service type is available

**Success Response (200):**

```json
{
  "message": "Update service type successfully"
}
```

**Error Responses:**

- **404 Not Found:** Service type not found
- **500 Internal Server Error:** Cloudinary upload failed

---

### 5. Delete Service Type

**Endpoint:** `DELETE /service-types/:id`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete service type successfully"
}
```

**Error Responses:**

- **404 Not Found:** Service type not found

**Notes:**

- This is a soft delete operation
- Service type is marked with `isDeleted: true` and `deletedAt` timestamp
- Deleted service types are excluded from GET endpoints

---

---

## Banners

Banners are promotional images displayed on the app, optionally with a CTA button. Position of text and CTA button can be configured per banner.

**Base route:** `/banners`

**Headers (protected endpoints):**

- `Authorization: Bearer {access_token}` (required)

### Schema

| Field                     | Type    | Required    | Default  | Description                                |
| ------------------------- | ------- | ----------- | -------- | ------------------------------------------ |
| `image_url`               | string  | ✅          | —        | Cloudinary secure URL of the image         |
| `public_id`               | string  | ✅          | —        | Cloudinary public ID                       |
| `title`                   | string  | —           | —        | Banner title text                          |
| `subtitle`                | string  | —           | —        | Banner subtitle / body text                |
| `text_align`              | string  | —           | —        | Text alignment (`left`, `center`, `right`) |
| `text_color`              | string  | —           | —        | Text color (CSS value, e.g. `#ffffff`)     |
| `cta`                     | object  | —           | `null`   | CTA button config (see below)              |
| `cta.label`               | string  | ✅ (if cta) | —        | Button label text                          |
| `cta.link`                | string  | ✅ (if cta) | —        | URL the button navigates to                |
| `cta.background_color`    | string  | —           | —        | Button background color                    |
| `cta.text_color`          | string  | —           | —        | Button text color                          |
| `cta.vertical_position`   | string  | —           | `bottom` | `top` \| `center` \| `bottom`              |
| `cta.horizontal_position` | string  | —           | `center` | `left` \| `center` \| `right`              |
| `order`                   | number  | —           | `0`      | Display order (ascending)                  |
| `is_active`               | boolean | —           | `false`  | Whether banner is visible                  |

---

### 1. Get All Banners (Admin)

**Endpoint:** `GET /banners`

**Headers:** `Authorization: Bearer {access_token}` (required)

**Query Parameters (optional):**

- `page` (number, default: 1)
- `limit` (number, default: 10)
- `is_active` (boolean)

**Success Response (200):**

```json
{
  "message": "Fetch banners successfully",
  "banners": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "image_url": "https://res.cloudinary.com/example/image/upload/v1/banners/promo.jpg",
      "public_id": "banners/promo",
      "title": "Promo Maret!",
      "subtitle": "Diskon 20% untuk semua layanan grooming",
      "text_align": "center",
      "text_color": "#ffffff",
      "cta": {
        "label": "Pesan Sekarang",
        "link": "/bookings",
        "background_color": "#FF6B35",
        "text_color": "#ffffff",
        "vertical_position": "bottom",
        "horizontal_position": "center"
      },
      "order": 1,
      "is_active": true,
      "isDeleted": false,
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-03-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 2. Get Active Banners (Public)

**Endpoint:** `GET /banners/active`

**Authentication:** Not Required

**Description:** Mengambil semua banner yang `is_active: true`, diurutkan berdasarkan `order`. Digunakan untuk ditampilkan ke user/guest.

**Success Response (200):**

```json
{
  "message": "Fetch active banners successfully",
  "banners": [ ... ],
  "pagination": { ... }
}
```

---

### 3. Get Banner By ID

**Endpoint:** `GET /banners/:id`

**Headers:** `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch banner successfully",
  "banner": { ... }
}
```

**Error Responses:**

- **404 Not Found:** Banner not found

---

### 4. Create Banner

**Endpoint:** `POST /banners`

**Headers:** `Authorization: Bearer {access_token}` (required)

**Request Body:**

```json
{
  "image_url": "https://res.cloudinary.com/example/image/upload/v1/banners/promo.jpg",
  "public_id": "banners/promo",
  "title": "Promo Maret!",
  "subtitle": "Diskon 20% untuk semua layanan grooming",
  "text_align": "center",
  "text_color": "#ffffff",
  "cta": {
    "label": "Pesan Sekarang",
    "link": "/bookings",
    "background_color": "#FF6B35",
    "text_color": "#ffffff",
    "vertical_position": "bottom",
    "horizontal_position": "center"
  },
  "order": 1
}
```

> `cta` bersifat opsional. Jika tidak dikirim, banner tidak memiliki tombol CTA.
>
> `cta.vertical_position` enum: `top` | `center` | `bottom` (default: `bottom`)
>
> `cta.horizontal_position` enum: `left` | `center` | `right` (default: `center`)

**Success Response (201):**

```json
{
  "message": "Create banner successfully"
}
```

---

### 5. Update Banner

**Endpoint:** `PUT /banners/:id`

**Headers:** `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** (semua field opsional)

```json
{
  "title": "Promo April!",
  "is_active": true,
  "order": 2,
  "cta": {
    "label": "Lihat Promo",
    "link": "/promos",
    "vertical_position": "bottom",
    "horizontal_position": "left"
  }
}
```

**Success Response (200):**

```json
{
  "message": "Update banner successfully"
}
```

**Error Responses:**

- **404 Not Found:** Banner not found

---

### 6. Delete Banner

**Endpoint:** `DELETE /banners/:id`

**Headers:** `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Delete banner successfully"
}
```

**Notes:**

- Soft delete — banner ditandai `isDeleted: true`
- Banner yang dihapus tidak muncul di semua GET endpoint

---

## Zones

Zones define delivery/service coverage areas linked to a specific store. Each zone contains radius boundaries, estimated travel time, and a travel fee.

**Base route:** `/zones`

**Headers (all endpoints):**

- `Authorization: Bearer {access_token}` (required)
- `Content-Type: application/json`

---

### 1. Get All Zones

**Endpoint:** `GET /zones`

**Query Parameters:**

| Parameter  | Type   | Required | Description                  |
| ---------- | ------ | -------- | ---------------------------- |
| `page`     | number | No       | Page number (default: 1)     |
| `limit`    | number | No       | Items per page (default: 10) |
| `search`   | string | No       | Search by `area_name`        |
| `store_id` | string | No       | Filter by store ObjectId     |

**Success Response (200):**

```json
{
  "message": "Fetch zones successfully",
  "zones": [
    {
      "_id": "6650f1a2c3b4e5f6a7b8c9d0",
      "store_id": "6650f1a2c3b4e5f6a7b8c900",
      "area_name": "Kemang",
      "min_radius_km": 0,
      "max_radius_km": 5,
      "travel_time_minutes": 30,
      "travel_fee": 15000,
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "store": {
        "_id": "6650f1a2c3b4e5f6a7b8c900",
        "name": "Pawship Kemang"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 2. Get Zone by ID

**Endpoint:** `GET /zones/:id`

**Path Parameters:**

- `id` (string, required) — Zone ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch zone successfully",
  "zone": {
    "_id": "6650f1a2c3b4e5f6a7b8c9d0",
    "store_id": "6650f1a2c3b4e5f6a7b8c900",
    "area_name": "Kemang",
    "min_radius_km": 0,
    "max_radius_km": 5,
    "travel_time_minutes": 30,
    "travel_fee": 15000,
    "isDeleted": false,
    "deletedAt": null,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "store": {
      "_id": "6650f1a2c3b4e5f6a7b8c900",
      "name": "Pawship Kemang"
    }
  }
}
```

**Error Responses:**

- **404 Not Found:**

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

---

### 3. Create Zone

**Endpoint:** `POST /zones`

**Request Body:**

```json
{
  "store_id": "string (required, valid ObjectId)",
  "area_name": "string (required)",
  "min_radius_km": "number (required, min: 0)",
  "max_radius_km": "number (required, min: 0)",
  "travel_time_minutes": "number (required, min: 0)",
  "travel_fee": "number (required, min: 0)"
}
```

**Example Request Body:**

```json
{
  "store_id": "6650f1a2c3b4e5f6a7b8c900",
  "area_name": "Kemang",
  "min_radius_km": 0,
  "max_radius_km": 5,
  "travel_time_minutes": 30,
  "travel_fee": 15000
}
```

**Success Response (201):**

```json
{
  "message": "Create zone successfully",
  "zone": {
    "_id": "6650f1a2c3b4e5f6a7b8c9d0",
    "store_id": "6650f1a2c3b4e5f6a7b8c900",
    "area_name": "Kemang",
    "min_radius_km": 0,
    "max_radius_km": 5,
    "travel_time_minutes": 30,
    "travel_fee": 15000,
    "isDeleted": false,
    "deletedAt": null,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Responses:**

- **400 Bad Request:** Validation error

```json
{
  "statusCode": 400,
  "message": ["store_id must be a mongodb id", "area_name should not be empty"],
  "error": "Bad Request"
}
```

---

### 4. Update Zone

**Endpoint:** `PUT /zones/:id`

**Path Parameters:**

- `id` (string, required) — Zone ObjectId

**Request Body** (all fields optional):

```json
{
  "store_id": "string (optional, valid ObjectId)",
  "area_name": "string (optional)",
  "min_radius_km": "number (optional, min: 0)",
  "max_radius_km": "number (optional, min: 0)",
  "travel_time_minutes": "number (optional, min: 0)",
  "travel_fee": "number (optional, min: 0)"
}
```

**Success Response (200):**

```json
{
  "message": "Update zone successfully",
  "zone": {
    "_id": "6650f1a2c3b4e5f6a7b8c9d0",
    "store_id": "6650f1a2c3b4e5f6a7b8c900",
    "area_name": "Kemang",
    "min_radius_km": 0,
    "max_radius_km": 7,
    "travel_time_minutes": 45,
    "travel_fee": 20000,
    "isDeleted": false,
    "deletedAt": null,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z",
    "store": {
      "_id": "6650f1a2c3b4e5f6a7b8c900",
      "name": "Pawship Kemang"
    }
  }
}
```

**Error Responses:**

- **404 Not Found:** Zone not found or already deleted

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

---

### 5. Delete Zone

**Endpoint:** `DELETE /zones/:id`

**Path Parameters:**

- `id` (string, required) — Zone ObjectId

**Success Response (200):**

```json
{
  "message": "Delete zone successfully"
}
```

**Error Responses:**

- **404 Not Found:** Zone not found or already deleted

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

**Notes:**

- This is a soft delete operation
- Zone is marked with `isDeleted: true` and `deletedAt` timestamp
- Deleted zones are excluded from GET endpoints

---

## Upload File

A standalone, reusable endpoint for uploading images to Cloudinary. Use this to get back `image_url` and `public_id`, then pass them into any Create/Update request body that accepts those fields.

### 1. Upload Image

**Endpoint:** `POST /upload-file`

**Content-Type:** `multipart/form-data`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Query Parameters:**

- `folder` (string, optional) — Cloudinary subfolder name. Defaults to `general` if not provided. Example: `?folder=services`

**Request Body (Form-Data):**

- `image`: File (required) — image to upload

**Example Form-Data in Postman:**

```
POST /upload-file?folder=services

Key: image | Type: File | Value: [Select file]
```

**Success Response (200):**

```json
{
  "message": "Upload image successfully",
  "image_url": "https://res.cloudinary.com/example/image/upload/v1/pawship-grooming/services/abc123.jpg",
  "public_id": "pawship-grooming/services/abc123"
}
```

**Error Responses:**

- **400 Bad Request:** Missing image file

```json
{
  "statusCode": 400,
  "message": "image file is required",
  "error": "Bad Request"
}
```

- **500 Internal Server Error:** Cloudinary upload failed

**Notes:**

- Use `?folder=` to dynamically control which Cloudinary subfolder the image is stored in (e.g. `?folder=services`, `?folder=service-types`, `?folder=grooming-sessions`)
- After uploading, use the returned `image_url` and `public_id` in any Create or Update request body
- Default folder is `general` when no `folder` query param is provided

---

## Pets

### 1. Get All Pets

**Endpoint:** `GET /pets`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Query Parameters (optional):**

- `page` (number, default: 1)
- `limit` (number, default: 10)
- `search` (string) — search by `name`, `description`, `internal_note`, or `tags`
- `is_active` (boolean)
- `pet_type_id` (MongoDB ObjectId)
- `size_category_id` (MongoDB ObjectId)
- `breed_category_id` (MongoDB ObjectId)
- `member_category_id` (MongoDB ObjectId)
- `customer_id` (MongoDB ObjectId)

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
      "pet_type": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "Dog"
      },
      "hair": {
        "_id": "507f1f77bcf86cd799439013",
        "name": "Short"
      },
      "birthday": "2020-01-15T00:00:00.000Z",
      "size": {
        "_id": "507f1f77bcf86cd799439014",
        "name": "Medium"
      },
      "breed": {
        "_id": "507f1f77bcf86cd799439015",
        "name": "Golden Retriever"
      },
      "weight": 15,
      "member_category": {
        "_id": "507f1f77bcf86cd799439016",
        "name": "Gold"
      },
      "tags": ["friendly", "energetic"],
      "last_grooming_at": "2026-01-15T00:00:00.000Z",
      "last_visit_at": "2026-02-01T00:00:00.000Z",
      "owner": {
        "_id": "507f1f77bcf86cd799439017",
        "username": "john_doe"
      },
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
      "is_active": true,
      "createdAt": "2026-01-10T10:30:00.000Z",
      "updatedAt": "2026-02-01T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**Notes:**

- Returns only non-deleted pets (`isDeleted: false`)
- All relationships are populated with their respective names
- Use query parameters to filter and paginate results

---

### 2. Get Pet By ID

**Endpoint:** `GET /pets/:id`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "Fetch pet successfully",
  "pet": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Buddy",
    "description": "Friendly dog",
    "internal_note": "Sensitive to loud noises",
    "profile_image": {
      "secure_url": "https://cloudinary.com/...",
      "public_id": "pets/buddy123"
    },
    "pet_type": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Dog"
    },
    "hair": {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Short"
    },
    "birthday": "2020-01-15T00:00:00.000Z",
    "size": {
      "_id": "507f1f77bcf86cd799439014",
      "name": "Medium"
    },
    "breed": {
      "_id": "507f1f77bcf86cd799439015",
      "name": "Golden Retriever"
    },
    "weight": 15,
    "member_category": {
      "_id": "507f1f77bcf86cd799439016",
      "name": "Gold"
    },
    "tags": ["friendly", "energetic"],
    "last_grooming_at": "2026-01-15T00:00:00.000Z",
    "last_visit_at": "2026-02-01T00:00:00.000Z",
    "owner": {
      "_id": "507f1f77bcf86cd799439017",
      "username": "john_doe"
    },
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
    "is_active": true,
    "createdAt": "2026-01-10T10:30:00.000Z",
    "updatedAt": "2026-02-01T10:30:00.000Z"
  }
}
```

**Error Responses:**

- **404 Not Found:** Pet not found

```json
{
  "statusCode": 404,
  "message": "data not found",
  "error": "Not Found"
}
```

**Notes:**

- Returns only non-deleted pets (`isDeleted: false`)
- All relationships are populated with their respective names

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
  "hair_category_id": "MongoDB ObjectId (optional)",
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

## Bookings

Base route: `/bookings`

> **Public endpoints** (no authentication required) are available under `/bookings/public/*` for guest/unauthenticated users.

---

### Public (Guest) Endpoints

#### 1. Get All Stores (Public)

**Endpoint:** `GET /bookings/public/stores`

**Authentication:** Not Required

**Description:** Mengambil semua store aktif beserta service types yang tersedia di masing-masing store.

**Success Response (200):**

```json
{
  "message": "Fetch stores successfully",
  "stores": [
    {
      "_id": "698be0cd80c319b74fe2f073",
      "code": "PW-0001",
      "name": "Pawship.id",
      "description": "Cabang pertama di Surabaya",
      "location": {
        "address": "Jl. Klampis Jaya No.A6",
        "city": "Surabaya",
        "province": "Jawa Timur",
        "postal_code": "60284"
      },
      "contact": {
        "phone_number": "080987654321",
        "whatsapp": "080987654321",
        "email": "pawshipid@gmail.com"
      },
      "operational": {
        "opening_time": "09.00",
        "closing_time": "18.00",
        "operational_days": ["Monday", "Tuesday", "Sunday"],
        "timezone": "Asia/Jakarta"
      },
      "capacity": {
        "default_daily_capacity_minutes": 960,
        "overbooking_limit_minutes": 120
      },
      "is_active": true,
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-02-11T01:52:13.002Z",
      "updatedAt": "2026-03-06T04:54:14.821Z",
      "sessions": ["09.00 - 12.00", "13.00 - 16.00", "17.00 - 20.00"],
      "serviceTypes": [
        {
          "_id": "69a22d75a9d735a33014cc8b",
          "title": "Grooming",
          "description": "Perawatan lengkap untuk hewan peliharaan meliputi mandi, potong bulu, potong kuku, dan pembersihan telinga agar tetap bersih, sehat, dan nyaman.",
          "image_url": "pawship-grooming/service-types/wv36relrkxfa3afhggaq"
        },
        {
          "_id": "69a23091fc6d99c2f08252f1",
          "title": "Addons",
          "description": "Layanan tambahan yang dapat dipilih pelanggan untuk melengkapi layanan utama",
          "image_url": "pawship-grooming/service-types/eoivdfvisqxjddarv0ie"
        }
      ]
    }
  ]
}
```

---

#### 2. Get Services (Public)

**Endpoint:** `GET /bookings/public/services`

**Authentication:** Not Required

**Query Parameters:**

- `store_id` (optional): Filter services by store
- `service_type_id` (optional): Filter by service type (`grooming` or `addon`)

**Success Response (200):**

```json
{
  "message": "Fetch services successfully",
  "services": [
    {
      "_id": "69a45774ecf65d9a74d53fe6",
      "code": "SVC-0001",
      "name": "Basic Grooming",
      "description": "Perawatan dasar yang bikin pawfriends bersih, wangi, dan nyaman lagi. Cocok untuk rutin supaya tetap fresh dan sehat.",
      "image_url": "https://res.cloudinary.com/do1uyohvw/image/upload/v1772357877/pawship-grooming/services/nait3ft2mnkjvjojq7j1.jpg",
      "public_id": "pawship-grooming/services/nait3ft2mnkjvjojq7j1",
      "prices": [
        {
          "pet_type_id": "698bf0d362f5760ac021c595",
          "pet_name": "Cat",
          "size_id": "698bf0e462f5760ac021c597",
          "size_name": "Small",
          "hair_id": "698bed63aac98e7b92a3e31d",
          "hair_name": "Sort Hair",
          "price": 69000
        },
        {
          "pet_type_id": "698bf0d362f5760ac021c595",
          "pet_name": "Cat",
          "size_id": "698bf0e462f5760ac021c597",
          "size_name": "Small",
          "hair_id": "698bf05c62f5760ac021c590",
          "hair_name": "Long Hair",
          "price": 89000
        },
        {
          "pet_type_id": "698bf0d362f5760ac021c595",
          "pet_name": "Cat",
          "size_id": "698bf0e862f5760ac021c599",
          "size_name": "Medium",
          "hair_id": "698bed63aac98e7b92a3e31d",
          "hair_name": "Sort Hair",
          "price": 89000
        },
        {
          "pet_type_id": "698bf0d362f5760ac021c595",
          "pet_name": "Cat",
          "size_id": "698bf0e862f5760ac021c599",
          "size_name": "Medium",
          "hair_id": "698bf05c62f5760ac021c590",
          "hair_name": "Long Hair",
          "price": 109000
        },
        {
          "pet_type_id": "698bf0d362f5760ac021c595",
          "pet_name": "Cat",
          "size_id": "698bf0ea62f5760ac021c59b",
          "size_name": "Large",
          "hair_id": "698bed63aac98e7b92a3e31d",
          "hair_name": "Sort Hair",
          "price": 109000
        },
        {
          "pet_type_id": "698bf0d362f5760ac021c595",
          "pet_name": "Cat",
          "size_id": "698bf0ea62f5760ac021c59b",
          "size_name": "Large",
          "hair_id": "698bf05c62f5760ac021c590",
          "hair_name": "Long Hair",
          "price": 129000
        }
      ],
      "duration": 60,
      "available_for_unlimited": true,
      "include": [
        "Mandi bersih dengan shampoo gentle khusus anabul",
        "Blow dry sampai kering dan fluffy",
        "Gunting kuku & bersihin telinga",
        "Pembersihan telinga",
        "Cukur area paw (bawah kaki)",
        "Parfum pet friendly"
      ],
      "show_in_homepage": false,
      "order": 0,
      "is_active": true,
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-03-01T15:12:52.848Z",
      "updatedAt": "2026-03-02T00:32:08.957Z",
      "service_location_type": "in store",
      "service_type": {
        "_id": "69a22d75a9d735a33014cc8b",
        "title": "Grooming"
      },
      "size_categories": [],
      "pet_types": [],
      "avaiable_store": [],
      "addons": [
        {
          "_id": "69ab7a5f83be3bf8a151e3dd",
          "code": "SVC-0002",
          "name": "3 Spots Detangling",
          "description": "Buka kusut di 3 area tertentu (biasanya ketiak, belakang telinga, atau ekor) biar bulu balik halus & nggak ketarik sakit.",
          "prices": [
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0e462f5760ac021c597",
              "size_name": "Small",
              "hair_id": "698bed63aac98e7b92a3e31d",
              "hair_name": "Sort Hair",
              "price": 35000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0e462f5760ac021c597",
              "size_name": "Small",
              "hair_id": "698bf05c62f5760ac021c590",
              "hair_name": "Long Hair",
              "price": 40000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0e862f5760ac021c599",
              "size_name": "Medium",
              "hair_id": "698bed63aac98e7b92a3e31d",
              "hair_name": "Sort Hair",
              "price": 35000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0e862f5760ac021c599",
              "size_name": "Medium",
              "hair_id": "698bf05c62f5760ac021c590",
              "hair_name": "Long Hair",
              "price": 40000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0ea62f5760ac021c59b",
              "size_name": "Large",
              "hair_id": "698bed63aac98e7b92a3e31d",
              "hair_name": "Sort Hair",
              "price": 35000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0ea62f5760ac021c59b",
              "size_name": "Large",
              "hair_id": "698bf05c62f5760ac021c590",
              "hair_name": "Long Hair",
              "price": 40000
            }
          ],
          "duration": 15
        }
      ]
    }
  ]
}
```

---

#### 3. Get All Options (Public)

**Endpoint:** `GET /bookings/public/options`

**Authentication:** Not Required

**Query Parameters:**

- `category` (optional): Filter options by category (e.g., `hair category`, `size category`, `breed category`, `member category`, `customer category`, `pet type`)

**Success Response (200):**

```json
{
  "message": "Fetch options successfully",
  "options": [
    {
      "_id": "698bf0d362f5760ac021c595",
      "name": "Cat",
      "category_options": "pet_type",
      "is_active": true,
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### 4. Check User By Phone (Public)

**Endpoint:** `GET /bookings/public/check-user/phone/:phone_number`

**Authentication:** Not Required

**Parameters:**

- `phone_number` (path): User's phone number

**Success Response (200):**

If user exists:

```json
{
  "message": "User found",
  "exists": true,
  "user": {
    "_id": "699a6a5126091dfdcf0c7190",
    "username": "Sintia",
    "email": "sintia@gmail.com",
    "phone_number": "089534267814",
    "role": "customer"
  },
  "pets": [
    {
      "_id": "699a6a5126091dfdcf0c7192",
      "name": "chiko",
      "pet_type": {
        "_id": "698bf0d362f5760ac021c595",
        "name": "Cat"
      },
      "hair": {
        "_id": "698bf05c62f5760ac021c590",
        "name": "Long Hair"
      },
      "size": {
        "_id": "698bf0e862f5760ac021c599",
        "name": "Medium"
      },
      "breed": {
        "_id": "699a6a2726091dfdcf0c718d",
        "name": "Ragdoll"
      }
    },
    {
      "_id": "699a6dda2aa0fc8159666d46",
      "name": "Chaca",
      "pet_type": {
        "_id": "698d5573b70c2a3711e368dd",
        "name": "Dog"
      },
      "hair": {
        "_id": "698bf05c62f5760ac021c590",
        "name": "Long Hair"
      },
      "size": {
        "_id": "698bf0e462f5760ac021c597",
        "name": "Small"
      },
      "breed": {
        "_id": "698da2bb19b8a1bbac7aabb6",
        "name": "Pom"
      }
    },
    {
      "_id": "699a70622d638099634e552f",
      "name": "Gigi",
      "pet_type": {
        "_id": "698d5573b70c2a3711e368dd",
        "name": "Dog"
      },
      "hair": {
        "_id": "698bed63aac98e7b92a3e31d",
        "name": "Sort Hair"
      },
      "size": {
        "_id": "698bf0e462f5760ac021c597",
        "name": "Small"
      },
      "breed": {
        "_id": "698da2bb19b8a1bbac7aabb6",
        "name": "Pom"
      }
    },
    {
      "_id": "699a72a1e0a1d4f8ef92a85b",
      "name": "Gigo",
      "pet_type": {
        "_id": "698d5573b70c2a3711e368dd",
        "name": "Dog"
      },
      "hair": {
        "_id": "698bed63aac98e7b92a3e31d",
        "name": "Sort Hair"
      },
      "size": {
        "_id": "698bf0e462f5760ac021c597",
        "name": "Small"
      },
      "breed": {
        "_id": "698da2bb19b8a1bbac7aabb6",
        "name": "Pom"
      }
    }
  ]
}
```

If user not found:

```json
{
  "message": "User not found, please register",
  "exists": false,
  "user": null,
  "pets": []
}
```

---

#### 5. Register Guest User (Public)

**Endpoint:** `POST /bookings/public/register`

**Authentication:** Not Required

**Request Body:**

```json
{
  "username": "string (required)",
  "email": "string (required, valid email format)",
  "phone_number": "string (required)",
  "pet": {
    "name": "string (required)",
    "pet_type_id": "MongoDB ObjectId (required)",
    "breed_category_id": "MongoDB ObjectId (required)",
    "size_category_id": "MongoDB ObjectId (required)",
    "hair_category_id": "MongoDB ObjectId (required)"
  }
}
```

**Success Response (201):**

```json
{
  "message": "User and pet registered successfully. Welcome email has been sent.",
  "user": {
    "_id": "69ab97591a5708c32b266194",
    "username": "caca",
    "email": "caca@gmail.com",
    "phone_number": "089534256786",
    "role": "customer"
  },
  "pet": {
    "_id": "69ab97591a5708c32b266196",
    "name": "Jeje",
    "pet_type": {
      "_id": "698d5573b70c2a3711e368dd",
      "name": "Dog"
    },
    "hair": {
      "_id": "698bed63aac98e7b92a3e31d",
      "name": "Sort Hair"
    },
    "size": {
      "_id": "698bf0ea62f5760ac021c59b",
      "name": "Large"
    },
    "breed": {
      "_id": "698da2bb19b8a1bbac7aabb6",
      "name": "Pom"
    }
  },
  "credentials": {
    "email": "caca@gmail.com",
    "password": "pawship123"
  }
}
```

**Business Logic:**

- Creates new user with default password `pawship123`
- Password is hashed with bcrypt
- Automatically creates first pet for the user
- Assigns default role `customer`

**Error Responses:**

- **400 Bad Request:** Email or phone already registered

---

#### 6. Create Pet For Guest (Public)

**Endpoint:** `POST /bookings/public/pets`

**Authentication:** Not Required

**Request Body:**

```json
{
  "phone_number": "string (required)",
  "pet_name": "string (required)",
  "pet_type_id": "MongoDB ObjectId (required)",
  "breed_category_id": "MongoDB ObjectId (required)",
  "size_category_id": "MongoDB ObjectId (required)",
  "hair_category_id": "MongoDB ObjectId (required)"
}
```

**Success Response (201):**

```json
{
  "message": "Pet created successfully",
  "pet": {
    "_id": "69ab97e81a5708c32b26619e",
    "name": "jeri",
    "pet_type": {
      "_id": "698d5573b70c2a3711e368dd",
      "name": "Dog"
    },
    "hair": {
      "_id": "698bf05c62f5760ac021c590",
      "name": "Long Hair"
    },
    "size": {
      "_id": "698bf0e462f5760ac021c597",
      "name": "Small"
    },
    "breed": {
      "_id": "698da2bb19b8a1bbac7aabb6",
      "name": "Pom"
    }
  },
  "customer": {
    "_id": "69ab97591a5708c32b266194",
    "username": "caca",
    "email": "caca@gmail.com",
    "phone_number": "089534256786"
  }
}
```

**Error Responses:**

- **404 Not Found:** User not found with this phone number

---

#### 7. Create Guest Booking (Public)

**Endpoint:** `POST /bookings/public`

**Authentication:** Not Required

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
  "service_addon_ids": ["MongoDB ObjectId"],
  "travel_fee": "number (optional)",
  "note": "string (optional)"
}
```

**Success Response (201):**

```json
{
  "message": "Guest booking created successfully"
}
```

**Business Logic:**

- Same capacity validation as authenticated booking
- If capacity exceeded beyond overbooking limit, booking is created as WAITLIST
- System automatically calculates pricing based on pet size
- Creates `pet_snapshot` automatically from pet data
- Creates `service_snapshot` automatically — stores service code, name, description, service type, and the best-matched price based on the pet's pet type, size, and hair
- Initial `booking_status` is `requested`

---

### Admin Endpoints

#### 1. Get All Bookings

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
      "service_snapshot": {
        "code": "GRM-001",
        "name": "Basic Grooming",
        "description": "Full grooming package including bath, dry, and trim",
        "service_type": {
          "_id": "507f1f77bcf86cd799439030",
          "title": "Grooming"
        },
        "price": 150000,
        "pet_type": {
          "_id": "507f1f77bcf86cd799439031",
          "name": "Dog"
        },
        "size": {
          "_id": "507f1f77bcf86cd799439032",
          "name": "Medium"
        },
        "hair": {
          "_id": "507f1f77bcf86cd799439033",
          "name": "Short"
        },
        "duration": 60
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
  "service_snapshot": {
    "code": "string (optional, auto-populated by server)",
    "name": "string (optional, auto-populated by server)",
    "description": "string (optional)",
    "service_type": { "_id": "string", "title": "string" },
    "price": "number (optional)",
    "pet_type": { "_id": "string", "name": "string" },
    "size": { "_id": "string", "name": "string" },
    "hair": { "_id": "string", "name": "string" },
    "duration": "number (optional)"
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
- System automatically creates `service_snapshot` — stores service code, name, description, service type, and the best-matched price entry based on the pet's pet type, size, and hair (highest specificity match wins)
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
HAIR = 'hair category';
SIZE = 'size category';
BREED = 'breed category';
MEMBER = 'member category';
CUSTOMER = 'customer category';
PET_TYPE = 'pet type';
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
10. **Guest Booking Flow** (public endpoints under `/bookings/public/*`):
    - Check if user exists by phone → If not, register → Create pet → Create booking
    - All guest endpoints are public (no authentication required)
    - Default password `pawship123` assigned to new users
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
