// src/server.ts
// Servidor principal con soporte LTI (versión simplificada)

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
// import compression from 'compression'; // ⚠️ Comentado temporalmente
import { config } from 'dotenv';
import { dbConnection } from './database/config';
import { LTIService } from './services/ltiService';
import { securityConfig } from './config/lti';

// Importar rutas LTI
import ltiAuthRoutes from './routes/lti/ltiAuth';

// TODO: Importar tus rutas existentes cuando las tengas
import usuarioRoutes from './routes/usuario';
// import cursoRoutes from './routes/curso';
// ... etc

// Cargar variables de entorno
config();

class Server {
    private app: express.Application;
    private port: string;

    constructor() {
        this.app = express();
        this.port = process.env.PORT || '3000';

        this.setupSecurity();
        this.conectarDB();
        this.middlewares();
        this.setupLTI();
        this.routes();
    }

    /**
     * Configurar middleware de seguridad
     */
    private setupSecurity(): void {
        // Helmet para headers de seguridad (configurado para LTI)
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    connectSrc: ["'self'", "https://canvas.instructure.com", "https://*.instructure.com"],
                    frameSrc: ["'self'", "https://*.instructure.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    frameAncestors: ["'self'", "https://*.instructure.com"]
                }
            },
            xFrameOptions: false // ✅ CORREGIDO: era frameOptions, ahora es xFrameOptions
        }));

        // Rate limiting solo para APIs, no para LTI endpoints
        const limiter = rateLimit({
            windowMs: securityConfig.rateLimitWindow,
            max: securityConfig.rateLimitMax,
            message: {
                error: 'Demasiadas solicitudes, intenta de nuevo más tarde'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => {
                // No aplicar rate limiting a endpoints LTI
                return req.path.startsWith('/lti/');
            }
        });

        this.app.use('/api/', limiter);
    }

    /**
     * Conectar a la base de datos
     */
    async conectarDB() {
        try {
            await dbConnection();
        } catch (error) {
            console.error('❌ Error conectando a la base de datos:', error);
            process.exit(1);
        }
    }

    /**
     * Configurar middlewares básicos
     */
    middlewares() {
        // Logging de requests
        if (process.env.NODE_ENV === 'development') {
            this.app.use(morgan('dev'));
        }

        // Compresión (comentado temporalmente)
        // this.app.use(compression());

        // CORS configurado para Canvas y desarrollo
        this.app.use(cors({
            origin: (origin, callback) => {
                // Permitir Canvas, localhost y ngrok
                const allowedOrigins = [
                    ...securityConfig.corsOrigin,
                    'http://localhost:3000',
                    'http://localhost:3001',
                    'https://localhost:3000',
                    'https://localhost:3001'
                ];

                // Permitir ngrok URLs en desarrollo
                if (process.env.NODE_ENV === 'development' && origin && origin.includes('ngrok.io')) {
                    allowedOrigins.push(origin);
                }

                // Permitir Canvas URLs
                if (origin && origin.includes('instructure.com')) {
                    allowedOrigins.push(origin);
                }

                // Permitir requests sin origin (Postman, curl, etc.)
                if (!origin) return callback(null, true);

                if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                    callback(null, true);
                } else {
                    callback(new Error('No permitido por CORS'));
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-ltik', 'x-lti-token']
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Middleware para logging de LTI requests
        this.app.use('/lti/*', (req, res, next) => {
            console.log(`🎯 LTI Request: ${req.method} ${req.path}`);
            if (process.env.DEBUG_LTI === 'true') {
                console.log('Headers:', JSON.stringify(req.headers, null, 2));
            }
            next();
        });

        // Health check endpoint mejorado
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                service: 'MATUC-LTI Backend',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                uptime: Math.floor(process.uptime()),
                environment: process.env.NODE_ENV || 'development',
                features: {
                    lti: true,
                    canvas_integration: !!process.env.CANVAS_API_URL,
                    database: 'connected',
                    ssl: process.env.LTI_ISSUER?.startsWith('https://') || false
                },
                endpoints: {
                    lti_config: '/lti/config',
                    lti_keys: '/lti/keys',
                    lti_test: '/lti/test',
                    api_test: '/api/test'
                }
            });
        });

        // Endpoint de información del sistema
        this.app.get('/info', (req, res) => {
            res.json({
                name: 'MATUC-LTI Exercise Composer',
                description: 'Backend server for mathematical exercise generation with Canvas LTI integration',
                version: '1.0.0',
                author: 'Wolfgang Rivera',
                license: 'MIT',
                repository: 'https://github.com/wcrivera/matuc-lti-exercise-composer',
                technologies: {
                    runtime: 'Node.js',
                    framework: 'Express',
                    database: 'MongoDB',
                    lti: 'LTI 1.3',
                    language: 'TypeScript'
                }
            });
        });
    }

    /**
     * Configurar LTI
     */
    async setupLTI() {
        try {
            console.log('🔧 Configurando integración LTI...');
            await LTIService.setupProvider(this.app);
            console.log('✅ LTI configurado exitosamente');
        } catch (error) {
            console.error('❌ Error configurando LTI:', error);
            console.warn('⚠️  El servidor continuará sin funcionalidad LTI completa');
            console.warn('   Verifica la configuración en .env y las dependencias instaladas');
        }
    }

    /**
     * Configurar todas las rutas
     */
    routes() {
        // ====================================================
        // RUTAS LTI
        // ====================================================
        this.app.use('/lti', ltiAuthRoutes);

        // ====================================================
        // RUTAS DE API EXISTENTES (descomentadas cuando las tengas)
        // ====================================================

        // ✅ RUTAS IMPLEMENTADAS (comentadas temporalmente)
        this.app.use('/api/usuario', usuarioRoutes);

        // TODO: Descomentar cuando tengas las rutas
        // this.app.use('/api/curso', cursoRoutes);
        // this.app.use('/api/ejercicio', ejercicioRoutes);
        // this.app.use('/api/pregunta', preguntaRoutes);
        // ... agregar el resto de tus rutas

        // ====================================================
        // RUTAS DE PRUEBA Y DESARROLLO
        // ====================================================

        // Test general del servidor
        this.app.get('/api/test', (req, res) => {
            res.json({
                message: '🚀 MATUC-LTI Backend funcionando correctamente',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                lti_enabled: true,
                database_connected: true,
                note: 'Servidor base funcionando. Rutas específicas por agregar.'
            });
        });

        // Test de selectores (preparado para Fase 2)
        this.app.post('/api/test/selector', async (req, res): Promise<void> => {
            try {
                const { type, correct, user } = req.body;

                if (!type || !correct || user === undefined) {
                    res.status(400).json({
                        ok: false,
                        msg: 'Se requieren los campos: type, correct, user',
                        example: {
                            type: 'number',
                            correct: '42',
                            user: '42.0'
                        }
                    });
                    return;
                }

                // Por ahora una validación simple, mejoraremos en Fase 2
                const isCorrect = correct.toString().trim() === user.toString().trim();

                res.json({
                    ok: true,
                    result: {
                        correct: isCorrect,
                        score: isCorrect ? 100 : 0,
                        feedback: isCorrect ? 'Respuesta correcta' : 'Respuesta incorrecta'
                    },
                    message: 'Selector básico funcionando (mejorado en Fase 2)',
                    note: 'Este es un selector temporal. En Fase 2 implementaremos el sistema completo.'
                });

            } catch (error) {
                res.status(500).json({
                    ok: false,
                    msg: 'Error en endpoint de selectores',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        });

        // Test específico de LTI con datos mock
        this.app.get('/api/test/lti-session', (req, res) => {
            const mockSession = {
                ltiContext: {
                    userId: 'mock_user_123',
                    courseId: 'mock_course_456',
                    roles: ['Learner'],
                    resourceLinkId: 'mock_resource_789',
                    contextTitle: 'Curso de Matemáticas - Test'
                },
                isTeacher: false,
                isStudent: true,
                timestamp: new Date().toISOString()
            };

            const token = Buffer.from(JSON.stringify(mockSession)).toString('base64');

            res.json({
                message: 'Mock LTI session creada para pruebas',
                token,
                session: mockSession,
                note: 'Usa este token para probar el frontend sin Canvas'
            });
        });

        // 🆕 ENDPOINT ESPECIAL - Crear primer administrador sin autenticación
        this.app.post('/api/setup/admin', async (req, res): Promise<void> => {
            try {
                const { Usuario } = await import('./models/usuario');
                const bcrypt = await import('bcryptjs');

                // Verificar si ya existe un admin
                const adminExistente = await Usuario.findOne({ admin: true });

                if (adminExistente) {
                    res.status(400).json({
                        ok: false,
                        msg: 'Ya existe un administrador. Usa las rutas normales de creación.',
                        hint: 'Si olvidaste las credenciales, usa el endpoint /api/setup/reset-admin'
                    });
                    return;
                }

                const { nombre, apellido, email, password } = req.body;

                if (!nombre || !apellido || !email || !password) {
                    res.status(400).json({
                        ok: false,
                        msg: 'Todos los campos son obligatorios: nombre, apellido, email, password'
                    });
                    return;
                }

                // Verificar que no exista el email
                const usuarioExistente = await Usuario.findOne({ email });
                if (usuarioExistente) {
                    res.status(400).json({
                        ok: false,
                        msg: 'El email ya está registrado'
                    });
                    return;
                }

                // Crear primer admin
                const salt = bcrypt.genSaltSync();
                const hashedPassword = bcrypt.hashSync(password, salt);

                const admin = new Usuario({
                    nombre,
                    apellido,
                    email,
                    password: hashedPassword,
                    rol: 'Admin',
                    admin: true,
                    activo: true
                });

                await admin.save();

                res.json({
                    ok: true,
                    msg: '🎉 Primer administrador creado exitosamente',
                    admin: {
                        uid: admin.id,
                        nombre: admin.nombre,
                        apellido: admin.apellido,
                        email: admin.email,
                        rol: admin.rol,
                        admin: true
                    },
                    next_steps: [
                        '1. Hacer login en POST /api/usuario/login',
                        '2. Usar el token para crear más usuarios',
                        '3. Este endpoint se deshabilitará automáticamente'
                    ]
                });

            } catch (error) {
                console.error('Error creando admin inicial:', error);
                res.status(500).json({
                    ok: false,
                    msg: 'Error creando administrador inicial',
                    error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
                });
            }
        });

        // 🆕 ENDPOINT PARA RESET (solo desarrollo)
        this.app.post('/api/setup/reset-admin', async (req, res): Promise<void> => {
            if (process.env.NODE_ENV !== 'development') {
                res.status(403).json({
                    ok: false,
                    msg: 'Endpoint solo disponible en desarrollo'
                });
                return;
            }

            try {
                const { Usuario } = await import('./models/usuario');

                // Eliminar todos los admins (solo en desarrollo)
                await Usuario.deleteMany({ admin: true });

                res.json({
                    ok: true,
                    msg: '🔄 Administradores eliminados. Usa /api/setup/admin para crear uno nuevo',
                    note: 'Solo disponible en desarrollo'
                });

            } catch (error) {
                res.status(500).json({
                    ok: false,
                    msg: 'Error reseteando admins'
                });
            }
        });

        // ====================================================
        // MANEJO DE ERRORES Y RUTAS NO ENCONTRADAS
        // ====================================================

        // Ruta 404 para APIs
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint de API no encontrado',
                path: req.originalUrl,
                method: req.method,
                available_endpoints: [
                    'GET /health',
                    'GET /info',
                    'GET /api/test',
                    'POST /api/test/selector',
                    'GET /api/test/lti-session',
                    'GET /lti/config',
                    'GET /lti/test'
                ]
            });
        });

        // Ruta 404 general
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Ruta no encontrada',
                path: req.originalUrl,
                method: req.method,
                suggestion: 'Verifica la URL y método HTTP'
            });
        });

        // Manejo de errores global
        this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            console.error('Error no manejado:', error);

            res.status(error.status || 500).json({
                error: 'Error interno del servidor',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
                timestamp: new Date().toISOString()
            });
        });
    }

    /**
     * Iniciar el servidor
     */
    listen() {
        this.app.listen(this.port, () => {
            this.showStartupInfo();
        });
    }

    /**
     * Mostrar información de inicio
     */
    private showStartupInfo() {
        console.log('\n🚀 ===============================================');
        console.log('   MATUC-LTI BACKEND SERVER INICIADO');
        console.log('===============================================');
        console.log(`📍 Puerto: ${this.port}`);
        console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 URL Local: http://localhost:${this.port}`);

        if (process.env.LTI_ISSUER) {
            console.log(`🎯 LTI Issuer: ${process.env.LTI_ISSUER}`);
        }

        console.log('\n📋 ENDPOINTS PRINCIPALES:');
        console.log(`   Health Check:    http://localhost:${this.port}/health`);
        console.log(`   Info Sistema:    http://localhost:${this.port}/info`);
        console.log(`   Test API:        http://localhost:${this.port}/api/test`);
        console.log(`   LTI Config:      http://localhost:${this.port}/lti/config`);
        console.log(`   LTI Test:        http://localhost:${this.port}/lti/test`);
        console.log(`   LTI Keys:        http://localhost:${this.port}/lti/keys`);

        console.log('\n🔧 PARA CANVAS DEVELOPER KEY:');
        const issuer = process.env.LTI_ISSUER || `http://localhost:${this.port}`;
        console.log(`   Target Link URI: ${issuer}/lti/launch`);
        console.log(`   OIDC Login URL:  ${issuer}/lti/login`);
        console.log(`   JWK URL:         ${issuer}/lti/keys`);

        console.log('\n💡 DESARROLLO:');
        if (process.env.NODE_ENV === 'development') {
            console.log('   Para LTI usa:    ./scripts/dev-with-ngrok.sh');
            console.log('   Test Selector:   POST /api/test/selector');
            console.log('   Mock LTI:        GET /api/test/lti-session');
        }

        console.log('===============================================\n');
    }
}

// Crear y iniciar servidor
const server = new Server();
server.listen();

export default Server;