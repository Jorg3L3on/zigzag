-- Align Ticket.client_tel with Client.phone capacity (TCI-05).
ALTER TABLE "Ticket" ALTER COLUMN "client_tel" SET DATA TYPE varchar(20);
