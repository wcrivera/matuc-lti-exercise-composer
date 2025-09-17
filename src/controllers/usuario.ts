// src/controllers/usuario.ts
// Controlador de usuario (migrado y mejorado de tu sistema)

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Usuario } from '../models/usuario';
import { Matricula } from '../models/matricula';
import { generarJWT, generarJWTAdmin } from '../helpers/generar-jwt';
import { AuthenticatedRequest } from '../middlewares/validar-jwt';

// ============================================================================
// CONTROLADORES DE AUTENTICACIÓN
// ============================================================================

/**
 * Login con email y contraseña
 */
export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        // Buscar usuario por email
        const usuarioEncontrado = await Usuario.findOne({ email });

        if (!usuarioEncontrado) {
            return res.status(400).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        // Verificar que el usuario esté activo
        if (!usuarioEncontrado.activo) {
            return res.status(400).json({
                ok: false,
                msg: 'Usuario inactivo. Contacta al administrador'
            });
        }

        // Verificar contraseña
        if (!usuarioEncontrado.password) {
            return res.status(400).json({
                ok: false,
                msg: 'Usuario sin contraseña configurada'
            });
        }

        const validPassword = bcrypt.compareSync(password, usuarioEncontrado.password);

        if (!validPassword) {
            return res.status(400).json({
                ok: false,
                msg: 'Contraseña incorrecta'
            });
        }

        // Generar token
        const token = await generarJWT(usuarioEncontrado.id);

        return res.json({
            ok: true,
            usuario: {
                uid: usuarioEncontrado.id,
                nombre: usuarioEncontrado.nombre,
                apellido: usuarioEncontrado.apellido,
                email: usuarioEncontrado.email,
                rol: usuarioEncontrado.rol,
                admin: usuarioEncontrado.admin || false
            },
            token
        });

    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

/**
 * Login con Microsoft Outlook
 */
export const loginOutlook = async (req: Request, res: Response) => {
    const { email, nombre, apellido } = req.body;

    try {
        let usuario = await Usuario.findOne({ email });

        if (!usuario) {
            // Crear nuevo usuario
            usuario = new Usuario({
                nombre,
                apellido,
                email,
                rol: 'Estudiante',
                activo: true,
                outlook: true
            });

            await usuario.save();
        }

        // Generar token
        const token = await generarJWT(usuario.id);

        return res.json({
            ok: true,
            usuario: {
                uid: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol,
                admin: usuario.admin || false
            },
            token,
            isNewUser: !usuario
        });

    } catch (error) {
        console.error('Error en loginOutlook:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error en autenticación con Outlook'
        });
    }
};

/**
 * Login con Google
 */
export const loginGoogle = async (req: Request, res: Response) => {
    const { email, nombre, apellido, googleId, picture } = req.body;

    try {
        let usuario = await Usuario.findOne({ email });

        if (!usuario) {
            // Crear nuevo usuario
            usuario = new Usuario({
                nombre,
                apellido,
                email,
                rol: 'Estudiante',
                activo: true,
                google: true,
                googleId,
                picture
            });

            await usuario.save();
        } else {
            // Actualizar información de Google si no existe
            if (!usuario.googleId) {
                usuario.googleId = googleId;
                usuario.google = true;
                usuario.picture = picture;
                await usuario.save();
            }
        }

        const token = await generarJWT(usuario.id);

        return res.json({
            ok: true,
            usuario: {
                uid: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol,
                admin: usuario.admin || false,
                picture: usuario.picture
            },
            token
        });

    } catch (error) {
        console.error('Error en loginGoogle:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error en autenticación con Google'
        });
    }
};

/**
 * Login desde PIMU
 */
export const loginPIMU = async (req: AuthenticatedRequest, res: Response) => {
    const { nombre, apellido, email, curso, grupo } = req.params;

    try {
        let usuario = await Usuario.findOne({ email });

        if (!usuario) {
            // Crear usuario desde PIMU
            usuario = new Usuario({
                nombre,
                apellido,
                email,
                curso,
                grupo: parseInt(grupo || '0'),
                rol: 'Estudiante',
                activo: true,
                pimu: true
            });

            await usuario.save();
        }

        const token = await generarJWT(usuario.id);

        return res.json({
            ok: true,
            usuario: {
                uid: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                curso: usuario.curso,
                grupo: usuario.grupo,
                rol: usuario.rol
            },
            token
        });

    } catch (error) {
        console.error('Error en loginPIMU:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error en autenticación PIMU'
        });
    }
};

/**
 * Renovar token JWT
 */
