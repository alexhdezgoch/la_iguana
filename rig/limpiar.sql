-- Solo para el banco de pruebas local: vacía los esquemas para reconstruirlos.
drop schema if exists public cascade;
drop schema if exists auth cascade;
create schema public;
