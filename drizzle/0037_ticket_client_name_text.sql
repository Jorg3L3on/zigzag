-- ZIG-I36 M-19: the ticket keeps the client's full name. Client.name is text;
-- the Ticket copy was varchar(100) and cut longer names. Widening only.
-- data-loss-ok: widens varchar(100) to text; every existing value fits, nothing is truncated or rewritten.
ALTER TABLE "Ticket" ALTER COLUMN "client_name" TYPE text;
