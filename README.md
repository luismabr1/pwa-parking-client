# PWA Parking Client - Sistema de Estacionamiento

Una aplicación web progresiva (PWA) completa para la gestión de estacionamientos con pagos móviles, notificaciones push y panel de administración.

## 🚀 Tecnologías Utilizadas

### Frontend
- **Next.js 15.3.5** - Framework React con App Router
- **React 19** - Biblioteca de interfaz de usuario
- **TypeScript** - Tipado estático para JavaScript
- **Tailwind CSS 4** - Framework de CSS utilitario
- **shadcn/ui** - Componentes de UI basados en Radix UI

### Backend
- **Next.js API Routes** - Endpoints del servidor
- **MongoDB 6.3.0** - Base de datos NoSQL
- **Cloudinary** - Almacenamiento y procesamiento de imágenes

### PWA y Notificaciones
- **Service Worker** - Funcionalidad offline y notificaciones push
- **Web Push API** - Notificaciones push nativas
- **Web App Manifest** - Configuración de instalación PWA

### Bibliotecas Adicionales
- **QR Scanner** - Escaneo de códigos QR
- **Lucide React** - Iconos
- **Sonner** - Notificaciones toast
- **Next Themes** - Soporte para temas claro/oscuro

## 📱 Características Principales

### Para Usuarios
- **Búsqueda de Tickets**: Por código manual o escaneo QR
- **Múltiples Métodos de Pago**:
  - Pago Móvil
  - Transferencia Bancaria
  - Efectivo (USD/Bolívares)
- **Notificaciones Push**: Actualizaciones en tiempo real del estado del pago
- **Instalación PWA**: Funciona como app nativa
- **Modo Offline**: Funcionalidad básica sin conexión

### Para Administradores
- **Gestión de Pagos**: Validación y rechazo de pagos
- **Configuración de Tarifas**: Precios y tasas de cambio
- **Datos Bancarios**: Configuración de cuentas para pagos
- **Notificaciones Admin**: Alertas de nuevos pagos

## 🏗️ Arquitectura del Sistema

### Estructura de Directorios
```
src/
├── app/                    # App Router de Next.js
│   ├── api/               # Endpoints del servidor
│   ├── ticket/[code]/     # Páginas dinámicas de tickets
│   └── globals.css        # Estilos globales
├── components/            # Componentes React
│   ├── ui/               # Componentes base de shadcn/ui
│   ├── notifications/    # Sistema de notificaciones
│   ├── ticket/          # Componentes específicos de tickets
│   └── payment-form.tsx # Formulario de pagos
├── hooks/                # Custom hooks
├── lib/                  # Utilidades y configuraciones
└── styles/              # Estilos adicionales
```

### Base de Datos (MongoDB)

#### Colecciones Principales:
- **tickets**: Información de tickets de estacionamiento
- **cars**: Datos de vehículos registrados
- **pagos**: Registros de pagos realizados
- **company_settings**: Configuración de la empresa
- **banks**: Lista de bancos disponibles
- **push_subscriptions**: Suscripciones para notificaciones

## 🔄 Flujos de Datos

### 1. Flujo de Búsqueda de Ticket
```
Usuario → Búsqueda (código/QR) → API /api/ticket/[code] → MongoDB → Validación → Respuesta
```

### 2. Flujo de Pago
```
Selección Método → Datos Bancarios → Formulario → API /api/process-payment → 
MongoDB (tickets, pagos, cars) → Cloudinary (imágenes) → Notificaciones Push
```

### 3. Flujo de Notificaciones
```
Evento (pago) → Service Worker → Push Subscription → API /api/send-notification → 
Web Push → Usuario/Admin
```

## 🚦 Estados del Sistema

### Estados de Tickets
- `disponible`: Ticket sin vehículo asignado
- `ocupado`: Vehículo registrado, pendiente confirmación
- `estacionado_confirmado`: Vehículo confirmado por personal
- `pagado_pendiente_validacion`: Pago registrado, esperando validación
- `pagado_pendiente_taquilla`: Pago en efectivo pendiente
- `pagado_validado`: Pago aprobado, listo para salir
- `salido`: Vehículo ha salido del estacionamiento

### Estados de Pagos
- `pendiente_validacion`: Esperando revisión del personal
- `validado`: Pago aprobado
- `rechazado`: Pago rechazado por el personal

## 🔧 Configuración y Instalación

### Variables de Entorno Requeridas
```env
MONGODB_URI=mongodb://localhost:27017/parking
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
NEXT_PUBLIC_VAPID_PUBLIC_KEY=tu_vapid_public_key
VAPID_PRIVATE_KEY=tu_vapid_private_key
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Comandos de Desarrollo
```bash
# Instalar dependencias
npm install

