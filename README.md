<p align="center">
  <img src="public/appointmee-logo.png" alt="AppointMee" width="140" />
</p>

<h1 align="center">AppointMee</h1>

<p align="center">
  <em>Encontrá establecimientos, descubrí sus servicios y reservá tu turno de forma simple, rápida y organizada.</em>
</p>

<p align="center">
  <img alt="Angular" src="https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" />
</p>

## ¿Qué es AppointMee?

AppointMee es el frontend de una plataforma de gestión de turnos que conecta a clientes con distintos establecimientos y sucursales. Desde la aplicación se pueden explorar sucursales, consultar sus servicios y reservar turnos, además de administrar la cuenta y las reservas.

Es un proyecto académico desarrollado para la materia **Programación IV** de la **Universidad Tecnológica Nacional (UTN)**.

## Cómo iniciar el proyecto

### Requisitos

- [Node.js](https://nodejs.org/) 22.22.3 o superior
- npm

### Pasos

1. Cloná el repositorio e ingresá a la carpeta:

   ```bash
   git clone https://github.com/appointmee/appointmee-front.git
   cd appointmee-front
   ```

2. Instalá las dependencias:

   ```bash
   npm install
   ```

3. Iniciá el servidor de desarrollo:

   ```bash
   npm start
   ```

4. Abrí [http://localhost:4200](http://localhost:4200) en el navegador.

La aplicación se recarga automáticamente al modificar los archivos del proyecto.

> **Backend:** el frontend consume la API desde `http://localhost:8080`. Para probar el flujo completo (inicio de sesión, sucursales y reservas) también tenés que ejecutar el [backend de AppointMee](https://github.com/appointmee/AppointMee). La URL se configura en `src/app/services/backend-service.ts`.

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia el servidor de desarrollo en `http://localhost:4200`. |
| `npm run build` | Genera la build de producción en `dist/`. |
| `npm test` | Ejecuta las pruebas unitarias con Vitest. |
| `npm run watch` | Compila en modo desarrollo y queda atento a los cambios. |
