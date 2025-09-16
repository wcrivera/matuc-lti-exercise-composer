// src/middlewares/validar-jwt.ts
// Middleware JWT mejorado (migrado de tu sistema)

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Usuario } from '../models/usuario';

export interface AuthenticatedRequest extends Request {
  user?: any;
  token?: string;
}

export const validarJWT = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.header('x-token') || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      ok: false,
      msg: 'No hay token en la petición'
    });
  }

  try {
    const payload = jwt.verify(token, process.env.SECRETORPRIVATEKEY!) as any;
    
    // Verificar que el usuario existe y está activo
    const usuario = await Usuario.findById(payload.uid).select('-password');
    
    if (!usuario) {
      return res.status(401).json({
        ok: false,
        msg: 'Token no válido - usuario no existe'
      });
    }

    if (!usuario.isActive()) {
      return res.status(401).json({
        ok: false,
        msg: 'Token no válido - usuario inactivo'
      });
    }

    // Agregar información del usuario al request
    req.user = usuario;
    req