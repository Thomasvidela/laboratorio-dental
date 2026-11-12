# Guía Paso a Paso: Cómo Alojar Gratis 24/7 tu PWA en la Nube (Vercel + Neon Postgres)

Esta guía te permite subir **DentalLab Pro** gratis a internet para usarla desde el teléfono del protesista las 24 horas (con Wi-Fi o datos móviles 4G/5G) **sin tener que dejar ninguna computadora encendida**.

---

## Paso 1: Subir esta carpeta a tu cuenta de GitHub (Privado)
1. Entra a [github.com](https://github.com) e inicia sesión (o crea una cuenta gratuita).
2. Crea un nuevo repositorio llamado `laboratorio-dental` y márcalo como **Private (Privado)**.
3. Sube los archivos de esta carpeta `Laboratorio_dental` (no hace falta subir `node_modules` ni `.next`, ya están excluidos en `.gitignore`).

## Paso 2: Conectar el Proyecto en Vercel (Gratis)
1. Entra a [vercel.com](https://vercel.com) y regístrate gratis usando tu cuenta de GitHub (**Continue with GitHub**).
2. Haz clic en **"Add New..." -> "Project"** e importa tu repositorio `laboratorio-dental`.
3. Antes de darle a Deploy, ve a la sección **Storage** (o una vez creado el proyecto entra a la pestaña **Storage** arriba):
   - Haz clic en **"Create Database"** -> elige **Neon (Serverless Postgres)** -> elige el plan **Free ($0/mes)** y presiona **Create**.
   - Vercel conectará automáticamente la variable `DATABASE_URL` a tu proyecto.
4. En **Settings -> Environment Variables**, agrega una variable más:
   - Nombre: `JWT_SECRET`
   - Valor: escribe cualquier frase larga y secreta (ej. `ClaveUltraSecretaDeMiLaboratorioDental2026_998877`).

## Paso 3: Desplegar y Crear tu Cuenta de Protesista
1. En Vercel ve a **Deployments** y haz clic en **Redeploy** (o se desplegará automáticamente al subirlo).
2. Como ya configuramos `vercel.json` con el comando `npm run vercel-build`, Vercel **creará automáticamente todas las tablas de la base de datos y activará el Backup Automático**.
3. Abre el enlace fijo que te da Vercel (ej. `https://laboratorio-dental-tomas.vercel.app`) desde el teléfono del protesista:
   - Crea tu cuenta inicial de protesista (el registro público se bloqueará automáticamente para que nadie más pueda registrarse).
   - Toca **"Instalar App"** (o *"Agregar a pantalla de inicio"* en Chrome/Safari) y ya tendrás el ícono en tu celular.

---

## ¿Cómo Pasar tus Datos de la PC Local a la Nube (o viceversa)?
1. En tu PC local, entra a la pestaña **Seguridad** y toca **"Descargar .JSON"**.
2. Abre la aplicación de la nube, entra a la pestaña **Seguridad**, toca **"Importar .JSON"** y selecciona ese archivo. ¡Todos tus precios, dentistas, trabajos y pagos se copiarán en 1 segundo!
