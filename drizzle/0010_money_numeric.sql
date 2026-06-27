-- Convert money columns from double precision (binary float) to exact
-- numeric(12,2). Existing values are rounded to cents on conversion.

ALTER TABLE "Service"
  ALTER COLUMN "price" SET DATA TYPE numeric(12, 2)
  USING ROUND("price"::numeric, 2);

ALTER TABLE "Ticket"
  ALTER COLUMN "total" SET DATA TYPE numeric(12, 2)
  USING ROUND("total"::numeric, 2);

ALTER TABLE "Ticket"
  ALTER COLUMN "paid" SET DATA TYPE numeric(12, 2)
  USING ROUND("paid"::numeric, 2);

ALTER TABLE "ServicesTickets"
  ALTER COLUMN "price" SET DATA TYPE numeric(12, 2)
  USING ROUND("price"::numeric, 2);

ALTER TABLE "TicketPayment"
  ALTER COLUMN "amount" SET DATA TYPE numeric(12, 2)
  USING ROUND("amount"::numeric, 2);
