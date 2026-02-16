# Plan de Seguridad para Vistas de Profesionales

Para garantizar que los profesionales **solo vean sus datos y nada más** (ni siquiera por error accediendo a una URL directa), implementaremos un bloqueo de rutas a nivel de aplicación.

## 1. Análisis del Estado Actual
- **Dashboard**: ✅ Ya está filtrado. Solo ven sus métricas, gráficas y atenciones.
- **Agenda**: ✅ Ya está filtrada. Solo ven sus citas y el formulario de nueva atención bloquea el selector de profesional.
- **Vulnerabilidad**: ⚠️ Si un profesional escribe manualmente `/pacientes` o `/reportes` en el navegador, podría ver el listado completo, ya que las rutas no tienen protección de rol, solo de autenticación.

## 2. Solución Propuesta: `AdminRoute` en `App.tsx`
Implementaremos un componente de seguridad `AdminRoute` en el archivo principal `App.tsx` para proteger todas las rutas sensibles.

### Cambios en `App.tsx`:
1.  **Crear componente `AdminRoute`**:
    *   Verificará si `user.rol === 'admin'`.
    *   Si no es admin, redirigirá automáticamente al `/` (Dashboard).
2.  **Proteger Rutas Globales**:
    *   Envolver las siguientes rutas con `AdminRoute`:
        *   `/profesionales` (Listado y edición)
        *   `/pacientes` (Listado y edición)
        *   `/tipos-atencion`
        *   `/reportes`
        *   `/costos`
        *   `/usuarios`
        *   `/configuracion`

## 3. Resultado Final
*   **Profesional**: Solo tendrá acceso a:
    *   `/` (Dashboard personal)
    *   `/agenda` (Agenda personal)
    *   `/agenda/nueva` (Crear cita para sí mismo)
*   **Admin**: Mantiene acceso total.
*   **Seguridad**: Cualquier intento de entrar a "Datos Generales" (Pacientes globales, Reportes financieros, etc.) será bloqueado y redirigido.
