// src/routes/usuario.ts
// Rutas de usuario (migrado y mejorado de tu sistema)

import { Router } from 'express';
import { check } from 'express-validator';
import { validarAdminJWT, validarJWT, validarPJWT } from '../middlewares/validar-jwt';
import { validarCampos } from '../middlewares/validar-campos';
import { validarGoogleToken } from '../middlewares/validar-google-token';
import * as usuarioCtrl from '../controllers/usuario';

const router = Router();

// ============================================================================
// RUTAS DE CLIENTE/USUARIO
// ============================================================================

/**
 * Login con credenciales
 */
router.post('/login', [
    check('email', 'El email es obligatorio').isEmail(),
    check('password', 'El password es obligatorio').notEmpty(),
    validarCampos
], usuarioCtrl.login);

/**
 * Login con Microsoft Outlook
 */
router.post('/outlook', usuarioCtrl.loginOutlook);

/**
 * Login con Google
 */
router.post('/google', validarGoogleToken, usuarioCtrl.loginGoogle);

/**
 * Login desde PIMU (sistema externo)
 */
router.post('/pimu', validarPJWT, usuarioCtrl.loginPIMU);

/**
 * Renovar token JWT
 */
router.get('/renew', validarJWT, usuarioCtrl.renewToken);

/**
 * Editar perfil de usuario
 */
router.put('/editar/:uid', [
    check('nombre', 'El nombre es obligatorio').optional().notEmpty(),
    check('apellido', 'El apellido es obligatorio').optional().notEmpty(),
    check('email', 'El email debe ser válido').optional().isEmail(),
    validarCampos,
    validarJWT
], usuarioCtrl.editarUsuario);

/**
 * Obtener perfil del usuario autenticado
 */
router.get('/perfil', validarJWT, usuarioCtrl.obtenerPerfil);

/**
 * Cambiar contraseña
 */
router.put('/cambiar-password', [
    check('passwordActual', 'La contraseña actual es obligatoria').notEmpty(),
    check('passwordNuevo', 'La nueva contraseña debe tener al menos 6 caracteres').isLength({ min: 6 }),
    validarCampos,
    validarJWT
], usuarioCtrl.cambiarPassword);

// ============================================================================
// 🆕 RUTAS LTI ESPECÍFICAS
// ============================================================================

/**
 * Crear/Actualizar usuario desde LTI Launch
 * (Canvas envía información del usuario)
 */
router.post('/lti/sync', usuarioCtrl.syncUsuarioLTI);

/**
 * Obtener información del usuario en contexto LTI
 */
router.get('/lti/info/:ltiUserId', usuarioCtrl.obtenerUsuarioLTI);

/**
 * Vincular usuario existente con datos LTI
 */
router.post('/lti/vincular', [
    check('ltiUserId', 'LTI User ID es obligatorio').notEmpty(),
    check('canvasUserId', 'Canvas User ID es obligatorio').notEmpty(),
    validarJWT
], usuarioCtrl.vincularUsuarioLTI);

// ============================================================================
// RUTAS DE ADMINISTRADOR
// ============================================================================

/**
 * Login de administrador con Outlook
 */
router.post('/admin/outlook', usuarioCtrl.loginOutlookAdmin);

/**
 * Obtener usuarios de un grupo específico
 */
router.get('/admin/obtener/:gid', validarAdminJWT, usuarioCtrl.obtenerUsuariosGrupo);

/**
 * Obtener usuarios NO matriculados en un grupo
 */
router.get('/admin/obtener-no-matriculado/:gid', validarAdminJWT, usuarioCtrl.obtenerUsuariosNoMatriculados);

/**
 * Crear usuario con contraseña (admin)
 */
router.post('/admin/crear/password', [
    check('nombre', 'El nombre es obligatorio').notEmpty(),
    check('apellido', 'El apellido es obligatorio').notEmpty(),
    check('email', 'El email es obligatorio').isEmail(),
    check('password', 'El password debe tener al menos 6 caracteres').isLength({ min: 6 }),
    check('rol', 'El rol es obligatorio').optional().isIn(['Estudiante', 'Profesor', 'Admin']),
    validarCampos,
    validarAdminJWT
], usuarioCtrl.crearUsuarioPassword);

/**
 * Crear usuario sin contraseña (admin)
 */
router.post('/admin/crear', [
    check('nombre', 'El nombre es obligatorio').notEmpty(),
    check('apellido', 'El apellido es obligatorio').notEmpty(),
    check('email', 'El email es obligatorio').isEmail(),
    check('rol', 'El rol es obligatorio').optional().isIn(['Estudiante', 'Profesor', 'Admin']),
    validarCampos,
    validarAdminJWT
], usuarioCtrl.crearUsuario);

/**
 * Eliminar usuario (admin)
 */
router.delete('/admin/eliminar/:uid', validarAdminJWT, usuarioCtrl.eliminarUsuario);

