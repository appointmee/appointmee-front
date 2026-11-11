# 4. Funcionalidades y estado observado

El estado describe evidencia del checkout del frontend, no una certificación integral del backend ni una aceptación de producto.

| Funcionalidad | Evidencia en frontend | Estado documentado |
| --- | --- | --- |
| Inicio y navegación | Ruta de inicio, navbar y páginas de sucursales | Implementado en frontend |
| Listado, categoría y búsqueda de sucursales | Rutas `/sucursales`; llamadas listar/filtrar/categorías | Implementado en frontend |
| Detalle, reseñas e imágenes de sucursal | Ruta de detalle y reseñas; DTO contempla imágenes | Implementado en frontend; proveedor de imágenes no verificado |
| Selección de servicio y profesional | Rutas de servicio/equipo y servicios HTTP | Implementado en frontend |
| Consulta de disponibilidad y registro de turno | Servicio HTTP y página de confirmación | Integración implementada; reglas definitivas dependen del backend |
| Inicio/cierre de sesión y refresh | Servicio de autenticación, interceptor y guardas | Implementado en frontend |
| Recuperación y verificación de email | Rutas, servicio y flujo con código/ticket de verificación | Implementado en frontend |
| Ajustes de la cuenta | Ruta `/configuracion` con las secciones Verificar cuenta, Cambiar contraseña y Eliminar cuenta | Implementado en frontend; la eliminación usa `DELETE /usuarios/borrar-cuenta` con dos confirmaciones |
| Gestión de sucursales, servicios, empleados y reseñas | Servicios Angular incluyen operaciones de lectura/escritura | Operaciones disponibles en cliente; permisos y alcance real deben confirmarse en Swagger |
| Mis turnos, perfil, solicitudes y registro | Rutas cargan un componente genérico `Section` | Marcado como sección pendiente/incompleta en frontend; no presentarlo como función terminada |
| Panel administrador | Ruta con metadato de rol, también carga `Section` | Marcado como incompleto en frontend |
| Pagos | README backend declara Mercado Pago y webhooks; no hay flujo de pago visible en estos servicios Angular | Backend documenta integración; flujo extremo a extremo no verificado aquí |
| Notificaciones WhatsApp | No se encontró evidencia en el checkout frontend ni en el README backend revisado | No verificado; no afirmar como implementado |

Para el inventario de llamadas REST del cliente, consultá [API REST](06-api-rest.md). Para roles y restricciones, consultá [Roles y permisos](05-roles-permisos.md).
