# Documentación de AppointMee

Guía técnica y funcional del proyecto. Se documenta el estado observado en el frontend de este repositorio y se enlazan las fuentes existentes del backend. Cuando algo no se puede verificar aquí, queda indicado expresamente.

## Contenido

1. [Introducción y alcance](01-introduccion.md)
2. [Arquitectura](02-arquitectura.md)
3. [Instalación y ejecución](03-instalacion.md)
4. [Funcionalidades y estado](04-funcionalidades.md)
5. [Roles y permisos](05-roles-permisos.md)
6. [API REST](06-api-rest.md)
7. [Base de datos](07-base-datos.md)
8. [Integraciones](08-integraciones.md)
9. [Recursos y gestión del proyecto](09-recursos-y-gestion.md)
10. [Diagramas](diagramas/README.md)

## Referencias técnicas del frontend

- [Arquitectura y rutas](arquitectura.md)
- [Contratos API consumidos](contratos-api.md)
- [Infraestructura y operación](infraestructura.md)
- [Pendientes y decisiones](pendientes.md)

## Fuentes y alcance de verificación

- [Frontend](https://github.com/appointmee/appointmee-front): rutas, servicios HTTP, modelos, configuración y despliegue.
- [Backend](https://github.com/appointmee/appointmee-back): README publicado, estructura, configuración declarada y Swagger cuando el servidor esté disponible.
- Jira: no hay una integración de Jira disponible en el entorno de esta tarea. No se atribuyen estados, fechas ni acuerdos a sus tickets.

La documentación refleja el checkout del frontend en el que se preparó. Antes de una entrega, conviene contrastar de nuevo el contrato OpenAPI, el esquema real de PostgreSQL y el tablero Jira, porque esos recursos evolucionan por separado.
