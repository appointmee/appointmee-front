# 1. Introducción

## Qué es AppointMee

AppointMee es una aplicación web para encontrar sucursales y reservar turnos de servicios profesionales. La interfaz permite explorar sucursales, consultar sus datos y reseñas, elegir un servicio y un profesional, consultar disponibilidad y enviar una reserva.

El backend concentra la lógica de negocio, la persistencia y la API. Su README lo describe como una API Java 21 / Spring Boot con PostgreSQL, autenticación JWT y pagos Mercado Pago. El frontend de este repositorio es una SPA Angular.

## Problema y propósito

El proyecto reúne en una misma aplicación la búsqueda de prestadores y la coordinación de turnos. La descripción funcional detallada del problema y los objetivos académicos deben validarse con las historias de usuario y el material del equipo: Jira no estuvo accesible durante esta revisión.

## Usuarios identificables en el código

- **Visitante:** puede navegar el inicio, el listado y el detalle público de sucursales.
- **Usuario autenticado:** las rutas y servicios contemplan reservas, reseñas, equipo y ajustes.
- **Empleador y administrador:** aparecen como valores de rol en metadatos de rutas Angular (`EMPLEADOR`, `ADMINISTRADOR`). El alcance efectivo de sus operaciones debe confirmarse en las reglas de seguridad del backend.
- **Empleado/profesional:** aparece como recurso asociado a una sucursal y como opción de reserva. No se pudo confirmar aquí un portal funcional propio para ese rol.

La [guía de roles](05-roles-permisos.md) separa las restricciones de navegación del frontend de la autorización real del servidor.

## Tecnologías

| Área | Tecnología observada |
| --- | --- |
| Frontend | Angular 22, TypeScript 6, RxJS 7, Angular Router y formularios |
| UI y pruebas frontend | CSS; Vitest 4 y jsdom 28 están declarados en `package.json` |
| Backend | Java 21, Spring Boot, Spring Web MVC, Spring Security, Spring Data JPA |
| Persistencia | PostgreSQL; H2 también aparece como dependencia del backend según su README |
| Autenticación | JWT con JJWT según el README del backend; el frontend gestiona access y refresh tokens |
| API | REST; Springdoc OpenAPI / Swagger UI en el backend |
| Pago | SDK de Mercado Pago declarado en el backend |
| Empaquetado frontend | Docker con Node 22 para build y Nginx para servir la SPA |

Versiones exactas del backend y dependencias: revisar el `pom.xml` de [appointmee-back](https://github.com/appointmee/appointmee-back) y el lockfile del repositorio correspondiente.
