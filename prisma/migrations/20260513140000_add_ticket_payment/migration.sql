-- CreateTable
CREATE TABLE "TicketPayment" (
    "id" SERIAL NOT NULL,
    "ticket_id" BIGINT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "company_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketPayment_ticket_id_idx" ON "TicketPayment"("ticket_id");

CREATE INDEX "TicketPayment_company_id_idx" ON "TicketPayment"("company_id");

ALTER TABLE "TicketPayment" ADD CONSTRAINT "TicketPayment_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Historial retroactivo: un registro por ticket con saldo ya registrado en Ticket.paid
INSERT INTO "TicketPayment" ("ticket_id", "amount", "company_id", "created_at")
SELECT t."id",
       COALESCE(t."paid", 0),
       t."company_id",
       COALESCE(t."updated_at", t."created_at")
FROM "Ticket" t
WHERE t."deleted_at" IS NULL
  AND t."finished" = true
  AND COALESCE(t."paid", 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM "TicketPayment" tp WHERE tp."ticket_id" = t."id"
  );
