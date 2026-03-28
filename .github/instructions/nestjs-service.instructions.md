---
applyTo: "src/**/*.service.ts"
---

# NestJS Service Conventions — pawship-grooming-server

## Class & File Structure

```ts
@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectConnection() private readonly connection: Connection,
  ) {}
}
```

- Always declare a `private readonly logger = new Logger(<ClassName>.name)` at the top of every service.
- Inject models with `@InjectModel(Entity.name)`, inject connection with `@InjectConnection()` when transactions are needed.

## Soft Delete — Never Hard Delete

Every destructive operation must soft-delete, not `.deleteOne()` / `.findByIdAndDelete()`.

```ts
// ✅ correct
await this.bookingModel.findByIdAndUpdate(id, {
  isDeleted: true,
  deletedAt: new Date(),
});

// ❌ never
await this.bookingModel.findByIdAndDelete(id);
```

Always filter active records with `{ isDeleted: false }`:

```ts
// ✅ correct
const bookings = await this.bookingModel.find({ isDeleted: false });

// ❌ missing filter
const bookings = await this.bookingModel.find({});
```

## Response Shape

All public service methods that return data for a controller must return an object shaped as:

```ts
return { message: 'Booking created successfully', booking };
// or for lists:
return { message: 'Bookings fetched successfully', bookings, total, page };
```

Never return a raw document or array as the sole return value.

## Transactions

Use MongoDB sessions for any write that spans multiple collections or updates capacity:

```ts
const session = await this.connection.startSession();
session.startTransaction();
try {
  // ... all writes pass { session }
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

## Error Handling

- Throw `NotFoundException` for missing documents after a findById lookup.
- Throw `BadRequestException` for domain-rule violations.
- Throw `ConflictException` for duplicate-key / uniqueness violations.
- Do **not** catch-and-swallow errors — let `AllExceptionsFilter` handle normalisation.

```ts
const booking = await this.bookingModel.findOne({ _id: id, isDeleted: false });
if (!booking) throw new NotFoundException('Booking not found');
```

## Population

Use virtual field population via `.populate()`, not manual lookup:

```ts
await this.petModel
  .findOne({ _id: id, isDeleted: false })
  .populate('pet_type')   // virtual defined on PetSchema
  .populate('breed');
```

Do not add new inline `populate` calls without a corresponding virtual defined on the schema.

## Logging

Use the class-level `logger` for significant events:

```ts
this.logger.log(`Booking ${id} status updated to ${status}`);
this.logger.warn(`Booking ${id} not found`);
this.logger.error(`Failed to process booking: ${err.message}`, err.stack);
```

Do not use `console.log` anywhere in services.
