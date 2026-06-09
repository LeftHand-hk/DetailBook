-- Manual creation of Customer table + Booking.customerId FK because
-- prisma db push times out on the AddForeignKey step against the
-- pooled connection (long-running ACCESS EXCLUSIVE lock on Booking).
SET lock_timeout = '8000';

CREATE TABLE IF NOT EXISTS "Customer" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "firstName"    TEXT NOT NULL,
  "lastName"     TEXT,
  "email"        TEXT,
  "phone"        TEXT,
  "notes"        TEXT,
  "vehicleMake"  TEXT,
  "vehicleModel" TEXT,
  "vehicleYear"  TEXT,
  "vehicleColor" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "Customer_userId_idx"        ON "Customer" ("userId");
CREATE INDEX IF NOT EXISTS "Customer_userId_email_idx"  ON "Customer" ("userId","email");
CREATE INDEX IF NOT EXISTS "Customer_userId_phone_idx"  ON "Customer" ("userId","phone");

ALTER TABLE "Customer"
  DROP CONSTRAINT IF EXISTS "Customer_userId_fkey";
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT;

CREATE INDEX IF NOT EXISTS "Booking_customerId_idx" ON "Booking" ("customerId");

ALTER TABLE "Booking"
  DROP CONSTRAINT IF EXISTS "Booking_customerId_fkey";
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
