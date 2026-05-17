ALTER TABLE "Role"
  ADD CONSTRAINT "Role_company_id_Company_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
--> statement-breakpoint
ALTER TABLE "Permission"
  ADD CONSTRAINT "Permission_company_id_Company_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
--> statement-breakpoint
ALTER TABLE "User"
  ADD CONSTRAINT "User_company_id_Company_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
--> statement-breakpoint
ALTER TABLE "User"
  ADD CONSTRAINT "User_role_id_Role_id_fk"
  FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
--> statement-breakpoint
ALTER TABLE "RolePermission"
  ADD CONSTRAINT "RolePermission_role_id_Role_id_fk"
  FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
--> statement-breakpoint
ALTER TABLE "RolePermission"
  ADD CONSTRAINT "RolePermission_permission_id_Permission_id_fk"
  FOREIGN KEY ("permission_id") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
