# Copilot Instructions — pawship-grooming-server

NestJS 11 / MongoDB (Mongoose) pet grooming backend. TypeScript throughout.

## Build & Test

```bash
npm install          # install deps
npm run start:dev    # watch mode (dev)
npm run build        # production build → dist/
npm run start:prod   # run dist/main.js
npm run lint         # ESLint + Prettier fix
npm run test         # Jest unit tests
npm run test:e2e     # E2E tests (jest-e2e.json)
npm run test:cov     # coverage report
```

## Architecture

Standard NestJS feature-module pattern. Each domain lives in `src/<domain>/` with:

```
<domain>.module.ts       ← wires providers/imports/exports
<domain>.controller.ts   ← HTTP routes, uses @UseGuards(AuthGuard)
<domain>.service.ts      ← business logic, InjectModel injections
dto/
  create-<domain>.dto.ts
  update-<domain>.dto.ts ← always extends PartialType(CreateDto)
  get-<domain>-query.dto.ts
entities/
  <domain>.entity.ts     ← Mongoose @Schema class
```

`AppModule` registers `ConfigModule` globally, sets up `MongooseModule.forRootAsync`, and applies `LoggerMiddleware` globally.

Global infrastructure in `src/common/`:
- **`AllExceptionsFilter`** — normalizes all errors to `{ statusCode, timestamp, path, message }`; logs 5xx at `error`, 4xx at `warn`
- **`LoggingInterceptor`** — debug-level pre/post handler logging
- **`LoggerMiddleware`** — request/response timing log with status-tiered log level

## Database Conventions

- **MongoDB** via `@nestjs/mongoose`. URI from `MONGODB_URI`, dbName from `MONGODB_DATABASE_NAME`.
- All schemas use `@Schema({ timestamps: true })` (auto `createdAt`/`updatedAt`).
- **Soft delete everywhere**: every entity has `isDeleted: boolean` (default `false`) + `deletedAt: Date | null`. Never hard-delete at DB level; always filter by `{ isDeleted: false }` in queries.
- **`toJSON.transform`** strips internal fields (`id`, `__v`, raw `*_id` FK fields) from all API responses — do not add separate serializers.
- **Virtual fields** for population (not inline `populate`):
  ```ts
  PetSchema.virtual('pet_type', { ref: 'Option', localField: 'pet_type_id', foreignField: '_id', justOne: true });
  ```
- **`Option` collection** is the single lookup table for all categorical data (pet type, breed, size, hair, member type), differentiated by a `category_options` string.
- **Transactions** (`InjectConnection` + `session.startTransaction()`) are used in `BookingService` for capacity management atomicity.

## Auth

- `AuthGuard` applies globally (registered in `AppModule`). Use `@Public()` to bypass it for guest-accessible endpoints.
- JWT payload: `{ _id, email, username, role }`. Access token verified against `JWT_SECRET_KEY`.
- Refresh tokens are bcrypt-hashed before storage in `User.refresh_token`.
- No RBAC guard yet — `role` is on the User entity but not enforced beyond auth.

## DTO & Validation

`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true })` is applied globally.

Conventions:
- Custom error messages on every validator: `@IsNotEmpty({ message: 'field is required' })`
- MongoDB IDs: `@IsMongoId({ message: '...' })`
- Nested DTOs: `@ValidateNested() @Type(() => NestedDto)`
- Boolean query params: `@Transform(({ value }) => value === 'true') @IsBoolean()`
- Numeric query params: `@Type(() => Number) @IsInt() @Min(0)`
- Update DTOs always use `PartialType(CreateDto)` — do not duplicate fields.

## Response Shape

All endpoints return `{ message: string, ...data }`. No shared response DTO class — keep it consistent manually.

## File Uploads / Cloudinary

- Uploads go through `POST /upload-file` (`src/upload-file/`) using `FileInterceptor('image')` (multer in-memory).
- Cloudinary credentials from env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- Helpers in `src/helpers/cloudinary.ts`: `uploadToCloudinary(file, folder)`, `deleteFromCloudinary(publicId)`.
- All uploads land under `pawship-grooming/<folder>/`.

## Domain Overview

Key relationships:
- `User` → `Pet` (via `Pet.customer_id`)
- `Pet` embeds `MembershipItem[]` linked to `Membership`
- `Service` → `ServiceType`; `Service` can self-reference via `addon_ids`
- `Service.prices` = embedded `ServicePrice[]` keyed on pet type + size + hair
- `Store` → `Zone` (delivery zones), `StoreDailyCapacity` (day overrides), `StoreDailyUsage` (consumption tracking)
- `Booking` embeds `pet_snapshot` + `service_snapshot` (denormalized at creation to prevent historical drift)
- `Booking.sessions` = embedded `GroomingSession[]` with `media: SessionMedia[]` (Cloudinary before/after photos)
- Booking status flow: `requested → confirmed → arrived → in_progress → completed | cancelled | rescheduled`

## Environment Variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DATABASE_NAME` | Database name |
| `JWT_SECRET_KEY` | Access token signing & verification |
| `JWT_ACCESS_TOKEN_SECRET` | Access token (if separate from above) |
| `JWT_REFRESH_TOKEN_SECRET` | Refresh token signing |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | Access token TTL |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | Refresh token TTL |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary config |
| `CLOUDINARY_API_KEY` | Cloudinary config |
| `CLOUDINARY_API_SECRET` | Cloudinary config |
| `PORT` | HTTP port (default `3000`) |

## API Documentation

**Every API change requires updating `API_DOCUMENTATION.md`** — endpoints added, modified, or removed; request/response shape changes; auth changes; status code changes.

Format for each endpoint:
- Method & path, description, authentication requirement
- Headers, path/query params, request body (with types and required/optional)
- Success response (status + example JSON)
- Error responses (status + example JSON)
- Notes (if needed)

Also keep the Table of Contents at the top of `API_DOCUMENTATION.md` in sync.

> ⚠️ Do not complete any API change without updating `API_DOCUMENTATION.md`.
