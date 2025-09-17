#!/bin/bash

# ============================================================================
# SETUP DESARROLLO - MATUC LTI
# ============================================================================

set -e

echo "🚀 Configurando entorno de desarrollo MATUC-LTI..."
echo ""

# ============================================================================
# 1. VERIFICAR PREREQUISITOS
# ============================================================================

echo "📋 Verificando prerequisitos..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Instala Node.js 18+ desde https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "18" ]; then
    echo "❌ Node.js versión 18+ requerida. Versión actual: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado"
    exit 1
fi

echo "✅ npm $(npm -v)"

# Verificar MongoDB
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB no detectado. Instala MongoDB Community desde https://www.mongodb.com/try/download/community"
    echo "   O usa MongoDB Atlas (cloud) configurando DB_CNN en .env"
    echo ""
fi

# ============================================================================
# 2. INSTALAR DEPENDENCIAS
# ============================================================================

echo "📦 Instalando dependencias de Node.js..."

npm install

echo "✅ Dependencias instaladas"

# ============================================================================
# 3. CONFIGURAR VARIABLES DE ENTORNO
# ============================================================================

echo "🔧 Configurando variables de entorno..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Archivo .env creado desde .env.example"
    else
        echo "❌ No se encontró .env.example"
        echo "   Crea manualmente un archivo .env con las variables necesarias"
        exit 1
    fi
else
    echo "✅ Archivo .env ya existe"
fi

# ============================================================================
# 4. CONFIGURAR NGROK PARA DESARROLLO LTI
# ============================================================================

echo "🌐 Verificando ngrok para HTTPS (requerido para LTI)..."

if ! command -v ngrok &> /dev/null; then
    echo "⚠️  ngrok no está instalado."
    echo "   Para LTI necesitas HTTPS. Opciones:"
    echo "   1. Instalar ngrok: https://ngrok.com/download"
    echo "   2. Usar otro túnel HTTPS (localtunnel, serveo, etc.)"
    echo "   3. Configurar SSL local con certificados"
    echo ""
    read -p "¿Quieres continuar sin ngrok? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Instala ngrok y ejecuta el script nuevamente"
        exit 1
    fi
else
    echo "✅ ngrok detectado"
    
    # Verificar si existe token de ngrok
    if [ -z "${NGROK_AUTH_TOKEN}" ]; then
        echo "💡 Para usar ngrok con subdominio personalizado:"
        echo "   1. Crea cuenta en https://ngrok.com"
        echo "   2. Copia tu authtoken"
        echo "   3. Agrégalo a .env: NGROK_AUTH_TOKEN=tu_token_aqui"
        echo ""
    fi
fi

# ============================================================================
# 5. VERIFICAR MONGODB
# ============================================================================

echo "🗃️  Verificando MongoDB..."

# Leer URL de MongoDB del .env
if [ -f ".env" ]; then
    DB_URL=$(grep -E "^DB_CNN=" .env | cut -d'=' -f2-)
    if [ -z "$DB_URL" ]; then
        DB_URL="mongodb://localhost:27017/matuc-lti-dev"
    fi
else
    DB_URL="mongodb://localhost:27017/matuc-lti-dev"
fi

echo "   URL de base de datos: $DB_URL"

# ============================================================================
# 6. CREAR DIRECTORIOS NECESARIOS
# ============================================================================

echo "📁 Creando estructura de directorios..."

mkdir -p src/controllers/lti
mkdir -p src/models/lti
mkdir -p src/routes/lti
mkdir -p src/services
mkdir -p src/config
mkdir -p src/utils
mkdir -p logs
mkdir -p tests/unit
mkdir -p tests/integration
mkdir -p docs

echo "✅ Directorios creados"

# ============================================================================
# 7. CONFIGURACIÓN TYPESCRIPT
# ============================================================================

echo "⚙️  Verificando configuración TypeScript..."

if [ ! -f "tsconfig.json" ]; then
    echo "📝 Creando tsconfig.json básico..."
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "removeComments": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
EOF
    echo "✅ tsconfig.json creado"
else
    echo "✅ tsconfig.json ya existe"
fi

# ============================================================================
# 8. SCRIPTS DE DESARROLLO
# ============================================================================

echo "🛠️  Configurando scripts de desarrollo..."

# Script para iniciar con ngrok
cat > scripts/dev-with-ngrok.sh << 'EOF'
#!/bin/bash

echo "🚀 Iniciando desarrollo con ngrok..."

# Iniciar ngrok en background
ngrok http 3000 --log=stdout > logs/ngrok.log 2>&1 &
NGROK_PID=$!

# Esperar a que ngrok se inicie
sleep 3

# Obtener URL de ngrok
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok\.io')

if [ -z "$NGROK_URL" ]; then
    echo "❌ No se pudo obtener URL de ngrok"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo "✅ ngrok iniciado: $NGROK_URL"
echo "💡 Actualiza LTI_ISSUER en .env con: $NGROK_URL"

# Actualizar .env automáticamente
if [ -f ".env" ]; then
    sed -i.bak "s|LTI_ISSUER=.*|LTI_ISSUER=$NGROK_URL|g" .env
    echo "✅ .env actualizado automáticamente"
fi

echo "🎯 Configuración para Canvas Developer Key:"
echo "   Target Link URI: $NGROK_URL/lti/launch"
echo "   OpenID Connect Initiation Url: $NGROK_URL/lti/login"
echo "   JWK Method: Public JWK URL"
echo "   Public JWK URL: $NGROK_URL/lti/keys"
echo ""

# Iniciar servidor de desarrollo
npm run dev

# Limpiar al salir
trap "kill $NGROK_PID 2>/dev/null; exit" INT TERM
EOF

chmod +x scripts/dev-with-ngrok.sh

# ============================================================================
# 9. RESUMEN FINAL
# ============================================================================

echo ""
echo "🎉 ¡Configuración completada!"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo ""
echo "1. 🔧 Configura tu .env:"
echo "   - Actualiza DB_CNN con tu URL de MongoDB"
echo "   - Configura LTI_ISSUER (se auto-actualiza con ngrok)"
echo ""
echo "2. 🚀 Inicia el servidor de desarrollo:"
echo "   npm run dev                    # Desarrollo normal"
echo "   ./scripts/dev-with-ngrok.sh    # Con ngrok para LTI"
echo ""
echo "3. 🎯 Configura Canvas Developer Key:"
echo "   - Ve a tu Canvas > Admin > Developer Keys"
echo "   - Crea nueva LTI Key"
echo "   - Usa las URLs que mostrará ngrok"
echo ""
echo "4. ✅ Prueba los endpoints:"
echo "   http://localhost:3000/health           # Estado del servidor"
echo "   http://localhost:3000/lti/config       # Configuración LTI"
echo "   http://localhost:3000/lti/test         # Test LTI"
echo ""
echo "🔗 Documentación: docs/development/setup-guide.md"
echo ""