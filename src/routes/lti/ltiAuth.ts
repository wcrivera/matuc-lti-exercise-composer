// src/routes/lti/ltiAuth.ts
// Rutas LTI simplificadas para desarrollo

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Endpoint para obtener la configuración LTI pública
 */
router.get('/config', (req: Request, res: Response) => {
    try {
        const baseUrl = process.env.LTI_ISSUER || `${req.protocol}://${req.get('host')}`;
        
        const config = {
            title: 'MATUC - Generador de Ejercicios Matemáticos',
            description: 'Herramienta para crear y evaluar ejercicios matemáticos automáticamente',
            target_link_uri: `${baseUrl}/lti/launch`,
            oidc_initiation_url: `${baseUrl}/lti/login`,
            public_jwk_url: `${baseUrl}/lti/keys`,
            status: 'development',
            version: 'simplified'
        };

        res.json(config);
    } catch (error) {
        console.error('Error obteniendo configuración LTI:', error);
        res.status(500).json({ 
            error: 'Error obteniendo configuración LTI'
        });
    }
});

/**
 * Endpoint para obtener las claves públicas JWKS
 */
router.get('/keys', (req: Request, res: Response) => {
    try {
        const keys = {
            keys: [],
            message: 'JWKS simplificado para desarrollo',
            note: 'Configurar ltijs para claves reales'
        };
        
        res.json(keys);
    } catch (error) {
        console.error('Error obteniendo claves JWKS:', error);
        res.status(500).json({ 
            error: 'Error obteniendo claves públicas'
        });
    }
});

/**
 * Endpoint de prueba para verificar que LTI está funcionando
 */
router.get('/test', (req: Request, res: Response) => {
    res.json({
        status: 'LTI Service Active',
        timestamp: new Date().toISOString(),
        issuer: process.env.LTI_ISSUER,
        clientId: process.env.LTI_CLIENT_ID,
        endpoints: {
            login: '/lti/login',
            launch: '/lti/launch', 
            keys: '/lti/keys',
            config: '/lti/config'
        },
        message: '✅ LTI configurado correctamente (versión simplificada)'
    });
});

/**
 * Endpoint simplificado para validar tokens LTI
 */
router.post('/validate-session', (req: Request, res: Response) => {
    const { token } = req.body;
    
    if (!token) {
        res.status(400).json({
            ok: false,
            error: 'Token requerido'
        });
        return;
    }

    try {
        // Decodificar token de sesión (base64)
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        // Validación básica
        if (!sessionData.ltiContext) {
            res.status(400).json({
                ok: false,
                error: 'Token LTI inválido'
            });
            return;
        }

        // Respuesta exitosa
        res.json({
            ok: true,
            session: sessionData.ltiContext,
            message: 'Token LTI válido'
        });
        return;

    } catch (error) {
        res.status(400).json({
            ok: false,
            error: 'Error validando token'
        });
        return;
    }
});

/**
 * Endpoint para generar token de prueba
 */
router.get('/mock-session', (req: Request, res: Response) => {
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
        message: 'Mock LTI session creada',
        token: token,
        session: mockSession,
        note: 'Usar este token para probar validación'
    });
});

export default router;