# Desarrollo con Turbopack
npm run dev

# Construcción para producción
npm run build

# Iniciar en producción
npm start

# Linting
npm run lint
```

## 📊 APIs Principales

### Endpoints de Tickets
- `GET /api/ticket/[code]` - Obtener detalles de ticket
- `GET /api/ticket-details` - Detalles con parámetros query

### Endpoints de Pagos
- `POST /api/process-payment` - Procesar nuevo pago
- `GET /api/company-settings` - Configuración de la empresa
- `GET /api/banks` - Lista de bancos

### Endpoints de Notificaciones
- `POST /api/push-subscriptions` - Gestionar suscripciones push
- `POST /api/send-notification` - Enviar notificaciones

## 🔐 Seguridad y Validaciones

### Validaciones de Pago
- Verificación de montos contra tarifas calculadas
- Validación de estados de tickets
- Campos obligatorios para pagos electrónicos
- Límites de tamaño para imágenes (5MB)

### Seguridad de Datos
- Validación de tipos en TypeScript
- Sanitización de inputs
- Manejo seguro de archivos con Cloudinary
- Headers de cache para APIs sensibles

## 🌐 PWA Features

### Service Worker (`public/sw.js`)
- Cache de recursos estáticos
- Manejo de notificaciones push
- Funcionalidad offline básica
- Interceptación de requests

### Manifest (`public/manifest.json`)
- Configuración de instalación
- Iconos adaptativos
- Shortcuts de aplicación
- Configuración de pantalla

## 🔔 Sistema de Notificaciones

### Tipos de Notificaciones
- **Usuario**: Confirmaciones de pago, estado del vehículo
- **Admin**: Nuevos pagos, solicitudes de validación
- **Test**: Notificaciones de prueba para desarrollo

### Implementación
- Web Push API con VAPID keys
- Suscripciones por ticket específico
- Manejo de permisos del navegador
- Fallback para navegadores no compatibles

## 🎨 UI/UX

### Componentes Principales
- **TicketSearch**: Búsqueda con QR y manual
- **PaymentForm**: Formulario multi-paso de pagos
- **NotificationSettings**: Configuración de notificaciones
- **PWAInstallPrompt**: Prompt de instalación

### Responsive Design
- Mobile-first approach
- Componentes adaptativos
- Optimización para PWA
- Soporte para modo oscuro

## 🔄 Flujo de Usuario Típico

1. **Búsqueda**: Usuario busca ticket por código o QR
2. **Validación**: Sistema verifica estado y calcula monto
3. **Método de Pago**: Usuario selecciona forma de pago
4. **Datos Bancarios**: Sistema muestra información para transferir
5. **Formulario**: Usuario completa datos de transferencia
6. **Confirmación**: Sistema registra pago y envía notificaciones
7. **Validación**: Personal valida el pago
8. **Salida**: Usuario puede salir del estacionamiento

## 🛠️ Mantenimiento y Desarrollo

### Estructura Modular
- Componentes reutilizables
- Hooks personalizados para lógica compleja
- Tipos TypeScript centralizados
- Utilidades compartidas

### Testing y Debug
- Console logs detallados en desarrollo
- Manejo de errores con try-catch
- Validaciones en frontend y backend
- Estados de loading y error

### Escalabilidad
- Arquitectura basada en componentes
- APIs RESTful
- Base de datos NoSQL flexible
- CDN para imágenes (Cloudinary)

---

## 📝 Notas para Desarrollo Futuro

- La aplicación está diseñada para ser modular y escalable
- Cada componente tiene responsabilidades específicas
- El sistema de notificaciones es independiente del flujo principal
- La PWA puede funcionar offline para funciones básicas
- MongoDB permite flexibilidad en el esquema de datos
- Cloudinary maneja automáticamente la optimización de imágenes

Para modificaciones futuras, revisar primero los tipos en `src/lib/types.ts` y los flujos en los componentes principales.

# Parking PWA - Sistema de Estacionamiento

Una aplicación web progresiva (PWA) completa para la gestión de estacionamientos con pagos móviles, notificaciones push y funcionalidad offline.

## Descripción General

**Parking PWA** es un sistema moderno de gestión de estacionamientos que permite a los usuarios buscar sus tickets, realizar pagos electrónicos y recibir notificaciones en tiempo real sobre el estado de sus vehículos. La aplicación está diseñada como una PWA, lo que significa que funciona tanto en navegadores web como puede instalarse en dispositivos móviles para una experiencia nativa.

## Características Principales

### **Búsqueda de Tickets**

- Búsqueda por código de ticket manual
- Escaneo de códigos QR para acceso rápido
- Validación en tiempo real del estado del ticket


### **Sistema de Pagos Múltiples**

- **Pago Móvil**: Transferencias instantáneas
- **Transferencia Bancaria**: Transferencias tradicionales
- **Efectivo**: Pagos en taquilla (USD y Bolívares)
- Carga de comprobantes de pago con imágenes
- Cálculo automático de montos con tasa de cambio


### **Notificaciones Push Inteligentes**

- Notificaciones automáticas cuando el pago es validado
- Alertas de estado del vehículo
- Soporte para modo offline
- Configuración automática por ticket


### **Tarifas Dinámicas**

- **Modelo Variable**: Cálculo por horas transcurridas
- **Modelo Fijo**: Tarifa única según horario de entrada
- Tarifas diferenciadas diurnas y nocturnas
- Configuración flexible de horarios nocturnos


### **PWA Completa**

- Instalable en dispositivos móviles
- Funcionalidad offline con Service Worker
- Página de error offline personalizada
- Caché inteligente de recursos


## Flujo de Usuario Completo

### 1. **Búsqueda del Ticket**

```plaintext
Usuario ingresa → Busca ticket (código/QR) → Sistema valida → Muestra detalles
```

### 2. **Visualización de Información**

- **Datos del Ticket**: Código, hora de entrada, estado
- **Información del Vehículo**: Placa, marca, modelo, propietario
- **Cálculo de Tarifa**: Monto en USD y Bolívares con tasa actual


### 3. **Proceso de Pago**

```plaintext
Selección método → Información bancaria → Datos transferencia → Confirmación → Registro
```

#### Pasos Detallados:

1. **Selección de Método**: Usuario elige entre pago móvil, transferencia o efectivo
2. **Información Bancaria**: Sistema muestra datos de la empresa para realizar el pago
3. **Registro de Transferencia**: Usuario ingresa referencia, banco, teléfono, cédula
4. **Tiempo de Salida**: Usuario indica cuándo planea salir (ahora, 5min, 10min, etc.)
5. **Comprobante**: Opción de subir imagen del comprobante
6. **Confirmación**: Revisión de todos los datos antes del envío


### 4. **Estados del Ticket**

- **Activo/Ocupado**: Vehículo registrado, listo para pago
- **Pago Pendiente Validación**: Pago electrónico registrado, esperando confirmación
- **Pago Pendiente Taquilla**: Pago en efectivo registrado, debe ir a taquilla
- **Pago Validado**: Pago confirmado, puede solicitar salida
- **Salido**: Proceso completado


### 5. **Notificaciones Automáticas**

- Al registrar pago: Se activan notificaciones automáticamente
- Validación: Usuario recibe notificación cuando el pago es aprobado
- Rechazo: Notificación si hay problemas con el pago


## Tecnologías Utilizadas

### **Frontend**

- **Next.js 15.3.5**: Framework React con App Router
- **React 19**: Biblioteca de interfaz de usuario
- **TypeScript**: Tipado estático para mayor robustez
- **Tailwind CSS 4**: Framework de estilos utilitarios
- **Radix UI**: Componentes accesibles y personalizables


### **Backend & Base de Datos**

- **MongoDB**: Base de datos NoSQL para almacenamiento
- **API Routes**: Endpoints serverless de Next.js
- **Cloudinary**: Almacenamiento y procesamiento de imágenes


### **PWA & Notificaciones**

- **Service Worker**: Funcionalidad offline y caché
- **Web Push API**: Notificaciones push nativas
- **VAPID**: Protocolo seguro para notificaciones
- **QR Scanner**: Lectura de códigos QR con cámara


### **Características Avanzadas**

- **Modo Oscuro**: Tema automático según preferencias del sistema
- **Responsive Design**: Optimizado para móviles y escritorio
- **Detección de Modo Incógnito**: Manejo especial para navegación privada
- **Gestión de Estados**: Control completo del flujo de la aplicación


## Arquitectura del Sistema

### **Estructura de Datos**

```plaintext
Tickets → Cars → Payments → Push Subscriptions
    ↓        ↓        ↓            ↓
  Estados   Info    Validación   Notificaciones
