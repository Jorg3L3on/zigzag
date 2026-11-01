-- ZIG-I36 M-19: the ticket keeps the client's full name. Client.name is text;
-- the Ticket copy was varchar(100) and cut longer names. Widening only.
ALTER TABLE "Ticket" ALTER COLUMN "client_name" TYPE text;
