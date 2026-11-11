# AppointMee

Aplicación web para descubrir sucursales y gestionar reservas de turnos. Esta copia contiene el frontend Angular; el backend se mantiene en un repositorio separado.

## Documentación

Empezá por el [índice de documentación](docs/README.md). Allí se reúnen la descripción, arquitectura, instalación, funcionalidades, roles, API, datos, integraciones y recursos del proyecto.

## Repositorios

- [Frontend Angular](https://github.com/appointmee/appointmee-front)
- [Backend Spring Boot](https://github.com/appointmee/appointmee-back)

La guía existente del backend es la referencia para su configuración y ejecución: [README del backend](https://github.com/appointmee/appointmee-back#readme). Los contratos HTTP vigentes se consultan en Swagger con el backend iniciado: `http://localhost:8080/swagger-ui/index.html`.

## Inicio rápido del frontend

Requisitos: Node.js 22 y npm 11, de acuerdo con el `Dockerfile` y `package.json` de este repositorio.

```bash
npm ci
npm start
```

La aplicación se abre en `http://localhost:4200` y espera el backend en `http://localhost:8080`. Para pasos completos, variables de entorno y pruebas, consultá [Instalación y ejecución](docs/03-instalacion.md).

## Alcance de esta documentación

El código de este repositorio es la fuente principal para el frontend. La documentación del backend se enlaza donde corresponde para evitar duplicarla. Jira no está conectado en este entorno, por lo que el [estado y las fuentes](docs/09-recursos-y-gestion.md) identifican lo que no se pudo validar desde ese sistema.
