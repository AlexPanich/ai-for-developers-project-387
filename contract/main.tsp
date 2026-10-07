import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

@service(#{ title: "Календарь звонков API" })
@route("/api")
namespace CalendarApi;

model EventType {
  @format("uuid")
  id: string;

  name: string;

  description: string;

  @minValue(1)
  @maxValue(540)
  durationMinutes: int32;
}

model EventTypeCreate {
  name: string;

  description: string;

  @minValue(1)
  @maxValue(540)
  durationMinutes: int32;
}

model EventTypeRef {
  @format("uuid")
  id: string;

  name: string;
}

model EventTypeList {
  eventTypes: EventType[];
}

model Booking {
  @format("uuid")
  id: string;

  @format("uuid")
  eventTypeId: string;

  startAt: offsetDateTime;

  guestName: string;

  @format("email")
  guestEmail: string;
}

model BookingCreate {
  @format("uuid")
  eventTypeId: string;

  startAt: offsetDateTime;

  guestName: string;

  @format("email")
  guestEmail: string;
}

model BookingListItem {
  eventType: EventTypeRef;

  startAt: offsetDateTime;
}

model BookingList {
  bookings: BookingListItem[];
}

model Slot {
  startAt: offsetDateTime;

  available: boolean;
}

model Availability {
  slots: Slot[];
}

@error
model ErrorBody {
  error: {
    code: "VALIDATION_ERROR" | "INVALID_ADMIN_PASSWORD" | "EVENT_TYPE_NOT_FOUND" | "SLOT_TAKEN";
    message: string;
  };
}

@error
model BadRequestError {
  @statusCode
  statusCode: 400;

  @body
  body: ErrorBody;
}

@error
model UnauthorizedError {
  @statusCode
  statusCode: 401;

  @body
  body: ErrorBody;
}

@error
model NotFoundError {
  @statusCode
  statusCode: 404;

  @body
  body: ErrorBody;
}

@error
model ConflictError {
  @statusCode
  statusCode: 409;

  @body
  body: ErrorBody;
}

@route("/event-types")
interface EventTypes {
  @get
  list(): EventTypeList;

  @get
  @route("{id}")
  get(@path id: string): EventType | NotFoundError;

  @get
  @route("{id}/availability")
  availability(@path id: string): Availability | NotFoundError;

  @post
  create(
    @header("X-Admin-Password") password: string,
    @body body: EventTypeCreate,
  ): {
    @statusCode
    statusCode: 201;

    @body
    body: EventType;
  } | BadRequestError | UnauthorizedError;
}

@route("/bookings")
interface Bookings {
  @post
  create(@body body: BookingCreate): {
    @statusCode
    statusCode: 201;

    @body
    body: Booking;
  } | BadRequestError | NotFoundError | ConflictError;

  @get
  list(): BookingList;
}
