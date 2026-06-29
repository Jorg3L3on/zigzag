-- Accelerate case-insensitive substring search (ILIKE '%term%') used by the
-- server-side paginated list queries (clients, tickets, users, roles) with
-- pg_trgm GIN trigram indexes. Postgres-native; no external search service.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Clients (getClients)
CREATE INDEX IF NOT EXISTS "Client_name_trgm_idx"
  ON "Client" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_email_trgm_idx"
  ON "Client" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_phone_trgm_idx"
  ON "Client" USING gin ("phone" gin_trgm_ops);

-- Tickets (getTicketsPaginated)
CREATE INDEX IF NOT EXISTS "Ticket_client_name_trgm_idx"
  ON "Ticket" USING gin ("client_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ticket_email_trgm_idx"
  ON "Ticket" USING gin ("email" gin_trgm_ops);

-- Users (getUsersPaginated)
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"
  ON "User" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_email_trgm_idx"
  ON "User" USING gin ("email" gin_trgm_ops);

-- Roles (getRolesPaginated)
CREATE INDEX IF NOT EXISTS "Role_name_trgm_idx"
  ON "Role" USING gin ("name" gin_trgm_ops);
