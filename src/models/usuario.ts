// src/models/usuario.ts
// Modelo de Usuario (migrado y mejorado de tu sistema)

import { Schema, model, Document } from 'mongoose';

export interface IUsuario extends Document {
    nombre: string;
    apellido: string;
    email: string;
    password?: string;
    rol: 'Estudiante' | 'Profesor' | 'Admin';
    activo: boolean;
    admin?: boolean;

    // Campos de autenticación externa
    outlook?: boolean;
    google?: boolean;
    googleId?: string;
    pimu?: boolean;
    picture?: string;

    // 🆕 Campos LTI/Canvas
    lti?: boolean;
    ltiUserId?: string;
    canvasUserId?: string;
    cursoCanvas?: string;

    // Campos adicionales de tu sistema
    curso?: string;
    grupo?: number;
    requiresPasswordSetup?: boolean;

    // Metadatos
    fechaCreacion: Date;
    ultimoAcceso?: Date;

    // Métodos del modelo
    isActive(): boolean;
    isAdmin(): boolean;
    isTeacher(): boolean;
    isStudent(): boolean;
    hasLTI(): boolean;
}

const usuarioSchema = new Schema<IUsuario>({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio'],
        trim: true,
        maxlength: [50, 'El nombre no puede tener más de 50 caracteres']
    },

    apellido: {
        type: String,
        required: [true, 'El apellido es obligatorio'],
        trim: true,
        maxlength: [50, 'El apellido no puede tener más de 50 caracteres']
    },

    email: {
        type: String,
        required: [true, 'El email es obligatorio'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido']
    },

    password: {
        type: String,
        minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
        // No requerido porque puede usar autenticación externa
    },

    rol: {
        type: String,
        enum: ['Estudiante', 'Profesor', 'Admin'],
        default: 'Estudiante'
    },

    activo: {
        type: Boolean,
        default: true
    },

    admin: {
        type: Boolean,
        default: false
    },

    // ============================================
    // CAMPOS DE AUTENTICACIÓN EXTERNA
    // ============================================

    outlook: {
        type: Boolean,
        default: false
    },

    google: {
        type: Boolean,
        default: false
    },

    googleId: {
        type: String,
        sparse: true // Permite múltiples documentos con valor null/undefined
    },

    pimu: {
        type: Boolean,
        default: false
    },

    picture: {
        type: String, // URL de la imagen de perfil
        trim: true
    },

    // ============================================
    // 🆕 CAMPOS LTI/CANVAS
    // ============================================

    lti: {
        type: Boolean,
        default: false
    },

    ltiUserId: {
        type: String,
        sparse: true, // Permite múltiples documentos con valor null
        index: true
    },

    canvasUserId: {
        type: String,
        sparse: true,
        index: true
    },

    cursoCanvas: {
        type: String, // ID del curso en Canvas
        trim: true
    },

    // ============================================
    // CAMPOS ADICIONALES DE TU SISTEMA
    // ============================================

    curso: {
        type: String,
        trim: true,
        maxlength: [100, 'El curso no puede tener más de 100 caracteres']
    },

    grupo: {
        type: Number,
        min: [0, 'El grupo debe ser mayor o igual a 0']
    },

    requiresPasswordSetup: {
        type: Boolean,
        default: false
    },

    // ============================================
    // METADATOS
    // ============================================

    fechaCreacion: {
        type: Date,
        default: Date.now
    },

    ultimoAcceso: {
        type: Date
    }

}, {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
    toJSON: {
        transform: function (doc, ret) {
            // No devolver la contraseña en las respuestas JSON
            delete ret.password;
            return ret;
        }
    }
});

// ============================================
// ÍNDICES
// ============================================

usuarioSchema.index({ email: 1 }, { unique: true });
usuarioSchema.index({ ltiUserId: 1 }, { sparse: true });
usuarioSchema.index({ canvasUserId: 1 }, { sparse: true });
usuarioSchema.index({ activo: 1 });
usuarioSchema.index({ rol: 1 });
usuarioSchema.index({ nombre: 1, apellido: 1 });

// Índice compuesto para búsquedas
usuarioSchema.index({
    nombre: 'text',
    apellido: 'text',
    email: 'text'
});

// ============================================
// MÉTODOS DE INSTANCIA
// ============================================

usuarioSchema.methods.isActive = function (): boolean {
    return this.activo === true;
};

usuarioSchema.methods.isAdmin = function (): boolean {
    return this.admin === true || this.rol === 'Admin';
};

usuarioSchema.methods.isTeacher = function (): boolean {
    return this.rol === 'Profesor' || this.isAdmin();
};

