-- Materiales (ZIG-I10-1): a company material catalog, default materials per
-- catalog Service, and material rows under each ticket/presupuesto line.
-- Additive only: existing documents simply have no materials.
CREATE TABLE IF NOT EXISTS "Material" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL,
  "name" varchar(100) NOT NULL,
  "unit" varchar(20),
  "price" numeric(12, 2) NOT NULL,
  "created_at" timestamp(3) DEFAULT now() NOT NULL,
  "updated_at" timestamp(3),
  "deleted_at" timestamp(3),
  CONSTRAINT "Material_company_id_Company_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Material_company_id_created_at_active_idx"
  ON "Material" ("company_id", "created_at") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Material_company_id_name_active_key"
  ON "Material" ("company_id", lower("name")) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ServiceMaterial" (
  "id" serial PRIMARY KEY NOT NULL,
  "service_id" integer NOT NULL,
  "material_id" integer NOT NULL,
  "quantity" numeric(10, 2) DEFAULT 1 NOT NULL,
  "price" numeric(12, 2),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp(3) DEFAULT now() NOT NULL,
  "updated_at" timestamp(3),
  "deleted_at" timestamp(3),
  CONSTRAINT "ServiceMaterial_service_id_Service_id_fk"
    FOREIGN KEY ("service_id") REFERENCES "Service"("id"),
  CONSTRAINT "ServiceMaterial_material_id_Material_id_fk"
    FOREIGN KEY ("material_id") REFERENCES "Material"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ServiceMaterial_material_id_idx"
  ON "ServiceMaterial" ("material_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceMaterial_service_id_material_id_active_key"
  ON "ServiceMaterial" ("service_id", "material_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketLineMaterial" (
  "id" serial PRIMARY KEY NOT NULL,
  "services_tickets_id" integer NOT NULL,
  "material_id" integer,
  "name" varchar(100),
  "unit" varchar(20),
  "quantity" numeric(10, 2) NOT NULL,
  "price" numeric(12, 2) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp(3) DEFAULT now() NOT NULL,
  "updated_at" timestamp(3),
  "deleted_at" timestamp(3),
  CONSTRAINT "TicketLineMaterial_services_tickets_id_ServicesTickets_id_fk"
    FOREIGN KEY ("services_tickets_id") REFERENCES "ServicesTickets"("id"),
  CONSTRAINT "TicketLineMaterial_material_id_Material_id_fk"
    FOREIGN KEY ("material_id") REFERENCES "Material"("id"),
  CONSTRAINT "TicketLineMaterial_material_or_name_chk"
    CHECK ("material_id" IS NOT NULL OR "name" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TicketLineMaterial_services_tickets_id_idx"
  ON "TicketLineMaterial" ("services_tickets_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TicketLineMaterial_material_id_idx"
  ON "TicketLineMaterial" ("material_id");
