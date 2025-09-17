// src/middlewares/validar-campos.ts
// Middleware para validar campos usando express-validator

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Middleware para validar campos usando express-validator
 */
export const validarCampos = (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.type === 'field' ? (error as any).path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? (error as any).value : null
        }));

        res.status(400).json({
            ok: false,
            msg: 'Error de validación en los campos',
            errors: errorMessages
        });
        return;
    }

    next();
};

/**
 * Middleware para validar campos específicos de LTI
 */
export const validarCamposLTI = (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.type === 'field' ? (error as any).path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? (error as any).value : null
        }));

        res.status(400).json({
            ok: false,
            msg: 'Error de validación en campos LTI',
            errors: errorMessages,
            lti_context: 'Campo requerido para integración con Canvas'
        });
        return;
    }

    next();
};

/**
 * Middleware para validar archivos subidos
 */
export const validarArchivos = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.files || Object.keys(req.files).length === 0) {
        res.status(400).json({
            ok: false,
            msg: 'No se han subido archivos'
        });
        return;
    }

    next();
};

/**
 * Middleware para validar tipos de archivo permitidos
 */
export const validarTiposArchivo = (tiposPermitidos: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.files) {
            next();
            return;
        }

        const archivos = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();

        for (const archivo of archivos) {
            const extension = (archivo as any).name.split('.').pop()?.toLowerCase();

            if (!tiposPermitidos.includes(extension || '')) {
                res.status(400).json({
                    ok: false,
                    msg: `Tipo de archivo no permitido: ${extension}`,
                    tipos_permitidos: tiposPermitidos
                });
                return;
            }
        }

        next();
    };
};

/**
 * Middleware para validar tamaño de archivos
 */
export const validarTamañoArchivo = (tamañoMaxMB: number) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.files) {
            next();
            return;
        }

        const tamañoMaxBytes = tamañoMaxMB * 1024 * 1024;
        const archivos = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();

        for (const archivo of archivos) {
            if ((archivo as any).size > tamañoMaxBytes) {
                res.status(400).json({
                    ok: false,
                    msg: `Archivo demasiado grande: ${((archivo as any).size / 1024 / 1024).toFixed(2)}MB`,
                    tamaño_maximo: `${tamañoMaxMB}MB`
                });
                return;
            }
        }

        next();
    };
};

export default {
    validarCampos,
    validarCamposLTI,
    validarArchivos,
    validarTiposArchivo,
    validarTamañoArchivo
};