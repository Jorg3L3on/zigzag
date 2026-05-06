CREATE TABLE "Client" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" varchar(100),
	"phone" varchar(20),
	"document" varchar(100),
	"address" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	"deleted_at" timestamp (3),
	"company_id" integer
);
--> statement-breakpoint
CREATE TABLE "Company" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"logo" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "Permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	"deleted_at" timestamp (3),
	"company_id" integer
);
--> statement-breakpoint
CREATE TABLE "Role" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	"deleted_at" timestamp (3),
	"company_id" integer
);
--> statement-breakpoint
CREATE TABLE "RolePermission" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "RolePermission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "Service" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" double precision NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	"deleted_at" timestamp (3),
	"company_id" integer
);
--> statement-breakpoint
CREATE TABLE "ServicesTickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"ticket_id" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"price" double precision NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "Ticket" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"client_name" varchar(100),
	"client_tel" varchar(10),
	"ticket_date" timestamp (3),
	"total" double precision,
	"email" varchar(40),
	"finished" boolean DEFAULT false NOT NULL,
	"document" varchar(100),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	"deleted_at" timestamp (3),
	"company_id" integer,
	"userId" bigint
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp (3),
	"password" text NOT NULL,
	"remember_token" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	"deleted_at" timestamp (3),
	"company_id" integer,
	"role_id" integer
);
--> statement-breakpoint
CREATE INDEX "Client_company_id_idx" ON "Client" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "Company_name_key" ON "Company" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission" USING btree ("name");--> statement-breakpoint
CREATE INDEX "Permission_company_id_idx" ON "Permission" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "Role_name_key" ON "Role" USING btree ("name");--> statement-breakpoint
CREATE INDEX "Role_company_id_idx" ON "Role" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "RolePermission_role_id_idx" ON "RolePermission" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "RolePermission_permission_id_idx" ON "RolePermission" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "Service_company_id_idx" ON "Service" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ServicesTickets_service_id_idx" ON "ServicesTickets" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "ServicesTickets_ticket_id_idx" ON "ServicesTickets" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "Ticket_company_id_idx" ON "Ticket" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "Ticket_client_id_idx" ON "Ticket" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE INDEX "User_company_id_idx" ON "User" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "User_role_id_idx" ON "User" USING btree ("role_id");