# 3. Instalación y ejecución

## Requisitos

- Git.
- Node.js 22 y npm 11 para el frontend (versiones alineadas con el `Dockerfile` y `package.json`).
- JDK 21, Maven Wrapper y PostgreSQL para el backend, según el [README backend](https://github.com/appointmee/appointmee-back#requisitos).

## Frontend

Desde la raíz de este repositorio:

```bash
npm ci
npm start
```

`npm start` ejecuta `ng serve --host localhost --port 4200`. La URL por defecto configurada en la aplicación es `http://localhost:8080`; iniciá el backend en ese puerto o cambiá la configuración de entorno antes de usar otro.

Comandos disponibles:

```bash
npm run build
npm test
```

`npm run build` genera el bundle de producción en `dist/`. `npm test` inicia las pruebas unitarias configuradas con Angular/Vitest. No hay un script E2E definido en `package.json`.

## Backend y PostgreSQL

El README del backend es la guía de instalación mantenida para ese repositorio. Resume el siguiente flujo:

1. Crear una base PostgreSQL local y configurar las variables requeridas.
2. Ejecutar `./mvnw spring-boot:run` desde la raíz del backend.
3. Ejecutar `./mvnw test` para las pruebas.

La aplicación escucha en el puerto `8080` por defecto. Hibernate está documentado con `ddl-auto=validate`, por lo que la base debe tener un esquema compatible; la aplicación no crea automáticamente el esquema en esa configuración. Consultá [README backend: ejecución y configuración](https://github.com/appointmee/appointmee-back#ejecución-local) antes de iniciar.

Variables referenciadas en ese README (definir valores localmente, nunca subir secretos):

| Variable | Propósito |
| --- | --- |
| `SPRING_DATASOURCE_URL` | URL JDBC de PostgreSQL, por ejemplo `jdbc:postgresql://localhost:5432/appointmee` |
| `SPRING_DATASOURCE_USERNAME` | Usuario de PostgreSQL |
| `SPRING_DATASOURCE_PASSWORD` | Contraseña de PostgreSQL |
| `MP_ACCESS_TOKEN` | Credencial de Mercado Pago |
| `JWT_SECRET` | Clave para firmar JWT |

El README del backend no indica en esta fuente un procedimiento de creación/restauración del esquema PostgreSQL. Los scripts o migraciones deben consultarse en ese repositorio antes de considerar reproducible un entorno limpio.

## Docker

El frontend incluye un `Dockerfile` multi-stage: compila con Node 22, sirve los archivos con Nginx y configura fallback de rutas Angular. Ejemplo:

```bash
docker build -t appointmee-frontend .
docker run --rm -p 8081:80 appointmee-frontend
```

La imagen no configura por sí sola la URL de API: el código compilado conserva `http://localhost:8080`. En un despliegue, navegador y backend deben tener orígenes alcanzables y CORS correctamente configurado en el servidor.