export const renewToken = async (req: AuthenticatedRequest, res: Response) => {
    const { uid } = req.params;

    try {
        const usuario = await Usuario.findById(uid);

        if (!usuario) {
            return res.status(400).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        const token = await generarJWT(usuario.id);

        return res.json({
            ok: true,
            usuario: {
                uid: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol,
                admin: usuario.admin || false
            },
            token
        });

    } catch (error) {
        console.error('Error renovando token:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error renovando token'
        });
    }
};

// ============================================================================
// CONTROLADORES DE USUARIO
// ============================================================================

/**
 * Obtener perfil del usuario autenticado
 */
export const obtenerPerfil = async (req: AuthenticatedRequest, res: Response) => {
    const { uid } = req.params;

    try {
        const usuario = await Usuario.findById(uid).select('-password');

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        return res.json({
            ok: true,
            usuario
        });

    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error obteniendo perfil'
        });
    }
};

/**
 * Editar usuario
 */
export const editarUsuario = async (req: Request, res: Response) => {
    const { uid } = req.params;
    const { password, ...resto } = req.body;

    try {
        const usuario = await Usuario.findById(uid);

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        // Si se incluye password, encriptarlo
        if (password) {
            const salt = bcrypt.genSaltSync();
            resto.password = bcrypt.hashSync(password, salt);
        }

        const usuarioActualizado = await Usuario.findByIdAndUpdate(uid, resto, { new: true }).select('-password');

        return res.json({
            ok: true,
            msg: 'Usuario actualizado correctamente',
            usuario: usuarioActualizado
        });

    } catch (error) {
        console.error('Error editando usuario:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error actualizando usuario'
        });
    }
};

/**
 * Cambiar contraseña
 */
export const cambiarPassword = async (req: AuthenticatedRequest, res: Response) => {
    const { uid } = req.params;
    const { passwordActual, passwordNuevo } = req.body;

    try {
        const usuario = await Usuario.findById(uid);

        // Verificar contraseña actual
        if (!usuario?.password) {
            return res.status(400).json({
                ok: false,
                msg: 'Usuario sin contraseña configurada'
            });
        }

        const validPassword = bcrypt.compareSync(passwordActual, usuario.password);

        if (!validPassword) {
            return res.status(400).json({
                ok: false,
                msg: 'Contraseña actual incorrecta'
            });
        }

        if (!validPassword) {
            return res.status(400).json({
                ok: false,
                msg: 'Contraseña actual incorrecta'
            });
        }

        // Encriptar nueva contraseña
        const salt = bcrypt.genSaltSync();
        const hashedPassword = bcrypt.hashSync(passwordNuevo, salt);

        await Usuario.findByIdAndUpdate(uid, { password: hashedPassword });

        return res.json({
            ok: true,
            msg: 'Contraseña actualizada correctamente'
        });

    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error cambiando contraseña'
        });
    }
};

// ============================================================================
// 🆕 CONTROLADORES LTI
// ============================================================================

/**
 * Sincronizar usuario desde LTI Launch
 */
export const syncUsuarioLTI = async (req: Request, res: Response) => {
    const { ltiUserId, canvasUserId, email, nombre, apellido, roles, courseId } = req.body;

    try {
        let usuario = await Usuario.findOne({
            $or: [
                { ltiUserId },
                { canvasUserId },
                { email }
            ]
        });

        if (!usuario) {
            // Crear nuevo usuario desde LTI
            usuario = new Usuario({
                nombre: nombre || 'Usuario',
                apellido: apellido || 'LTI',
                email: email || `${ltiUserId}@canvas.lms`,
                ltiUserId,
                canvasUserId,
                rol: roles.includes('Instructor') ? 'Profesor' : 'Estudiante',
                activo: true,
                lti: true,
                cursoCanvas: courseId
            });

            await usuario.save();
        } else {
            // Actualizar datos LTI existentes
            usuario.ltiUserId = ltiUserId;
            usuario.canvasUserId = canvasUserId;
            usuario.lti = true;
            usuario.cursoCanvas = courseId;
            await usuario.save();
        }

        return res.json({
            ok: true,
            msg: 'Usuario sincronizado con LTI',
            usuario: {
                uid: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol,
                ltiUserId: usuario.ltiUserId,
                canvasUserId: usuario.canvasUserId
            }
        });

    } catch (error) {
        console.error('Error sincronizando usuario LTI:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error sincronizando usuario LTI'
        });
    }
};

/**
 * Obtener información de usuario LTI
 */
export const obtenerUsuarioLTI = async (req: Request, res: Response) => {
    const { ltiUserId } = req.params;

    try {
        const usuario = await Usuario.findOne({ ltiUserId }).select('-password');

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario LTI no encontrado'
            });
        }

        return res.json({
            ok: true,
            usuario
        });

    } catch (error) {
        console.error('Error obteniendo usuario LTI:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error obteniendo usuario LTI'
        });
    }
};

