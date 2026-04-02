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
7. [Banners](#banners)
8. [Upload File](#upload-file)
9. [Pets](#pets)
10. [Memberships](#memberships)
11. [Pet Memberships](#pet-memberships)
12. [Benefit Usages](#benefit-usages)
13. [Bookings](#bookings) _(includes public/guest endpoints)_
14. [Grooming Sessions](#grooming-sessions)
15. [Promotions](#promotions)

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
    "profile": {
      "full_name": "Jane Doe",
      "customer_category_id": "507f1f77bcf86cd799439033"
    },
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
- `profile` field is omitted entirely when the user has not set any profile data
- Only fields that have been explicitly saved to the database are returned — no null placeholders
- Fields like `groomer_skills` and `groomer_rating` are only meaningful for users with `role: groomer`
- `customer_category_id` is only meaningful for users with `role: customer`
- If user role is `customer`, the response includes a `pets` array with all their pets (non-deleted only)
- Pets are populated with their relationships: pet_type, hair_category, size_category, and breed_category
- Useful for profile pages or checking current user permissions

---

### 3. Update My Profile

**Endpoint:** `PUT /users/me/profile`

**Authentication:** Required (JWT Token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Request Body:** (All fields optional)

```json
{
  "full_name": "string (optional)",
  "image_url": "string (optional)",
  "public_id": "string (optional)",
  "gender": "Male | Female (optional)",
  "placement": "MongoDB ObjectId — Store ref (optional, admin/ops/groomer only)",
  "groomer_skills": ["string"],
  "groomer_rating": "number >= 0 (optional, groomer only)",
  "customer_category_id": "MongoDB ObjectId — Option ref (optional, customer only)",
  "tags": ["string"],
  "addresses": [
    {
      "label": "string (optional) — e.g. 'Home', 'Office'",
      "street": "string (optional)",
      "subdistrict": "string (optional)",
      "district": "string (optional)",
      "city": "string (optional)",
      "province": "string (optional)",
      "postal_code": "string (optional)",
      "note": "string (optional) — note for courier/driver",
      "latitude": "number (optional)",
      "longitude": "number (optional)",
      "is_main_address": "boolean (optional) — default true if first address, else false"
    }
  ]
}
```

**Success Response (200):**

```json
{
  "message": "Update profile successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "phone_number": "+628123456789",
    "role": "groomer",
    "profile": {
      "full_name": "John Doe",
      "image_url": "https://res.cloudinary.com/...",
      "public_id": "pawship-grooming/users/abc123",
      "gender": "Male",
      "placement": "507f1f77bcf86cd799439099",
      "groomer_skills": ["Dog grooming", "Cat grooming"],
      "tags": ["experienced"],
      "addresses": [
        {
          "label": "Home",
          "street": "Jl. Merdeka No. 1",
          "subdistrict": "Gambir",
          "district": "Gambir",
          "city": "Jakarta Pusat",
          "province": "DKI Jakarta",
          "postal_code": "10110",
          "note": "Blue gate, left alley",
          "latitude": -6.1751,
          "longitude": 106.8272,
          "is_main_address": true
        },
        {
          "label": "Office",
          "street": "Jl. Sudirman No. 10",
          "city": "Jakarta Selatan",
          "province": "DKI Jakarta",
          "postal_code": "10220",
          "is_main_address": false
        }
      ]
    },
    "is_active": true,
    "isDeleted": false,
    "createdAt": "2026-02-12T09:52:34.717Z",
    "updatedAt": "2026-03-11T10:00:00.000Z"
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

**Notes:**

- Email cannot be updated via this endpoint
- Only `profile.*` fields are updated; account fields (`username`, `phone_number`, `role`, etc.) are not affected
- Uses dot-notation `$set` so partial updates do not overwrite other profile fields
- Role-based field eligibility is not enforced at the API level — all fields are accepted regardless of role

---

### 4. Create My Pet

**Endpoint:** `POST /users/me/pets`

**Authentication:** Required (JWT Token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

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
  "birthday": "ISO date (optional)",
  "size_category_id": "MongoDB ObjectId (required)",
  "breed_category_id": "MongoDB ObjectId (required)",
  "weight": "number (optional)",
  "tags": ["string"],
  "last_grooming_at": "ISO date (optional)",
  "last_visit_at": "ISO date (optional)",
  "memberships": [
    {
      "membership_id": "MongoDB ObjectId (required)",
      "start_date": "ISO date (required)",
      "end_date": "ISO date (required)",
      "status": "active | inactive | expired (required)",
      "usage_count": "number (optional)",
      "max_usage": "number (optional)"
    }
  ],
  "is_active": "boolean (optional, default: true)"
}
```

**Success Response (201):**

```json
{
  "message": "Create pet successfully",
  "pet": {
    "_id": "507f1f77bcf86cd799439020",
    "name": "Buddy",
    "customer_id": "507f1f77bcf86cd799439011",
    "pet_type_id": "507f1f77bcf86cd799439012",
    "size_category_id": "507f1f77bcf86cd799439014",
    "breed_category_id": "507f1f77bcf86cd799439015",
    "is_active": true,
    "isDeleted": false,
    "createdAt": "2026-03-11T10:00:00.000Z",
    "updatedAt": "2026-03-11T10:00:00.000Z"
  }
}
```

**Error Responses:**

- **401 Unauthorized:** Missing or invalid token
- **400 Bad Request:** Validation error

**Notes:**

- `customer_id` is automatically set from the JWT — no need to include it in the request body

---

### 5. Get My Pets

**Endpoint:** `GET /users/me/pets`

**Authentication:** Required (JWT Token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

- `page` (optional, number): Page number (default: 1)
- `limit` (optional, number): Items per page (default: 10)
- `search` (optional, string): Search by name, description, tags
- `is_active` (optional, boolean): Filter by active status
- `pet_type_id` (optional, MongoDB ObjectId): Filter by pet type
- `size_category_id` (optional, MongoDB ObjectId): Filter by size
- `breed_category_id` (optional, MongoDB ObjectId): Filter by breed

**Success Response (200):**

```json
{
  "message": "Fetch pets successfully",
  "pets": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "name": "Buddy",
      "pet_type": { "_id": "507f1f77bcf86cd799439012", "name": "Dog" },
      "size": { "_id": "507f1f77bcf86cd799439014", "name": "Medium" },
      "breed": {
        "_id": "507f1f77bcf86cd799439015",
        "name": "Golden Retriever"
      },
      "is_active": true,
      "isDeleted": false,
      "createdAt": "2026-03-11T10:00:00.000Z",
      "updatedAt": "2026-03-11T10:00:00.000Z"
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

**Notes:**

- Results are automatically filtered to only show pets belonging to the authenticated user
- Deleted pets (`isDeleted: true`) are excluded

---

### 6. Get My Pet by ID

**Endpoint:** `GET /users/me/pets/:petId`

**Authentication:** Required (JWT Token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `petId` (path): MongoDB ObjectId of the pet

**Success Response (200):**

```json
{
  "message": "Fetch pet successfully",
  "pet": {
    "_id": "507f1f77bcf86cd799439020",
    "name": "Buddy",
    "description": "Friendly dog",
    "pet_type": { "_id": "507f1f77bcf86cd799439012", "name": "Dog" },
    "hair": { "_id": "507f1f77bcf86cd799439013", "name": "Short" },
    "size": { "_id": "507f1f77bcf86cd799439014", "name": "Medium" },
    "breed": { "_id": "507f1f77bcf86cd799439015", "name": "Golden Retriever" },
    "is_active": true,
    "isDeleted": false,
    "createdAt": "2026-03-11T10:00:00.000Z",
    "updatedAt": "2026-03-11T10:00:00.000Z"
  }
}
```

**Error Responses:**

- **401 Unauthorized:** Token missing or invalid
- **404 Not Found:** Pet not found or does not belong to the authenticated user

```json
{
  "statusCode": 404,
  "message": "Pet not found",
  "error": "Not Found"
}
```

---

### 7. Update My Pet

**Endpoint:** `PUT /users/me/pets/:petId`

**Authentication:** Required (JWT Token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `petId` (path): MongoDB ObjectId of the pet

**Request Body:** (All fields optional)

```json
{
  "name": "string",
  "description": "string",
  "internal_note": "string",
  "profile_image": { "secure_url": "string", "public_id": "string" },
  "pet_type_id": "MongoDB ObjectId",
  "hair_category_id": "MongoDB ObjectId",
  "birthday": "ISO date",
  "size_category_id": "MongoDB ObjectId",
  "breed_category_id": "MongoDB ObjectId",
  "weight": "number",
  "tags": ["string"],
  "last_grooming_at": "ISO date",
  "last_visit_at": "ISO date",
  "is_active": "boolean"
}
```

**Success Response (200):**

```json
{
  "message": "Update pet successfully"
}
```

**Error Responses:**

- **401 Unauthorized:** Token missing or invalid
- **404 Not Found:** Pet not found or does not belong to the authenticated user

---

### 8. Delete My Pet (Soft Delete)

**Endpoint:** `DELETE /users/me/pets/:petId`

**Authentication:** Required (JWT Token)

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `petId` (path): MongoDB ObjectId of the pet

**Success Response (200):**

```json
{
  "message": "Delete pet successfully"
}
```

**Error Responses:**

- **401 Unauthorized:** Token missing or invalid
- **404 Not Found:** Pet not found or does not belong to the authenticated user

**Notes:**

- Performs a soft delete (`isDeleted: true`); the pet is not removed from the database

---

### 9. Get User By ID

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
    "profile": {
      "full_name": "Jane Customer",
      "customer_category_id": "507f1f77bcf86cd799439033"
    },
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
- Pets are populated with their relationships: pet_type, hair, size, and breed

---

### 10. Create User

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

### 11. Update User

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

### 12. Update User Password

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

### 13. Toggle User Status (Activate/Deactivate)

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

### 14. Delete User (Soft Delete)

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
      "is_default_store": true,
      "is_pick_up_available": true,
      "is_active": true,
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-02-11T01:52:13.002Z",
      "updatedAt": "2026-03-06T04:54:14.821Z",
      "__v": 0,
      "sessions": ["09.00 - 12.00", "13.00 - 16.00", "17.00 - 20.00"],
      "zones": [
        {
          "area_name": "Kemang",
          "min_radius_km": 0,
          "max_radius_km": 5,
          "travel_time_minutes": 30,
          "travel_fee": 15000
        }
      ]
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
    "sessions": ["09.00 - 12.00", "13.00 - 16.00", "17.00 - 20.00"],
    "is_default_store": false,
    "is_pick_up_available": true,
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
    ],
    "zones": [
      {
        "area_name": "Kemang",
        "min_radius_km": 0,
        "max_radius_km": 5,
        "travel_time_minutes": 30,
        "travel_fee": 15000
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
    "default_daily_capacity_minutes": "number (default: 960)",
    "overbooking_limit_minutes": "number (default: 120)"
  },
  "sessions": ["string (optional)"],
  "is_default_store": "boolean (optional, default: false)",
  "is_pick_up_available": "boolean (optional, default: false)",
  "is_active": "boolean (optional, default: true)",
  "zones": [
    {
      "area_name": "string (required)",
      "min_radius_km": "number (required, min: 0)",
      "max_radius_km": "number (required, min: 0)",
      "travel_time_minutes": "number (required, min: 0)",
      "travel_fee": "number (required, min: 0)"
    }
  ]
}
```

**Success Response (200):**

```json
{
  "message": "Create store successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Duplicate code, default store already exists, or validation error

```json
{
  "statusCode": 400,
  "message": "code already exists",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "A default store already exists. Only one store can be set as default.",
  "error": "Bad Request"
}
```

**Notes:**

- `code`: Must be unique (e.g., STR001, STR002)
- `name`: Store name
- `is_default_store`: Only one store in the system can have this set to `true`. If you attempt to set another store as default while one already exists, the operation will fail with a 400 error
- `is_pick_up_available`: When `true`, this store supports pick-up service. Customers can request pick-up bookings if their location falls within the configured delivery zones. Requires at least one zone to be configured with `min_radius_km` and `max_radius_km` values
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
  "sessions": ["string (optional)"],
  "is_default_store": "boolean (optional)",
  "is_pick_up_available": "boolean (optional)",
  "is_active": "boolean (optional)",
  "zones": [
    {
      "area_name": "string (required)",
      "min_radius_km": "number (required, min: 0)",
      "max_radius_km": "number (required, min: 0)",
      "travel_time_minutes": "number (required, min: 0)",
      "travel_fee": "number (required, min: 0)"
    }
  ]
}
```

**Success Response (200):**

```json
{
  "message": "Store updated successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Invalid ID, duplicate code, or default store already exists

```json
{
  "statusCode": 400,
  "message": "code already exists",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "A default store already exists. Only one store can be set as default.",
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

- `is_default_store`: Only one store in the system can have this set to `true`. If you attempt to set another store as default while one already exists, the operation will fail with a 400 error

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
      "updatedAt": "2026-03-07T01:09:10.113Z",
      "service_location_type": "in store",
      "is_pick_up_available": false,
      "service_type": {
        "_id": "69a22d75a9d735a33014cc8b",
        "title": "Grooming"
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
          "_id": "698bf0d362f5760ac021c595",
          "name": "Cat"
        }
      ],
      "hair_categories": [
        {
          "_id": "698bed63aac98e7b92a3e31d",
          "name": "Sort Hair"
        },
        {
          "_id": "698bf05c62f5760ac021c590",
          "name": "Long Hair"
        }
      ],
      "avaiable_store": [
        {
          "_id": "698be0cd80c319b74fe2f073",
          "name": "Pawship.id"
        },
        {
          "_id": "699a589b9f9402b88230c66a",
          "name": "Pawship.id Cabang 2"
        }
      ],
      "addons": [
        {
          "_id": "69ab7a5f83be3bf8a151e3dd",
          "code": "SVC-0002",
          "name": "3 Spots Detangling"
        }
      ]
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
    "updatedAt": "2026-03-07T01:09:10.113Z",
    "service_location_type": "in store",
    "service_type": {
      "_id": "69a22d75a9d735a33014cc8b",
      "title": "Grooming"
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
        "_id": "698bf0d362f5760ac021c595",
        "name": "Cat"
      }
    ],
    "hair_categories": [
      {
        "_id": "698bed63aac98e7b92a3e31d",
        "name": "Sort Hair"
      },
      {
        "_id": "698bf05c62f5760ac021c590",
        "name": "Long Hair"
      }
    ],
    "avaiable_store": [
      {
        "_id": "698be0cd80c319b74fe2f073",
        "name": "Pawship.id"
      },
      {
        "_id": "699a589b9f9402b88230c66a",
        "name": "Pawship.id Cabang 2"
      }
    ],
    "addons": [
      {
        "_id": "69ab7a5f83be3bf8a151e3dd",
        "code": "SVC-0002",
        "name": "3 Spots Detangling"
      }
    ]
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

**Example — price_type: "single":**

```json
{
  "code": "SVC001",
  "name": "basic grooming",
  "description": "Basic grooming package",
  "service_type_id": "507f1f77bcf86cd799439012",
  "pet_type_ids": ["507f1f77bcf86cd799439013"],
  "size_category_ids": ["507f1f77bcf86cd799439014", "507f1f77bcf86cd799439015"],
  "hair_category_ids": ["698bed63aac98e7b92a3e31d", "698bf05c62f5760ac021c590"],
  "price_type": "single",
  "price": 100000,
  "duration": 60,
  "available_for_unlimited": false,
  "available_store_ids": ["507f1f77bcf86cd799439016"],
  "addon_ids": ["507f1f77bcf86cd799439022"],
  "include": ["Bath", "Nail Trim", "Ear Cleaning"],
  "image_url": "https://res.cloudinary.com/example/image/upload/v1/services/basic-grooming.jpg",
  "public_id": "pawship-grooming/services/basic-grooming",
  "show_in_homepage": false,
  "order": 0,
  "service_location_type": "in store",
  "is_pick_up_available": false,
  "is_active": true,
  "sessions": ["bathing", "styling", "nail_trimming"]
}
```

**Example — price_type: "multiple":**

```json
{
  "code": "SVC001",
  "name": "basic grooming",
  "description": "Basic grooming package",
  "service_type_id": "507f1f77bcf86cd799439012",
  "pet_type_ids": ["507f1f77bcf86cd799439013"],
  "size_category_ids": ["507f1f77bcf86cd799439014", "507f1f77bcf86cd799439015"],
  "hair_category_ids": ["698bed63aac98e7b92a3e31d", "698bf05c62f5760ac021c590"],
  "price_type": "multiple",
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
  "service_location_type": "in store",
  "is_pick_up_available": false,
  "is_active": true,
  "sessions": ["bathing", "styling", "nail_trimming"]
}
```

**Field Descriptions:**

- `code`: Unique service code (required)
- `name`: Service name — will be auto-capitalized (required)
- `description`: Service description (optional)
- `service_type_id`: Reference to a Service Type document (required)
- `pet_type_ids`: Array of pet type Option IDs (optional, default: all active pet types)
- `size_category_ids`: Array of size category Option IDs (optional, default: all active size categories)
- `price_type`: Pricing strategy — `single` (one flat price) or `multiple` (price varies per pet/size/hair combination) (required)
- `price`: Flat price for the service — required when `price_type` is `single` (optional otherwise)
- `prices`: Array of `{ pet_id, size_id, hair_id, price }` — all three ID fields are optional per entry — required when `price_type` is `multiple` (optional otherwise)
- `duration`: Duration in minutes, minimum 1 (required)
- `available_for_unlimited`: Whether available for unlimited membership (optional)
- `available_store_ids`: Stores where service is available (optional, default: all active stores)
- `addon_ids`: Other service IDs available as add-ons to this service (optional)
- `include`: List of what is included in the service — free-text strings (optional)
- `image_url`: Cloudinary image URL (optional) — set manually or via the upload endpoint
- `public_id`: Cloudinary public ID (optional) — set manually or via the upload endpoint
- `show_in_homepage`: Whether to show this service on the homepage (optional, default: false)
- `order`: Display order/sort priority (optional, default: 0)
- `service_location_type`: Location where the service is performed — `in home` or `in store` (optional, default: `in store`)
- `is_pick_up_available`: Whether this service can be booked as a pick-up service (optional, default: false). When true, customers can request pick-up delivery if the store supports it and their location is within a delivery zone
- `is_active`: Active status (optional, default: true)
- `sessions`: Array of session type strings that will be auto-generated for all bookings of this service (required, minimum 1 item). Examples: `["bathing", "styling", "nail_trimming"]`. These sessions are created automatically when a booking is made, regardless of who creates it (admin, customer, or guest)

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
    "price_type is required",
    "price_type must be either single or multiple",
    "Duration must be at least 1 minute"
  ],
  "error": "Bad Request"
}
```

**Notes:**

- Service name will be automatically capitalized (e.g., "basic grooming" → "Basic Grooming")
- Code must be unique across all services
- `price_type` determines the pricing strategy:
  - `single`: One flat price — `price` field is required
  - `multiple`: Price varies by pet/size/hair combination — `prices` array is required
- If `available_store_ids` is not provided or empty, defaults to all active stores
- If `size_category_ids` is not provided or empty, defaults to all active size categories
- If `pet_type_ids` is not provided or empty, defaults to all active pet types
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
  "price_type": "multiple",
  "prices": [
    {
      "pet_id": "507f1f77bcf86cd799439013",
      "size_id": "507f1f77bcf86cd799439014",
      "price": 120000
    }
  ],
  "show_in_homepage": true,
  "order": 1,
  "is_pick_up_available": true,
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
- If `price_type` is updated to `single`, `price` must also be provided
- If `price_type` is updated to `multiple`, `prices` array must also be provided
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
      "_id": "69a22d75a9d735a33014cc8b",
      "title": "Grooming",
      "description": "Perawatan lengkap untuk hewan peliharaan meliputi mandi, potong bulu, potong kuku, dan pembersihan telinga agar tetap bersih, sehat, dan nyaman.",
      "image_url": "https://res.cloudinary.com/do1uyohvw/image/upload/v1772236148/pawship-grooming/service-types/wv36relrkxfa3afhggaq.jpg",
      "public_id": "pawship-grooming/service-types/wv36relrkxfa3afhggaq",
      "is_active": false,
      "show_in_homepage": false,
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-02-27T23:49:09.120Z",
      "updatedAt": "2026-03-07T04:01:28.007Z",
      "stores": [
        {
          "_id": "69a04fbf5b6e81b3fc6580cc",
          "code": "TOKO-JKT-001",
          "name": "Pawship Jakarta",
          "description": "Ini adalah pawship pertama di Jakarta"
        },
        {
          "_id": "69a048055b6e81b3fc65808d",
          "code": "test-01",
          "name": "test 01"
        },
        {
          "_id": "699a589b9f9402b88230c66a",
          "code": "PW-0002",
          "name": "Pawship.id Cabang 2",
          "description": "Cabang kedua di Surabaya"
        },
        {
          "_id": "698be0cd80c319b74fe2f073",
          "code": "PW-0001",
          "name": "Pawship.id",
          "description": "Cabang pertama di Surabaya"
        }
      ]
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
    "_id": "69a22d75a9d735a33014cc8b",
    "title": "Grooming",
    "description": "Perawatan lengkap untuk hewan peliharaan meliputi mandi, potong bulu, potong kuku, dan pembersihan telinga agar tetap bersih, sehat, dan nyaman.",
    "image_url": "https://res.cloudinary.com/do1uyohvw/image/upload/v1772236148/pawship-grooming/service-types/wv36relrkxfa3afhggaq.jpg",
    "public_id": "pawship-grooming/service-types/wv36relrkxfa3afhggaq",
    "is_active": false,
    "show_in_homepage": false,
    "isDeleted": false,
    "deletedAt": null,
    "createdAt": "2026-02-27T23:49:09.120Z",
    "updatedAt": "2026-03-07T04:01:28.007Z",
    "stores": [
      {
        "_id": "69a04fbf5b6e81b3fc6580cc",
        "code": "TOKO-JKT-001",
        "name": "Pawship Jakarta",
        "description": "Ini adalah pawship pertama di Jakarta"
      },
      {
        "_id": "69a048055b6e81b3fc65808d",
        "code": "test-01",
        "name": "test 01"
      },
      {
        "_id": "699a589b9f9402b88230c66a",
        "code": "PW-0002",
        "name": "Pawship.id Cabang 2",
        "description": "Cabang kedua di Surabaya"
      },
      {
        "_id": "698be0cd80c319b74fe2f073",
        "code": "PW-0001",
        "name": "Pawship.id",
        "description": "Cabang pertama di Surabaya"
      }
    ]
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

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Request Body (JSON):**

```json
{
  "title": "Addons",
  "description": "Layanan tambahan yang dapat dipilih pelanggan untuk melengkapi layanan utama",
  "image_url": "https://res.cloudinary.com/do1uyohvw/image/upload/v1772236945/pawship-grooming/service-types/eoivdfvisqxjddarv0ie.jpg",
  "public_id": "pawship-grooming/service-types/eoivdfvisqxjddarv0ie",
  "is_active": false,
  "show_in_homepage": false,
  "store_ids": [
    "69a04fbf5b6e81b3fc6580cc",
    "69a048055b6e81b3fc65808d",
    "699a589b9f9402b88230c66a",
    "698be0cd80c319b74fe2f073"
  ]
}
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

---

### 4. Update Service Type

**Endpoint:** `PUT /service-types/:id`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body {JSON}:** (All fields optional)

```json
{
  "title": "Addons",
  "description": "Layanan tambahan yang dapat dipilih pelanggan untuk melengkapi layanan utama",
  "image_url": "https://res.cloudinary.com/do1uyohvw/image/upload/v1772236945/pawship-grooming/service-types/eoivdfvisqxjddarv0ie.jpg",
  "public_id": "pawship-grooming/service-types/eoivdfvisqxjddarv0ie",
  "is_active": false,
  "show_in_homepage": false,
  "store_ids": [
    "69a04fbf5b6e81b3fc6580cc",
    "69a048055b6e81b3fc65808d",
    "699a589b9f9402b88230c66a",
    "698be0cd80c319b74fe2f073"
  ]
}
```

**Success Response (200):**

```json
{
  "message": "Update service type successfully"
}
```

**Error Responses:**

- **404 Not Found:** Service type not found

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

Banners are promotional images displayed on the app, optionally with a CTA button. Position of text and CTA button can be configured per banner. Each banner has separate images for desktop and mobile.

**Base route:** `/banners`

**Headers (protected endpoints):**

- `Authorization: Bearer {access_token}` (required)

### Schema

| Field                      | Type    | Required    | Default  | Description                                |
| -------------------------- | ------- | ----------- | -------- | ------------------------------------------ |
| `banner_desktop`           | object  | ✅          | —        | Desktop image                              |
| `banner_desktop.image_url` | string  | ✅          | —        | Cloudinary secure URL                      |
| `banner_desktop.public_id` | string  | ✅          | —        | Cloudinary public ID                       |
| `banner_mobile`            | object  | ✅          | —        | Mobile image                               |
| `banner_mobile.image_url`  | string  | ✅          | —        | Cloudinary secure URL                      |
| `banner_mobile.public_id`  | string  | ✅          | —        | Cloudinary public ID                       |
| `add_text`                 | boolean | —           | `false`  | Whether to show text overlay on the banner |
| `title`                    | string  | —           | —        | Banner title text                          |
| `subtitle`                 | string  | —           | —        | Banner subtitle / body text                |
| `text_align`               | string  | —           | —        | Text alignment (`left`, `center`, `right`) |
| `text_color`               | string  | —           | —        | Text color (CSS value, e.g. `#ffffff`)     |
| `cta`                      | object  | —           | `null`   | CTA button config (see below)              |
| `cta.label`                | string  | ✅ (if cta) | —        | Button label text                          |
| `cta.link`                 | string  | ✅ (if cta) | —        | URL the button navigates to                |
| `cta.background_color`     | string  | —           | —        | Button background color                    |
| `cta.text_color`           | string  | —           | —        | Button text color                          |
| `cta.vertical_position`    | string  | —           | `bottom` | `top` \| `center` \| `bottom`              |
| `cta.horizontal_position`  | string  | —           | `center` | `left` \| `center` \| `right`              |
| `order`                    | number  | —           | `0`      | Display order (ascending)                  |
| `is_active`                | boolean | —           | `false`  | Whether banner is visible                  |

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
      "banner_desktop": {
        "image_url": "https://res.cloudinary.com/example/image/upload/v1/banners/promo-desktop.jpg",
        "public_id": "banners/promo-desktop"
      },
      "banner_mobile": {
        "image_url": "https://res.cloudinary.com/example/image/upload/v1/banners/promo-mobile.jpg",
        "public_id": "banners/promo-mobile"
      },
      "add_text": true,
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

### 2. Get Public Banners

**Endpoint:** `GET /banners/public`

**Authentication:** Not Required

**Description:** Mengambil semua banner aktif khusus untuk tampilan publik (tanpa field internal seperti `public_id`, `isDeleted`, dll). Diurutkan berdasarkan `order`.

**Success Response (200):**

```json
{
  "message": "Fetch public banners successfully",
  "banners": [
    {
      "_id": "60d21b4667d0d8992e610c85",
      "banner_desktop": {
        "image_url": "https://res.cloudinary.com/example/image/upload/v1/banners/promo-desktop.jpg",
        "public_id": "banners/promo-desktop"
      },
      "banner_mobile": {
        "image_url": "https://res.cloudinary.com/example/image/upload/v1/banners/promo-mobile.jpg",
        "public_id": "banners/promo-mobile"
      },
      "add_text": true,
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
  ]
}
```

**Notes:**

- Response hanya menyertakan field yang relevan untuk tampilan publik
- Field internal seperti `isDeleted`, `deletedAt`, `createdAt`, `updatedAt` tidak disertakan

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
  "banner_desktop": {
    "image_url": "https://res.cloudinary.com/example/image/upload/v1/banners/promo-desktop.jpg",
    "public_id": "banners/promo-desktop"
  },
  "banner_mobile": {
    "image_url": "https://res.cloudinary.com/example/image/upload/v1/banners/promo-mobile.jpg",
    "public_id": "banners/promo-mobile"
  },
  "add_text": true,
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

> `banner_desktop` dan `banner_mobile` wajib diisi, masing-masing berisi `image_url` dan `public_id` dari Cloudinary.
>
> `add_text` (default: `false`) — set `true` untuk menampilkan overlay teks (title, subtitle, dll) di atas banner.
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
  "banner_mobile": {
    "image_url": "https://res.cloudinary.com/example/image/upload/v1/banners/promo-mobile-v2.jpg",
    "public_id": "banners/promo-mobile-v2"
  },
  "add_text": false,
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

## Upload File

A standalone, reusable endpoint for uploading images to Cloudinary. Use this to get back `image_url` and `public_id`, then pass them into any Create/Update request body that accepts those fields.

### 1. Upload Image

**Endpoint:** `POST /upload-file`

**Content-Type:** `multipart/form-data`

**Headers:**

- `Authorization: Bearer {access_token}` (required)

**Request Body (Form-Data):**

- `image`: File (required) — image to upload
- `folder` (string, required) — Cloudinary subfolder name.

**Example Form-Data in Postman:**

```
POST /upload-file

Key: image | Type: File | Value: [Select file]
Key: folder | Type: text
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

- After uploading, use the returned `image_url` and `public_id` in any Create or Update request body

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
    "tags": ["friendly", "energetic"],
    "last_grooming_at": "2026-01-15T00:00:00.000Z",
    "last_visit_at": "2026-02-01T00:00:00.000Z",
    "owner": {
      "_id": "507f1f77bcf86cd799439017",
      "username": "john_doe"
    },
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
- Pet memberships are now managed through the dedicated **PetMemberships API** (`GET /pet-memberships/:pet_id/active` to view active memberships for a pet)

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
  "tags": ["string"] (optional array),
  "last_grooming_at": "Date (optional)",
  "last_visit_at": "Date (optional)",
  "customer_id": "MongoDB ObjectId (required)",
  "is_active": "boolean (optional)"
}
```

**Success Response (200):**

```json
{
  "message": "Create pet successfully"
}
```

**Notes:**

- Pet memberships are now managed through the dedicated **PetMemberships API** (`POST /pet-memberships` to assign memberships to a pet)

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

Memberships provide benefits to pets, including discounts and quota-based session benefits. Benefits can have period-based resets (weekly, monthly, or unlimited).

**Benefit Structure:**

- `applies_to`: `service`, `addon`, `pickup` (scope of the benefit)
- `service_id`: Reference to a Service (optional; populated with full service details on retrieval)
- `label`: Human-readable label (optional; **required when `service_id` is not provided**)
- `type`: `discount` (percentage off subtotal), `quota` (session count — no monetary deduction)
- `period`: `weekly` (resets Monday 00:00), `monthly` (resets 1st day 00:00), `unlimited` (no reset)
- `limit`: Max usage count per period (optional — omit or `null` for unlimited)
- `value`: Discount percentage (required for `type: discount`, omit for `type: quota`)

---

### 1. Get All Memberships

**Endpoint:** `GET /memberships`

**Authentication:** Required (JWT)

**Query Parameters:**

- `pet_type_id` (optional): Filter by pet type MongoDB ObjectId
- `is_active` (optional): Filter by active status (true/false)

**Success Response (200):**

```json
{
  "message": "memberships retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Gold Membership",
      "description": "Premium membership package",
      "duration_months": 12,
      "price": 1200000,
      "note": "Includes 12 free grooming sessions",
      "pet_type_ids": ["507f1f77bcf86cd799439012"],
      "is_active": true,
      "benefits": [
        {
          "_id": "69bcbbc3183a5d93fb342b82",
          "applies_to": "service",
          "type": "quota",
          "period": "weekly",
          "limit": 1,
          "service": {
            "price": 0,
            "_id": "69a45774ecf65d9a74d53fe6",
            "code": "SVC-0001",
            "name": "Basic Grooming",
            "prices": [
              {
                "pet_type_id": "698bf0d362f5760ac021c595",
                "pet_name": "Cat",
                "size_id": "698bf0e462f5760ac021c597",
                "size_name": "Small",
                "hair_id": "69a0fe2bdee77f169eb32598",
                "hair_name": "Sort Hair",
                "price": 69000
              },
              {
                "pet_type_id": "698bf0d362f5760ac021c595",
                "pet_name": "Cat",
                "size_id": "698bf0e462f5760ac021c597",
                "size_name": "Small",
                "hair_id": "69a0fe38dee77f169eb3259b",
                "hair_name": "Long Hair",
                "price": 89000
              },
              {
                "pet_type_id": "698bf0d362f5760ac021c595",
                "pet_name": "Cat",
                "size_id": "698bf0e862f5760ac021c599",
                "size_name": "Medium",
                "hair_id": "69a0fe2bdee77f169eb32598",
                "hair_name": "Sort Hair",
                "price": 89000
              },
              {
                "pet_type_id": "698bf0d362f5760ac021c595",
                "pet_name": "Cat",
                "size_id": "698bf0e862f5760ac021c599",
                "size_name": "Medium",
                "hair_id": "69a0fe38dee77f169eb3259b",
                "hair_name": "Long Hair",
                "price": 109000
              },
              {
                "pet_type_id": "698bf0d362f5760ac021c595",
                "pet_name": "Cat",
                "size_id": "698bf0ea62f5760ac021c59b",
                "size_name": "Large",
                "hair_id": "69a0fe2bdee77f169eb32598",
                "hair_name": "Sort Hair",
                "price": 109000
              },
              {
                "pet_type_id": "698bf0d362f5760ac021c595",
                "pet_name": "Cat",
                "size_id": "698bf0ea62f5760ac021c59b",
                "size_name": "Large",
                "hair_id": "69a0fe38dee77f169eb3259b",
                "hair_name": "Long Hair",
                "price": 129000
              }
            ],
            "price_type": "multiple"
          }
        },
        {
          "_id": "69bcbbc3183a5d93fb342b83",
          "applies_to": "addon",
          "type": "quota",
          "period": "unlimited",
          "service": {
            "_id": "69ad38fa00e9af98d2941074",
            "code": "SVC-0003",
            "name": "Nail Trim",
            "prices": [],
            "price_type": "single",
            "price": 40000
          }
        },
        {
          "_id": "69bcbbc3183a5d93fb342b84",
          "applies_to": "addon",
          "label": "Add ons Discount",
          "type": "discount",
          "period": "unlimited",
          "value": 10
        },
        {
          "_id": "69bcbbc3183a5d93fb342b85",
          "applies_to": "pickup",
          "label": "Pickup & Delivery",
          "type": "quota",
          "period": "monthly",
          "limit": 1
        },
        {
          "_id": "69bcbbc3183a5d93fb342b86",
          "applies_to": "pickup",
          "label": "Pickup Discount",
          "type": "discount",
          "period": "unlimited",
          "value": 20
        }
      ],
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-03-19T08:45:00.000Z"
    }
  ]
}
```

---

### 2. Get Membership By ID

**Endpoint:** `GET /memberships/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "membership retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Gold Membership",
    "description": "Premium membership package",
    "duration_months": 12,
    "price": 1200000,
    "note": "Includes 12 free grooming sessions",
    "pet_type_ids": ["507f1f77bcf86cd799439012"],
    "is_active": true,
    "benefits": [
      {
        "_id": "69bcbbc3183a5d93fb342b82",
        "applies_to": "service",
        "type": "quota",
        "period": "weekly",
        "limit": 1,
        "service": {
          "price": 0,
          "_id": "69a45774ecf65d9a74d53fe6",
          "code": "SVC-0001",
          "name": "Basic Grooming",
          "prices": [
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0e462f5760ac021c597",
              "size_name": "Small",
              "hair_id": "69a0fe2bdee77f169eb32598",
              "hair_name": "Sort Hair",
              "price": 69000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0e462f5760ac021c597",
              "size_name": "Small",
              "hair_id": "69a0fe38dee77f169eb3259b",
              "hair_name": "Long Hair",
              "price": 89000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0e862f5760ac021c599",
              "size_name": "Medium",
              "hair_id": "69a0fe2bdee77f169eb32598",
              "hair_name": "Sort Hair",
              "price": 89000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0e862f5760ac021c599",
              "size_name": "Medium",
              "hair_id": "69a0fe38dee77f169eb3259b",
              "hair_name": "Long Hair",
              "price": 109000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0ea62f5760ac021c59b",
              "size_name": "Large",
              "hair_id": "69a0fe2bdee77f169eb32598",
              "hair_name": "Sort Hair",
              "price": 109000
            },
            {
              "pet_type_id": "698bf0d362f5760ac021c595",
              "pet_name": "Cat",
              "size_id": "698bf0ea62f5760ac021c59b",
              "size_name": "Large",
              "hair_id": "69a0fe38dee77f169eb3259b",
              "hair_name": "Long Hair",
              "price": 129000
            }
          ],
          "price_type": "multiple"
        }
      },
      {
        "_id": "69bcbbc3183a5d93fb342b83",
        "applies_to": "addon",
        "type": "quota",
        "period": "unlimited",
        "service": {
          "_id": "69ad38fa00e9af98d2941074",
          "code": "SVC-0003",
          "name": "Nail Trim",
          "prices": [],
          "price_type": "single",
          "price": 40000
        }
      },
      {
        "_id": "69bcbbc3183a5d93fb342b84",
        "applies_to": "addon",
        "label": "Add ons Discount",
        "type": "discount",
        "period": "unlimited",
        "value": 10
      },
      {
        "_id": "69bcbbc3183a5d93fb342b85",
        "applies_to": "pickup",
        "label": "Pickup & Delivery",
        "type": "quota",
        "period": "monthly",
        "limit": 1
      },
      {
        "_id": "69bcbbc3183a5d93fb342b86",
        "applies_to": "pickup",
        "label": "Pickup Discount",
        "type": "discount",
        "period": "unlimited",
        "value": 20
      }
    ],
    "pet_types": [
      {
        "_id": "698d5573b70c2a3711e368dd",
        "name": "Dog"
      },
      {
        "_id": "698bf0d362f5760ac021c595",
        "name": "Cat"
      }
    ],
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-03-19T08:45:00.000Z"
  }
}
```

**Error Responses:**

- **404 Not Found:** Membership not found
- **400 Bad Request:** Invalid membership ID format

---

### 3. Create Membership

**Endpoint:** `POST /memberships`

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "name": "string (required, max 100 chars, unique)",
  "description": "string (optional)",
  "duration_months": "number (required, min: 1)",
  "price": "number (required, min: 0)",
  "note": "string (optional)",
  "pet_type_ids": ["MongoDB ObjectId (required, min. 1)"],
  "benefits": [
    {
      "applies_to": "service | addon | pickup (required)",
      "service_id": "MongoDB ObjectId (optional), require when applies_to service or addon",
      "label": "string (required when service_id is not provided)",
      "type": "discount | quota (required)",
      "period": "weekly | monthly | unlimited (optional, default: unlimited)",
      "limit": "number (optional, omit or null = unlimited, min: 0)",
      "value": "number (required for type: discount, percentage 0-100)"
    }
  ]
}
```

**Example Request Body:**

```json
{
  "name": "Gold Membership",
  "description": "Premium membership package",
  "duration_months": 12,
  "price": 1200000,
  "note": "Includes 12 free grooming sessions",
  "pet_type_ids": ["507f1f77bcf86cd799439012"],
  "benefits": [
    {
      "applies_to": "service",
      "label": "Monthly Service Discount",
      "type": "discount",
      "period": "monthly",
      "limit": 5,
      "value": 10
    },
    {
      "applies_to": "service",
      "service_id": "69a45774ecf65d9a74d53fe6",
      "type": "quota",
      "period": "unlimited",
      "limit": 12
    },
    {
      "applies_to": "pickup",
      "label": "Free Pickup",
      "type": "quota",
      "period": "monthly",
      "limit": 2
    }
  ]
}
```

**Success Response (201):**

```json
{
  "message": "membership created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Gold Membership",
    "description": "Premium membership package",
    "duration_months": 12,
    "price": 1200000,
    "note": "Includes 12 free grooming sessions",
    "pet_type_ids": ["507f1f77bcf86cd799439012"],
    "is_active": true,
    "benefits": [
      {
        "_id": "607f1f77bcf86cd799439021",
        "applies_to": "service",
        "service_id": null,
        "label": "Monthly Service Discount",
        "type": "discount",
        "period": "monthly",
        "limit": 5,
        "value": 10
      },
      {
        "_id": "607f1f77bcf86cd799439022",
        "applies_to": "service",
        "service_id": {
          "_id": "69a45774ecf65d9a74d53fe6",
          "name": "Basic Grooming",
          "price": 350000,
          "code": "SVC-0001"
        },
        "label": null,
        "type": "quota",
        "period": "unlimited",
        "limit": 12,
        "value": null
      },
      {
        "_id": "607f1f77bcf86cd799439023",
        "applies_to": "pickup",
        "service_id": null,
        "label": "Free Pickup",
        "type": "quota",
        "period": "monthly",
        "limit": 2,
        "value": null
      }
    ],
    "createdAt": "2026-03-19T10:30:00.000Z",
    "updatedAt": "2026-03-19T10:30:00.000Z"
  }
}
```

**Error Responses:**

- **400 Bad Request:** Validation error or duplicate name

```json
{
  "statusCode": 400,
  "message": "membership with this name already exists",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "label is required when service_id is not provided",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "value is required for discount type",
  "error": "Bad Request"
}
```

**Notes:**

- Each benefit **must** have either `service_id` or `label` (or both)
- `label` is required when `service_id` is not provided
- `value` (percentage) is required when `type` is `discount`
- `limit` omitted or `null` means unlimited usage
- `applies_to: 'pickup'` does not need a `service_id` — use `label` instead

---

### 4. Update Membership

**Endpoint:** `PUT /memberships/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Request Body:** Same as Create Membership (all fields optional)

**Success Response (200):**

```json
{
  "message": "membership updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Gold Membership Updated",
    "description": "Premium membership package",
    "duration_months": 12,
    "price": 1300000,
    "note": "Updated benefits",
    "pet_type_ids": ["507f1f77bcf86cd799439012"],
    "is_active": true,
    "benefits": [],
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-03-19T11:45:00.000Z"
  }
}
```

**Error Responses:**

- **404 Not Found:** Membership not found
- **400 Bad Request:** Invalid ID format or validation error

```json
{
  "statusCode": 400,
  "message": "label is required when service_id is not provided",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "value is required for discount type",
  "error": "Bad Request"
}
```

**Notes:**

- `benefits` is a full replacement — the entire array is replaced on update
- Each benefit **must** have either `service_id` or `label`
- Existing benefit `_id` can be passed to preserve the same ID
- Snapshot in existing `PetMembership` records is **not** retroactively updated

---

### 5. Delete Membership (Soft Delete)

**Endpoint:** `DELETE /memberships/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId

**Success Response (200):**

```json
{
  "message": "membership deleted successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Gold Membership",
    "isDeleted": true,
    "deletedAt": "2026-03-19T12:00:00.000Z"
  }
}
```

**Error Responses:**

- **404 Not Found:** Membership not found
- **400 Bad Request:** Invalid membership ID format

---

## Pet Memberships

Pet Memberships represent the purchased membership plans for individual pets. Each pet membership tracks the pet, membership plan, dates, and benefits snapshot with usage tracking. Benefits have period-based resets to track usage per week/month, and unlimited benefits never reset.

**Key Concepts:**

- **benefits_snapshot**: Denormalized copy of membership benefits at purchase time, includes `used` counter and `period_reset_date` for tracking
- **Period Resets**: Weekly (every Monday 00:00), Monthly (1st day 00:00), or Unlimited (never)
- **used counter**: Tracks how many times a benefit has been used in the current period
- **limit**: `null` means unlimited (no cap); a positive number sets the max per period
- **remaining**: `null` means unlimited; a number shows how many uses are left
- **MembershipLog**: Every lifecycle event (purchased, renewed, cancelled, updated) is recorded as a log entry with a `benefits_snapshot_before` — the full snapshot state at the moment the event occurred
- **is_active**: `true` = membership is still valid (not cancelled); `false` = cancelled. Use date range to determine if a membership is currently active vs expired. Cancellation sets `is_active: false` without hard-deleting the record

---

### 1. Get All Pet Memberships

**Endpoint:** `GET /pet-memberships`

**Authentication:** Required (JWT)

**Query Parameters:**

- `pet_id` (optional, MongoDB ObjectId): Filter by pet ID
- `membership_plan_id` (optional, MongoDB ObjectId): Filter by membership plan ID

**Success Response (200):**

```json
{
  "message": "pet memberships retrieved successfully",
  "data": [
    {
      "_id": "69bba72cb163fca04487f97a",
      "start_date": "2026-03-19T07:35:08.749Z",
      "end_date": "2026-09-19T07:35:08.749Z",
      "benefits_snapshot": [
        {
          "_id": "69bb9d015c840eeb3bb38c80",
          "applies_to": "service",
          "service_id": "69a45774ecf65d9a74d53fe6",
          "label": null,
          "service": {
            "_id": "69a45774ecf65d9a74d53fe6",
            "code": "BATH_PREMIUM",
            "name": "Premium Bath Service",
            "price": 150000,
            "description": "Premium bathing with premium shampoo",
            "service_location_type": "store"
          },
          "type": "quota",
          "period": "unlimited",
          "limit": 1,
          "value": null,
          "used": 0,
          "period_reset_date": "2026-03-19T07:35:08.749Z"
        },
        {
          "_id": "69bb9d015c840eeb3bb38c81",
          "applies_to": "service",
          "service_id": "69ad38fa00e9af98d2941074",
          "label": null,
          "service": {
            "_id": "69ad38fa00e9af98d2941074",
            "code": "HOTEL_STANDARD",
            "name": "Standard Hotel Service",
            "price": 200000,
            "description": "Standard overnight hotel stay",
            "service_location_type": "store"
          },
          "type": "quota",
          "period": "unlimited",
          "limit": null,
          "value": null,
          "used": 0,
          "period_reset_date": null
        },
        {
          "_id": "69bb9d015c840eeb3bb38c82",
          "applies_to": "addon",
          "service_id": null,
          "label": "Addon Discount 10%",
          "service": null,
          "type": "discount",
          "period": "unlimited",
          "limit": null,
          "value": 10,
          "used": 0,
          "period_reset_date": null
        },
        {
          "_id": "69bb9d015c840eeb3bb38c84",
          "applies_to": "pickup",
          "service_id": null,
          "label": "Free Pickup",
          "service": null,
          "type": "quota",
          "period": "monthly",
          "limit": 2,
          "value": null,
          "used": 0,
          "period_reset_date": "2026-04-01T00:00:00.000Z"
        }
      ],
      "is_active": true,
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-03-19T07:35:08.758Z",
      "updatedAt": "2026-03-19T07:35:08.758Z",
      "status": "active",
      "pet": {
        "_id": "699a6285a99f14a4be787c77",
        "name": "Pet 1",
        "tags": ["Cat", "Grooming"],
        "pet_type": {
          "_id": "698bf0d362f5760ac021c595",
          "name": "Cat"
        },
        "owner": {
          "_id": "699a5d240d322c3d4e81dfbc",
          "username": "Cantika"
        }
      },
      "membership": [
        {
          "_id": "69bb920087f62205055d6ae9",
          "name": "Unlimited Grooming Bronze (6 Month)",
          "description": "Booking jadwal prioritas, Biaya sudah pasti, Groomer terpercaya, Ter-dia in-store dan dari rumah",
          "duration_months": 6,
          "price": 1500000
        }
      ]
    }
  ]
}
```

**Notes:**

- `benefits_snapshot` is a denormalized copy of membership benefits with usage tracking
- Each benefit in the array is automatically populated with a full `service` object if `service_id` is set:
  - `service` object includes: `_id`, `code`, `name`, `price`, `description`, `service_location_type`
  - `service: null` if benefit doesn't reference a specific service (e.g., general discounts on addons/orders)
- `used`: Current usage count for this period
- `period_reset_date`: When the usage counter last reset (null for UNLIMITED period)
- `pet` includes nested `owner` (customer) and `pet_type` details
- `membership` is an array containing the applicable membership plan(s)
- `status`: computed membership status — `"active"` | `"expired"` | `"pending"` | `"cancelled"`
  - `"active"`: `is_active = true` and today is within `start_date` – `end_date`
  - `"expired"`: `is_active = true` and today is past `end_date`
  - `"pending"`: `is_active = true` and today is before `start_date`
  - `"cancelled"`: `is_active = false`

---

### 2. Get Pet Membership By ID

**Endpoint:** `GET /pet-memberships/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId of the pet membership

**Success Response (200):**

```json
{
  "message": "pet membership retrieved successfully",
  "data": {
    "_id": "69bba72cb163fca04487f97a",
    "start_date": "2026-03-19T07:35:08.749Z",
    "end_date": "2026-09-19T07:35:08.749Z",
    "benefits_snapshot": [
      {
        "_id": "69bb9d015c840eeb3bb38c80",
        "type": "quota",
        "applies_to": "service",
        "period": "unlimited",
        "service_id": "69a45774ecf65d9a74d53fe6",
        "service": {
          "_id": "69a45774ecf65d9a74d53fe6",
          "code": "SVC-0001",
          "name": "Basic Grooming",
          "price": 89000,
          "description": "Perawatan dasar yang bikin pawfriends bersih, wangi, dan nyaman lagi",
          "service_location_type": "in store"
        },
        "limit": 1,
        "used": 0,
        "period_reset_date": "2026-03-19T07:35:08.749Z",
        "id": "69bb9d015c840eeb3bb38c80"
      },
      {
        "_id": "69bb9d015c840eeb3bb38c81",
        "type": "quota",
        "applies_to": "service",
        "period": "unlimited",
        "service_id": "69ad38fa00e9af98d2941074",
        "service": {
          "_id": "69ad38fa00e9af98d2941074",
          "code": "SVC-0005",
          "name": "Premium Detailing",
          "price": 125000,
          "description": "Premium grooming dengan extra detailing services",
          "service_location_type": "in home"
        },
        "limit": -1,
        "used": 0,
        "period_reset_date": "2026-03-19T07:35:08.749Z",
        "id": "69bb9d015c840eeb3bb38c81"
      },
      {
        "_id": "69bb9d015c840eeb3bb38c82",
        "type": "discount",
        "applies_to": "addon",
        "period": "unlimited",
        "value": 10,
        "service": null,
        "limit": -1,
        "used": 0,
        "period_reset_date": "2026-03-19T07:35:08.749Z",
        "id": "69bb9d015c840eeb3bb38c82"
      },
      {
        "_id": "69bb9d015c840eeb3bb38c83",
        "type": "quota",
        "applies_to": "service",
        "period": "unlimited",
        "service_id": null,
        "service": null,
        "limit": 1,
        "used": 0,
        "period_reset_date": "2026-03-19T07:35:08.749Z",
        "id": "69bb9d015c840eeb3bb38c83"
      },
      {
        "_id": "69bb9d015c840eeb3bb38c84",
        "type": "discount",
        "applies_to": "service",
        "period": "unlimited",
        "value": 20,
        "service": null,
        "limit": -1,
        "used": 0,
        "period_reset_date": "2026-03-19T07:35:08.749Z",
        "id": "69bb9d015c840eeb3bb38c84"
      }
    ],
    "isDeleted": false,
    "deletedAt": null,
    "createdAt": "2026-03-19T07:35:08.758Z",
    "updatedAt": "2026-03-19T07:35:08.758Z",
    "status": "active",
    "pet": {
      "_id": "699a6285a99f14a4be787c77",
      "name": "Pet 1",
      "tags": ["Cat", "Grooming"],
      "pet_type": {
        "_id": "698bf0d362f5760ac021c595",
        "name": "Cat"
      },
      "owner": {
        "_id": "699a5d240d322c3d4e81dfbc",
        "username": "Cantika"
      }
    },
    "membership": {
      "_id": "69bb920087f62205055d6ae9",
      "name": "Unlimited Grooming Bronze (6 Month)",
      "description": "Booking jadwal prioritas, Biaya sudah pasti, Groomer terpercaya, Ter-dia in-store dan dari rumah",
      "duration_months": 6,
      "price": 1500000
    }
  }
}
```

**Error Responses:**

- **400 Bad Request:** Invalid pet membership ID format

```json
{
  "statusCode": 400,
  "message": "invalid pet membership ID",
  "error": "Bad Request"
}
```

- **404 Not Found:** Pet membership not found

```json
{
  "statusCode": 404,
  "message": "pet membership not found",
  "error": "Not Found"
}
```

**Notes:**

- `benefits_snapshot` is a denormalized copy of membership benefits with usage tracking
- Each benefit in the array is automatically populated with a full `service` object if `service_id` is set:
  - `service` object includes: `_id`, `code`, `name`, `price`, `description`, `service_location_type`
  - `service: null` if benefit doesn't reference a specific service (e.g., general discounts on addons/orders)
- `used`: Current usage count for this period
- `period_reset_date`: When the usage counter last reset (null for UNLIMITED period)

---

### 3. Purchase Pet Membership (Create)

**Endpoint:** `POST /pet-memberships`

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "pet_id": "MongoDB ObjectId (required)",
  "membership_plan_id": "MongoDB ObjectId (required)"
}
```

**Example:**

```json
{
  "pet_id": "507f1f77bcf86cd799439020",
  "membership_plan_id": "507f1f77bcf86cd799439011"
}
```

**Success Response (201):**

```json
{
  "message": "pet membership purchased successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "pet_id": "507f1f77bcf86cd799439020",
    "membership_plan_id": "507f1f77bcf86cd799439011",
    "start_date": "2026-03-19T10:30:00.000Z",
    "end_date": "2027-03-19T10:30:00.000Z",
    "benefits_snapshot": [
      {
        "_id": "607f1f77bcf86cd799439021",
        "type": "discount",
        "applies_to": "service",
        "period": "monthly",
        "value": 10,
        "service_id": null,
        "limit": 5,
        "used": 0,
        "period_reset_date": "2026-04-01T00:00:00.000Z"
      },
      {
        "_id": "607f1f77bcf86cd799439022",
        "type": "free_service",
        "applies_to": "service",
        "period": "unlimited",
        "value": 150000,
        "service_id": "69a45774ecf65d9a74d53fe6",
        "limit": 12,
        "used": 0,
        "period_reset_date": null
      }
    ],
    "createdAt": "2026-03-19T10:30:00.000Z",
    "updatedAt": "2026-03-19T10:30:00.000Z"
  }
}
```

**Error Responses:**

- **400 Bad Request:** Pet ID or membership plan ID is invalid/missing

```json
{
  "statusCode": 400,
  "message": "pet_id is required",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "membership_plan_id must be a valid MongoDB ID",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "membership plan not found",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "pet already has an active membership for this plan",
  "error": "Bad Request"
}
```

**Notes:**

- When a pet membership is created, `benefits_snapshot` is populated from the membership plan's benefits
- `used` counter starts at 0 for each benefit
- `period_reset_date` is calculated based on the benefit's period type (weekly, monthly, or null for unlimited)
- `start_date` is the current date/time
- `end_date` is calculated by adding `membership_plan.duration_months` to the start_date

---

### 4. Get Active Membership for Pet

**Endpoint:** `GET /pet-memberships/:pet_id/active`

**Authentication:** Required (JWT)

**Parameters:**

- `pet_id` (path): MongoDB ObjectId of the pet

**Success Response (200) — With Active Membership:**

```json
{
  "message": "active membership found",
  "data": [
    {
      "_id": "69bd2be555b99229f78e9e64",
      "pet_id": "69ad09a7615651455a811a52",
      "membership_plan_id": "69bd2b7b55b99229f78e9cc6",
      "start_date": "2026-03-20T11:13:41.916Z",
      "end_date": "2026-09-20T11:13:41.916Z",
      "benefits_snapshot": [
        {
          "_id": "69bd2bcf55b99229f78e9e10",
          "applies_to": "service",
          "service_id": "69a45774ecf65d9a74d53fe6",
          "type": "quota",
          "period": "weekly",
          "limit": 1,
          "used": 0,
          "period_reset_date": "2026-03-22T17:00:00.000Z",
          "id": "69bd2bcf55b99229f78e9e10",
          "service": {
            "_id": "69a45774ecf65d9a74d53fe6",
            "code": "SVC-0001",
            "name": "Basic Grooming",
            "description": "Perawatan dasar yang bikin pawfriends bersih, wangi, dan nyaman lagi. Cocok untuk rutin supaya tetap fresh dan sehat.",
            "service_location_type": "in store"
          }
        },
        {
          "_id": "69bd2bcf55b99229f78e9e11",
          "applies_to": "addon",
          "service_id": "69ace8ab7fbc3acb5e61f94d",
          "type": "quota",
          "period": "unlimited",
          "limit": null,
          "used": 0,
          "period_reset_date": null,
          "id": "69bd2bcf55b99229f78e9e11",
          "service": {
            "_id": "69ace8ab7fbc3acb5e61f94d",
            "code": "SVC-0002",
            "name": "3 Spots Detangling",
            "description": "Buka kusut di 3 area tertentu (biasanya ketiak, belakang telinga, atau ekor) biar bulu balik halus & nggak ketarik sakit.",
            "price": 35000,
            "service_location_type": "in store"
          }
        }
      ],
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-03-20T11:13:41.918Z",
      "updatedAt": "2026-03-20T11:13:41.918Z",
      "__v": 0,
      "status": "active",
      "pet": {
        "_id": "69ad09a7615651455a811a52",
        "name": "Cici",
        "pet_type_id": "698bf0d362f5760ac021c595",
        "size_category_id": "698bf0d362f5760ac021c598",
        "hair_category_id": "698bf0d362f5760ac021c599",
        "tags": ["Test", "Satu", "Tiga"],
        "customer_id": "699a5d240d322c3d4e81dfbc",
        "pet_type": {
          "_id": "698bf0d362f5760ac021c595",
          "name": "Cat"
        },
        "size": {
          "_id": "698bf0d362f5760ac021c598",
          "name": "Small"
        },
        "hair": {
          "_id": "698bf0d362f5760ac021c599",
          "name": "Short"
        },
        "owner": {
          "_id": "699a5d240d322c3d4e81dfbc",
          "username": "Cantika"
        },
        "id": "69ad09a7615651455a811a52"
      },
      "membership": {
        "_id": "69bd2b7b55b99229f78e9cc6",
        "name": "Unlimited Grooming Silver (6 Month)",
        "duration_months": 6,
        "price": 2300000,
        "id": "69bd2b7b55b99229f78e9cc6"
      },
      "id": "69bd2be555b99229f78e9e64"
    },
    {
      "_id": "69bd2bea55b99229f78e9e79",
      "pet_id": "69ad09a7615651455a811a52",
      "membership_plan_id": "69bd231f55b99229f78e9976",
      "start_date": "2026-03-20T11:13:46.504Z",
      "end_date": "2026-09-20T11:13:46.504Z",
      "benefits_snapshot": [
        {
          "_id": "69bd290855b99229f78e9a60",
          "applies_to": "service",
          "service_id": "69a45774ecf65d9a74d53fe6",
          "type": "quota",
          "period": "weekly",
          "limit": 1,
          "used": 0,
          "period_reset_date": "2026-03-22T17:00:00.000Z",
          "id": "69bd290855b99229f78e9a60",
          "service": {
            "_id": "69a45774ecf65d9a74d53fe6",
            "code": "SVC-0001",
            "name": "Basic Grooming",
            "description": "Perawatan dasar yang bikin pawfriends bersih, wangi, dan nyaman lagi. Cocok untuk rutin supaya tetap fresh dan sehat.",
            "service_location_type": "in store"
          }
        },
        {
          "_id": "69bd290855b99229f78e9a61",
          "applies_to": "service",
          "label": "Full Grooming",
          "type": "discount",
          "period": "unlimited",
          "limit": 2,
          "value": 10,
          "used": 0,
          "period_reset_date": null,
          "id": "69bd290855b99229f78e9a61",
          "service": null
        },
        {
          "_id": "69bd290855b99229f78e9a62",
          "applies_to": "addon",
          "service_id": "69ace8ab7fbc3acb5e61f94d",
          "type": "quota",
          "period": "unlimited",
          "limit": null,
          "used": 0,
          "period_reset_date": null,
          "id": "69bd290855b99229f78e9a62",
          "service": {
            "_id": "69ace8ab7fbc3acb5e61f94d",
            "code": "SVC-0002",
            "name": "3 Spots Detangling",
            "description": "Buka kusut di 3 area tertentu (biasanya ketiak, belakang telinga, atau ekor) biar bulu balik halus & nggak ketarik sakit.",
            "price": 35000,
            "service_location_type": "in store"
          }
        },
        {
          "_id": "69bd290855b99229f78e9a63",
          "applies_to": "service",
          "label": "Product Discount (Service excl training, Pawship, Pawlush)",
          "type": "discount",
          "period": "unlimited",
          "limit": null,
          "value": 10,
          "used": 0,
          "period_reset_date": null,
          "id": "69bd290855b99229f78e9a63",
          "service": null
        },
        {
          "_id": "69bd290855b99229f78e9a64",
          "applies_to": "pickup",
          "label": "Pickup Discount",
          "type": "discount",
          "period": "unlimited",
          "limit": null,
          "value": 20,
          "used": 0,
          "period_reset_date": null,
          "id": "69bd290855b99229f78e9a64",
          "service": null
        }
      ],
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-03-20T11:13:46.506Z",
      "updatedAt": "2026-03-20T11:13:46.506Z",
      "__v": 0,
      "status": "active",
      "pet": {
        "_id": "69ad09a7615651455a811a52",
        "name": "Cici",
        "pet_type_id": "698bf0d362f5760ac021c595",
        "size_category_id": "698bf0d362f5760ac021c598",
        "hair_category_id": "698bf0d362f5760ac021c599",
        "tags": ["Test", "Satu", "Tiga"],
        "customer_id": "699a5d240d322c3d4e81dfbc",
        "pet_type": {
          "_id": "698bf0d362f5760ac021c595",
          "name": "Cat"
        },
        "size": {
          "_id": "698bf0d362f5760ac021c598",
          "name": "Small"
        },
        "hair": {
          "_id": "698bf0d362f5760ac021c599",
          "name": "Short"
        },
        "owner": {
          "_id": "699a5d240d322c3d4e81dfbc",
          "username": "Cantika"
        },
        "id": "69ad09a7615651455a811a52"
      },
      "membership": {
        "_id": "69bd231f55b99229f78e9976",
        "name": "Bronze Membersip",
        "description": "Bronze Membership Description",
        "duration_months": 6,
        "price": 1500000,
        "id": "69bd231f55b99229f78e9976"
      },
      "id": "69bd2bea55b99229f78e9e79"
    }
  ]
}
```

**Success Response (200) — No Active Membership:**

```json
{
  "message": "no active membership",
  "data": []
}
```

**Error Responses:**

- **400 Bad Request:** Invalid pet ID format

```json
{
  "statusCode": 400,
  "message": "invalid pet ID",
  "error": "Bad Request"
}
```

**Notes:**

- A membership is "active" if the current date/time is between `start_date` and `end_date`
- Returns empty array `[]` if no active membership exists
- `status`: computed membership status — `"active"` | `"expired"` | `"pending"` | `"cancelled"`
  - `"active"`: `is_active = true` and today is within `start_date` – `end_date`
  - `"expired"`: `is_active = true` and today is past `end_date`
  - `"pending"`: `is_active = true` and today is before `start_date`
  - `"cancelled"`: `is_active = false`

---

### 5. Get Benefits Summary

**Endpoint:** `GET /pet-memberships/:pet_id/benefits-summary`

**Authentication:** Required (JWT)

**Parameters:**

- `pet_id` (path): MongoDB ObjectId of the pet

**Success Response (200) — With Active Membership:**

```json
{
  "message": "benefits summary retrieved successfully",
  "data": [
    {
      "membership": {
        "_id": "69bd2be555b99229f78e9e64",
        "membership_plan_id": "69bd2b7b55b99229f78e9cc6",
        "membership_name": "Unlimited Grooming Silver (6 Month)",
        "start_date": "2026-03-20T11:13:41.916Z",
        "end_date": "2026-09-20T11:13:41.916Z",
        "status": "active"
      },
      "benefits": [
        {
          "_id": "69bd2bcf55b99229f78e9e10",
          "pet_membership_id": "69bd2be555b99229f78e9e64",
          "applies_to": "service",
          "service_id": "69a45774ecf65d9a74d53fe6",
          "label": null,
          "service": {
            "_id": "69a45774ecf65d9a74d53fe6",
            "code": "SVC-0001",
            "name": "Basic Grooming",
            "price": 120000,
            "description": "Basic grooming package",
            "service_location_type": "store"
          },
          "type": "quota",
          "period": "weekly",
          "limit": 1,
          "value": null,
          "used": 0,
          "remaining": 1,
          "can_apply": true,
          "period_reset_date": "2026-03-22T17:00:00.000Z",
          "next_reset_date": "2026-03-29T17:00:00.000Z"
        },
        {
          "_id": "69bd2bcf55b99229f78e9e11",
          "pet_membership_id": "69bd2be555b99229f78e9e64",
          "applies_to": "pickup",
          "service_id": null,
          "label": "Pickup & Delivery",
          "service": null,
          "type": "discount",
          "period": "monthly",
          "limit": null,
          "value": 20,
          "used": 0,
          "remaining": null,
          "can_apply": true,
          "period_reset_date": null,
          "next_reset_date": null
        }
      ]
    }
  ]
}
```

**Success Response (200) — No Active Membership:**

```json
{
  "message": "benefits summary retrieved successfully",
  "data": []
}
```

**Notes:**

- `data` is an array — one entry per active membership; empty array if no active membership
- Each entry has `membership` (plan info, including `status`) and `benefits[]` (enriched benefit objects for that membership)
- `membership.status`: computed status — `"active"` | `"expired"` | `"pending"` | `"cancelled"`
- `pet_membership_id`: present on every benefit to identify its source membership
- `can_apply`: `true` if benefit has remaining quota (`limit` is `null` = unlimited, or `used < limit`)
- `remaining`: `null` for unlimited benefits (`limit` is `null`), otherwise `limit - used`
- `period_reset_date`: next reset date for the current period; `null` for `unlimited` period benefits
- `next_reset_date`: the reset date after `period_reset_date`; `null` for `unlimited` period benefits
- For `weekly`/`monthly` period benefits, `used` is automatically reset to `0` when querying if `period_reset_date` has passed
- `service`: populated service object when `service_id` is set; `null` otherwise. Includes: `_id`, `code`, `name`, `price`, `description`, `service_location_type`
- `label`: descriptive label for benefits without `service_id` (e.g. `"Pickup & Delivery"`); `null` when `service_id` is present

---

### 6. Get Benefits History

**Endpoint:** `GET /pet-memberships/:pet_id/benefits-history`

**Authentication:** Required (JWT)

**Parameters:**

- `pet_id` (path): MongoDB ObjectId of the pet

**Query Parameters:**

- `limit` (optional, number): Max records to return (default: 100)
- `skip` (optional, number): Offset for pagination (default: 0)

**Success Response (200) — With Active Membership:**

```json
{
  "message": "benefits history retrieved successfully",
  "data": {
    "has_active_membership": true,
    "memberships": [
      {
        "pet_membership_id": "507f1f77bcf86cd799439030",
        "status": "active"
      }
    ],
    "benefits_history": [
      {
        "_id": "607f1f77bcf86cd799439051",
        "benefit_id": "607f1f77bcf86cd799439021",
        "type": "discount",
        "applied_date": "2026-03-18T14:30:00.000Z",
        "booking_id": "507f1f77bcf86cd799439040",
        "amount_deducted": 35000
      },
      {
        "_id": "607f1f77bcf86cd799439052",
        "benefit_id": "607f1f77bcf86cd799439021",
        "type": "discount",
        "applied_date": "2026-03-10T10:15:00.000Z",
        "booking_id": "507f1f77bcf86cd799439041",
        "amount_deducted": 35000
      }
    ]
  }
}
```

**Success Response (200) — No Active Membership:**

```json
{
  "message": "benefits history retrieved successfully",
  "data": {
    "has_active_membership": false,
    "benefits_history": []
  }
}
```

**Notes:**

- Currently returns empty `benefits_history`; will be populated once BenefitUsage tracking is integrated
- Shows audit trail of when benefits were applied to bookings
- `memberships`: array of objects with `pet_membership_id` and `status` for each active membership
- `status` values: `"active"` | `"expired"` | `"pending"` | `"cancelled"`

---

### 7. Update Pet Membership

**Endpoint:** `PUT /pet-memberships/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId of the pet membership

**Request Body:**

```json
{
  "start_date": "ISO date string (required)",
  "end_date": "ISO date string (required)"
}
```

**Example:**

```json
{
  "start_date": "2026-03-20T00:00:00.000Z",
  "end_date": "2026-09-20T00:00:00.000Z"
}
```

**Success Response (200):**

```json
{
  "message": "pet membership updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "pet_id": "507f1f77bcf86cd799439020",
    "membership_plan_id": "507f1f77bcf86cd799439011",
    "start_date": "2026-03-20T00:00:00.000Z",
    "end_date": "2026-09-20T00:00:00.000Z",
    "isDeleted": false,
    "deletedAt": null,
    "createdAt": "2026-03-19T10:30:00.000Z",
    "updatedAt": "2026-03-20T09:00:00.000Z"
  }
}
```

**Error Responses:**

- **400 Bad Request:** Invalid ID format or missing/invalid fields

```json
{
  "statusCode": 400,
  "message": "invalid pet membership ID",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": ["start_date is required", "end_date is required"],
  "error": "Bad Request"
}
```

- **404 Not Found:** Pet membership not found

```json
{
  "statusCode": 404,
  "message": "pet membership not found",
  "error": "Not Found"
}
```

**Notes:**

- Only `start_date` and `end_date` can be updated — membership plan and benefits snapshot are locked at purchase time
- A `MembershipLog` entry with `event_type: "updated"` is created automatically recording the new dates
- `benefits_snapshot_before` is `[]` for update log entries

---

### 8. Cancel Pet Membership

**Endpoint:** `PATCH /pet-memberships/:id/cancelled`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId of the pet membership

**Success Response (200):**

```json
{
  "message": "pet membership cancelled successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "pet_id": "507f1f77bcf86cd799439020",
    "membership_plan_id": "507f1f77bcf86cd799439011",
    "is_active": false,
    "isDeleted": false,
    "deletedAt": null
  }
}
```

**Error Responses:**

- **400 Bad Request:** Invalid ID format

```json
{
  "statusCode": 400,
  "message": "invalid pet membership ID",
  "error": "Bad Request"
}
```

- **404 Not Found:** Pet membership not found

```json
{
  "statusCode": 404,
  "message": "pet membership not found",
  "error": "Not Found"
}
```

**Notes:**

- Cancellation sets `is_active: false` (record is kept for history)
- Cancelled memberships (`is_active: false`) are excluded from all GET endpoints except history
- Benefits are no longer available after cancellation

---

### 9. Renew Pet Membership

**Endpoint:** `POST /pet-memberships/:id/renew`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId of the pet membership to renew

**Success Response (200):**

```json
{
  "message": "membership renewed successfully",
  "data": {
    "_id": "69bd2be555b99229f78e9e64",
    "start_date": "2026-03-20T11:13:41.916Z",
    "end_date": "2027-03-20T11:13:41.916Z",
    "benefits_snapshot": [
      {
        "_id": "69bd2bcf55b99229f78e9e10",
        "applies_to": "service",
        "service_id": "69a45774ecf65d9a74d53fe6",
        "type": "quota",
        "period": "weekly",
        "limit": 1,
        "used": 0,
        "period_reset_date": "2026-03-22T17:00:00.000Z"
      }
    ],
    "isDeleted": false
  }
}
```

**Error Responses:**

- **400 Bad Request:** Membership is still active

```json
{
  "statusCode": 400,
  "message": "membership is still active and cannot be renewed yet",
  "error": "Bad Request"
}
```

- **404 Not Found:** Pet membership not found

```json
{
  "statusCode": 404,
  "message": "pet membership not found",
  "error": "Not Found"
}
```

**Notes:**

- Only expired memberships (where `end_date < now`) can be renewed
- New `end_date` is calculated from the old `end_date` (contiguous, no gap): `old end_date + duration_months`
- All `benefits_snapshot.used` counters are reset to `0` and `period_reset_date` is recalculated from the new start
- A `MembershipLog` entry with `event_type: "renewed"` is created automatically, storing `benefits_snapshot_before` (the state with final used counts before reset)

---

### 10. Get Membership History

**Endpoint:** `GET /pet-memberships/:pet_id/membership-history`

**Authentication:** Required (JWT)

**Parameters:**

- `pet_id` (path): MongoDB ObjectId of the pet

**Success Response (200):**

```json
{
  "message": "membership history retrieved successfully",
  "data": [
    {
      "_id": "69bd2be555b99229f78e9e64",
      "pet_id": "69ad09a7615651455a811a52",
      "membership_plan_id": "69bd2b7b55b99229f78e9cc6",
      "start_date": "2026-03-20T11:13:41.916Z",
      "end_date": "2026-09-20T11:13:41.916Z",
      "is_active": true,
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-03-20T11:13:41.918Z",
      "updatedAt": "2026-03-20T11:13:41.918Z",
      "status": "active",
      "membership": {
        "_id": "69bd2b7b55b99229f78e9cc6",
        "name": "Unlimited Grooming Silver (6 Month)",
        "description": "Silver membership with weekly grooming quota",
        "duration_months": 6,
        "price": 2300000
      }
    },
    {
      "_id": "69bc1aa055b99229f78e1234",
      "pet_id": "69ad09a7615651455a811a52",
      "membership_plan_id": "69bd231f55b99229f78e9976",
      "start_date": "2025-09-20T08:00:00.000Z",
      "end_date": "2026-03-20T08:00:00.000Z",
      "is_active": false,
      "isDeleted": false,
      "deletedAt": "2026-03-20T11:00:00.000Z",
      "createdAt": "2025-09-20T08:00:00.001Z",
      "updatedAt": "2026-03-20T11:00:00.001Z",
      "status": "cancelled",
      "membership": {
        "_id": "69bd231f55b99229f78e9976",
        "name": "Bronze Membership",
        "description": "Bronze Membership Description",
        "duration_months": 6,
        "price": 1500000
      }
    }
  ]
}
```

**Success Response (200) — No History:**

```json
{
  "message": "membership history retrieved successfully",
  "data": []
}
```

**Error Responses:**

- **400 Bad Request:** Invalid pet ID format

```json
{
  "statusCode": 400,
  "message": "invalid pet ID",
  "error": "Bad Request"
}
```

**Notes:**

- Returns **all** pet memberships for the pet where `isDeleted: false` — includes active, expired, and cancelled
- `benefits_snapshot` is excluded from this list — use endpoint 11 for log detail
- `status`: computed membership status — `"active"` | `"expired"` | `"pending"` | `"cancelled"`
  - `"active"`: `is_active = true` and today is within `start_date` – `end_date`
  - `"expired"`: `is_active = true` and today is past `end_date`
  - `"pending"`: `is_active = true` and today is before `start_date`
  - `"cancelled"`: `is_active = false`
- Sorted by `createdAt` descending (newest first)
- Use `_id` of each item as `pet_membership_id` to call endpoint 11

---

### 11. Get Membership History Detail

**Endpoint:** `GET /pet-memberships/:pet_id/membership-history/:pet_membership_id`

**Authentication:** Required (JWT)

**Parameters:**

- `pet_id` (path): MongoDB ObjectId of the pet
- `pet_membership_id` (path): MongoDB ObjectId of the pet membership

**Success Response (200):**

```json
{
  "message": "membership history detail retrieved successfully",
  "data": {
    "pet_membership": {
      "_id": "69bd2be555b99229f78e9e64",
      "pet_id": "69ad09a7615651455a811a52",
      "membership_plan_id": "69bd2b7b55b99229f78e9cc6",
      "start_date": "2026-03-20T11:13:41.916Z",
      "end_date": "2026-09-20T11:13:41.916Z",
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-03-20T11:13:41.918Z",
      "updatedAt": "2026-03-20T11:13:41.918Z",
      "status": "active",
      "membership": {
        "_id": "69bd2b7b55b99229f78e9cc6",
        "name": "Unlimited Grooming Silver (6 Month)",
        "description": "Silver membership with weekly grooming quota",
        "duration_months": 6,
        "price": 2300000
      }
    },
    "logs": [
      {
        "_id": "69be3cf155b99229f78f0001",
        "event_type": "updated",
        "event_date": "2026-03-21T09:00:00.000Z",
        "start_date": "2026-03-21T09:00:00.000Z",
        "end_date": "2026-09-21T09:00:00.000Z",
        "benefits_snapshot_before": [],
        "note": "Updated dates: start=2026-03-21T09:00:00.000Z, end=2026-09-21T09:00:00.000Z",
        "createdAt": "2026-03-21T09:00:00.001Z",
        "updatedAt": "2026-03-21T09:00:00.001Z",
        "membership": {
          "_id": "69bd2b7b55b99229f78e9cc6",
          "name": "Unlimited Grooming Silver (6 Month)",
          "description": "Silver membership with weekly grooming quota",
          "duration_months": 6,
          "price": 2300000
        }
      },
      {
        "_id": "69bd2cf055b99229f78e9f10",
        "event_type": "renewed",
        "event_date": "2026-09-20T11:13:41.916Z",
        "start_date": "2026-09-20T11:13:41.916Z",
        "end_date": "2027-03-20T11:13:41.916Z",
        "benefits_snapshot_before": [
          {
            "_id": "69bd2bcf55b99229f78e9e10",
            "applies_to": "service",
            "service_id": "69a45774ecf65d9a74d53fe6",
            "type": "quota",
            "period": "weekly",
            "limit": 1,
            "used": 3,
            "period_reset_date": "2026-09-27T17:00:00.000Z"
          }
        ],
        "note": "Renewed from 2026-09-20T11:13:41.916Z to 2027-03-20T11:13:41.916Z",
        "createdAt": "2026-09-20T11:13:41.918Z",
        "updatedAt": "2026-09-20T11:13:41.918Z",
        "membership": {
          "_id": "69bd2b7b55b99229f78e9cc6",
          "name": "Unlimited Grooming Silver (6 Month)",
          "description": "Silver membership with weekly grooming quota",
          "duration_months": 6,
          "price": 2300000
        }
      },
      {
        "_id": "69bd2be655b99229f78e9e80",
        "event_type": "purchased",
        "event_date": "2026-03-20T11:13:41.916Z",
        "start_date": "2026-03-20T11:13:41.916Z",
        "end_date": "2026-09-20T11:13:41.916Z",
        "benefits_snapshot_before": [
          {
            "_id": "69bd2bcf55b99229f78e9e10",
            "applies_to": "service",
            "service_id": "69a45774ecf65d9a74d53fe6",
            "type": "quota",
            "period": "weekly",
            "limit": 1,
            "used": 0,
            "period_reset_date": "2026-03-22T17:00:00.000Z"
          }
        ],
        "note": null,
        "createdAt": "2026-03-20T11:13:41.918Z",
        "updatedAt": "2026-03-20T11:13:41.918Z",
        "membership": {
          "_id": "69bd2b7b55b99229f78e9cc6",
          "name": "Unlimited Grooming Silver (6 Month)",
          "description": "Silver membership with weekly grooming quota",
          "duration_months": 6,
          "price": 2300000
        }
      }
    ]
  }
}
```

**Error Responses:**

- **400 Bad Request:** Invalid ID format

```json
{
  "statusCode": 400,
  "message": "invalid pet ID",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "invalid pet membership ID",
  "error": "Bad Request"
}
```

- **404 Not Found:** Pet membership not found for this pet

```json
{
  "statusCode": 404,
  "message": "pet membership not found",
  "error": "Not Found"
}
```

**Notes:**

- `pet_membership`: the membership record without `benefits_snapshot`
- `pet_membership.status`: computed status — `"active"` | `"expired"` | `"pending"` | `"cancelled"`
- `logs`: all `MembershipLog` entries for this specific pet membership, filtered by `pet_id` + `pet_membership_id` + `membership_plan_id`, sorted `event_date` descending
- `event_type` values: `"purchased"` | `"renewed"` | `"cancelled"` | `"updated"`
- `benefits_snapshot_before` is `[]` for `updated` events; populated for `purchased`, `renewed`, `cancelled`

---

### 11. Soft Delete Pet Membership

**Endpoint:** `DELETE /pet-memberships/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId of the pet membership

**Success Response (200):**

```json
{
  "message": "pet membership cancelled successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "pet_id": "507f1f77bcf86cd799439020",
    "membership_plan_id": "507f1f77bcf86cd799439011",
    "is_active": false,
    "isDeleted": false,
    "deletedAt": "timestamp"
  }
}
```

**Error Responses:**

- **400 Bad Request:** Invalid ID format

```json
{
  "statusCode": 400,
  "message": "invalid pet membership ID",
  "error": "Bad Request"
}
```

- **404 Not Found:** Pet membership not found

```json
{
  "statusCode": 404,
  "message": "pet membership not found",
  "error": "Not Found"
}
```

## Benefit Usages

Benefit Usages track when and how membership benefits are applied to bookings. Each usage record documents which benefit was used, which booking it was applied to, and how much of the benefit was consumed (amount_used).

**Key Concepts:**

- **pet_membership_id**: Reference to the pet membership that owns the benefit
- **benefit_id**: Reference to the specific benefit in the membership's benefits_snapshot
- **booking_id**: The booking where the benefit was applied
- **scope**: Type of benefit applied (`service`, `addon`, or `pickup`)
- **target_id**: The service or addon that was the target of the benefit (if service-scoped)
- **amount_used**: How much of the benefit was consumed (discount $ amount, free session count, etc.)
- **used_at**: When the benefit was applied

---

### 1. Record Benefit Usage

**Endpoint:** `POST /benefit-usage`

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "pet_membership_id": "MongoDB ObjectId (required)",
  "benefit_id": "MongoDB ObjectId (required, _id from benefits_snapshot)",
  "booking_id": "MongoDB ObjectId (required)",
  "target_id": "MongoDB ObjectId (required, service or addon ID)",
  "amount_used": "number (required, min: 0)"
}
```

**Example Request:**

```json
{
  "pet_membership_id": "507f1f77bcf86cd799439030",
  "benefit_id": "607f1f77bcf86cd799439021",
  "booking_id": "507f1f77bcf86cd799439040",
  "target_id": "69a45774ecf65d9a74d53fe6",
  "amount_used": 35000
}
```

**Success Response (201):**

```json
{
  "message": "benefit usage recorded successfully",
  "data": {
    "_id": "607f1f77bcf86cd799439051",
    "pet_membership_id": "507f1f77bcf86cd799439030",
    "benefit_id": "607f1f77bcf86cd799439021",
    "booking_id": "507f1f77bcf86cd799439040",
    "used_at": "2026-03-19T14:30:00.000Z",
    "scope": "service",
    "target_id": "69a45774ecf65d9a74d53fe6",
    "amount_used": 35000,
    "isDeleted": false,
    "createdAt": "2026-03-19T14:30:00.000Z",
    "updatedAt": "2026-03-19T14:30:00.000Z"
  }
}
```

**Error Responses:**

- **400 Bad Request:** Missing required fields or invalid IDs

```json
{
  "statusCode": 400,
  "message": "pet_membership_id is required",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "amount_used must be >= 0",
  "error": "Bad Request"
}
```

**Notes:**

- `scope` is auto-derived from the benefit's `applies_to` field in the pet membership
- This endpoint is typically called automatically by the booking system when a benefit is applied during booking creation
- `used_at` is automatically set to the current date/time
- `amount_used` represents the monetary value (in currency units) or count (for quota benefits) consumed
- Each usage record is immutable once created; updates require deleting and re-creating

---

### 2. Get All Benefit Usage Records

**Endpoint:** `GET /benefit-usage`

**Authentication:** Required (JWT)

**Query Parameters:**

- `pet_membership_id` (optional, MongoDB ObjectId): Filter by pet membership
- `booking_id` (optional, MongoDB ObjectId): Filter by booking

**Example Requests:**

```bash
# Get all usage records
GET /benefit-usage

# Filter by pet membership
GET /benefit-usage?pet_membership_id=507f1f77bcf86cd799439030

# Filter by booking
GET /benefit-usage?booking_id=507f1f77bcf86cd799439040

# Combined filters
GET /benefit-usage?pet_membership_id=507f1f77bcf86cd799439030&booking_id=507f1f77bcf86cd799439040
```

**Success Response (200):**

```json
{
  "message": "benefit usage records retrieved successfully",
  "data": [
    {
      "_id": "607f1f77bcf86cd799439051",
      "pet_membership_id": "507f1f77bcf86cd799439030",
      "benefit_id": "607f1f77bcf86cd799439021",
      "booking_id": "507f1f77bcf86cd799439040",
      "booking_id_details": {
        "_id": "507f1f77bcf86cd799439040",
        "code": "BK-2026-001",
        "status": "completed",
        "total_price": 300000
      },
      "used_at": "2026-03-19T14:30:00.000Z",
      "scope": "service",
      "target_id": "69a45774ecf65d9a74d53fe6",
      "amount_used": 35000,
      "isDeleted": false,
      "createdAt": "2026-03-19T14:30:00.000Z",
      "updatedAt": "2026-03-19T14:30:00.000Z"
    },
    {
      "_id": "607f1f77bcf86cd799439052",
      "pet_membership_id": "507f1f77bcf86cd799439030",
      "benefit_id": "607f1f77bcf86cd799439021",
      "booking_id": "507f1f77bcf86cd799439041",
      "booking_id_details": {
        "_id": "507f1f77bcf86cd799439041",
        "code": "BK-2026-002",
        "status": "completed",
        "total_price": 280000
      },
      "used_at": "2026-03-10T10:15:00.000Z",
      "scope": "service",
      "target_id": "69a45774ecf65d9a74d53fe6",
      "amount_used": 35000,
      "isDeleted": false,
      "createdAt": "2026-03-10T10:15:00.000Z",
      "updatedAt": "2026-03-10T10:15:00.000Z"
    }
  ]
}
```

**Notes:**

- Results are sorted by `used_at` (newest first)
- The `booking_id` field is populated with booking details
- Query filters are AND-ed together (must match all provided filters)

---

### 3. Get Benefit Usage By ID

**Endpoint:** `GET /benefit-usage/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId of the benefit usage record

**Success Response (200):**

```json
{
  "message": "benefit usage record retrieved successfully",
  "data": {
    "_id": "607f1f77bcf86cd799439051",
    "pet_membership_id": "507f1f77bcf86cd799439030",
    "benefit_id": "607f1f77bcf86cd799439021",
    "booking_id": "507f1f77bcf86cd799439040",
    "booking_id_details": {
      "_id": "507f1f77bcf86cd799439040",
      "code": "BK-2026-001",
      "status": "completed",
      "total_price": 300000
    },
    "used_at": "2026-03-19T14:30:00.000Z",
    "scope": "service",
    "target_id": "69a45774ecf65d9a74d53fe6",
    "amount_used": 35000,
    "isDeleted": false,
    "createdAt": "2026-03-19T14:30:00.000Z",
    "updatedAt": "2026-03-19T14:30:00.000Z"
  }
}
```

**Error Responses:**

- **400 Bad Request:** Invalid benefit usage ID format

```json
{
  "statusCode": 400,
  "message": "invalid benefit usage ID",
  "error": "Bad Request"
}
```

- **404 Not Found:** Benefit usage record not found

```json
{
  "statusCode": 404,
  "message": "benefit usage not found",
  "error": "Not Found"
}
```

---

### 4. Get Usage History for Pet Membership

**Endpoint:** `GET /benefit-usage/:pet_membership_id/history`

**Authentication:** Required (JWT)

**Parameters:**

- `pet_membership_id` (path): MongoDB ObjectId of the pet membership

**Query Parameters:**

- `limit` (optional, number): Max records to return (default: 100)
- `skip` (optional, number): Offset for pagination (default: 0)

**Example Requests:**

```bash
# Get all usage history
GET /benefit-usage/507f1f77bcf86cd799439030/history

# Paginate results
GET /benefit-usage/507f1f77bcf86cd799439030/history?limit=10&skip=20
```

**Success Response (200):**

```json
{
  "message": "usage history retrieved successfully",
  "data": [
    {
      "_id": "607f1f77bcf86cd799439051",
      "pet_membership_id": "507f1f77bcf86cd799439030",
      "benefit_id": "607f1f77bcf86cd799439021",
      "booking_id": "507f1f77bcf86cd799439040",
      "booking_id_details": {
        "_id": "507f1f77bcf86cd799439040",
        "code": "BK-2026-001",
        "status": "completed"
      },
      "used_at": "2026-03-19T14:30:00.000Z",
      "scope": "service",
      "target_id": "69a45774ecf65d9a74d53fe6",
      "amount_used": 35000
    },
    {
      "_id": "607f1f77bcf86cd799439052",
      "pet_membership_id": "507f1f77bcf86cd799439030",
      "benefit_id": "607f1f77bcf86cd799439021",
      "booking_id": "507f1f77bcf86cd799439041",
      "booking_id_details": {
        "_id": "507f1f77bcf86cd799439041",
        "code": "BK-2026-002",
        "status": "completed"
      },
      "used_at": "2026-03-10T10:15:00.000Z",
      "scope": "service",
      "target_id": "69a45774ecf65d9a74d53fe6",
      "amount_used": 35000
    }
  ]
}
```

**Error Responses:**

- **400 Bad Request:** Invalid pet membership ID format

```json
{
  "statusCode": 400,
  "message": "invalid pet membership ID",
  "error": "Bad Request"
}
```

**Notes:**

- Results are sorted by `used_at` (newest first)
- Paginated results help with large usage histories
- Useful for auditing benefit consumption over time

---

### 5. Delete Benefit Usage Record (Soft Delete)

**Endpoint:** `DELETE /benefit-usage/:id`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): MongoDB ObjectId of the benefit usage record

**Success Response (200):**

```json
{
  "message": "benefit usage record deleted successfully",
  "data": {
    "_id": "607f1f77bcf86cd799439051",
    "pet_membership_id": "507f1f77bcf86cd799439030",
    "benefit_id": "607f1f77bcf86cd799439021",
    "booking_id": "507f1f77bcf86cd799439040",
    "isDeleted": true,
    "deletedAt": "2026-03-19T15:45:00.000Z"
  }
}
```

**Error Responses:**

- **400 Bad Request:** Invalid benefit usage ID format

```json
{
  "statusCode": 400,
  "message": "invalid benefit usage ID",
  "error": "Bad Request"
}
```

- **404 Not Found:** Benefit usage record not found

```json
{
  "statusCode": 404,
  "message": "benefit usage not found",
  "error": "Not Found"
}
```

**Notes:**

- This is a soft delete operation
- Record is marked with `isDeleted: true` and `deletedAt` timestamp
- Useful for reversing/canceling benefit applications if a booking is cancelled
- Deleted records are excluded from GET endpoints

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

#### 8. Preview Apply Benefits (Public)

**Endpoint:** `POST /bookings/public/apply-benefit`

**Description:**
Preview the effect of applying selected membership benefits to a booking before the booking is created. Returns the breakdown of each benefit's discount and the final price after all discounts.

**Authentication:** Not Required

**Request Body:**

```json
{
  "pet_id": "MongoDB ObjectId (required)",
  "selected_benefit_ids": ["MongoDB ObjectId (required)"],
  "store_id": "MongoDB ObjectId (optional)",
  "service_id": "MongoDB ObjectID (optional)",
  "add_on_ids": "Array of MongoDB ObjectID (optional)"
}
```

**Example Request Body:**

```json
{
  "pet_id": "69ad09a7615651455a811a52",
  "selected_benefit_ids": [
    "69c410310993f7ae9b9e1962",
    "69c410310993f7ae9b9e1961"
  ],
  "store_id": "698be0cd80c319b74fe2f073",
  "service_id": "69c54942ad42bcc455c0d18a"
}
```

| Field                  | Type             | Required | Description                                                                                                                         |
| ---------------------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pet_id`               | MongoId          | ✅       | Pet to preview benefits for                                                                                                         |
| `selected_benefit_ids` | MongoId[]        | ✅       | Benefit IDs to preview                                                                                                              |
| `store_id`             | MongoId          | ❌       | Required when any selected benefit has `applies_to: pickup`. Used to compute travel fee via the customer's address and store zones. |
| `service_id`           | MongoId          | ❌       | Required when any selected benefit has `applies_to: service` and `type: discount`.                                                  |
| `add_on_ids`           | Array of MongoId | ❌       | Required when any selected benefit has `applies_to: addon` and `type: discount`.                                                    |

**Success Response (200):**

```json
{
  "message": "Benefit preview calculated successfully",
  "applied_benefits": [
    {
      "benefit_id": "69c410310993f7ae9b9e1962",
      "benefit_type": "discount",
      "benefit_period": "unlimited",
      "benefit_value": 10,
      "amount_deducted": 6900,
      "applied_at": "2026-03-26T14:57:31.911Z"
    },
    {
      "benefit_id": "69c410310993f7ae9b9e1961",
      "benefit_type": "discount",
      "benefit_period": "unlimited",
      "benefit_value": 20,
      "amount_deducted": 5000,
      "applied_at": "2026-03-26T14:57:32.796Z"
    }
  ],
  "total_discount": 11900,
  "final_price": 82100,
  "breakdown": [
    {
      "benefit": {
        "_id": "69c410310993f7ae9b9e1962",
        "label": "Booking Discount",
        "service": null
      },
      "applies_to": "service",
      "benefit_type": "discount",
      "benefit_period": "unlimited",
      "benefit_value": 10,
      "base_price": 69000,
      "amount_deducted": 6900,
      "description": null
    },
    {
      "benefit": {
        "_id": "69c410310993f7ae9b9e1961",
        "label": "Pickup Discount",
        "service": null
      },
      "applies_to": "pickup",
      "benefit_type": "discount",
      "benefit_period": "unlimited",
      "benefit_value": 20,
      "base_price": 25000,
      "amount_deducted": 5000,
      "description": null
    }
  ]
}
```

**Error Responses:**

- **404 Not Found:** Pet or membership not found
- **400 Bad Request:** Invalid or missing fields

**Notes:**

- This endpoint does not require a booking to exist. Use it to preview discounts before creating a booking.
- Each `breakdown` item targets a specific price component via `applies_to`: `service`, `addon`, or `pickup`.
- `base_price` is the price of the targeted component at the time this benefit is applied (accounts for previous deductions on the same component).
- `benefit type: discount` → deducts a percentage of `base_price`. `benefit type: quota` → makes the targeted component fully free (`amount_deducted = base_price`).
- `service` and `addon` benefits look up the price from the benefit's linked `service_id` using the pet's type, size, and hair. If no matching price is found for the pet's config, the benefit is skipped.
- `pickup` benefits calculate `base_price` by matching the customer's main address against the store's delivery zones — `store_id` must be provided, otherwise the benefit is skipped.
- Only benefits where `can_apply: true` (from the pet's active membership) are included in the result.
- If the pet has no active membership, all arrays are empty and `final_price` is `0`.

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
      "customer": {
        "_id": "507f1f77bcf86cd799439012",
        "username": "Cantika",
        "email": "cantika@gmail.com",
        "phone_number": "081324765890"
      },
      "pet_snapshot": {
        "_id": "699a6285a99f14a4be787c77",
        "name": "Pet 1",
        "member_type": {
          "_id": "699456cf429638a275fb0456",
          "name": "Vip - In Store"
        },
        "pet_type": {
          "_id": "698bf0d362f5760ac021c595",
          "name": "Cat"
        },
        "size": {
          "_id": "698bf0e462f5760ac021c597",
          "name": "Small"
        },
        "hair": {
          "_id": "69a0fe38dee77f169eb3259b",
          "name": "Long Hair"
        },
        "breed": {
          "_id": "698da2bb19b8a1bbac7aabb6",
          "name": "Pom"
        }
      },
      "service_snapshot": {
        "_id": "69a45774ecf65d9a74d53fe6",
        "code": "SVC-0001",
        "name": "Basic Grooming",
        "description": "Perawatan dasar yang bikin pawfriends bersih, wangi, dan nyaman lagi. Cocok untuk rutin supaya tetap fresh dan sehat.",
        "service_type": {
          "_id": "69a22d75a9d735a33014cc8b",
          "title": "Grooming"
        },
        "price": 89000,
        "duration": 60,
        "addons": [
          {
            "_id": "69ace8ab7fbc3acb5e61f94d",
            "code": "SVC-0002",
            "name": "3 Spots Detangling",
            "price": 35000,
            "duration": 15
          }
        ]
      },
      "pet_id": "699a6285a99f14a4be787c77",
      "store_id": "507f1f77bcf86cd799439014",
      "store": {
        "_id": "507f1f77bcf86cd799439014",
        "name": "Pawship.id"
      },
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
  "booking": {
    "_id": "69acf9f3ec21849a308137c5",
    "service_type": "grooming",
    "pet_snapshot": {
      "_id": "699a6285a99f14a4be787c77",
      "name": "Pet 1",
      "member_type": {
        "_id": "699456cf429638a275fb0456",
        "name": "Vip - In Store"
      },
      "pet_type": {
        "_id": "698bf0d362f5760ac021c595",
        "name": "Cat"
      },
      "size": {
        "_id": "698bf0e462f5760ac021c597",
        "name": "Small"
      },
      "hair": {
        "_id": "69a0fe38dee77f169eb3259b",
        "name": "Long Hair"
      },
      "breed": {
        "_id": "698da2bb19b8a1bbac7aabb6",
        "name": "Pom"
      }
    },
    "service_snapshot": {
      "_id": "69a45774ecf65d9a74d53fe6",
      "code": "SVC-0001",
      "name": "Basic Grooming",
      "description": "Perawatan dasar yang bikin pawfriends bersih, wangi, dan nyaman lagi. Cocok untuk rutin supaya tetap fresh dan sehat.",
      "service_type": {
        "_id": "69a22d75a9d735a33014cc8b",
        "title": "Grooming"
      },
      "price": 89000,
      "duration": 60,
      "addons": [
        {
          "_id": "69ace8ab7fbc3acb5e61f94d",
          "code": "SVC-0002",
          "name": "3 Spots Detangling",
          "price": 35000,
          "duration": 15
        }
      ]
    },
    "date": "2026-03-08T00:00:00.000Z",
    "time_range": "09.00 - 12.00",
    "type": "in store",
    "booking_status": "waitlist",
    "status_logs": [
      {
        "status": "waitlist",
        "timestamp": "2026-03-08T04:24:19.117Z",
        "note": "Booking is waitlisted (capacity exceeded) - created by Jhon (admin)"
      }
    ],
    "travel_fee": 0,
    "sub_total_service": 124000,
    "total_price": 124000,
    "discount_ids": [],
    "note": "hewan takut suara bising",
    "isDeleted": false,
    "deletedAt": null,
    "sessions": [
      {
        "type": "bathing",
        "status": "not started",
        "started_at": null,
        "finished_at": null,
        "notes": null,
        "internal_note": null,
        "media": [],
        "order": 0,
        "groomer_detail": {
          "_id": "699a5d240d322c3d4e81dfbd",
          "username": "groomer_andi",
          "email": "andi@pawship.id",
          "phone_number": "081200000001"
        }
      }
    ],
    "media": [
      {
        "type": "image",
        "secure_url": "https://res.cloudinary.com/example/image/upload/v1/pawship-grooming/bookings/IMG_001.jpg",
        "public_id": "pawship-grooming/bookings/IMG_001",
        "note": "Before grooming photo",
        "created_by": {
          "user_id": "699a5d240d322c3d4e81dfbd",
          "name_snapshot": "groomer_andi"
        },
        "uploaded_at": "2026-03-08T05:00:00.000Z"
      }
    ],
    "createdAt": "2026-03-08T04:24:19.137Z",
    "updatedAt": "2026-03-08T04:24:19.137Z",
    "customer": {
      "_id": "699a5d240d322c3d4e81dfbc",
      "username": "Cantika",
      "email": "cantika@gmail.com",
      "phone_number": "081324765890"
    },
    "store": {
      "_id": "698be0cd80c319b74fe2f073",
      "name": "Pawship.id"
    }
  }
}
```

> **Note:** `sessions[].groomer_detail` berisi data User groomer yang di-assign ke sesi tertentu. Field `groomer_id` (raw ObjectId) tidak akan muncul di response.
>
> **Note:** `media[]` adalah array of media (photos/videos) yang di-upload untuk keseluruhan booking. Berbeda dengan session-level media yang ada di masa lalu, semua media sekarang di-store di level booking untuk kemudahan manajemen. Media dapat di-upload kapan saja selama booking aktif.

**Error Responses:**

- **404 Not Found:** Booking not found

---

### 2. Get Booking Preview with Benefits

**Endpoint:** `POST /bookings/preview`

**Headers:** `Authorization: Bearer {access_token}` (required)

**Description:** Calculate booking price with benefit options and pricing breakdown. Shows available membership benefits that can be applied to reduce the final price. Optionally, include `pick_up: true` together with `store_id` and `customer_id` to also retrieve the matched pickup zone and travel fee for the customer's saved address.

**Request Body:**

```json
{
  "pet_id": "MongoDB ObjectId (required)",
  "service_id": "MongoDB ObjectId (required)",
  "addon_ids": ["MongoDB ObjectId (optional)"],
  "date": "Date (required)",
  "time_range": "string (optional)",
  "pick_up": "boolean (optional, default: false)",
  "store_id": "MongoDB ObjectId (required when pick_up is true)",
  "customer_id": "MongoDB ObjectId (required when pick_up is true)"
}
```

**Success Response (200) — without `pick_up`:**

```json
{
  "message": "Booking preview calculated successfully",
  "pet_id": "699a6285a99f14a4be787c77",
  "pet_name": "Fluffy",
  "service_id": "69a45774ecf65d9a74d53fe6",
  "service_name": "Basic Grooming",
  "pricing": {
    "original_service_price": 350000,
    "addon_prices": [
      {
        "_id": "69b10c52a58f123456789abc",
        "name": "Extra Nail Trim",
        "price": 50000
      }
    ],
    "subtotal_before_benefits": 400000,
    "has_active_membership": true,
    "available_benefits": [
      {
        "_id": "607f1f77bcf86cd799439011",
        "applies_to": "service",
        "service_id": "69a45774ecf65d9a74d53fe6",
        "type": "discount",
        "period": "monthly",
        "value": 10,
        "limit": 5,
        "used": 2,
        "remaining": 3,
        "can_apply": true,
        "period_reset_date": "2026-03-21T00:00:00.000Z",
        "next_reset_date": "2026-04-01T00:00:00.000Z",
        "amount_discount": 35000,
        "description": "Discount: 10% (Monthly) - 3/5 remaining"
      },
      {
        "_id": "607f1f77bcf86cd799439013",
        "applies_to": "addon",
        "service_id": "69b10c52a58f123456789abc",
        "type": "discount",
        "period": "monthly",
        "value": 20,
        "limit": 3,
        "used": 0,
        "remaining": 3,
        "can_apply": true,
        "period_reset_date": null,
        "next_reset_date": "2026-04-01T00:00:00.000Z",
        "amount_discount": 10000,
        "description": "Discount: 20% (Monthly) - 3/3 remaining"
      }
    ],
    "estimated_total_discount": 45000,
    "estimated_final_price": 355000
  },
  "pricing_breakdown": {
    "service": {
      "name": "Basic Grooming",
      "price": 350000
    },
    "addons": [
      {
        "_id": "69b10c52a58f123456789abc",
        "name": "Extra Nail Trim",
        "price": 50000
      }
    ],
    "subtotal": 400000,
    "travel_fee": 0,
    "grand_total": 400000,
    "discount": 45000,
    "final": 355000
  }
}
```

**Success Response (200) — with `pick_up: true`:**

Same shape as above, but `available_benefits` also includes benefits with `applies_to: "pickup"`, `pricing_breakdown.travel_fee` is set from the matched zone, and `pick_up` is appended at the root:

```json
{
  "message": "Booking preview calculated successfully",
  "pet_id": "699a6285a99f14a4be787c77",
  "pet_name": "Fluffy",
  "service_id": "69a45774ecf65d9a74d53fe6",
  "service_name": "Basic Grooming",
  "pricing": {
    "original_service_price": 350000,
    "addon_prices": [],
    "subtotal_before_benefits": 350000,
    "has_active_membership": true,
    "available_benefits": [
      {
        "_id": "607f1f77bcf86cd799439011",
        "applies_to": "service",
        "service_id": "69a45774ecf65d9a74d53fe6",
        "type": "discount",
        "period": "monthly",
        "value": 10,
        "limit": 5,
        "used": 2,
        "remaining": 3,
        "can_apply": true,
        "amount_discount": 35000,
        "description": "Discount: 10% (Monthly) - 3/5 remaining"
      },
      {
        "_id": "607f1f77bcf86cd799439014",
        "applies_to": "pickup",
        "service_id": null,
        "type": "discount",
        "period": "unlimited",
        "value": 100,
        "limit": null,
        "used": 0,
        "remaining": null,
        "can_apply": true,
        "amount_discount": 25000,
        "description": "Discount: 100% (Unlimited) - ∞/∞ remaining"
      }
    ],
    "estimated_total_discount": 60000,
    "estimated_final_price": 315000
  },
  "pricing_breakdown": {
    "service": {
      "name": "Basic Grooming",
      "price": 350000
    },
    "addons": [],
    "subtotal": 350000,
    "travel_fee": 25000,
    "grand_total": 375000,
    "discount": 60000,
    "final": 315000
  },
  "pick_up": {
    "is_available": true,
    "zone": {
      "area_name": "Zone A",
      "min_radius_km": 0,
      "max_radius_km": 5,
      "travel_time_minutes": 30,
      "travel_fee": 25000
    },
    "distance_km": 3.47
  }
}
```

**Error Responses:**

- **404 Not Found:** Pet or service not found
- **404 Not Found:** Store or customer not found (when `pick_up: true`)
- **400 Bad Request:** Invalid pet_id or service_id format
- **400 Bad Request:** `store_id` is required when `pick_up` is true
- **400 Bad Request:** `customer_id` is required when `pick_up` is true
- **400 Bad Request:** Pick-up service is not available for this store
- **400 Bad Request:** Customer address with latitude and longitude is required for pick-up
- **400 Bad Request:** Customer location is outside all delivery zones (includes distance in km)

**Notes:**

- `available_benefits` is filtered by request context:
  - `applies_to: "service"` — only included when the benefit's `service_id` matches the requested `service_id`
  - `applies_to: "addon"` — only included when `addon_ids` are provided **and** the benefit's `service_id` matches one of them; omitted entirely when no addons are sent
  - `applies_to: "pickup"` — only included when `pick_up: true` is sent
- `amount_discount` is calculated against the relevant price base: service price for `service` benefits, that addon's price for `addon` benefits, and `travel_fee` for `pickup` benefits.
- `pricing_breakdown.travel_fee` is `0` when `pick_up` is not requested; set to the matched zone's fee otherwise.
- `pricing_breakdown.grand_total` = `subtotal` + `travel_fee`.
- `pricing_breakdown.final` = `grand_total` − `discount`.
- When `pick_up: true`, the backend loads the customer's saved `profile.address.latitude` / `profile.address.longitude` — the customer must have their address coordinates set.
- The `travel_fee` inside `pick_up.zone` is the authoritative fee to pass as `travel_fee` when creating the booking (`POST /bookings` or `POST /bookings/public`). Do **not** compute it on the client side.
- The `pick_up` block is only present in the response when `pick_up: true` was sent in the request.

---

### 3. Create Booking

**Endpoint:** `POST /bookings`

**Headers:** `Authorization: Bearer {access_token}` (required)

**Request Body:**

```json
{
  "service_type_id": "MongoDB ObjectId (required)",
  "customer_id": "MongoDB ObjectId (required)",
  "pet_id": "MongoDB ObjectId (required)",
  "store_id": "MongoDB ObjectId (required)",
  "service_id": "MongoDB ObjectId (required)",
  "date": "2026-03-08 (required, format: YYYY-MM-DD)",
  "time_range": "09.00 - 12.00 (required)",
  "pick_up": "boolean (optional, default: false)",
  "service_addon_ids": ["MongoDB ObjectId (optional)"],
  "discount_ids": ["MongoDB ObjectId (optional)"],
  "selected_benefit_ids": [
    "MongoDB ObjectId (optional, benefit IDs from pet membership to apply to booking)"
  ],
  "sessions": [
    {
      "type": "string (required, e.g. 'bathing', 'styling')",
      "groomer_id": "MongoDB ObjectId (required)",
      "order": "number (optional, default: index position)"
    }
  ],
  "referal_code": "string (optional)",
  "note": "string (optional)",
  "payment_method": "string (optional)"
}
```

**Example Request Body:**

```json
{
  "service_type_id": "69a22d75a9d735a33014cc8b",
  "customer_id": "699a5d240d322c3d4e81dfbc",
  "pet_id": "699a6285a99f14a4be787c77",
  "date": "2026-03-08",
  "time_range": "09.00 - 12.00",
  "store_id": "698be0cd80c319b74fe2f073",
  "service_id": "69a45774ecf65d9a74d53fe6",
  "pick_up": false,
  "service_addon_ids": ["69ace8ab7fbc3acb5e61f94d"],
  "note": "hewan takut suara bising"
}
```

> `pet_snapshot` dan `service_snapshot` di-generate otomatis oleh server berdasarkan `pet_id` dan `service_id`.
> `sub_total_service` dan `total_price` dihitung otomatis oleh server.
> **IMPORTANT:** Field `sessions` in the request body is **ignored** for all booking types (admin, customer, guest). Sessions are **automatically generated** on the server-side based on the `service.sessions` array defined when the service was created. For example, if a service defines `sessions: ["bathing", "styling", "nail_trimming"]`, all bookings of that service will automatically have these three sessions created. If a service has no sessions defined, the booking will have an empty sessions array.
> When `pick_up` is `true`, the system validates that:
>
> 1. Customer has latitude/longitude in their profile address
> 2. The store has `is_pick_up_available: true`
> 3. The service has `is_pick_up_available: true`
> 4. Customer location falls within one of the store's delivery zones
>    If validation fails, a `BadRequestException` is returned with a descriptive error message.

**Field Explanations: Membership Benefits**

**`selected_benefit_ids`** (Optional)

- **Purpose:** Array of benefit IDs from the pet's active membership that customer wants to apply to this booking
- **When to use:**
  - Customer has an active membership with benefits
  - Customer wants to use/redeem membership benefits to reduce the booking cost
  - Call `POST /bookings/preview` first to see available benefits and calculated discounts
- **How it works:**
  1. Get the benefit IDs from the returned `available_benefits[]._id` in the preview response
  2. Select which benefits to apply (e.g., a 10% discount benefit and a free service benefit)
  3. Include the benefit IDs in the `selected_benefit_ids` array when creating the booking
  4. System automatically validates and applies selected benefits
- **Example:**
  ```json
  "selected_benefit_ids": [
    "607f1f77bcf86cd799439011",
    "607f1f77bcf86cd799439012"
  ]
  ```

**`applied_benefits`** (Read-only, returned in response)

- **Purpose:** Audit trail showing which benefits were actually applied to the booking and how much discount/credit was given
- **Appears in:** GET `/bookings/:id` response (not in POST request)
- **Contains:**
  - `benefit_id` — Reference to the benefit that was applied
  - `benefit_type` — Type of benefit: `discount` (percentage), `free_service` (fixed amount), `quota` (session count)
  - `benefit_period` — How often the benefit resets: `weekly`, `monthly`, or `unlimited`
  - `benefit_value` — The benefit's base value (10 for 10% discount, 50000 for fixed 50k discount, etc.)
  - `amount_deducted` — Actual amount deducted from the booking total price
  - `applied_at` — Timestamp when the benefit was applied
- **Example:**
  ```json
  "applied_benefits": [
    {
      "benefit_id": "607f1f77bcf86cd799439011",
      "benefit_type": "discount",
      "benefit_period": "monthly",
      "benefit_value": 10,
      "amount_deducted": 40000,
      "applied_at": "2026-03-19T14:30:00.000Z"
    },
    {
      "benefit_id": "607f1f77bcf86cd799439012",
      "benefit_type": "free_service",
      "benefit_period": "unlimited",
      "benefit_value": 50000,
      "amount_deducted": 50000,
      "applied_at": "2026-03-19T14:30:00.000Z"
    }
  ]
  ```

**Price Fields** (Understanding the pricing with benefits)

- `original_total_price` — Total price BEFORE benefits are applied (service + addons + travel fee)
- `final_total_price` — Total price AFTER selected benefits are applied (original_total_price - total_discount)
- `total_price` — Deprecated field, always equals `final_total_price` for backward compatibility

**Success Response (200):**

Booking creation is asynchronous - the endpoint returns immediately with status:

```json
{
  "message": "Create booking successfully"
}
```

> **Note:** To view the actual applied benefits in detail, query the booking via `GET /bookings/:id` - the response will include the complete `applied_benefits[]` array with all benefit details and amounts deducted.

**Example: Viewing Applied Benefits in GET Response**

When you fetch the created booking with `GET /bookings/:id`, the response includes:

```json
{
  "message": "Fetch booking successfully",
  "booking": {
    "_id": "69acf9f3ec21849a308137c5",
    "original_total_price": 400000,
    "final_total_price": 310000,
    "total_price": 310000,
    "applied_benefits": [
      {
        "benefit_id": "607f1f77bcf86cd799439011",
        "benefit_type": "discount",
        "benefit_period": "monthly",
        "benefit_value": 10,
        "amount_deducted": 40000,
        "applied_at": "2026-03-19T14:30:00.000Z"
      },
      {
        "benefit_id": "607f1f77bcf86cd799439012",
        "benefit_type": "free_service",
        "benefit_period": "unlimited",
        "benefit_value": 50000,
        "amount_deducted": 50000,
        "applied_at": "2026-03-19T14:30:00.000Z"
      }
    ]
  }
}
```

**Booking Status After Creation:**

The actual booking status depends on capacity availability:

- **Status: `REQUESTED`** — Booking accepted and scheduled
  - Booking fits within store's daily capacity + overbooking limit
  - Can include a note if overbooking occurred: "overbooked by X minutes"

- **Status: `WAITLIST`** — Booking accepted but placed in waitlist
  - Store has exceeded its overbooking limit for the requested date/time
  - Booking is created but flagged for manual review
  - Status log note: "Booking is waitlisted (capacity exceeded)"
  - Customer should be notified and may need to reschedule

**Note:** To check the actual booking status created, query the booking details endpoint `GET /bookings/:id`

**Business Logic:**

- System automatically creates `pet_snapshot` from pet data
- System automatically creates `service_snapshot` — stores service code, name, description, service type, and the exact-matched price entry based on the pet's pet type, size, and hair (all three must match)
- System calculates pricing based on service and pet size (including addons)
- **Benefit Application (if `selected_benefit_ids` provided):**
  - Validates each selected benefit exists in the pet's active membership
  - Checks if benefit is still applicable (within period, usage count available)
  - Calculates discount based on benefit type:
    - `discount` type: applies percentage discount to subtotal
    - `free_service` type: applies fixed amount discount
  - Auto-deducts benefit usage upon successful booking creation
  - Stores applied benefits as audit trail in `applied_benefits[]` with:
    - benefit_id, benefit_type, benefit_period, benefit_value, amount_deducted, applied_at
  - Updates `original_total_price` (before benefits) and `final_total_price` (after benefits)
  - For backward compatibility, `total_price` is set to `final_total_price`
- Creates initial status log entry
- **Capacity Management & Status Assignment:**
  - Validates against store's daily capacity (checks StoreDailyCapacity override or uses default)
  - Atomically increments StoreDailyUsage for the date
  - **If capacity exceeded beyond overbooking_limit_minutes:**
    - Creates booking with `WAITLIST` status (capacity has been exceeded beyond acceptable limit)
    - Rolls back the capacity usage increment
    - Status log note: "Booking is waitlisted (capacity exceeded)"
  - **If within overbooking limit:**
    - Creates booking with `REQUESTED` status
    - If usage > total capacity (but within overbooking limit): status log includes "overbooked by X minutes" note
  - Uses MongoDB transactions to ensure data consistency
- **Pick-up Service:**
  - When `pick_up: true`, system validates customer location and store/service capabilities
  - Calculates distance from customer's home location to store using Haversine formula
  - Matches customer location against store's configured delivery zones
  - Stores matched zone info in `pick_up_zone` field with area name, radius, travel time, and travel fee
  - If customer location is outside all zones, booking fails with error: "Customer location is outside all delivery zones"
- All operations are atomic - if any step fails, entire transaction is rolled back

**Error Responses:**

- **404 Not Found:** Harga tidak ditemukan untuk kombinasi jenis hewan, ukuran, dan jenis bulu yang dipilih

```json
{
  "statusCode": 404,
  "message": "Harga tidak ditemukan untuk hewan dengan jenis, ukuran, dan jenis bulu yang dipilih",
  "error": "Not Found"
}
```

- **404 Not Found:** Harga addon tidak ditemukan

```json
{
  "statusCode": 404,
  "message": "Harga addon tidak ditemukan untuk hewan dengan jenis, ukuran, dan jenis bulu yang dipilih",
  "error": "Not Found"
}
```

- **400 Bad Request:** Pick-up validation failed - customer has no location

```json
{
  "statusCode": 400,
  "message": "Customer profile must have location (latitude/longitude) to use pick-up service",
  "error": "Bad Request"
}
```

- **400 Bad Request:** Pick-up validation failed - store doesn't support pick-up

```json
{
  "statusCode": 400,
  "message": "This store does not support pick-up service",
  "error": "Bad Request"
}
```

- **400 Bad Request:** Pick-up validation failed - service doesn't support pick-up

```json
{
  "statusCode": 400,
  "message": "This service does not support pick-up",
  "error": "Bad Request"
}
```

- **400 Bad Request:** Pick-up validation failed - customer location outside delivery zones

```json
{
  "statusCode": 400,
  "message": "Customer location is outside all delivery zones",
  "error": "Bad Request"
}
```

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
- Status logs are automatically appended when `booking_status` changes
- Use specific endpoints for status updates

**Error Responses:**

- **404 Not Found:** Harga tidak ditemukan untuk kombinasi jenis hewan, ukuran, dan jenis bulu yang dipilih

```json
{
  "statusCode": 404,
  "message": "Harga tidak ditemukan untuk hewan dengan jenis, ukuran, dan jenis bulu yang dipilih",
  "error": "Not Found"
}
```

- **404 Not Found:** Harga addon tidak ditemukan

```json
{
  "statusCode": 404,
  "message": "Harga addon tidak ditemukan untuk hewan dengan jenis, ukuran, dan jenis bulu yang dipilih",
  "error": "Not Found"
}
```

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

### 6. Create Session for Booking

**Endpoint:** `POST /bookings/:id/session`

**Authentication:** Required (JWT)

**Parameters:**

- `id` (path): Booking MongoDB ObjectId

**Request Body:**

```json
{
  "type": "string (required, e.g., 'bathing', 'styling', 'nail_trimming')",
  "groomer_id": "MongoDB ObjectId (required)",
  "order": "number (optional, default: appended to end)"
}
```

**Success Response (200):**

```json
{
  "message": "Session created successfully"
}
```

**Business Logic:**

- Creates a new session and pushes it into `booking.sessions`
- `order` defaults to current sessions length (appended to end) if not provided
- Session status starts as `NOT_STARTED`

**Error Responses:**

- **404 Not Found:** Booking not found

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

## Grooming Sessions

Grooming sessions track individual grooming tasks within a booking. Sessions can be created by admin at booking creation time (via `sessions[]` in `POST /bookings`) or individually via `POST /bookings/:id/session`.

### Session Lifecycle

- **Creation**: Created at booking time by admin (with `sessions[]` in request), or individually via `POST /bookings/:id/session`
- **States**: NOT_STARTED → IN_PROGRESS → FINISHED

### 1. Create Session

**Endpoint:** `POST /bookings/:bookingId/session`

**Authentication:** Required (JWT)

**Parameters:**

- `bookingId` (path): Booking MongoDB ObjectId

**Request Body:**

```json
{
  "type": "string (required, e.g., 'bathing', 'styling', 'nail_trimming')",
  "groomer_id": "MongoDB ObjectId (required)",
  "order": "number (optional, default: appended to end)"
}
```

**Success Response (200):**

```json
{
  "message": "Session created successfully"
}
```

**Business Logic:**

- Creates a new session and pushes it into `booking.sessions`
- `order` defaults to current sessions length (appended to end) if not provided
- Session status starts as `NOT_STARTED`

**Error Responses:**

- **404 Not Found:** Booking not found

---

### 2. Update Session

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

### 3. Start Session

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

### 4. Finish Session

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

### 5. Delete Session

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

### 6. Upload Session Media

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

## Promotions

### 1. Create Promotion

**Endpoint:** `POST /promotions`
**Description:** Create a new promotion.
**Authentication:** Required (Bearer Token)

**Headers:**
| Key | Value |
|-----|-------|
| Authorization | Bearer {access_token} |
| Content-Type | application/json |

**Request Body:**

```json
{
  "code": "PROMO2026",
  "name": "New Member Discount",
  "description": "10% off for new members",
  "promo_type": "membership_benefit",
  "claim_type": "once_per_booking",
  "benefit": {
    "type": "discount",
    "discount_type": "percent",
    "value": 10
  },
  "eligibility": {
    "is_only_for_membership": true,
    "membership_ids": ["60d21b4667d0d8992e610c85"],
    "first_time_user": false
  },
  "validity": {
    "start_at": "2026-03-01T00:00:00.000Z",
    "end_at": "2026-12-31T23:59:59.000Z"
  },
  "stackable": false,
  "priority": 1,
  "is_active": true
}
```

**Field Notes:**

- `benefit.type`: `"discount"` or `"free_service"`
- If `benefit.type` is `"discount"`: `discount_type` (`"percent"` or `"fixed"`) and `value` are **required**
- If `benefit.type` is `"free_service"`: `service_id` (MongoDB ObjectId) is **required**
- `promo_type`: `"membership_benefit"` or `"general_promo"`
- `claim_type`: `"once_per_membership"`, `"every_add_on"`, or `"once_per_booking"`
- `validity.end_at`: optional — if `null`, promotion has no expiry
- `eligibility`: **required**
- `eligibility.is_only_for_membership`: **required** — `true` = hanya untuk member, `false` = bisa dipakai semua user
- `eligibility.membership_ids`: optional — membatasi promo ke membership tertentu
- `eligibility.first_time_user`: optional — default `false`
- `stackable`: default `false`
- `priority`: default `0` — lower number = higher priority

**Success Response (201):**

```json
{
  "message": "Create promotion successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Validation failed or `code` already exists
- **401 Unauthorized:** Missing or invalid token

---

### 2. Get All Promotions

**Endpoint:** `GET /promotions`
**Description:** Retrieve a paginated list of promotions with optional filters.
**Authentication:** Required (Bearer Token)

**Headers:**
| Key | Value |
|-----|-------|
| Authorization | Bearer {access_token} |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 10) |
| search | string | No | Search by name or code (case-insensitive) |
| is_active | boolean | No | Filter by active status |
| promo_type | string | No | `membership_benefit` or `general_promo` |
| claim_type | string | No | `once_per_membership`, `every_add_on`, or `once_per_booking` |

**Success Response (200):**

```json
{
  "message": "Fetch promotions successfully",
  "promotions": [
    {
      "_id": "60d21b4667d0d8992e610c85",
      "code": "PROMO2026",
      "name": "New Member Discount",
      "description": "10% off for new members",
      "promo_type": "membership_benefit",
      "claim_type": "once_per_booking",
      "benefit": {
        "type": "discount",
        "discount_type": "percent",
        "value": 10,
        "service_id": null
      },
      "eligibility": {
        "is_only_for_membership": true,
        "membership_ids": ["60d21b4667d0d8992e610c85"],
        "memberships": [
          { "_id": "60d21b4667d0d8992e610c85", "name": "Gold Member" }
        ],
        "first_time_user": false
      },
      "validity": {
        "start_at": "2026-03-01T00:00:00.000Z",
        "end_at": "2026-12-31T23:59:59.000Z"
      },
      "stackable": false,
      "priority": 1,
      "is_active": true,
      "isDeleted": false,
      "createdAt": "2026-03-09T10:00:00.000Z",
      "updatedAt": "2026-03-09T10:00:00.000Z"
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

**Error Responses:**

- **401 Unauthorized:** Missing or invalid token

---

### 3. Get Promotion By ID

**Endpoint:** `GET /promotions/:id`
**Description:** Retrieve a single promotion by its ID.
**Authentication:** Required (Bearer Token)

**Headers:**
| Key | Value |
|-----|-------|
| Authorization | Bearer {access_token} |

**Path Parameters:** `:id` — MongoDB ObjectId of the promotion

**Success Response (200):**

```json
{
  "message": "Fetch promotion successfully",
  "promotion": {
    "_id": "60d21b4667d0d8992e610c85",
    "code": "FREE2026",
    "name": "Free Bath Service",
    "description": "Free bath for premium members",
    "promo_type": "membership_benefit",
    "claim_type": "once_per_membership",
    "benefit": {
      "type": "free_service",
      "discount_type": null,
      "value": null,
      "service_id": "60d21b4667d0d8992e610c86",
      "service": { "_id": "60d21b4667d0d8992e610c86", "name": "Bath Service" }
    },
    "eligibility": {
      "is_only_for_membership": true,
      "membership_ids": ["60d21b4667d0d8992e610c85"],
      "memberships": [
        { "_id": "60d21b4667d0d8992e610c85", "name": "Platinum Member" }
      ],
      "first_time_user": false
    },
    "validity": {
      "start_at": "2026-03-01T00:00:00.000Z",
      "end_at": null
    },
    "stackable": false,
    "priority": 0,
    "is_active": true,
    "isDeleted": false,
    "createdAt": "2026-03-09T10:00:00.000Z",
    "updatedAt": "2026-03-09T10:00:00.000Z"
  }
}
```

**Error Responses:**

- **401 Unauthorized:** Missing or invalid token
- **404 Not Found:** Promotion not found or already deleted

---

### 4. Update Promotion

**Endpoint:** `PUT /promotions/:id`
**Description:** Update an existing promotion. All fields are optional.
**Authentication:** Required (Bearer Token)

**Headers:**
| Key | Value |
|-----|-------|
| Authorization | Bearer {access_token} |
| Content-Type | application/json |

**Path Parameters:** `:id` — MongoDB ObjectId of the promotion

**Request Body:** _(all fields optional)_

```json
{
  "name": "Updated Name",
  "is_active": false,
  "priority": 2,
  "validity": {
    "start_at": "2026-04-01T00:00:00.000Z",
    "end_at": "2026-12-31T23:59:59.000Z"
  }
}
```

**Success Response (200):**

```json
{
  "message": "Update promotion successfully"
}
```

**Error Responses:**

- **400 Bad Request:** Validation failed or `code` already exists on another promotion
- **401 Unauthorized:** Missing or invalid token
- **404 Not Found:** Promotion not found or already deleted

---

### 5. Delete Promotion (Soft Delete)

**Endpoint:** `DELETE /promotions/:id`
**Description:** Soft-delete a promotion (sets `isDeleted: true`, records `deletedAt`). The record remains in the database.
**Authentication:** Required (Bearer Token)

**Headers:**
| Key | Value |
|-----|-------|
| Authorization | Bearer {access_token} |

**Path Parameters:** `:id` — MongoDB ObjectId of the promotion

**Success Response (200):**

```json
{
  "message": "Delete promotion successfully"
}
```

**Error Responses:**

- **401 Unauthorized:** Missing or invalid token
- **404 Not Found:** Promotion not found or already deleted

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
WAITLIST = 'waitlist';
DRIVER_ON_THE_WAY = 'driver on the way';
GROOMER_ON_THE_WAY = 'groomer on the way';
ARRIVED = 'arrived';
IN_PROGRESS = 'in progress';
COMPLETED = 'completed';
RESCHEDULED = 'rescheduled';
CANCELLED = 'cancelled';
```

**Status Descriptions:**

- `REQUESTED` — Booking created and pending confirmation
- `CONFIRMED` — Booking confirmed by admin/system
- `WAITLIST` — Booking in waitlist due to capacity exceeded
- `DRIVER_ON_THE_WAY` — Driver is on the way to pick up the pet (pick-up service)
- `GROOMER_ON_THE_WAY` — Groomer is on the way to customer's location (home service)
- `ARRIVED` — Customer/groomer/driver has arrived at location
- `IN_PROGRESS` — Grooming service in progress
- `COMPLETED` — Service completed successfully
- `RESCHEDULED` — Booking rescheduled to different date/time
- `CANCELLED` — Booking cancelled

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

**Last Updated:** March 9, 2026
**API Version:** 1.0.0