```

### **API Endpoints**

- `/api/ticket/[code]`: Obtener detalles del ticket
- `/api/process-payment`: Procesar pagos
- `/api/push-subscriptions`: Gestionar notificaciones
- `/api/send-notification`: Enviar notificaciones
- `/api/company-settings`: Configuración de la empresa
- `/api/banks`: Lista de bancos disponibles


### **Flujo de Datos**

1. **Cliente** busca ticket → **API** valida → **MongoDB** consulta
2. **Cliente** envía pago → **API** procesa → **Cloudinary** almacena imagen
3. **Sistema** actualiza estados → **Push Service** envía notificaciones


## Instalación y Configuración

### **Prerrequisitos**

- Node.js 18+
- MongoDB
- Cuenta de Cloudinary
- Claves VAPID para notificaciones push


### **Instalación**

```shellscript
# Clonar el repositorio
git clone <repository-url>
cd pwa-parking-client

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
```

### **Variables de Entorno Requeridas**

```plaintext
# Base de datos
MONGODB_URI=mongodb://localhost:27017/parking

# Cloudinary (para imágenes)
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# Notificaciones Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=tu_vapid_public_key
VAPID_PRIVATE_KEY=tu_vapid_private_key
VAPID_EMAIL=mailto:admin@tu-dominio.com