/**
 * Editar usuario (admin)
 */
router.put('/admin/editar/:uid', [
    check('nombre', 'El nombre es obligatorio').optional().notEmpty(),
    check('apellido', 'El apellido es obligatorio').optional().notEmpty(),
    check('email', 'El email debe ser válido').optional().isEmail(),
    check('rol', 'El rol debe ser válido').optional().isIn(['Estudiante', 'Profesor', 'Admin']),
    check('activo', 'El estado activo debe ser boolean').optional().isBoolean(),
    validarCampos,
    validarAdminJWT
], usuarioCtrl.editarUsuario);

/**
 * Obtener todos los usuarios (admin)
 */
router.get('/admin/todos', validarAdminJWT, usuarioCtrl.obtenerTodosUsuarios);

/**
 * Buscar usuarios por término (admin)
 */
router.get('/admin/buscar/:termino', validarAdminJWT, usuarioCtrl.buscarUsuarios);

/**
 * Estadísticas de usuarios (admin)
 */
router.get('/admin/estadisticas', validarAdminJWT, usuarioCtrl.estadisticasUsuarios);

// ============================================================================
// 🆕 RUTAS ADMIN LTI
// ============================================================================

/**
 * Obtener usuarios sincronizados con Canvas
 */
router.get('/admin/lti/canvas-users', validarAdminJWT, usuarioCtrl.obtenerUsuariosCanvas);

/**
 * Sincronizar usuarios con Canvas (admin)
 */
router.post('/admin/lti/sync-canvas', validarAdminJWT, usuarioCtrl.sincronizarConCanvas);

/**
 * Desvincular usuario de Canvas (admin)
 */
router.delete('/admin/lti/desvincular/:uid', validarAdminJWT, usuarioCtrl.desvincularCanvas);

// ============================================================================
// MIDDLEWARE DE MANEJO DE ERRORES ESPECÍFICO
// ============================================================================

router.use((error: any, req: any, res: any, next: any) => {
    console.error('Error en rutas de usuario:', error);

    // Error de validación de MongoDB
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map((err: any) => err.message);
        return res.status(400).json({
            ok: false,
            msg: 'Error de validación',
            errors
        });
    }

    // Error de duplicado (email ya existe)
    if (error.code === 11000) {
        return res.status(400).json({
            ok: false,
            msg: 'El email ya está registrado'
        });
    }

    // Error de casting (ID inválido)
    if (error.name === 'CastError') {
        return res.status(400).json({
            ok: false,
            msg: 'ID de usuario inválido'
        });
    }

    // Error genérico
    res.status(500).json({
        ok: false,
        msg: 'Error interno del servidor en rutas de usuario'
    });
});

export default router;

// ============================================================================
// DOCUMENTACIÓN DE ENDPOINTS
// ============================================================================

/**
 * ENDPOINTS DISPONIBLES:
 * 
 * === CLIENTE ===
 * POST   /api/usuario/login                    - Login con email/password
 * POST   /api/usuario/outlook                  - Login con Microsoft
 * POST   /api/usuario/google                   - Login con Google
 * POST   /api/usuario/pimu                     - Login desde PIMU
 * GET    /api/usuario/renew                    - Renovar token
 * GET    /api/usuario/perfil                   - Obtener perfil
 * PUT    /api/usuario/editar/:uid              - Editar perfil
 * PUT    /api/usuario/cambiar-password         - Cambiar contraseña
 * 
 * === LTI ===
 * POST   /api/usuario/lti/sync                 - Sincronizar usuario LTI
 * GET    /api/usuario/lti/info/:ltiUserId      - Info usuario LTI
 * POST   /api/usuario/lti/vincular             - Vincular usuario LTI
 * 
 * === ADMIN ===
 * POST   /api/usuario/admin/outlook            - Login admin Outlook
 * GET    /api/usuario/admin/obtener/:gid       - Usuarios de grupo
 * GET    /api/usuario/admin/obtener-no-matriculado/:gid - No matriculados
 * POST   /api/usuario/admin/crear/password     - Crear con password
 * POST   /api/usuario/admin/crear              - Crear sin password
 * DELETE /api/usuario/admin/eliminar/:uid      - Eliminar usuario
 * PUT    /api/usuario/admin/editar/:uid        - Editar usuario
 * GET    /api/usuario/admin/todos              - Todos los usuarios
 * GET    /api/usuario/admin/buscar/:termino    - Buscar usuarios
 * GET    /api/usuario/admin/estadisticas       - Estadísticas
 * 
 * === ADMIN LTI ===
 * GET    /api/usuario/admin/lti/canvas-users   - Usuarios Canvas
 * POST   /api/usuario/admin/lti/sync-canvas    - Sincronizar Canvas
 * DELETE /api/usuario/admin/lti/desvincular/:uid - Desvincular Canvas
 */