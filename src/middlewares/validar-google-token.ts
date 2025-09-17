// src/middlewares/validar-google-token.ts
// Middleware para validar tokens de Google OAuth (simplificado)

import { Request, Response, NextFunction } from 'express';

interface GoogleTokenRequest extends Request {
    googleUser?: {
        id: string;
        email: string;
        name: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
    };
}

/**
 * Middleware para validar token de Google (versión simplificada)
 */
export const validarGoogleToken = async (req: GoogleTokenRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { token } = req.body;

        if (!token) {
            res.status(400).json({
                ok: false,
                msg: 'Token de Google requerido'
            });
            return;
        }

        // En desarrollo, permitir token mock
        if (process.env.NODE_ENV === 'development') {
            if (token === 'mock_google_token') {
                req.googleUser = {
                    id: 'mock_google_id_123',
                    email: 'test@gmail.com',
                    name: 'Usuario Test',
                    given_name: 'Usuario',
                    family_name: 'Test',
                    picture: 'https://via.placeholder.com/150'
                };
                next();
                return;
            }
        }

        // Validación simplificada para desarrollo
        if (typeof token === 'string' && token.length > 10) {
            // Token parece válido, crear usuario mock para desarrollo
            req.googleUser = {
                id: `google_${Date.now()}`,
                email: req.body.email || 'usuario@gmail.com',
                name: req.body.name || 'Usuario Google',
                given_name: req.body.given_name || 'Usuario',
                family_name: req.body.family_name || 'Google'
            };

            next();
            return;
        } else {
            res.status(401).json({
                ok: false,
                msg: 'Token de Google inválido'
            });
            return;
        }

    } catch (error) {
        console.error('Error validando token de Google:', error);
        res.status(401).json({
            ok: false,
            msg: 'Error validando token de Google',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        });
        return;
    }
};

/**
 * Middleware para extraer información del usuario de Google
 */
export const extraerInfoGoogle = (req: GoogleTokenRequest, res: Response, next: NextFunction): void => {
    if (!req.googleUser) {
        res.status(400).json({
            ok: false,
            msg: 'Información de Google no disponible'
        });
        return;
    }

    // Agregar información de Google al body para el controlador
    req.body.googleId = req.googleUser.id;
    req.body.email = req.googleUser.email;
    req.body.nombre = req.googleUser.given_name || req.googleUser.name;
    req.body.apellido = req.googleUser.family_name || '';
    req.body.picture = req.googleUser.picture;

    next();
};

export default {
    validarGoogleToken,
    extraerInfoGoogle
}