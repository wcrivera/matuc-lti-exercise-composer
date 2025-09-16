// ============================================================================
// MODELOS LTI PARA MONGODB - BACKEND EXPRESS
// ============================================================================

import { Schema, model, Document } from 'mongoose';

// ============================================================================
// INTERFACE Y MODELO: EXERCISE SET
// ============================================================================

export interface IExerciseSet extends Document {
  titulo: string;
  descripcion: string;
  ejercicios: string[]; // IDs de ejercicios existentes
  configuracion: {
    orden: 'secuencial' | 'aleatorio';
    mostrarRespuestas: boolean;
    mostrarExplicaciones: boolean;
    permitirReintentos: boolean;
    guardarProgreso: boolean;
  };
  lti: {
    courseId: string;
    resourceLinkId: string;
    maxIntentos: number;
    tiempoLimite?: number; // minutos
    fechaVencimiento?: Date;
    calificacionMaxima: number;
  };
  createdBy: string; // userId del instructor
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExerciseSetSchema = new Schema<IExerciseSet>({
  titulo: {
    type: String,
    required: [true, 'El título es requerido'],
    trim: true,
    maxlength: [200, 'El título no puede exceder 200 caracteres']
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [1000, 'La descripción no puede exceder 1000 caracteres']
  },
  ejercicios: [{
    type: String,
    required: true
  }],
  configuracion: {
    orden: {
      type: String,
      enum: ['secuencial', 'aleatorio'],
      default: 'secuencial'
    },
    mostrarRespuestas: {
      type: Boolean,
      default: true
    },
    mostrarExplicaciones: {
      type: Boolean,
      default: true
    },
    permitirReintentos: {
      type: Boolean,
      default: true
    },
    guardarProgreso: {
      type: Boolean,
      default: true
    }
  },
  lti: {
    courseId: {
      type: String,
      required: [true, 'Course ID es requerido']
    },
    resourceLinkId: {
      type: String,
      required: [true, 'Resource Link ID es requerido']
    },
    maxIntentos: {
      type: Number,
      required: true,
      min: [1, 'Debe permitir al menos 1 intento'],
      max: [10, 'No puede exceder 10 intentos']
    },
    tiempoLimite: {
      type: Number,
      min: [5, 'Tiempo mínimo: 5 minutos'],
      max: [480, 'Tiempo máximo: 8 horas']
    },
    fechaVencimiento: Date,
    calificacionMaxima: {
      type: Number,
      required: true,
      min: [1, 'Calificación mínima: 1'],
      max: [1000, 'Calificación máxima: 1000']
    }
  },
  createdBy: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices para optimización
ExerciseSetSchema.index({ 'lti.courseId': 1 });
ExerciseSetSchema.index({ createdBy: 1 });
ExerciseSetSchema.index({ 'lti.resourceLinkId': 1 });

export const ExerciseSet = model<IExerciseSet>('ExerciseSet', ExerciseSetSchema);

// ============================================================================
// INTERFACE Y MODELO: EXERCISE ATTEMPT
// ============================================================================

export interface IExerciseAttempt extends Document {
  exerciseSetId: string;
  studentId: string;
  courseId: string;
  respuestas: IStudentResponse[];
  puntuacion: number;
  puntuacionMaxima: number;
  completado: boolean;
  iniciadoEn: Date;
  completadoEn?: Date;
  tiempoTotal?: number; // segundos
  intento: number; // 1, 2, 3...
  progreso: {
    currentExercise: number;
    currentQuestion: number;
    answers: { [key: string]: string };
    timeSpent: number;
  };
}

export interface IStudentResponse {
  ejercicioId: string;
  preguntaId: string;
  respuesta: string;
  esCorrecta: boolean;
  intento: number;
  tiempoRespuesta: number; // segundos
  timestamp: Date;
  feedback?: string;
}

const StudentResponseSchema = new Schema<IStudentResponse>({
  ejercicioId: { type: String, required: true },
  preguntaId: { type: String, required: true },
  respuesta: { type: String, required: true },
  esCorrecta: { type: Boolean, required: true },
  intento: { type: Number, required: true, min: 1 },
  tiempoRespuesta: { type: Number, required: true, min: 0 },
  timestamp: { type: Date, default: Date.now },
  feedback: String
});

const ExerciseAttemptSchema = new Schema<IExerciseAttempt>({
  exerciseSetId: {
    type: String,
    required: true,
    ref: 'ExerciseSet'
  },
  studentId: {
    type: String,
    required: true
  },
  courseId: {
    type: String,
    required: true
  },
  respuestas: [StudentResponseSchema],
  puntuacion: {
    type: Number,
    default: 0,
    min: 0
  },
  puntuacionMaxima: {
    type: Number,
    required: true,
    min: 1
  },
  completado: {
    type: Boolean,
    default: false
  },
  iniciadoEn: {
    type: Date,
    default: Date.now
  },
  completadoEn: Date,
  tiempoTotal: {
    type: Number,
    min: 0
  },
  intento: {
    type: Number,
    required: true,
    min: 1
  },
  progreso: {
    currentExercise: { type: Number, default: 0 },
    currentQuestion: { type: Number, default: 0 },
    answers: { type: Schema.Types.Mixed, default: {} },
    timeSpent: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Índices compuestos para optimización
ExerciseAttemptSchema.index({ exerciseSetId: 1, studentId: 1 });
ExerciseAttemptSchema.index({ courseId: 1, completado: 1 });
ExerciseAttemptSchema.index({ studentId: 1, iniciadoEn: -1 });

export const ExerciseAttempt = model<IExerciseAttempt>('ExerciseAttempt', ExerciseAttemptSchema);

// ============================================================================
// INTERFACE Y MODELO: LTI SESSION
// ============================================================================

export interface ILTISession extends Document {
  ltiToken: string;
  courseId: string;
  userId: string;
  userRole: string;
  userName: string;
  userEmail: string;
  contextTitle: string;
  resourceLinkId: string;
  launchPresentationTarget: string;
  isActive: boolean;
  expiresAt: Date;
  lastActivity: Date;
  canvasData?: {
    canvasUserId?: string;
    canvasCourseId?: string;
    canvasRoles?: string[];
  };
}

const LTISessionSchema = new Schema<ILTISession>({
  ltiToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  courseId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    required: true,
    enum: ['Instructor', 'Student', 'TeachingAssistant', 'Administrator']
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  contextTitle: {
    type: String,
    required: true
  },
  resourceLinkId: {
    type: String,
    required: true
  },
  launchPresentationTarget: {
    type: String,
    default: 'iframe'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  canvasData: {
    canvasUserId: String,
    canvasCourseId: String,
    canvasRoles: [String]
  }
}, {
  timestamps: true
});

// TTL index para auto-expiración
LTISessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
LTISessionSchema.index({ userId: 1, courseId: 1 });

export const LTISession = model<ILTISession>('LTISession', LTISessionSchema);

// ============================================================================
// INTERFACE Y MODELO: LTI ACTIVITY LOG
// ============================================================================

export interface ILTIActivity extends Document {
  userId: string;
  courseId: string;
  exerciseSetId?: string;
  exerciseId?: string;
  action: string;
  data?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

const LTIActivitySchema = new Schema<ILTIActivity>({
  userId: {
    type: String,
    required: true
  },
  courseId: {
    type: String,
    required: true
  },
  exerciseSetId: String,
  exerciseId: String,
  action: {
    type: String,
    required: true
  },
  data: Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Índices para análiticas
LTIActivitySchema.index({ userId: 1, timestamp: -1 });
LTIActivitySchema.index({ courseId: 1, timestamp: -1 });
LTIActivitySchema.index({ action: 1, timestamp: -1 });

export const LTIActivity = model<ILTIActivity>('LTIActivity', LTIActivitySchema);

// ============================================================================
// EXPORTACIONES ADICIONALES
// ============================================================================

export interface IStudentResponse {}

// Tipos para controllers
export interface CreateExerciseSetRequest {
  titulo: string;
  descripcion?: string;
  ejercicios: string[];
  configuracion: IExerciseSet['configuracion'];
  lti: Omit<IExerciseSet['lti'], 'courseId' | 'resourceLinkId'>;
}

export interface UpdateExerciseSetRequest extends Partial<CreateExerciseSetRequest> {
  isActive?: boolean;
}

export interface ValidationRequest {
  preguntaId: string;
  respuesta: string;
  tipo: string;
}

export interface ValidationResult {
  esCorrecta: boolean;
  mensaje?: string;
  sugerencia?: string;
  explicacion?: string;
  respuestaCorrecta?: string;
}