/**
 * Vincular usuario existente con datos LTI
 */
export const vincularUsuarioLTI = async (req: AuthenticatedRequest, res: Response) => {
    const { uid } = req.params;
    const { ltiUserId, canvasUserId } = req.body;

    try {
        const usuario = await Usuario.findById(uid);

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        usuario.ltiUserId = ltiUserId;
        usuario.canvasUserId = canvasUserId;
        usuario.lti = true;
        await usuario.save();

        return res.json({
            ok: true,
            msg: 'Usuario vinculado con LTI correctamente',
            usuario: {
                uid: usuario.id,
                ltiUserId: usuario.ltiUserId,
                canvasUserId: usuario.canvasUserId
            }
        });

    } catch (error) {
        console.error('Error vinculando usuario LTI:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error vinculando usuario LTI'
        });
    }
};

// ============================================================================
// CONTROLADORES DE ADMINISTRACIÓN
// ============================================================================

/**
 * Login de administrador con Outlook
 */
export const loginOutlookAdmin = async (req: Request, res: Response) => {
    const { email, nombre, apellido } = req.body;

    try {
        const usuario = await Usuario.findOne({ email });

        if (!usuario || !usuario.admin) {
            return res.status(403).json({
                ok: false,
                msg: 'Acceso restringido - No es administrador'
            });
        }

        const token = await generarJWTAdmin(usuario.id);

        return res.json({
            ok: true,
            usuario: {
                uid: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                admin: true
            },
            token
        });

    } catch (error) {
        console.error('Error en loginOutlookAdmin:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error en autenticación de administrador'
        });
    }
};

/**
 * Obtener usuarios de un grupo
 */
export const obtenerUsuariosGrupo = async (req: AuthenticatedRequest, res: Response) => {
    const { gid, uid } = req.params;

    try {
        const usuario = await Usuario.findById(uid);

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        const matriculas = await Matricula.find({ gid }).populate('uid', 'nombre apellido email rol activo');

        return res.json({
            ok: true,
            matriculas
        });

    } catch (error) {
        console.error('Error obteniendo usuarios del grupo:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error obteniendo usuarios del grupo'
        });
    }
};

/**
 * Obtener usuarios NO matriculados en un grupo
 */
export const obtenerUsuariosNoMatriculados = async (req: AuthenticatedRequest, res: Response) => {
    const { gid, uid } = req.params;

    try {
        const usuario = await Usuario.findById(uid);

        if (!usuario || !usuario.admin) {
            return res.status(403).json({
                ok: false,
                msg: 'Acceso restringido'
            });
        }

        const matriculas = await Matricula.find({ gid });
        const idsMatriculados = matriculas.map(m => m.uid);

        const usuariosNoMatriculados = await Usuario.find({
            _id: { $nin: idsMatriculados },
            activo: true
        }).sort({ apellido: 1, nombre: 1 });

        return res.json({
            ok: true,
            usuarios: usuariosNoMatriculados
        });

    } catch (error) {
        console.error('Error obteniendo usuarios no matriculados:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error obteniendo usuarios no matriculados'
        });
    }
};

/**
 * Crear usuario con contraseña (admin)
 */
export const crearUsuarioPassword = async (req: Request, res: Response) => {
    const { nombre, apellido, email, password, rol = 'Estudiante' } = req.body;

    try {
        // Verificar si el email ya existe
        const usuarioExistente = await Usuario.findOne({ email });

        if (usuarioExistente) {
            return res.status(400).json({
                ok: false,
                msg: 'El email ya está registrado'
            });
        }

        // Encriptar contraseña
        const salt = bcrypt.genSaltSync();
        const hashedPassword = bcrypt.hashSync(password, salt);

        const usuario = new Usuario({
            nombre,
            apellido,
            email,
            password: hashedPassword,
            rol,
            activo: true
        });

        await usuario.save();

        return res.json({
            ok: true,
            msg: 'Usuario creado correctamente',
            usuario: {
                uid: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error creando usuario:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error creando usuario'
        });
    }
};

/**
 * Crear usuario sin contraseña (admin)
 */
export const crearUsuario = async (req: Request, res: Response) => {
    const { nombre, apellido, email, rol = 'Estudiante' } = req.body;

    try {
        const usuarioExistente = await Usuario.findOne({ email });

        if (usuarioExistente) {
            return res.status(400).json({
                ok: false,
                msg: 'El email ya está registrado'
            });
        }

        const usuario = new Usuario({
            nombre,
            apellido,
            email,
            rol,
            activo: true,
            requiresPasswordSetup: true
        });

        await usuario.save();

        return res.json({
            ok: true,
            msg: 'Usuario creado correctamente',
            usuario: {
                uid: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol,
                requiresPasswordSetup: true
            }
        });

    } catch (error) {
        console.error('Error creando usuario:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error creando usuario'
        });
    }
};

