# Municipio Digital para iOS

El proyecto nativo de iPhone y iPad está preparado en `ios/App` con:

- Nombre: Municipio Digital
- Identificador: `bo.gob.gamcc.municipiodigital`
- Versión inicial: 1.0 (compilación 1)
- Compatibilidad: iOS 15 o superior
- Orientación adaptable: vertical y horizontal
- Icono y pantalla de inicio con la marca municipal
- Conexión segura al sistema publicado en `https://sisgem-cc.vercel.app/`

## Compilación y prueba en un Mac

1. Instalar Node.js 22 o superior, Xcode 26 o superior y sus herramientas de línea de comandos.
2. Abrir el repositorio e instalar las dependencias con `pnpm install`.
3. Ejecutar `pnpm ios:sync`.
4. Ejecutar `pnpm ios:open` para abrir el proyecto en Xcode.
5. En Signing & Capabilities, seleccionar la cuenta y el equipo de Apple del GAMCC.
6. Probar la aplicación en un iPhone, iPad o simulador.

## TestFlight y App Store

En Xcode se debe crear un Archive, validarlo y distribuirlo mediante App Store Connect. Para publicar o generar un IPA instalable se necesita una membresía activa de Apple Developer, un certificado de firma y el perfil de aprovisionamiento correspondiente. No se deben guardar certificados ni claves privadas dentro del repositorio.
