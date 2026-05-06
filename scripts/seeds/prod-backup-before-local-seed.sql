--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: Company; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."Company" ("id", "name", "address", "phone", "email", "logo", "is_system", "created_at", "updated_at", "deleted_at") VALUES (1, 'SOLUCIONES CHANO', 'C. Camarote #121', '(939) 165-46-35', 'test@email.com', NULL, false, '2025-06-01 21:54:23.168', NULL, NULL);
INSERT INTO "public"."Company" ("id", "name", "address", "phone", "email", "logo", "is_system", "created_at", "updated_at", "deleted_at") VALUES (2, 'zigzag', 'C. Camarote #121', '(939) 165-46-35', 'test@email.com', '/favicon.ico', true, '2025-06-01 21:54:23.168', NULL, NULL);
INSERT INTO "public"."Company" ("id", "name", "address", "phone", "email", "logo", "is_system", "created_at", "updated_at", "deleted_at") VALUES (3, 'Empresa de prueba', 'direccion', '999', 'jj@jj.com', '', false, '2025-06-15 05:13:31.998', '2025-06-15 05:13:31.998', NULL);
INSERT INTO "public"."Company" ("id", "name", "address", "phone", "email", "logo", "is_system", "created_at", "updated_at", "deleted_at") VALUES (4, 'Otra empresa de prueba11', 'direccion11', '961315155911', 'carmen@solorzano.com', '', false, '2025-06-15 06:01:50.723', '2025-06-15 07:22:37.88', NULL);
INSERT INTO "public"."Company" ("id", "name", "address", "phone", "email", "logo", "is_system", "created_at", "updated_at", "deleted_at") VALUES (5, 'TELMEX', 'direccion8', '9998', 'admin@example.com', '', false, '2025-06-15 06:05:01.139', '2025-06-15 06:05:01.139', '2025-06-15 06:05:39.798');


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."Client" ("id", "name", "email", "phone", "document", "address", "created_at", "updated_at", "deleted_at", "company_id") VALUES (1, 'TELMEX 1', 'admin@example.com', '9613151559', NULL, NULL, '2025-06-03 04:23:45.94', NULL, NULL, 2);
INSERT INTO "public"."Client" ("id", "name", "email", "phone", "document", "address", "created_at", "updated_at", "deleted_at", "company_id") VALUES (2, 'Limpiar alfombras', 'admin@example.com', '9613151559', NULL, NULL, '2025-06-03 04:41:58.567', NULL, NULL, 1);
INSERT INTO "public"."Client" ("id", "name", "email", "phone", "document", "address", "created_at", "updated_at", "deleted_at", "company_id") VALUES (3, 'Hotel Bugambilias', 'admin@example.com', '9613151559', NULL, NULL, '2025-06-04 04:04:28.349', NULL, NULL, 1);


--
-- Data for Name: Permission; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (1, 'Primer permiso', 'ses', '2025-06-15 20:26:11.463', '2025-06-15 20:26:18.381', '2025-06-15 20:27:00.833', 4);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (2, 'Segundo permiso 2', 'pp', '2025-06-15 20:26:28.995', '2025-06-15 20:26:53.252', '2025-06-15 20:26:57.232', 2);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (3, 'Limpiar alfombras', 'lol', '2025-06-15 20:27:52.486', '2025-06-15 20:28:11.988', NULL, 2);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (4, 'Tercer permiso', '', '2025-06-15 20:37:24.835', '2025-06-15 20:37:24.835', '2025-06-15 21:02:26.064', 3);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (5, 'Cuarto permiso', '', '2025-06-15 20:37:42.855', '2025-06-15 20:37:42.855', NULL, 3);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (6, 'Crear usuarios', '', '2025-06-15 20:46:02.359', '2025-06-15 20:46:02.359', NULL, 3);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (7, 'Ver usuarios', '', '2025-06-15 20:46:09.22', '2025-06-15 20:46:09.22', NULL, 3);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (8, 'Borrar usuarios', '', '2025-06-15 20:46:16.848', '2025-06-15 20:46:16.848', NULL, 3);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (9, 'Editar usuarios', '', '2025-06-15 20:46:26.56', '2025-06-15 20:46:26.56', NULL, 3);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (10, 'Ver tickets', '', '2025-06-15 20:46:56.136', '2025-06-15 20:46:56.136', NULL, 3);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (11, 'Crear tickets', '', '2025-06-15 20:47:03.272', '2025-06-15 20:47:03.272', NULL, 3);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (12, 'Actualizar tickets', '', '2025-06-15 20:47:16.408', '2025-06-15 20:47:16.408', NULL, 3);
INSERT INTO "public"."Permission" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (13, 'Eliminar tickets', '', '2025-06-15 20:47:40.062', '2025-06-15 20:47:40.062', NULL, 3);


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."Role" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (1, 'Primer rol', '', '2025-06-15 19:16:29.562', '2025-06-15 20:13:54.43', NULL, 2);
INSERT INTO "public"."Role" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (2, 'Segundo rol', '', '2025-06-15 19:16:52.216', '2025-06-15 20:14:04.598', NULL, 1);
INSERT INTO "public"."Role" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (3, 'admin', '', '2025-06-15 19:24:22.734', NULL, '2025-06-15 19:42:28.563', NULL);
INSERT INTO "public"."Role" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (4, 'Lámpara sala', 'lol', '2025-06-15 19:55:25.84', '2025-06-15 20:03:47.724', NULL, 1);
INSERT INTO "public"."Role" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (5, 'Lámpara salas', 'aa', '2025-06-15 20:14:55.667', '2025-06-15 20:14:55.667', NULL, 3);
INSERT INTO "public"."Role" ("id", "name", "description", "created_at", "updated_at", "deleted_at", "company_id") VALUES (6, 'TELMEXx', 'ws', '2025-06-15 20:17:22.105', '2025-06-15 20:17:40.131', '2025-06-15 20:17:40.131', 2);


