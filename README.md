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