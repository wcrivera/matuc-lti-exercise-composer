// src/helpers/generar-jwt.ts
// Helper para generar tokens JWT

import jwt from 'jsonwebtoken';

/**
 * Generar JWT para usuario cliente
 */
export const generarJWT = (uid: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const payload = { uid };

        const secretKey = process.env.SECRETORPRIVATEKEY || process.env.SECRET_JWT_SEED_CLIENTE;

        if (!secretKey) {
            reject('No se ha configurado la clave secreta JWT');
            return;
        }

        jwt.sign(payload, secretKey, {
            expiresIn: '24h'
        }, (err, token) => {
            if (err) {
                console.error('Error generando JWT:', err);
                reject('No se pudo generar el token');
            } else {
                resolve(token!);
            }
        }
        );
    });
};

/**
 * Generar JWT para administrador
 */
export const generarJWTAdmin = (uid: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const payload = { uid };

        const secretKey = process.env.SECRETORPRIVATEKEY || process.env.SECRET_JWT_SEED_ADMIN;

        if (!secretKey) {
            reject('No se ha configurado la clave secreta JWT Admin');
            return;
        }

        jwt.sign(
            payload,
            secretKey,
            {
                expiresIn: '24h'
            },
            (err, token) => {
                if (err) {
                    console.error('Error generando JWT Admin:', err);
                    reject('No se pudo generar el token de administrador');
                } else {
                    resolve(token!);
                }
            }
        );
    });
};

/**
 * 🆕 Generar JWT para PIMU
 */
export const generarJWTPIMU = (data: {
    nombre: string;
    apellido: string;
    email: string;
    curso?: string;
    grupo?: string;
}): Promise<string> => {
    return new Promise((resolve, reject) => {
        const payload = data;

        const secretKey = process.env.SECRET_JWT_SEED_PIMU;

        if (!secretKey) {
            reject('No se ha configurado la clave secreta JWT PIMU');
            return;
        }

        jwt.sign(
            payload,
            secretKey,
            {
                expiresIn: '1h' // PIMU tokens más cortos
            },
            (err, token) => {
                if (err) {
                    console.error('Error generando JWT PIMU:', err);
                    reject('No se pudo generar el token PIMU');
                } else {
                    resolve(token!);
                }
            }
        );
    });
};

/**
 * 🆕 Generar token de sesión LTI
 */
export const generarLTISessionToken = (ltiData: {
    ltiContext: any;
    isTeacher: boolean;
    isStudent: boolean;
}): string => {
    const sessionData = {
        ...ltiData,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
    };

    return Buffer.from(JSON.stringify(sessionData)).toString('base64');
};

/**
 * 🆕 Validar token de sesión LTI
 */
export const validarLTISessionToken = (token: string): {
    valid: boolean;
    data?: any;
    error?: string;
} => {
    try {
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());

        if (!sessionData.ltiContext || !sessionData.timestamp) {
            return {
                valid: false,
                error: 'Token LTI malformado'
            };
        }

        // Verificar expiración
        const expiresAt = new Date(sessionData.expiresAt || sessionData.timestamp);
        const now = new Date();

        if (now > expiresAt) {
            return {
                valid: false,
                error: 'Token LTI expirado'
            };
        }

        return {
            valid: true,
            data: sessionData
        };

    } catch (error) {
        return {
            valid: false,
            error: 'Error decodificando token LTI'
        };
    }
};

/**
 * 🆕 Verificar JWT sin lanzar error
 */
export const verificarJWT = (token: string, secret?: string): {
    valid: boolean;
    payload?: any;
    error?: string;
} => {
    try {
        const secretKey = secret || process.env.SECRETORPRIVATEKEY;

        if (!secretKey) {
            return {
                valid: false,
                error: 'Clave secreta no configurada'
            };
        }

        const payload = jwt.verify(token, secretKey);

        return {
            valid: true,
            payload
        };

    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Token inválido'
        };
    }
};

/**
 * Decodificar JWT sin verificar (útil para debug)
 */
export const decodificarJWT = (token: string): any => {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
};

export default {
    generarJWT,
    generarJWTAdmin,
    generarJWTPIMU,
    generarLTISessionToken,
    validarLTISessionToken,
    verificarJWT,
    decodificarJWT
};