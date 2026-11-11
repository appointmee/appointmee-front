# 7. Base de datos

## Motor y configuración

El backend declara PostgreSQL como base principal y Spring Data JPA para persistencia. Su README indica `ddl-auto=validate`: Hibernate valida el esquema existente al iniciar, pero esta configuración no constituye una migración ni crea tablas.

La URL y credenciales se proveen por `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` y `SPRING_DATASOURCE_PASSWORD`. Ver [Instalación](03-instalacion.md). No incluir valores reales en documentación o control de versiones.

## Dominios identificados

El README backend agrupa el sistema en usuarios/roles, sucursales, servicios, turnos, solicitudes, reseñas, imágenes y pagos. Los modelos del frontend también muestran atributos de sucursal, servicio, empleado, turno y reseña.

## Entidades y relaciones

No se pudo validar desde este checkout la lista completa de entidades JPA, sus cardinalidades, claves foráneas, restricciones ni enumeraciones persistidas. Tampoco se encontró aquí un script SQL, migración o diagrama entidad-relación. Por ese motivo no se publica un ER inferido a partir de los DTO del frontend.

Para completar esta sección sin duplicar ni adivinar, usar las entidades, anotaciones JPA y scripts del repositorio backend como fuente, y añadir el ER a `diagramas/` una vez contrastado con el esquema PostgreSQL real.