# Configuración general
NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
NEXT_PUBLIC_PRICING_MODEL=variable # o "fija"
```

### **Comandos Disponibles**

```shellscript
npm run dev          # Desarrollo con Turbo
npm run dev:clean    # Desarrollo limpio (limpia caché)
npm run build        # Construcción para producción
npm run start        # Servidor de producción
npm run lint         # Verificar código
npm run clean        # Limpiar caché (.next y node_modules/.cache)
npm run reset        # Reset completo (clean + install)
```

### **Comandos para Windows**

```shellscript
npm run clean:win    # Limpiar caché en Windows
npm run reset:win    # Reset completo en Windows
```

## Personalización

### **Logo y Branding**

Edita `src/config/app-config.ts`:

```typescript
export const APP_CONFIG = {
  logo: {
    src: "ruta/a/tu/logo.png", // Tu logo personalizado
    alt: "Mi Logo",
    fallbackText: "ML", // Texto si no hay logo
  },
  app: {
    name: "Mi Sistema de Estacionamiento",
    shortName: "Mi Parking",
    themeColor: "#000000", // Color principal
  },
  company: {
    name: "Mi Empresa",
  },
}
```

### **Configuración de Tarifas**

- **Variable de entorno**: `NEXT_PUBLIC_PRICING_MODEL=variable` o `fija`
- **Variable**: Cobra por horas transcurridas
- **Fija**: Tarifa única según horario de entrada


## Configuración de Servicios

### **MongoDB**

1. Instalar MongoDB localmente o usar MongoDB Atlas
2. Crear base de datos llamada `parking`
3. Las colecciones se crean automáticamente:

1. `tickets`: Información de tickets
2. `cars`: Datos de vehículos
3. `pagos`: Registros de pagos
4. `push_subscriptions`: Suscripciones de notificaciones
5. `company_settings`: Configuración de la empresa
6. `banks`: Lista de bancos





### **Cloudinary**

1. Crear cuenta en [Cloudinary](https://cloudinary.com)
2. Obtener credenciales del dashboard
3. Configurar variables de entorno


### **Notificaciones Push (VAPID)**

```shellscript
# Generar claves VAPID
npx web-push generate-vapid-keys
```

## Uso de la Aplicación

### **Para Usuarios**

1. **Acceder**: Abrir la aplicación en el navegador
2. **Buscar**: Ingresar código de ticket o escanear QR
3. **Pagar**: Seleccionar método de pago y completar proceso
4. **Notificaciones**: Recibir actualizaciones automáticas


### **Instalación como PWA**

- **Android**: "Agregar a pantalla de inicio"
- **iOS**: Safari → Compartir → "Agregar a pantalla de inicio"
- **Desktop**: Ícono de instalación en la barra de direcciones


## Seguridad y Privacidad

- **HTTPS**: Requerido para PWA y notificaciones
- **Validación**: Verificación completa de datos
- **Modo Incógnito**: Detección y manejo especial
- **Permisos**: Control granular de notificaciones
- **Datos**: Almacenamiento seguro en MongoDB


## Solución de Problemas

### **Errores Comunes**

1. **Error de chunk**: Ejecutar `npm run dev:clean`
2. **Notificaciones no funcionan**: Verificar HTTPS y permisos
3. **Base de datos**: Verificar conexión MongoDB
4. **Imágenes**: Verificar credenciales Cloudinary


### **Logs de Desarrollo**

- Consola del navegador para errores frontend
- Terminal para errores de servidor
- MongoDB logs para problemas de base de datos


## Despliegue

### **Vercel (Recomendado)**

1. Conectar repositorio a Vercel
2. Configurar variables de entorno
3. Desplegar automáticamente


### **Servidor Propio**

```shellscript
npm run build
npm start
```

## Contribución

1. Fork del proyecto
2. Crear rama para feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request


## Licencia

Este proyecto es privado. Todos los derechos reservados.

## Soporte

Para soporte técnico o consultas:

- Crear issue en el repositorio
- Contactar al equipo de desarrollo


---

**Parking PWA** - Sistema completo de gestión de estacionamientos con tecnología web moderna 🚗✨