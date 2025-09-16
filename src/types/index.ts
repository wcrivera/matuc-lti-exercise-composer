// src/types/index.ts
// Archivo principal que exporta todos los tipos

export * from './lti';
export * from './canvas';
export * from './selectors';
export * from './common';

// ================================

// src/types/common.ts
// Tipos comunes utilizados en todo el sistema

import { Document, Types } from 'mongoose';

// Respuesta API estándar
export interface APIResponse<T = any> {
  ok: boolean;
  msg: string;
  data?: T;
  error?: string;
  timestamp: string;
}

// Usuario base (compatible con tu sistema existente)
export interface BaseUser {
  uid: Types.ObjectId | string;
  nombre: string;
  apellido?: string;
  email: string;
  rol: 'Estudiante' | 'Profesor' | 'Admin';
  curso?: string;
  grupo?: number;
  activo: boolean;
}

// Contexto de curso base
export interface BaseCourse {
  cid: Types.ObjectId | string;
  nombre: string;
  codigo?: string;
  descripcion?: string;
  activo: boolean;
}

// Módulo base (compatible con tu sistema)
export interface BaseModule {
  mid: Types.ObjectId | string;
  cid: Types.ObjectId | string;
  nombre: string;
  descripcion?: string;
  orden: number;
  activo: boolean;
}

// Ejercicio base (migrado de tu sistema)
export interface BaseExercise {
  eid: Types.ObjectId | string;
  cid: Types.ObjectId | string;
  mid: Types.ObjectId | string;
  numero: number;
  titulo?: string;
  enunciado?: string;
  multiple: { estado: boolean; columnas: number };
  activo: boolean;
  evaluacion: boolean;
}

// Pregunta base (migrada de tu sistema)
export interface BaseQuestion {
  pid: Types.ObjectId | string;
  cid: Types.ObjectId | string;
  mid: Types.ObjectId | string;
  eid: Types.ObjectId | string;
  numero: number;
  tipo: string;
  enunciado: string;
  respuesta?: string;
  alternativas?: Array<{
    letra: string;
    alternativa: string;
    estado?: boolean | null;
  }>;
}

// DBP base (migrado de tu sistema)
export interface BaseDBP {
  id: Types.ObjectId | string;
  cid: Types.ObjectId | string;
  mid: Types.ObjectId | string;
  pid: Types.ObjectId | string;
  uid: Types.ObjectId | string;
  fecha: Date;
  respuesta: string;
  estado: boolean;
}

// Configuración de paginación
export interface PaginationConfig {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Resultado paginado
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Filtros base para consultas
export interface BaseFilters {
  activo?: boolean;
  fechaDesde?: Date;
  fechaHasta?: Date;
  busqueda?: string;
}

// Métricas base
export interface BaseMetrics {
  total: number;
  activos: number;
  porcentajeExito?: number;
  ultimaActualizacion: Date;
}

// Configuración de tiempo
export interface TimeConfig {
  zona?: string;
  formato?: string;
  incluirSegundos?: boolean;
}

// Configuración de logging
export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  incluirTimestamp: boolean;
  incluirMetadata: boolean;
}

// ================================

// src/types/lti.ts
// Tipos específicos para LTI

export type SelectorType = 'numero' | 'conjunto' | 'vector' | 'punto' | 'formula' | 'ecuacion' | 'antiderivada';
export type UserRole = 'student' | 'instructor' | 'admin';
export type SessionStatus = 'active' | 'paused' | 'expired';
export type ResponseStatus = 'in_progress' | 'completed' | 'timed_out';

// Contexto LTI completo
export interface LTIContext {
  userId: string;
  courseId: string;
  assignmentId?: string;
  userRole: UserRole;
  userName: string;
  userEmail: string;
  contextTitle: string;
  launchUrl: string;
  sessionId?: string;
}

// Datos del LTI Launch
export interface LTILaunchData {
  userId: string;
  courseId: string;
  assignmentId?: string;
  userRole: UserRole;
  userName: string;
  userEmail: string;
  contextTitle: string;
  launchUrl: string;
  customParameters?: Record<string, any>;
  roles: string[];
}

// Configuración de un sub-ejercicio en LTI
export interface LTISubExerciseConfig {
  exerciseId: string;
  order: number;
  prompt: string;
  correctAnswer: string;
  validationType: SelectorType;
  points: number;
  selectorConfig: {
    tolerance?: number;
    caseSensitive?: boolean;
    stripSpaces?: boolean;
    customValidation?: string;
  };
}

// Request para crear set de ejercicios LTI
export interface LTIExerciseSetCreateRequest {
  title: string;
  mainStatement: string;
  description?: string;
  exercises: Array<Omit<LTISubExerciseConfig, 'exerciseId'>>;
  timeLimit?: number;
  dueDate?: string;
  allowMultipleAttempts?: boolean;
  showFeedback?: boolean;
}

// Request para enviar respuestas
export interface LTISubmissionRequest {
  responses: Array<{
    exerciseId: string;
    answer: string;
  }>;
}

// Respuesta de validación individual
export interface LTIValidationResponse {
  exerciseId: string;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  validation: {
    ok: boolean | null;
    title: string;
    msg: string;
    showFeedback: boolean;
    metadata?: any;
  };
}

