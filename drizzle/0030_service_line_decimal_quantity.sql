-- ZIG-I12-2: service lines accept decimal quantities (1.5 h de mano de obra),
-- like materials. integer -> numeric(10, 2) keeps every stored value.
-- data-loss-ok: widening integer to numeric(10,2) preserves all existing quantities
ALTER TABLE "ServicesTickets" ALTER COLUMN "quantity" TYPE numeric(10, 2);
