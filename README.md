# Barbería Turnos - Sistema de Reservas Online

Sistema de gestión de turnos para barberías. Permite a los clientes reservar citas online de manera fácil y a los barberos gestionar sus agendas.

## Tecnologías Utilizadas

- **React 19** - Librería de UI
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de estilos CSS
- **Firebase** - Backend y autenticación
- **React Router** - Enrutamiento
- **React Hot Toast** - Notificaciones
- **React Icons** - Iconos

## Instalación

1. Clonar el repositorio
2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Crear archivo `.env` basado en `.env.example`:

   ```bash
   cp .env.example .env
   ```

4. Configurar las variables de entorno de Firebase en el archivo `.env`

## Scripts Disponibles

- `npm run dev` - Iniciar servidor de desarrollo
- `npm run build` - Compilar para producción
- `npm run preview` - Previsualizar build de producción
- `npm run lint` - Ejecutar linter

## Estructura de Carpetas

```
src/
├── pages/       - Páginas principales de la aplicación
├── components/  - Componentes reutilizables
├── hooks/       - Hooks personalizados
├── services/    - Servicios (Firebase, APIs, etc.)
├── context/     - Context API para estado global
```

## Setup

1. Clonar el repositorio:
   ```bash
   git clone <URL_DEL_REPO>
   cd app_turnos_barberia
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Copiar `.env.example` a `.env` y completar credenciales de Firebase:
   ```bash
   cp .env.example .env
   ```
4. Copiar `functions/.env.example` a `functions/.env` y completar credenciales de Twilio:
   ```bash
   cp functions/.env.example functions/.env
   ```

## Deploy

- Frontend en Vercel:

  ```bash
  vercel deploy
  ```

- Functions en Firebase:
  ```bash
  cd functions
  npm install
  cd ..
  firebase deploy --only functions
  ```

## Crear proyecto Firebase

1. Ir a https://console.firebase.google.com
2. Crear nuevo proyecto (o usar `barberia-turnos`).
3. En Authentication > Métodos de inicio de sesión, habilitar Phone.
4. En Firestore, crear base de datos en modo producción o prueba.
5. Copiar credenciales de configuración de Firebase en `.env`.

## Configuración de Twilio WhatsApp

1. Crea un proyecto en https://www.twilio.com/ y ve al panel de _Programmable Messaging_.
2. En el menú _Try it out_, selecciona _Try WhatsApp_ y sigue las instrucciones para configurar Twilio Sandbox.
3. Vincula tu número personal enviando el código generado al número de sandbox (ej.: `join sala-de-dioses`).
4. Copia tus credenciales:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM` (por defecto: `whatsapp:+14155238886`)
5. Crea `functions/.env` basado en `functions/.env.example` y completa las credenciales.

## Uso de las funciones

- `onTurnoCreado`: Envía WhatsApp inmediato al crear turno confirmado.
- `recordatorios`: Se ejecuta cada 30 min y envía recordatorio 24h/1h.
- `cancelarTurno`: Callable desde frontend para cancelar un turno y notificar por WhatsApp.

## Licencia

Privado