// Resultado completo de envío
export interface LTISubmissionResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  responses: Array<{
    exerciseId: string;
    isCorrect: boolean;
    pointsEarned: number;
    validationResult: any;
  }>;
  attemptNumber: number;
  gradeSentToCanvas: boolean;
  timeSpent?: number;
}

// Estadísticas de un set LTI
export interface LTISetStatistics {
  totalAttempts: number;
  uniqueStudents: number;
  averageScore: number;
  medianScore: number;
  highestScore: number;
  lowestScore: number;
  completionRate: number;
  averageTimeSpent: number;
  exerciseStats: Array<{
    exerciseId: string;
    prompt: string;
    successRate: number;
    averageTimeSpent: number;
    commonErrors: Array<{
      answer: string;
      frequency: number;
    }>;
  }>;
}

// ================================

// src/types/canvas.ts
// Tipos para Canvas API

export interface CanvasUser {
  id: number;
  name: string;
  email: string;
  login_id: string;
  avatar_url?: string;
  enrollments?: CanvasEnrollment[];
}

export interface CanvasEnrollment {
  id: number;
  course_id: number;
  user_id: number;
  type: string;
  role: string;
  enrollment_state: string;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  account_id: number;
  start_at?: string;
  end_at?: string;
  enrollment_term_id: number;
  workflow_state: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  points_possible: number;
  due_at?: string;
  course_id: number;
  position: number;
  submission_types: string[];
  external_tool_tag_attributes?: {
    url: string;
    new_tab: boolean;
  };
  published: boolean;
}

export interface CanvasSubmission {
  id: number;
  user_id: number;
  assignment_id: number;
  score?: number;
  grade?: string;
  submitted_at?: string;
  graded_at?: string;
  workflow_state: string;
}

export interface CanvasGradeResult {
  success: boolean;
  submission?: CanvasSubmission;
  gradeId?: string;
  error?: string;
  canvasErrorCode?: string;
}

// Request para crear assignment en Canvas
export interface CanvasAssignmentCreateRequest {
  name: string;
  description: string;
  points_possible: number;
  due_at?: string;
  submission_types: string[];
  external_tool_tag_attributes?: {
    url: string;
    content_type: 'ContextExternalTool';
    content_id: string;
  };
}

// Configuración para Canvas API
export interface CanvasAPIConfig {
  baseURL: string;
  token: string;
  accountId: string;
  timeout: number;
  retryAttempts: number;
}

// ================================

// src/types/selectors.ts
// Tipos para el sistema de selectores mejorado

export interface ValidationResult {
  ok: boolean | null;
  title: string;
  msg: string;
  metadata?: {
    type: string;
    originalInput?: string;
    processedInput?: string;
    evaluatedValue?: any;
    tolerance?: number;
    expectedParts?: number;
    actualParts?: number;
    difference?: number;
    timestamp?: string;
    [key: string]: any;
  };
}

export interface SelectorConfig {
  tolerance?: number;
  caseSensitive?: boolean;
  stripSpaces?: boolean;
  customFormatters?: Record<string, (input: string) => string>;
}

export interface ValidationRequest {
  type: SelectorType;
  correctAnswer: string;
  userAnswer: string;
  config?: SelectorConfig;
}

export interface BatchValidationRequest {
  exerciseId: string;
  validations: ValidationRequest[];
}

export interface BatchValidationResult {
  exerciseId: string;
  results: Array<ValidationResult & { index: number }>;
  totalScore: number;
  maxScore: number;
  allCorrect: boolean;
}

// Configuración específica por tipo de selector
export interface NumberSelectorConfig extends SelectorConfig {
  tolerance: number;
  allowFractions?: boolean;
  allowScientificNotation?: boolean;
}

export interface SetSelectorConfig extends SelectorConfig {
  strictOrder?: boolean;
  allowEquivalentForms?: boolean;
  maxIntervals?: number;
}

export interface FormulaSelectorConfig extends SelectorConfig {
  evaluationPoints?: number;
  allowEquivalentForms?: boolean;
  simplifyBeforeCompare?: boolean;
}

// Metadata específica por tipo de validación
export interface NumberValidationMetadata {
  type: 'number';
  correctValue: number;
  userValue: number;
  difference: number;
  withinTolerance: boolean;
  tolerance: number;
}

export interface SetValidationMetadata {
  type: 'set';
  expectedParts: number;
  actualParts: number;
  partsMatched: number;
  invalidParts?: string[];
}

export interface FormulaValidationMetadata {
  type: 'formula';
  evaluationPoints: number;
  pointsMatched: number;
  sampledValues?: Array<{
    x: number;
    expected: number;
    actual: number;
    matches: boolean;
  }>;
}

// Estadísticas de uso de selectores
export interface SelectorUsageStats {
  type: SelectorType;
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  commonErrors: Array<{
    input: string;
    frequency: number;
    errorType: string;
  }>;
}

// ================================

// src/types/request.ts
// Extensiones para Request de Express

import { Request } from 'express';

export interface LTIRequest extends Request {
  ltiContext?: LTIContext;
}

export interface AuthenticatedRequest extends Request {
  user?: BaseUser;
  token?: string;
}

export interface LTIAuthenticatedRequest extends Request {
  ltiContext?: LTIContext;
  user?: BaseUser;
}