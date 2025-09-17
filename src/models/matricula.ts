// src/models/matricula.ts
// Modelo de Matricula (basado en tu sistema)

import { Schema, model, Document, Types } from 'mongoose';

export interface IMatricula extends Document {
    cid: Types.ObjectId; // ID del curso
    gid: Types.ObjectId; // ID del grupo  
    uid: Types.ObjectId; // ID del usuario
    rol: 'Estudiante' | 'Profesor' | 'Ayudante';
    activo: boolean;
    fechaMatricula: Date;
    fechaUltimaActividad?: Date;

    // 🆕 Campos LTI
    ltiResourceLinkId?: string; // ID del recurso LTI que originó la matrícula
    canvasEnrollmentId?: string; // ID de enrollment en Canvas

    // Metadatos
    notas?: string;
}

const matriculaSchema = new Schema<IMatricula>({
    cid: {
        type: Schema.Types.ObjectId,
        ref: 'Curso',
        required: [true, 'El ID del curso es obligatorio'],
        index: true
    },

    gid: {
        type: Schema.Types.ObjectId,
        ref: 'Grupo',
        required: [true, 'El ID del grupo es obligatorio'],
        index: true
    },

    uid: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: [true, 'El ID del usuario es obligatorio'],
        index: true
    },

    rol: {
        type: String,
        enum: ['Estudiante', 'Profesor', 'Ayudante'],
        default: 'Estudiante'
    },

    activo: {
        type: Boolean,
        default: true
    },

    fechaMatricula: {
        type: Date,
        default: Date.now
    },

    fechaUltimaActividad: {
        type: Date
    },

    // ============================================
    // 🆕 CAMPOS LTI
    // ============================================

    ltiResourceLinkId: {
        type: String,
        trim: true,
        index: true
    },

    canvasEnrollmentId: {
        type: String,
        trim: true,
        index: true
    },

    // ============================================
    // METADATOS
    // ============================================

    notas: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
    }

}, {
    timestamps: true
});

// ============================================
// ÍNDICES
// ============================================

// Índice único: un usuario solo puede estar matriculado una vez en un curso-grupo
matriculaSchema.index({ cid: 1, gid: 1, uid: 1 }, { unique: true });

// Índices para consultas frecuentes
matriculaSchema.index({ cid: 1, activo: 1 });
matriculaSchema.index({ gid: 1, activo: 1 });
matriculaSchema.index({ uid: 1, activo: 1 });
matriculaSchema.index({ rol: 1, activo: 1 });

// Índice para LTI
matriculaSchema.index({ ltiResourceLinkId: 1 });
matriculaSchema.index({ canvasEnrollmentId: 1 });

// ============================================
// MÉTODOS DE INSTANCIA
// ============================================

matriculaSchema.methods.isActive = function (): boolean {
    return this.activo === true;
};

matriculaSchema.methods.isTeacher = function (): boolean {
    return this.rol === 'Profesor';
};

matriculaSchema.methods.isStudent = function (): boolean {
    return this.rol === 'Estudiante';
};

matriculaSchema.methods.isAssistant = function (): boolean {
    return this.rol === 'Ayudante';
};

matriculaSchema.methods.updateActivity = function (): Promise<IMatricula> {
    this.fechaUltimaActividad = new Date();
    return this.save();
};

// ============================================
// MÉTODOS ESTÁTICOS
// ============================================

matriculaSchema.statics.findByCurso = function (cid: string | Types.ObjectId) {
    return this.find({ cid, activo: true })
        .populate('uid', 'nombre apellido email rol')
        .populate('gid', 'nombre numero')
        .sort({ 'uid.apellido': 1, 'uid.nombre': 1 });
};

matriculaSchema.statics.findByGrupo = function (gid: string | Types.ObjectId) {
    return this.find({ gid, activo: true })
        .populate('uid', 'nombre apellido email rol activo')
        .sort({ 'uid.apellido': 1, 'uid.nombre': 1 });
};

matriculaSchema.statics.findByUsuario = function (uid: string | Types.ObjectId) {
    return this.find({ uid, activo: true })
        .populate('cid', 'nombre codigo descripcion')
        .populate('gid', 'nombre numero')
        .sort({ fechaMatricula: -1 });
};