usuarioSchema.methods.isStudent = function (): boolean {
    return this.rol === 'Estudiante';
};

usuarioSchema.methods.hasLTI = function (): boolean {
    return this.lti === true && (this.ltiUserId || this.canvasUserId);
};

// ============================================
// MÉTODOS ESTÁTICOS
// ============================================

usuarioSchema.statics.findByLTI = function (ltiUserId: string) {
    return this.findOne({ ltiUserId, activo: true });
};

usuarioSchema.statics.findByCanvas = function (canvasUserId: string) {
    return this.findOne({ canvasUserId, activo: true });
};

usuarioSchema.statics.findActiveByEmail = function (email: string) {
    return this.findOne({ email: email.toLowerCase(), activo: true });
};

usuarioSchema.statics.searchUsers = function (termino: string) {
    const regex = new RegExp(termino, 'i');
    return this.find({
        $or: [
            { nombre: regex },
            { apellido: regex },
            { email: regex }
        ],
        activo: true
    }).select('-password').sort({ apellido: 1, nombre: 1 });
};

usuarioSchema.statics.getActiveTeachers = function () {
    return this.find({
        rol: { $in: ['Profesor', 'Admin'] },
        activo: true
    }).select('-password').sort({ apellido: 1, nombre: 1 });
};

usuarioSchema.statics.getActiveStudents = function () {
    return this.find({
        rol: 'Estudiante',
        activo: true
    }).select('-password').sort({ apellido: 1, nombre: 1 });
};

usuarioSchema.statics.getLTIUsers = function () {
    return this.find({
        lti: true,
        activo: true
    }).select('-password').sort({ apellido: 1, nombre: 1 });
};

// ============================================
// MIDDLEWARE (HOOKS)
// ============================================

// Antes de guardar
usuarioSchema.pre('save', function (next) {
    // Convertir email a minúsculas
    if (this.email) {
        this.email = this.email.toLowerCase();
    }

    // Actualizar último acceso si es un login
    if (this.isModified('ultimoAcceso') === false) {
        this.ultimoAcceso = new Date();
    }

    // Sincronizar admin con rol
    if (this.rol === 'Admin') {
        this.admin = true;
    }

    next();
});

// Después de encontrar
usuarioSchema.post('findOneAndUpdate', function (doc) {
    if (doc) {
        // Actualizar último acceso
        doc.ultimoAcceso = new Date();
    }
});

// ============================================
// VIRTUAL FIELDS
// ============================================

usuarioSchema.virtual('nombreCompleto').get(function () {
    return `${this.nombre} ${this.apellido}`;
});

usuarioSchema.virtual('iniciales').get(function () {
    return `${this.nombre.charAt(0)}${this.apellido.charAt(0)}`.toUpperCase();
});

usuarioSchema.virtual('tipoAuth').get(function () {
    if (this.lti) return 'LTI/Canvas';
    if (this.google) return 'Google';
    if (this.outlook) return 'Outlook';
    if (this.pimu) return 'PIMU';
    if (this.password) return 'Password';
    return 'Sin configurar';
});

// ============================================
// VALIDACIONES PERSONALIZADAS
// ============================================

usuarioSchema.pre('validate', function (next) {
    // Validar que tenga al menos un método de autenticación
    if (!this.password && !this.google && !this.outlook && !this.pimu && !this.lti) {
        if (!this.requiresPasswordSetup) {
            this.requiresPasswordSetup = true;
        }
    }

    next();
});

// Validación de email único (más específica)
usuarioSchema.pre('save', async function (next) {
    if (this.isModified('email')) {
        const emailExists = await (this.constructor as any).findOne({
            email: this.email,
            _id: { $ne: this._id }
        });

        if (emailExists) {
            const error = new Error('El email ya está registrado');
            (error as any).code = 11000;
            return next(error);
        }
    }

    next();
});

// ============================================
// EXPORTAR MODELO
// ============================================

export const Usuario = model<IUsuario>('Usuario', usuarioSchema);

// Tipo para crear usuario
export type CreateUsuarioDTO = Omit<IUsuario, '_id' | 'fechaCreacion' | 'ultimoAcceso' | keyof Document>;

// Tipo para actualizar usuario
export type UpdateUsuarioDTO = Partial<Pick<IUsuario,
    'nombre' | 'apellido' | 'email' | 'rol' | 'activo' | 'curso' | 'grupo' | 'picture'
>>;

// Tipo para respuesta de usuario (sin campos sensibles)
export type UsuarioResponse = Omit<IUsuario, 'password' | keyof Document>;

export default Usuario;