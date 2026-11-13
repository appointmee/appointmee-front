# 5. Roles y permisos

## Roles reconocidos por la interfaz

Los modelos de sesión representan `roles` como una lista de cadenas. `app.routes.ts` declara metadatos para:

| Rol | Referencia en frontend | Alcance comprobable |
| --- | --- | --- |
| `CLIENTE` | Aparece como ejemplo de perfil en pruebas del frontend y en los flujos de reserva/reseñas | La lista oficial de roles debe confirmarse en el backend |
| `EMPLEADOR` | Metadato de la ruta `/mis-sucursales` | La página actual usa sección genérica; permiso efectivo no verificado |
| `ADMINISTRADOR` | Metadato de la ruta `/admin` | La página actual usa sección genérica; permiso efectivo no verificado |
| Empleado | Recurso asociado a una sucursal y al turno | No se identificó una clave de rol específica en las rutas inspeccionadas |

## Controles de navegación

- `authGuard` restringe rutas marcadas como autenticadas.
- `guestGuard` restringe la ruta de inicio de sesión a visitantes.
- `verificationGuard` controla el flujo de verificación de cuenta.
- Los metadatos `roles` aparecen en rutas, pero no equivalen a autorización segura por sí mismos. La API debe aplicar las reglas de acceso en el servidor.

La lista de permisos HTTP y los códigos de respuesta autorizados deben tomarse de Swagger (`/swagger-ui/index.html`) con el backend activo. No se infieren permisos por método o nombre de ruta.