--
-- Data for Name: RolePermission; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (1, 3, '2025-06-15 20:45:40.659');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 4, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 5, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 6, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 7, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 8, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 9, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 10, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 11, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 12, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (5, 13, '2025-06-15 20:47:55.972');
INSERT INTO "public"."RolePermission" ("role_id", "permission_id", "created_at") VALUES (6, 3, '2025-06-15 20:56:45.224');


--
-- Data for Name: Service; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (1, 'Mantenimiento A/C', 'Description for Mantenimiento A/C', 700, '2025-05-25 02:19:47.093', '2025-05-25 02:19:47.093', NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (2, 'Instalación A/C', 'Description for Instalación A/C', 3900, '2025-05-25 02:19:47.093', '2025-06-01 18:27:52.187', NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (3, 'Revisión de forros de tuvería', 'Description for Revisión de forros de tuvería', 0, '2025-05-25 02:19:47.093', '2025-05-25 02:19:47.093', NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (4, 'Ajuste de presión de Refrigerador', 'Description for Ajuste de presión de Refrigerador', 0, '2025-05-25 02:19:47.093', '2025-05-25 02:19:47.093', NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (5, 'Lavado de condensador', 'Description for Lavado de condensador', 0, '2025-05-25 02:19:47.093', '2025-05-25 02:19:47.093', NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (6, 'Desmontar equipo', 'Description for Desmontar equipo', 0, '2025-05-25 02:19:47.093', '2025-05-25 02:19:47.093', NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (9, 'Limpiar alfombras', 'Alfombras limpias', 59.99, '2025-05-25 20:55:06.358', '2025-05-25 20:55:19.783', NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (10, 'Amor', 'Brindar amor', 200, '2025-06-01 18:40:12.158', '2025-06-01 18:40:12.158', NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (11, 'Lámpara sala', 'lol old', 90.09, '2025-06-04 04:04:04.997', NULL, NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (12, 'Miguel Ángel León Gómez', 'desa', 11, '2025-06-04 04:44:26.702', NULL, NULL, 1);
INSERT INTO "public"."Service" ("id", "name", "description", "price", "created_at", "updated_at", "deleted_at", "company_id") VALUES (13, 'Limpiar alfombras grandes', 'alfombras grandes', 290, '2025-06-04 04:47:11.27', NULL, NULL, 1);


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."User" ("id", "name", "email", "email_verified_at", "password", "remember_token", "created_at", "updated_at", "deleted_at", "company_id", "role_id") VALUES (3, 'jorge', 'jorge@jorge2.com', NULL, '$2b$10$sh9SmGVO6u.6ICw5VRREcOBchnJqGLIXXQr3aCinMNJ70Ed4VIrsG', NULL, '2025-06-02 05:15:48.221', NULL, NULL, 1, NULL);
INSERT INTO "public"."User" ("id", "name", "email", "email_verified_at", "password", "remember_token", "created_at", "updated_at", "deleted_at", "company_id", "role_id") VALUES (4, 'Miguel Ángel León Gómez', 'miguel@leongomez.com', NULL, '$2b$10$r.bwIyHRBGwoVNLGg3sai.9zIKAzdt.KXwYi5zgjMtEQ7MX8mkSNW', NULL, '2025-06-15 06:07:20.584', '2025-06-15 07:14:00.937', '2025-06-15 07:14:00.937', 1, NULL);
INSERT INTO "public"."User" ("id", "name", "email", "email_verified_at", "password", "remember_token", "created_at", "updated_at", "deleted_at", "company_id", "role_id") VALUES (5, 'Miguel Ángel León Gómez2', 'miguel@leon1.com', NULL, '$2b$10$djubQtjNmvRyIGxoc9oJne.1ymytFPWMtr4MM.aK1FWMArshig19y', NULL, '2025-06-15 07:17:06.356', '2025-06-16 07:48:26.09', NULL, 1, 5);
INSERT INTO "public"."User" ("id", "name", "email", "email_verified_at", "password", "remember_token", "created_at", "updated_at", "deleted_at", "company_id", "role_id") VALUES (6, 'Carmen', 'carmen@solorzano.com', NULL, '$2b$10$/LQ52AQ6cG.uC9AleMV72OdDLVrcNpvcNp6.w5V6O2grk9Dd7ZCPO', NULL, '2025-06-15 20:58:10.6', '2025-06-15 20:59:33.25', '2025-06-15 20:59:33.25', 3, 5);
INSERT INTO "public"."User" ("id", "name", "email", "email_verified_at", "password", "remember_token", "created_at", "updated_at", "deleted_at", "company_id", "role_id") VALUES (1, 'jorge', 'jorgeleon983@outlook.com', NULL, '$2b$12$6SjcCwTOEYxnZwWPprPg9OrS5QIJ.g8axo3OpmE7CGfJUhx9fwlHK', NULL, '2024-10-03 14:15:18', '2026-05-05 00:08:00.269', NULL, 1, NULL);
INSERT INTO "public"."User" ("id", "name", "email", "email_verified_at", "password", "remember_token", "created_at", "updated_at", "deleted_at", "company_id", "role_id") VALUES (2, 'jorg', 'jorge@jorge.com', NULL, '$2b$12$6SjcCwTOEYxnZwWPprPg9OrS5QIJ.g8axo3OpmE7CGfJUhx9fwlHK', NULL, '2025-05-31 11:42:37.331', '2026-05-05 00:47:40.114', NULL, 2, 6);


--
-- Data for Name: Ticket; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."Ticket" ("id", "client_id", "client_name", "client_tel", "ticket_date", "total", "email", "finished", "document", "created_at", "updated_at", "deleted_at", "company_id", "userId") VALUES (1, 2, 'Primera prueba', '9613151559', '2024-10-02 00:00:00', NULL, 'jorgeleon983@gmail.com', false, NULL, '2024-10-03 14:20:32', '2024-10-03 14:20:32', NULL, 1, NULL);
INSERT INTO "public"."Ticket" ("id", "client_id", "client_name", "client_tel", "ticket_date", "total", "email", "finished", "document", "created_at", "updated_at", "deleted_at", "company_id", "userId") VALUES (2, 2, 'Segunda prueba1', '9613151559', '2025-06-01 06:00:00', 3600, 'jorgeleon983@gmail.com', true, '/pdfs/Segunda prueba1_2025-06-01.pdf', '2024-10-03 14:31:56', '2024-10-03 14:31:56', NULL, 1, NULL);
INSERT INTO "public"."Ticket" ("id", "client_id", "client_name", "client_tel", "ticket_date", "total", "email", "finished", "document", "created_at", "updated_at", "deleted_at", "company_id", "userId") VALUES (4, 2, '13', '12', '2025-05-24 06:00:00', 1639.96, 'jorge@jorge.com', true, '/pdfs/13_2025-05-26.pdf', '2025-05-31 11:42:49.602', NULL, NULL, 1, NULL);
INSERT INTO "public"."Ticket" ("id", "client_id", "client_name", "client_tel", "ticket_date", "total", "email", "finished", "document", "created_at", "updated_at", "deleted_at", "company_id", "userId") VALUES (5, 2, 'Otra prueba', '9613151559', '2025-06-01 06:00:00', 200, 'admin@example.com', true, '/pdfs/Otra prueba_2025-06-01.pdf', '2025-06-01 12:40:36.366', NULL, '2025-06-04 04:13:08.722', 1, NULL);
INSERT INTO "public"."Ticket" ("id", "client_id", "client_name", "client_tel", "ticket_date", "total", "email", "finished", "document", "created_at", "updated_at", "deleted_at", "company_id", "userId") VALUES (6, 2, 'Limpiar alfombras', '9613151559', '2025-06-02 06:00:00', 2800, 'admin@example.com', true, '/pdfs/Limpiar alfombras_2025-06-03.pdf', '2025-06-03 04:52:44.362', NULL, '2025-06-04 04:10:42.936', 1, NULL);
INSERT INTO "public"."Ticket" ("id", "client_id", "client_name", "client_tel", "ticket_date", "total", "email", "finished", "document", "created_at", "updated_at", "deleted_at", "company_id", "userId") VALUES (7, 2, 'Limpiar alfombras', '9613151559', '2025-06-03 06:00:00', 5300, 'admin@example.com', true, '/pdfs/Limpiar alfombras_2025-06-03.pdf', '2025-06-04 04:00:02.27', NULL, '2025-06-04 04:10:16.58', 1, NULL);
INSERT INTO "public"."Ticket" ("id", "client_id", "client_name", "client_tel", "ticket_date", "total", "email", "finished", "document", "created_at", "updated_at", "deleted_at", "company_id", "userId") VALUES (8, 2, 'Limpiar alfombras', '9613151559', '2025-06-03 06:00:00', NULL, 'admin@example.com', false, '', '2025-06-04 04:29:27.901', NULL, '2025-06-04 04:43:48.178', 1, NULL);
INSERT INTO "public"."Ticket" ("id", "client_id", "client_name", "client_tel", "ticket_date", "total", "email", "finished", "document", "created_at", "updated_at", "deleted_at", "company_id", "userId") VALUES (9, 3, 'Hotel Bugambilias', '9613151559', '2025-06-02 06:00:00', 240.17, 'admin@example.com', true, '/pdfs/Hotel Bugambilias_2025-06-03.pdf', '2025-06-04 04:30:23.221', NULL, NULL, 1, NULL);
INSERT INTO "public"."Ticket" ("id", "client_id", "client_name", "client_tel", "ticket_date", "total", "email", "finished", "document", "created_at", "updated_at", "deleted_at", "company_id", "userId") VALUES (10, 2, 'Limpiar alfombras', '9613151559', '2025-06-09 06:00:00', NULL, 'admin@example.com', false, '', '2025-06-16 07:50:31.812', NULL, NULL, 1, NULL);


--
-- Data for Name: ServicesTickets; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (1, 2, 1, 1, 1200, '2024-10-03 14:22:41', '2024-10-03 14:22:41', NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (3, 9, 4, 4, 59.99, '2025-05-25 21:27:05.346', '2025-05-26 05:47:04.621', NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (4, 1, 4, 1, 700, '2025-05-25 21:29:56.109', '2025-05-25 21:29:56.109', NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (5, 1, 4, 1, 700, '2025-05-25 21:30:01.759', '2025-05-25 21:30:01.759', NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (6, 2, 2, 1, 1500, '2025-06-01 18:25:27.725', '2025-06-01 18:25:27.725', NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (8, 1, 2, 3, 700, '2025-06-01 18:26:13.764', '2025-06-01 18:26:21.837', NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (9, 10, 5, 1, 200, '2025-06-01 18:40:42.888', '2025-06-01 18:40:42.888', NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (10, 9, 1, 3, 59.99, '2025-06-02 06:23:53.764', NULL, NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (11, 1, 6, 1, 700, '2025-06-03 04:52:51.968', NULL, NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (12, 1, 6, 3, 700, '2025-06-03 05:08:27.281', NULL, NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (13, 1, 7, 2, 700, '2025-06-04 04:00:10.425', NULL, NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (15, 2, 7, 1, 3900, '2025-06-04 04:00:55.906', NULL, NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (16, 9, 9, 1, 59.99, '2025-06-04 04:42:59.885', NULL, NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (17, 11, 9, 2, 90.09, '2025-06-04 04:43:07.62', NULL, NULL);
INSERT INTO "public"."ServicesTickets" ("id", "service_id", "ticket_id", "quantity", "price", "created_at", "updated_at", "deleted_at") VALUES (18, 13, 10, 2, 290, '2025-06-16 07:50:40.865', NULL, NULL);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: jorgeleon
--

INSERT INTO "public"."_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('abd89741-846b-4fa6-9963-dce4933c010f', 'acd61781bda30385ad1b474e9d82f2a9f307cb8dc71aaca2b735f151903d2435', '2026-05-04 22:56:25.602496-06', '20260504230000_init', NULL, NULL, '2026-05-04 22:56:24.589113-06', 1);


--
-- Name: Client_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jorgeleon
--

SELECT pg_catalog.setval('"public"."Client_id_seq"', 3, true);


--
-- Name: Company_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jorgeleon
--

SELECT pg_catalog.setval('"public"."Company_id_seq"', 5, true);


--
-- Name: Permission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jorgeleon
--

SELECT pg_catalog.setval('"public"."Permission_id_seq"', 13, true);


--
-- Name: Role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jorgeleon
--

SELECT pg_catalog.setval('"public"."Role_id_seq"', 6, true);


--
-- Name: Service_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jorgeleon
--

SELECT pg_catalog.setval('"public"."Service_id_seq"', 13, true);


--
-- Name: ServicesTickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jorgeleon
--

SELECT pg_catalog.setval('"public"."ServicesTickets_id_seq"', 18, true);


--
-- Name: Ticket_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jorgeleon
--

SELECT pg_catalog.setval('"public"."Ticket_id_seq"', 10, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jorgeleon
--

SELECT pg_catalog.setval('"public"."User_id_seq"', 6, true);


--
-- PostgreSQL database dump complete
--

