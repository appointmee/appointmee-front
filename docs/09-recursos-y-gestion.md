# 9. Recursos técnicos y gestión

## Repositorios y documentación existente

- [appointmee-front](https://github.com/appointmee/appointmee-front): este checkout. Antes de esta tarea su README era la plantilla generada por Angular CLI; no se encontraron otros Markdown ni diagramas en el repositorio.
- [appointmee-back](https://github.com/appointmee/appointmee-back): ya tiene un README en español con tecnologías, arquitectura, requisitos, configuración, Docker, Swagger, pruebas y seguridad. Esta documentación lo enlaza en vez de copiarlo.
- Jira: no hubo una conexión disponible en este entorno, así que no se pudieron revisar historias, tareas, estados, estimaciones ni responsables. No inventar esos datos; agregar aquí enlaces al tablero y a épicas cuando el equipo los facilite.

## Flujo de trabajo técnico

1. Revisar el README y Swagger del backend antes de cambiar una llamada o documentar permisos.
2. Usar los modelos TypeScript y servicios Angular como referencia de los payloads consumidos por el cliente.
3. Mantener las variables sensibles fuera de Git y actualizar los ejemplos con nombres, no valores reales.
4. Al modificar el contrato REST, alinear backend, frontend y esta guía.
5. Al modificar entidades o esquema PostgreSQL, actualizar el ER a partir del esquema real y revisar `ddl-auto=validate`.

## Recursos y estado de verificación

- API en desarrollo: `http://localhost:8080/swagger-ui/index.html` y `http://localhost:8080/v3/api-docs`.
- Diagrama de componentes: [diagramas/appointmee.mmd](diagramas/appointmee.mmd).
- Índice de diagramas: [diagramas/README.md](diagramas/README.md).
- La documentación describe el checkout actual del frontend. No se ejecutó una instalación limpia, build, suite de pruebas, API ni integraciones durante esta tarea; los comandos se incluyen como instrucciones y deben correrse en el entorno de desarrollo del equipo.

## Revisión previa a entrega

- Confirmar estado de cada flujo con demo o pruebas de aceptación.
- Consultar Jira y registrar únicamente estados vigentes.
- Contrastar rutas, cuerpos, permisos y errores con OpenAPI generado por el backend activo.
- Contrastar las entidades JPA y el ER con el esquema PostgreSQL desplegado.
- Revisar que no haya secretos en los ejemplos.
