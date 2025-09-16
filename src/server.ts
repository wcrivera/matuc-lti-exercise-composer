// src/server.ts
// Servidor principal mínimo para iniciar

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { dbConnection } from './database/config';

// Cargar variables de entorno
config();

class Server {
    private app: express.Application;
    private port: string;

    constructor() {
        this.app = express();
        this.port = process.env.PORT || '3000';

        this.conectarDB();
        this.middlewares();
        this.routes();
    }

    async conectarDB() {
        try {
            await dbConnection();
            console.log('✅ Base de datos conectada correctamente');
        } catch (error) {
            console.error('❌ Error conectando a la base de datos:', error);
            process.exit(1);
        }
    }

    middlewares() {
        // CORS
        this.app.use(cors());

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development'
            });
        });
    }

    routes() {
        // Ruta de prueba básica
        this.app.get('/api/test', (req, res) => {
            res.json({
                message: '🚀 Servidor MATUC-LTI funcionando correctamente',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        // Ruta para probar selectores
        this.app.post('/api/test/selector', async (req, res): Promise<void> => {
            try {
                const { SelectorFactory } = await import('./selectors/SelectorFactory');

                const { type, correct, user } = req.body;

                if (!type || !correct || !user) {
                    res.status(400).json({
                        ok: false,
                        msg: 'Se requieren los campos: type, correct, user'
                    });
                    return;
                }

                const result = await SelectorFactory.validateResponse(type, correct, user);

                res.json({
                    ok: true,
                    result,
                    message: 'Selector probado exitosamente'
                });

            } catch (error) {
                res.status(500).json({
                    ok: false,
                    msg: 'Error probando selector',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        });

        // Manejo de rutas no encontradas
        this.app.use('*', (req, res) => {
            res.status(404).json({
                ok: false,
                msg: `Ruta ${req.method} ${req.originalUrl} no encontrada`,
                availableRoutes: [
                    'GET /health',
                    'GET /api/test',
                    'POST /api/test/selector'
                ]
            });
        });
    }

    listen() {
        this.app.listen(this.port, () => {
            console.log(`🚀 Servidor corriendo en puerto ${this.port}`);
            console.log(`🌐 URL: http://localhost:${this.port}`);
            console.log(`📋 Health check: http://localhost:${this.port}/health`);
            console.log(`🧪 Test endpoint: http://localhost:${this.port}/api/test`);
            console.log(`🔬 Selector test: POST http://localhost:${this.port}/api/test/selector`);
        });
    }
}

const server = new Server();
server.listen();