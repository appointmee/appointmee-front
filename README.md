<p align="center">
  <img src="public/appointmee-logo.png" alt="AppointMee" width="140" />
</p>

<h1 align="center">AppointMee · Frontend</h1>

<p align="center">
  Explorá sucursales, conocé sus servicios y gestioná tu experiencia de turnos desde una aplicación web.
</p>

<p align="center">
  <img alt="Angular 22" src="https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white" />
  <img alt="TypeScript 6" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white" />
</p>

AppointMee es una aplicación web de gestión de turnos y el frontend de un proyecto académico para **Programación IV** de la **Universidad Tecnológica Nacional (UTN)**. Este repositorio contiene la interfaz Angular; la API se desarrolla por separado.

## Qué ofrece

- Explorar y buscar sucursales, y consultar su información, equipo y reseñas.
- Ver los servicios disponibles y comenzar el flujo de selección de turno.
- Crear una cuenta, iniciar sesión, verificar el email y recuperar la contraseña.
- Acceder a secciones protegidas según la sesión y el rol de la cuenta.
- Usar vistas adaptables con estados de carga y error para las operaciones principales.

Algunas secciones autenticadas todavía son pantallas de sección y no flujos completos de gestión. El estado de cada flujo se puede comprobar en la implementación y en la [documentación del frontend](docs/README.md).

## Requisitos

- Node.js 22.22.3 o superior
- npm 11 (el proyecto declara `npm@11.17.0`)
- Backend de AppointMee para probar las operaciones que usan la API

## Inicio rápido

```bash
git clone https://github.com/appointmee/appointmee-front.git
cd appointmee-front
npm install
npm start
```

Abrí [http://localhost:4200](http://localhost:4200). El servidor de desarrollo recarga la aplicación cuando cambiás el código.

Por defecto, el frontend consume el backend en `http://localhost:8080`. Para usar las funciones conectadas, iniciá el [backend de AppointMee](https://github.com/appointmee/AppointMee). La URL está centralizada en `src/app/services/backend-service.ts`.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia Angular en `http://localhost:4200`. |
| `npm run build` | Genera el build de producción en `dist/`. |
| `npm test -- --watch=false` | Ejecuta las pruebas unitarias con Vitest y jsdom una vez. |
| `npm run watch` | Compila en desarrollo y observa cambios. |

Para correr una prueba puntual:

```bash
npx ng test --watch=false --include='src/app/pages/servicios/servicios.spec.ts'
```

## Estructura del proyecto

```text
src/app/
├── components/    # Componentes reutilizables, como la navegación
├── guards/        # Protección de rutas y control de sesión
├── http/          # Contexto y presentación de errores HTTP
├── interceptors/  # Autenticación y tratamiento de solicitudes
├── models/        # Tipos de datos de la aplicación
├── pages/         # Pantallas y flujos de usuario
└── services/      # Comunicación con la API y estado de autenticación
```

La aplicación usa componentes standalone y rutas con carga diferida. Los tests están junto a las páginas, servicios y demás unidades que cubren.

## Documentación

- [Índice de documentación](docs/README.md)
- [Arquitectura y rutas](docs/arquitectura.md)
- [Contratos de API consumidos](docs/contratos-api.md)
- [Infraestructura y despliegue](docs/infraestructura.md)
- [Pendientes y decisiones](docs/pendientes.md)

## Despliegue

El repositorio incluye `vercel.json` con una regla de rewrite para que las rutas de la aplicación Angular funcionen al abrirlas directamente. La configuración actual del cliente apunta a `http://localhost:8080`; revisá la [documentación de infraestructura](docs/infraestructura.md) antes de publicar para confirmar la configuración de API adecuada al entorno.

## Licencia

Proyecto académico. No se encontró un archivo de licencia en este repositorio.
