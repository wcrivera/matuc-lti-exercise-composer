// src/middlewares/validar-jwt.ts
// Middleware JWT simplificado (compatible con tu sistema + LTI)

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extender Request para incluir información del usuario
export interface AuthenticatedRequest extends Request {
  user?: any;
  token?: string;
  uid?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  curso?: string;
  grupo?: string;
}

/**
 * Validar JWT de cliente/usuario
 */
export const validarJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.header('x-token') || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        ok: false,
        msg: 'No hay token en la petición'
      });
      return;
    }

    // Usar variable de entorno compatible con tu sistema
    const secretKey = process.env.SECRETORPRIVATEKEY || process.env.SECRET_JWT_SEED_CLIENTE;

    if (!secretKey) {
      res.status(500).json({
        ok: false,
        msg: 'Configuración de JWT no encontrada'
      });
      return;
    }

    const payload = jwt.verify(token, secretKey) as any;

    // Agregar información al request (compatible con tu sistema)
    req.params.uid = payload.uid;
    req.uid = payload.uid;
    req.token = token;

    next();
  } catch (error) {
    console.error('Error validando JWT:', error);
    res.status(401).json({
      ok: false,
      msg: 'Token no es válido'
    });
    return;
  }
};

/**
 * Validar JWT de administrador
 */
export const validarAdminJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.header('x-token') || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        ok: false,
        msg: 'No hay token en la petición'
      });
      return;
    }

    // Usar variable de entorno compatible con tu sistema
    const secretKey = process.env.SECRETORPRIVATEKEY || process.env.SECRET_JWT_SEED_ADMIN;

    if (!secretKey) {
      res.status(500).json({
        ok: false,
        msg: 'Configuración de JWT Admin no encontrada'
      });
      return;
    }

    const payload = jwt.verify(token, secretKey) as any;

    // Agregar información al request
    req.params.uid = payload.uid;
    req.uid = payload.uid;
    req.token = token;

    next();
  } catch (error) {
    console.error('Error validando Admin JWT:', error);
    res.status(401).json({
      ok: false,
      msg: 'Token de administrador no válido'
    });
    return;
  }
};

/**
 * Validar JWT de PIMU (sistema externo)
 */
export const validarPJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(401).json({
        ok: false,
        msg: 'No hay token en la petición'
      });
      return;
    }

    // Usar variable de entorno para PIMU
    const secretKey = process.env.SECRET_JWT_SEED_PIMU;

    if (!secretKey) {
      res.status(500).json({
        ok: false,
        msg: 'Configuración de JWT PIMU no encontrada'
      });
      return;
    }

    const payload = jwt.verify(token, secretKey) as any;

    // Agregar información específica de PIMU al request
    req.params.nombre = payload.nombre;
    req.params.apellido = payload.apellido;
    req.params.email = payload.email;
    req.params.curso = payload.curso;
    req.params.grupo = payload.grupo;

    // También en propiedades directas
    req.nombre = payload.nombre;
    req.apellido = payload.apellido;
    req.email = payload.email;
    req.curso = payload.curso;
    req.grupo = payload.grupo;

    next();
  } catch (error) {
    console.error('Error validando PIMU JWT:', error);
    res.status(401).json({
      ok: false,
      msg: 'Token PIMU no válido'
    });
    return;
  }
};

/**
 * 🆕 Validar token de sesión LTI (simplificado)
 */
export const validarLTIToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.header('x-lti-token') || req.query.token as string;

    if (!token) {
      res.status(401).json({
        ok: false,
        msg: 'No hay token LTI en la petición'
      });
      return;
    }

    // Decodificar token LTI (base64)
    const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());

    // Validar estructura básica
    if (!sessionData.ltiContext || !sessionData.timestamp) {
      res.status(400).json({
        ok: false,
        msg: 'Token LTI inválido'
      });
      return;
    }

    // Verificar que no sea muy antiguo (24 horas)
    const tokenTime = new Date(sessionData.timestamp);
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas en ms

    if (now.getTime() - tokenTime.getTime() > maxAge) {
      res.status(401).json({
        ok: false,
        msg: 'Token LTI expirado'
      });
      return;
    }

    // Agregar información LTI al request
    (req as any).ltiContext = sessionData.ltiContext;
    (req as any).isTeacher = sessionData.isTeacher;
    (req as any).isStudent = sessionData.isStudent;

    next();
  } catch (error) {
    console.error('Error validando LTI token:', error);
    res.status(400).json({
      ok: false,
      msg: 'Token LTI malformado'
    });
    return;
  }
};

/**
 * 🆕 Middleware opcional para LTI (no falla si no hay token)
 */
export const validarLTITokenOpcional = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const token = req.header('x-lti-token') || req.query.token as string;

  if (!token) {
    // No hay token LTI, continuar sin error
    (req as any).ltiContext = null;
    next();
    return;
  }

  try {
    const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());

    if (sessionData.ltiContext && sessionData.timestamp) {
      const tokenTime = new Date(sessionData.timestamp);
      const now = new Date();
      const maxAge = 24 * 60 * 60 * 1000;

      if (now.getTime() - tokenTime.getTime() <= maxAge) {
        (req as any).ltiContext = sessionData.ltiContext;
        (req as any).isTeacher = sessionData.isTeacher;
        (req as any).isStudent = sessionData.isStudent;
      }
    }
  } catch (error) {
    // Error decodificando, pero no bloqueamos la request
    console.warn('Token LTI opcional inválido:', error instanceof Error ? error.message : String(error));
  }

  next();
};

/**
 * 🆕 Validar que el usuario sea profesor (requiere LTI context)
 */
export const validarProfesorLTI = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!(req as any).ltiContext) {
    res.status(403).json({
      ok: false,
      msg: 'Contexto LTI requerido'
    });
    return;
  }

  if (!(req as any).isTeacher) {
    res.status(403).json({
      ok: false,
      msg: 'Acceso restringido a profesores'
    });
    return;
  }

  next();
};

/**
 * 🆕 Validar que el usuario sea estudiante (requiere LTI context)
 */
export const validarEstudianteLTI = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!(req as any).ltiContext) {
    res.status(403).json({
      ok: false,
      msg: 'Contexto LTI requerido'
    });
    return;
  }

  if (!(req as any).isStudent) {
    res.status(403).json({
      ok: false,
      msg: 'Acceso restringido a estudiantes'
    });
    return;
  }

  next();
};

// Extender el tipo Request globalmente
declare global {
  namespace Express {
    interface Request {
      uid?: string;
      token?: string;
      nombre?: string;
      apellido?: string;
      email?: string;
      curso?: string;
      grupo?: string;
      ltiContext?: any;
      isTeacher?: boolean;
      isStudent?: boolean;
    }
  }
}

export default {
  validarJWT,
  validarAdminJWT,
  validarPJWT,
  validarLTIToken,
  validarLTITokenOpcional,
  validarProfesorLTI,
  validarEstudianteLTI
};