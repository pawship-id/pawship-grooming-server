---
applyTo: "src/**/dto/**/*.ts"
---

# DTO Conventions — pawship-grooming-server

## File Naming

| Purpose | File name pattern |
|---------|-------------------|
| Create payload | `create-<domain>.dto.ts` |
| Update payload | `update-<domain>.dto.ts` |
| Query params | `get-<domain>-query.dto.ts` |
| Shared enums/constants | `<domain>.dto.ts` |

## Update DTOs — Always Use PartialType

Never duplicate fields from a create DTO. Always extend with `PartialType`:

```ts
// ✅ correct
import { PartialType } from '@nestjs/mapped-types';
import { CreateBookingDto } from './create-booking.dto';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {}
```

## Validators — Always Include Custom Messages

Every `class-validator` decorator must include a `message` option. No silent failures.

```ts
// ✅ correct
@IsNotEmpty({ message: 'Customer ID is required' })
@IsMongoId({ message: 'Customer ID must be a valid MongoDB ID' })
customer_id: string;

// ❌ no message
@IsNotEmpty()
@IsMongoId()
customer_id: string;
```

## MongoDB ID Fields

```ts
@IsNotEmpty({ message: 'Pet ID is required' })
@IsMongoId({ message: 'Pet ID must be a valid MongoDB ID' })
pet_id: string;
```

## Nested DTOs

```ts
@ValidateNested()
@Type(() => PetSnapshotDto)
@IsNotEmpty({ message: 'Pet snapshot is required' })
pet_snapshot: PetSnapshotDto;
```

Always import `@Type` from `class-transformer` alongside `@ValidateNested` from `class-validator`.

## Optional Fields

```ts
@IsOptional()
@IsString({ message: 'Notes must be a string' })
notes?: string;
```

Optional fields use `?` and must have `@IsOptional()` before other validators.

## Boolean Query Params

```ts
@IsOptional()
@Transform(({ value }) => value === 'true')
@IsBoolean({ message: 'is_active must be a boolean' })
is_active?: boolean;
```

## Numeric Query Params

```ts
@IsOptional()
@Type(() => Number)
@IsInt({ message: 'page must be an integer' })
@Min(1, { message: 'page must be at least 1' })
page?: number;
```

Then reference in the entity and service from the DTO file.

## Array Fields

```ts
@IsArray({ message: 'addon_ids must be an array' })
@IsMongoId({ each: true, message: 'Each addon ID must be a valid MongoDB ID' })
@ArrayNotEmpty({ message: 'addon_ids must not be empty' })
addon_ids: string[];
```

## Global ValidationPipe reminder

The global pipe is configured with `{ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }`. Do **not** add a local `ValidationPipe` to controllers.