matriculaSchema.statics.findEstudiantesByGrupo = function (gid: string | Types.ObjectId) {
    return this.find({ gid, rol: 'Estudiante', activo: true })
        .populate('uid', 'nombre apellido email')
        .sort({ 'uid.apellido': 1, 'uid.nombre': 1 });
};

matriculaSchema.statics.findProfesoresByCurso = function (cid: string | Types.ObjectId) {
    return this.find({ cid, rol: { $in: ['Profesor', 'Ayudante'] }, activo: true })
        .populate('uid', 'nombre apellido email')
        .sort({ rol: 1, 'uid.apellido': 1 });
};

matriculaSchema.statics.findByLTIResource = function (ltiResourceLinkId: string) {
    return this.find({ ltiResourceLinkId, activo: true })
        .populate('uid', 'nombre apellido email rol ltiUserId canvasUserId')
        .populate('cid', 'nombre')
        .populate('gid', 'nombre numero');
};

matriculaSchema.statics.findByCanvasEnrollment = function (canvasEnrollmentId: string) {
    return this.findOne({ canvasEnrollmentId, activo: true })
        .populate('uid', 'nombre apellido email rol')
        .populate('cid', 'nombre')
        .populate('gid', 'nombre numero');
};

// ============================================
// MIDDLEWARE (HOOKS)
// ============================================

// Antes de guardar
matriculaSchema.pre('save', function (next) {
    // Actualizar actividad si es una modificación
    if (this.isModified() && !this.isModified('fechaUltimaActividad')) {
        this.fechaUltimaActividad = new Date();
    }

    next();
});

// Antes de eliminar (soft delete)
matriculaSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate() as any;

    if (update && update.activo === false) {
        update.fechaUltimaActividad = new Date();
    }

    next();
});

// ============================================
// VALIDACIONES PERSONALIZADAS
// ============================================

// Validar que no se duplique la matrícula
matriculaSchema.pre('save', async function (next) {
    if (this.isNew) {
        const existeMatricula = await (this.constructor as any).findOne({
            cid: this.cid,
            gid: this.gid,
            uid: this.uid,
            activo: true
        });

        if (existeMatricula) {
            const error = new Error('El usuario ya está matriculado en este curso-grupo');
            (error as any).code = 11000;
            return next(error);
        }
    }

    next();
});

// ============================================
// VIRTUAL FIELDS
// ============================================

matriculaSchema.virtual('diasMatriculado').get(function () {
    const ahora = new Date();
    const diferencia = ahora.getTime() - this.fechaMatricula.getTime();
    return Math.floor(diferencia / (1000 * 60 * 60 * 24));
});

matriculaSchema.virtual('esReciente').get(function () {
    const unaSemana = 7 * 24 * 60 * 60 * 1000; // Una semana en ms
    const ahora = new Date();
    return (ahora.getTime() - this.fechaMatricula.getTime()) < unaSemana;
});

// ============================================
// EXPORTAR MODELO
// ============================================

export const Matricula = model<IMatricula>('Matricula', matriculaSchema);

// Tipos para DTOs
export type CreateMatriculaDTO = {
    cid: string | Types.ObjectId;
    gid: string | Types.ObjectId;
    uid: string | Types.ObjectId;
    rol?: 'Estudiante' | 'Profesor' | 'Ayudante';
    ltiResourceLinkId?: string;
    canvasEnrollmentId?: string;
    notas?: string;
};

export type UpdateMatriculaDTO = Partial<Pick<IMatricula,
    'rol' | 'activo' | 'notas' | 'ltiResourceLinkId' | 'canvasEnrollmentId'
>>;

// Tipo para respuesta poblada
export interface MatriculaPopulated extends Omit<IMatricula, 'uid' | 'cid' | 'gid'> {
    uid: {
        _id: Types.ObjectId;
        nombre: string;
        apellido: string;
        email: string;
        rol: string;
        activo: boolean;
        ltiUserId?: string;
        canvasUserId?: string;
    };
    cid: {
        _id: Types.ObjectId;
        nombre: string;
        codigo?: string;
        descripcion?: string;
    };
    gid: {
        _id: Types.ObjectId;
        nombre: string;
        numero: number;
    };
}

export default Matricula;