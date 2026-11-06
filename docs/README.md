# Documentación general de AppointMee (frontend)

Este índice describe lo que el frontend de este repositorio implementa y los contratos HTTP que espera del backend. La fuente inspeccionada es el código de `src/app`; el repositorio no incluye el backend, su OpenAPI ni su infraestructura de ejecución. Por eso, los contratos son expectativas observadas desde el cliente, no una especificación autoritativa del servidor.

## Documentos

- [Arquitectura del frontend](arquitectura.md): estructura, navegación, sesión y despliegue visible.
- [Contratos API consumidos](contratos-api.md): endpoints, payloads, modelos y manejo de errores.
- [Infraestructura y operación](infraestructura.md): configuración comprobable y pendientes para completar.
- [Pendientes y decisiones](pendientes.md): discrepancias, capacidades ausentes y plan para cerrar documentación.

## Alcance

La URL del backend está fijada actualmente en `http://localhost:8080` (`src/app/services/backend-service.ts`). No se encontró configuración de entornos, manifiesto de contenedores, pipeline CI/CD, especificación API, infraestructura como código ni código de servidor. Los apartados sobre backend y producción identifican estas ausencias explícitamente; no implican que esos recursos no existan fuera de este checkout.
