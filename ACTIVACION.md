# ARISSTO: cuentas y sincronizacion

La version local abierta con `file:` conserva el funcionamiento anterior. La version publicada exige una cuenta y guarda los casos y tareas en Netlify Blobs. No hay cuentas activadas ni sincronizacion en produccion hasta completar estos pasos.

## Activar en el sitio existente

1. Reconectar la cuenta de Netlify. Usar el sitio existente, no crear otra direccion: los datos del navegador estan asociados a su direccion original.
2. Activar Netlify Identity y configurar el registro como **Invite only**. Las cuentas del equipo se crean desde ARISSTO, no por registro publico.
3. Configurar la variable privada `ARISSTO_INITIAL_ADMIN_PASSWORD` en el entorno de Functions con la clave inicial acordada. No ponerla en el codigo, archivos publicos ni Git. Se recomienda cambiarla por una clave larga al entrar.
4. Publicar con dependencias y Functions: `npm ci`, `npm run build`, y desplegar con la configuracion de `netlify.toml`. La carpeta publica es exclusivamente `dist`. No subir la raiz del proyecto ni `seed-data.js`: contienen registros historicos y contactos privados. Subir solo `dist` mediante arrastrar archivos tampoco publica las Functions necesarias.
5. Abrir el sitio. La primera solicitud configura unicamente la cuenta **EGOMEZ**, nombre **Edwin Gomez**, con rol `admin`. Las direcciones `usuario@arissto.invalid` son identificadores internos de Identity; no se solicita correo personal ni se envia correo. Si el proveedor rechaza la clave inicial, establecer una mas larga en la variable privada y reintentar. Si la cuenta existe pero no tiene los metadatos esperados, el bootstrap la repara con usuario EGOMEZ y rol admin sin cambiar su contrasena.
6. Ingresar con EGOMEZ desde el navegador y la direccion donde estan los casos actuales. La migracion incorpora los registros locales a su cuenta sin borrar el origen, sin reemplazar registros existentes del servidor y sin restaurar eliminados. Si hay datos en otros navegadores, efectuar este paso desde cada origen original; el codigo no puede leer los datos privados de otro origen.
7. Retirar `ARISSTO_INITIAL_ADMIN_PASSWORD` una vez activada la cuenta. Cambiar la clave desde **Cambiar contrasena**.
8. Desde **Usuarios**, Edwin puede crear cuentas con nombre de usuario y contrasena, editar nombres y establecer nuevas contrasenas. Las cuentas nuevas siempre son miembros, no administradores. Asignar sus registros desde **Cuenta asignada** al editar cada caso o tarea.

## Comportamiento

- Los miembros solo reciben del servidor sus casos y tareas; el administrador recibe todos. El nombre escrito en Encargado no concede permisos: se usa el identificador interno de la cuenta.
- Las cooperativas son un directorio compartido para autocompletar. Solo el administrador puede modificarlo.
- El servidor valida las cuentas y sus permisos en cada solicitud. No se guardan contrasenas en los registros ni en archivos publicos.
- Las nuevas escrituras se confirman en el servidor. Sin conexion, el formulario conserva su contenido para reintentar; no se anuncia un guardado que no se haya confirmado.
- La pantalla consulta cambios cada 20 segundos y al volver a la ventana. Durante la edicion no sustituye el formulario. Una edicion concurrente obsoleta recibe un aviso y debe revisarse nuevamente.
- Las copias antiguas de localStorage se conservan para recuperacion. La version con cuentas no escribe los registros nuevos en esas claves comunes ni las muestra a miembros.
- Los reinicios de contrasena los hace el administrador desde Usuarios. No hay recuperacion por correo porque los usuarios no proporcionan uno. Si Edwin pierde su acceso, debe recuperarse mediante la administracion de Identity en Netlify.

## Verificacion

`npm test` verifica permisos, aislamiento, conflictos, migracion y operaciones de cuentas. Las pruebas usan datos efimeros que nunca se incluyen en la pagina ni en el almacenamiento real.

La integracion real de Identity y Blobs debe verificarse en un despliegue de Netlify. Una vista local o pruebas con servicios aislados no prueban la configuracion del sitio ni activan las cuentas reales.

