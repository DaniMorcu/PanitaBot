#!/bin/bash
# =============================================================================
# PanitaBot - Script de Deploy a Google Cloud Run
# =============================================================================
# Ejecutar desde Google Cloud Shell (shell.cloud.google.com)
# o desde cualquier terminal con gcloud CLI instalado.
#
# Uso:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Requisitos previos:
#   1. Tener una cuenta de Google Cloud con facturación habilitada
#      (el free tier requiere tarjeta pero NO cobra si no pasas los límites)
#   2. Tener MongoDB Atlas configurado con el connection string listo
#      (ver instrucciones al final de este archivo)
# =============================================================================

set -e

# --- Colores ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_step() { echo -e "\n${CYAN}[PASO]${NC} $1"; }
print_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# CONFIGURACIÓN - Modifica estos valores según tu proyecto
# =============================================================================
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="panita-bot"
REPO_NAME="panita-bot"
IMAGE_NAME="bot"
MEMORY="128Mi"
CPU="1"
MIN_INSTANCES="0"
MAX_INSTANCES="1"
TIMEOUT="30"

# =============================================================================
# PASO 0: Verificar gcloud
# =============================================================================
print_step "Verificando gcloud CLI..."

if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI no encontrado."
    echo "Si estás en tu PC, instálalo desde: https://cloud.google.com/sdk/docs/install"
    echo "O usa Google Cloud Shell (gratis): https://shell.cloud.google.com"
    exit 1
fi

# Verificar autenticación
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1 | grep -q "@"; then
    print_warn "No estás autenticado. Iniciando login..."
    gcloud auth login
fi

ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
print_ok "Autenticado como: $ACCOUNT"

# =============================================================================
# PASO 1: Proyecto de GCP
# =============================================================================
print_step "Configurando proyecto de Google Cloud..."

# Listar proyectos existentes
echo ""
echo "Proyectos existentes:"
gcloud projects list --format="table(projectId, name)" 2>/dev/null || true
echo ""

read -p "¿Quieres crear un proyecto nuevo? (s/n): " CREATE_PROJECT

if [[ "$CREATE_PROJECT" == "s" || "$CREATE_PROJECT" == "S" ]]; then
    read -p "ID del proyecto (solo minúsculas, números y guiones, ej: panita-bot-prod): " PROJECT_ID
    
    echo "Creando proyecto '$PROJECT_ID'..."
    gcloud projects create "$PROJECT_ID" --name="PanitaBot" 2>/dev/null || {
        print_warn "El proyecto ya existe o no se pudo crear. Intentando seleccionarlo..."
    }
else
    read -p "ID del proyecto existente: " PROJECT_ID
fi

gcloud config set project "$PROJECT_ID"
print_ok "Proyecto configurado: $PROJECT_ID"

# =============================================================================
# PASO 2: Verificar facturación
# =============================================================================
print_step "Verificando cuenta de facturación..."

BILLING=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null || echo "false")

if [[ "$BILLING" != "True" ]]; then
    print_warn "Este proyecto NO tiene facturación habilitada."
    echo ""
    echo "Necesitas vincular una cuenta de facturación (incluso para el free tier)."
    echo "1. Ve a: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
    echo "2. Vincula o crea una cuenta de facturación"
    echo "3. Ejecuta este script de nuevo"
    echo ""
    echo "NOTA: El free tier NO cobra. La tarjeta es solo para verificación."
    read -p "¿Ya vinculaste la facturación? (s/n): " BILLING_DONE
    
    if [[ "$BILLING_DONE" != "s" && "$BILLING_DONE" != "S" ]]; then
        print_error "Configura la facturación primero y vuelve a ejecutar el script."
        exit 1
    fi
fi

print_ok "Facturación verificada."

# =============================================================================
# PASO 3: Habilitar APIs
# =============================================================================
print_step "Habilitando APIs necesarias (puede tardar 1-2 minutos)..."

gcloud services enable run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    --quiet

print_ok "APIs habilitadas: Cloud Run, Artifact Registry, Cloud Build"

# =============================================================================
# PASO 4: Crear repositorio en Artifact Registry
# =============================================================================
print_step "Configurando Artifact Registry..."

if gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null; then
    print_ok "Repositorio '$REPO_NAME' ya existe."
else
    echo "Creando repositorio de imágenes Docker..."
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Imágenes Docker de PanitaBot" \
        --quiet
    print_ok "Repositorio creado."
fi

# =============================================================================
# PASO 5: Pedir variables de entorno
# =============================================================================
print_step "Configurando variables de entorno..."

echo ""
echo "Necesito algunos datos para configurar el bot."
echo "Si no tienes alguno, puedes dejarlo vacío y actualizarlo después."
echo ""

# BOT_TOKEN
read -p "BOT_TOKEN (de @BotFather): " BOT_TOKEN
if [[ -z "$BOT_TOKEN" ]]; then
    print_error "BOT_TOKEN es obligatorio. Créalo en @BotFather de Telegram."
    exit 1
fi

# MONGODB_URI
echo ""
echo "MongoDB Atlas connection string."
echo "Formato: mongodb+srv://usuario:password@cluster.mongodb.net/panitabot"
echo "(Ver instrucciones de MongoDB Atlas al final de este script con: cat deploy.sh)"
read -p "MONGODB_URI: " MONGODB_URI
if [[ -z "$MONGODB_URI" ]]; then
    print_error "MONGODB_URI es obligatorio. Configura MongoDB Atlas primero."
    exit 1
fi

# ENCRYPTION_KEY
echo ""
ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')
echo "ENCRYPTION_KEY generada automáticamente: ${ENCRYPTION_KEY:0:16}..."
print_ok "Guárdala en un lugar seguro por si necesitas descifrar API keys existentes."

# WEBHOOK_SECRET
WEBHOOK_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')
print_ok "WEBHOOK_SECRET generado automáticamente."

# GEMINI_API_KEY
echo ""
read -p "GEMINI_API_KEY (global, opcional - cada grupo puede tener la suya): " GEMINI_API_KEY

# GEMINI_MODEL
read -p "GEMINI_MODEL (default: gemini-2.5-flash-lite): " GEMINI_MODEL
GEMINI_MODEL=${GEMINI_MODEL:-"gemini-2.5-flash-lite"}

echo ""
print_ok "Variables configuradas."

# =============================================================================
# PASO 6: Build y Push de la imagen
# =============================================================================
print_step "Construyendo imagen Docker con Cloud Build (puede tardar 2-5 minutos)..."

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest"

gcloud builds submit \
    --tag "$IMAGE_URI" \
    --quiet

print_ok "Imagen construida y subida: $IMAGE_URI"

# =============================================================================
# PASO 7: Primer deploy (sin WEBHOOK_URL)
# =============================================================================
print_step "Desplegando en Cloud Run (primer deploy para obtener la URL)..."

gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_URI" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --min-instances "$MIN_INSTANCES" \
    --max-instances "$MAX_INSTANCES" \
    --memory "$MEMORY" \
    --cpu "$CPU" \
    --timeout "$TIMEOUT" \
    --set-env-vars "MODE=webhook" \
    --set-env-vars "BOT_TOKEN=${BOT_TOKEN}" \
    --set-env-vars "MONGODB_URI=${MONGODB_URI}" \
    --set-env-vars "ENCRYPTION_KEY=${ENCRYPTION_KEY}" \
    --set-env-vars "WEBHOOK_SECRET=${WEBHOOK_SECRET}" \
    --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY}" \
    --set-env-vars "GEMINI_MODEL=${GEMINI_MODEL}" \
    --set-env-vars "DEFAULT_MODEL=gemini" \
    --set-env-vars "DEFAULT_MAX_TOKENS=1024" \
    --set-env-vars "DEFAULT_SUMMARY_COUNT=50" \
    --set-env-vars "WEBHOOK_URL=https://placeholder.run.app" \
    --quiet

# Obtener la URL asignada por Cloud Run
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --format="value(status.url)")

print_ok "URL de Cloud Run: $SERVICE_URL"

# =============================================================================
# PASO 8: Re-deploy con WEBHOOK_URL correcta
# =============================================================================
print_step "Re-desplegando con la URL de webhook correcta..."