/**
 * Eliminar usuario (admin)
 */
export const eliminarUsuario = async (req: Request, res: Response) => {
    const { uid } = req.params;

    try {
        const usuario = await Usuario.findById(uid);

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        // Soft delete - marcar como inactivo
        usuario.activo = false;
        await usuario.save();

        return res.json({
            ok: true,
            msg: 'Usuario eliminado correctamente'
        });

    } catch (error) {
        console.error('Error eliminando usuario:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error eliminando usuario'
        });
    }
};

/**
 * Obtener todos los usuarios (admin)
 */
export const obtenerTodosUsuarios = async (req: Request, res: Response) => {
    try {
        const usuarios = await Usuario.find().select('-password').sort({ apellido: 1, nombre: 1 });

        return res.json({
            ok: true,
            usuarios,
            total: usuarios.length
        });

    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error obteniendo usuarios'
        });
    }
};

/**
 * Buscar usuarios por término (admin)
 */
export const buscarUsuarios = async (req: Request, res: Response) => {
    const { termino } = req.params;

    try {
        if (!termino) {
            return res.status(400).json({
                ok: false,
                msg: 'Término de búsqueda requerido'
            });
        }

        const regex = new RegExp(termino, 'i');

        const usuarios = await Usuario.find({
            $or: [
                { nombre: regex },
                { apellido: regex },
                { email: regex }
            ]
        }).select('-password').sort({ apellido: 1, nombre: 1 });

        return res.json({
            ok: true,
            usuarios,
            total: usuarios.length,
            termino
        });

    } catch (error) {
        console.error('Error buscando usuarios:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error buscando usuarios'
        });
    }
};

/**
 * Estadísticas de usuarios (admin)
 */
export const estadisticasUsuarios = async (req: Request, res: Response) => {
    try {
        const totalUsuarios = await Usuario.countDocuments();
        const usuariosActivos = await Usuario.countDocuments({ activo: true });
        const usuariosInactivos = await Usuario.countDocuments({ activo: false });

        const porRol = await Usuario.aggregate([
            { $group: { _id: '$rol', total: { $sum: 1 } } }
        ]);

        const conLTI = await Usuario.countDocuments({ lti: true });

        return res.json({
            ok: true,
            estadisticas: {
                total: totalUsuarios,
                activos: usuariosActivos,
                inactivos: usuariosInactivos,
                porRol,
                conLTI,
                porcentajeActivos: totalUsuarios > 0 ? (usuariosActivos / totalUsuarios * 100).toFixed(2) : 0
            }
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error obteniendo estadísticas'
        });
    }
};

// ============================================================================
// 🆕 CONTROLADORES ADMIN LTI
// ============================================================================

/**
 * Obtener usuarios sincronizados con Canvas
 */
export const obtenerUsuariosCanvas = async (req: Request, res: Response) => {
    try {
        const usuariosCanvas = await Usuario.find({ lti: true }).select('-password');

        return res.json({
            ok: true,
            usuarios: usuariosCanvas,
            total: usuariosCanvas.length
        });

    } catch (error) {
        console.error('Error obteniendo usuarios Canvas:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error obteniendo usuarios Canvas'
        });
    }
};

/**
 * Sincronizar usuarios con Canvas (admin)
 */
export const sincronizarConCanvas = async (req: Request, res: Response) => {
    try {
        // TODO: Implementar sincronización con Canvas API
        // Por ahora respuesta mock

        return res.json({
            ok: true,
            msg: 'Sincronización con Canvas iniciada',
            note: 'Implementar en Fase 2 con Canvas API'
        });

    } catch (error) {
        console.error('Error sincronizando con Canvas:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error sincronizando con Canvas'
        });
    }
};

/**
 * Desvincular usuario de Canvas (admin)
 */
export const desvincularCanvas = async (req: Request, res: Response) => {
    const { uid } = req.params;

    try {
        const usuario = await Usuario.findById(uid);

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        usuario.lti = false;
        delete usuario.ltiUserId;
        delete usuario.canvasUserId;
        delete usuario.cursoCanvas;
        await usuario.save();

        return res.json({
            ok: true,
            msg: 'Usuario desvinculado de Canvas correctamente'
        });

    } catch (error) {
        console.error('Error desvinculando de Canvas:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error desvinculando de Canvas'
        });
    }
};