gcloud run services update "$SERVICE_NAME" \
    --region "$REGION" \
    --update-env-vars "WEBHOOK_URL=${SERVICE_URL}" \
    --quiet

print_ok "Webhook URL configurada: ${SERVICE_URL}/webhook"

# =============================================================================
# PASO 9: Verificar
# =============================================================================
print_step "Verificando que todo funciona..."

# Health check
echo "Probando health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
    print_ok "Health check OK (HTTP 200)"
else
    print_warn "Health check respondió HTTP $HTTP_STATUS (puede tardar unos segundos en levantar)"
fi

# Verificar webhook con Telegram
echo "Verificando webhook registrado en Telegram..."
WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")

if echo "$WEBHOOK_INFO" | grep -q "${SERVICE_URL}/webhook"; then
    print_ok "Webhook registrado correctamente en Telegram"
else
    print_warn "El webhook puede tardar unos segundos en registrarse. Verifica manualmente:"
    echo "  curl https://api.telegram.org/bot\${BOT_TOKEN}/getWebhookInfo"
fi

# =============================================================================
# RESUMEN FINAL
# =============================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}¡PanitaBot desplegado con éxito!${NC}"
echo "=============================================="
echo ""
echo "URL del servicio:  $SERVICE_URL"
echo "Webhook URL:       ${SERVICE_URL}/webhook"
echo "Health check:      ${SERVICE_URL}/health"
echo "Proyecto GCP:      $PROJECT_ID"
echo "Región:            $REGION"
echo "Memoria:           $MEMORY"
echo "Instancias:        min=$MIN_INSTANCES, max=$MAX_INSTANCES"
echo ""
echo "--- Variables generadas (GUÁRDALAS) ---"
echo "ENCRYPTION_KEY:    $ENCRYPTION_KEY"
echo "WEBHOOK_SECRET:    $WEBHOOK_SECRET"
echo ""
echo "--- Comandos útiles ---"
echo "Ver logs:          gcloud run logs read --service $SERVICE_NAME --region $REGION"
echo "Ver logs en vivo:  gcloud run logs tail --service $SERVICE_NAME --region $REGION"
echo "Re-deploy:         gcloud run deploy $SERVICE_NAME --image $IMAGE_URI --region $REGION"
echo "Eliminar servicio: gcloud run services delete $SERVICE_NAME --region $REGION"
echo ""
echo "--- Para actualizar el bot ---"
echo "1. Haz cambios en el código"
echo "2. gcloud builds submit --tag $IMAGE_URI"
echo "3. gcloud run deploy $SERVICE_NAME --image $IMAGE_URI --region $REGION"
echo ""
echo "¡El Panita está en la nube, pana! 🚀"

# =============================================================================
# INSTRUCCIONES DE MONGODB ATLAS (referencia)
# =============================================================================
# 
# 1. Ve a https://www.mongodb.com/atlas y crea una cuenta (o inicia sesión)
#
# 2. Crear cluster gratuito:
#    - Click "Build a Database"
#    - Selecciona "M0" (Free / Shared)
#    - Provider: Google Cloud
#    - Region: Iowa (us-central1) - la misma que Cloud Run
#    - Cluster Name: panita-bot (o el que quieras)
#    - Click "Create Deployment"
#
# 3. Crear usuario de base de datos:
#    - Username: panitabot
#    - Password: (genera una segura)
#    - Click "Create Database User"
#
# 4. Configurar acceso de red:
#    - Ve a "Network Access" en el menú lateral
#    - Click "Add IP Address"
#    - Click "Allow Access from Anywhere" (0.0.0.0/0)
#    - IMPORTANTE: Cloud Run tiene IPs dinámicas, necesitas esto
#    - Click "Confirm"
#
# 5. Obtener connection string:
#    - Ve a "Database" en el menú lateral
#    - Click "Connect" en tu cluster
#    - Selecciona "Drivers"
#    - Copia el connection string
#    - Reemplaza <password> con la contraseña del paso 3
#    - Agrega el nombre de la base de datos: /panitabot
#    - Resultado: mongodb+srv://panitabot:TU_PASSWORD@cluster0.xxxxx.mongodb.net/panitabot
#
# =============================================================================
