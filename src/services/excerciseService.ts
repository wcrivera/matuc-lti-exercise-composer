// src/services/exerciseService.ts
// Servicio para gestión de ejercicios y sets LTI

import { LTIExerciseSet, ILTIExerciseSet, ISubExercise } from '../models/lti/ltiExerciseSet';
import { LTIGroupedResponse } from '../models/lti/ltiResponse';
import { validationService } from './validationService';
import { canvasService } from './canvasService';
import { LTIUtils } from '../utils/ltiUtils';

export interface CreateExerciseSetRequest {
  canvasAssignmentId: string;
  canvasCourseId: string;
  title: string;
  mainStatement: string;
  description?: string;
  exercises: Array<Omit<ISubExercise, 'exerciseId'>>;
  timeLimit?: number;
  dueDate?: Date;
  allowMultipleAttempts?: boolean;
  showFeedback?: boolean;
  createdBy: string;
}

export interface SubmitResponsesRequest {
  canvasAssignmentId: string;
  canvasUserId: string;
  responses: Array<{
    exerciseId: string;
    answer: string;
  }>;
}

export class ExerciseService {
  
  // Crear nuevo set de ejercicios
  async createExerciseSet(request: CreateExerciseSetRequest): Promise<ILTIExerciseSet> {
    try {
      // Validar que no existe un set para este assignment
      const existingSet = await LTIExerciseSet.findOne({
        canvasAssignmentId: request.canvasAssignmentId
      });

      if (existingSet) {
        throw new Error('Ya existe un set de ejercicios para este assignment');
      }

      // Validar ejercicios
      this.validateExercises(request.exercises);

      // Crear el set
      const exerciseSet = new LTIExerciseSet({
        ...request,
        exercises: request.exercises.map((ex, index) => ({
          exerciseId: LTIUtils.generateExerciseId(),
          order: ex.order || index + 1,
          ...ex
        }))
      });

      const savedSet = await exerciseSet.save();
      
      // Sincronizar con Canvas si es necesario
      if (canvasService) {
        await this.syncWithCanvas(savedSet);
      }

      return savedSet;

    } catch (error) {
      throw new Error(`Error creando set de ejercicios: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  // Obtener set de ejercicios por assignment ID
  async getExerciseSet(canvasAssignmentId: string, userRole: string): Promise<any> {
    try {
      const exerciseSet = await LTIExerciseSet.findOne({
        canvasAssignmentId,
        isActive: true
      });

      if (!exerciseSet) {
        throw new Error('Set de ejercicios no encontrado');
      }

      // Para estudiantes, filtrar información sensible
      if (userRole === 'student') {
        return {
          setId: exerciseSet._id,
          title: exerciseSet.title,
          mainStatement: exerciseSet.mainStatement,
          description: exerciseSet.description,
          exercises: exerciseSet.exercises.map(ex => ({
            exerciseId: ex.exerciseId,
            order: ex.order,
            prompt: ex.prompt,
            validationType: ex.validationType,
            points: ex.points
            // NO incluir correctAnswer ni selectorConfig sensible
          })),
          maxScore: exerciseSet.maxScore,
          timeLimit: exerciseSet.timeLimit,
          allowMultipleAttempts: exerciseSet.allowMultipleAttempts,
          showFeedback: exerciseSet.showFeedback
        };
      }

      // Para instructores, información completa
      return exerciseSet;

    } catch (error) {
      throw new Error(`Error obteniendo set de ejercicios: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  // Procesar respuestas de un set completo
  async submitResponses(request: SubmitResponsesRequest): Promise<any> {
    try {
      const exerciseSet = await LTIExerciseSet.findOne({
        canvasAssignmentId: request.canvasAssignmentId,
        isActive: true
      });

      if (!exerciseSet) {
        throw new Error('Set de ejercicios no encontrado');
      }

      // Validar todas las respuestas
      const validationResults = [];
      let totalScore = 0;

      for (const response of request.responses) {
        const exercise = exerciseSet.getExerciseById(response.exerciseId);
        if (!exercise) {
          continue; // Saltar ejercicios no encontrados
        }

        // Validar respuesta
        const validationResult = await validationService.validateWithTimeout({
          type: exercise.validationType,
          correctAnswer: exercise.correctAnswer,
          userAnswer: LTIUtils.sanitizeUserAnswer(response.answer),
          config: exercise.selectorConfig
        });

        const isCorrect = validationResult.ok === true;
        const pointsEarned = isCorrect ? exercise.points : 0;
        totalScore += pointsEarned;

        validationResults.push({
          exerciseId: response.exerciseId,
          userAnswer: response.answer,
          isCorrect,
          pointsEarned,
          validationResult
        });
      }

      // Determinar número de intento
      const attemptNumber = await this.getNextAttemptNumber(
        request.canvasUserId,
        request.canvasAssignmentId
      );

      // Guardar respuesta agrupada
      const groupedResponse = new LTIGroupedResponse({
        setId: exerciseSet._id,
        canvasUserId: request.canvasUserId,
        canvasAssignmentId: request.canvasAssignmentId,
        canvasCourseId: exerciseSet.canvasCourseId,
        responses: validationResults,
        totalScore,
        maxScore: exerciseSet.maxScore,
        status: 'completed',
        attemptNumber
      });

      const savedResponse = await groupedResponse.save();

      // Enviar calificación a Canvas
      const gradeResult = await this.sendGradeToCanvas(
        exerciseSet.canvasCourseId,
        request.canvasAssignmentId,
        request.canvasUserId,
        totalScore,
        exerciseSet.maxScore
      );

      if (gradeResult.success) {
        savedResponse.gradeSentToCanvas = true;
        savedResponse.canvasGradeId = gradeResult.gradeId;
        await savedResponse.save();
      }

      return {
        totalScore,
        maxScore: exerciseSet.maxScore,
        percentage: (totalScore / exerciseSet.maxScore) * 100,
        responses: validationResults,
        attemptNumber,
        gradeSentToCanvas: gradeResult.success
      };

    } catch (error) {
      throw new Error(`Error procesando respuestas: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  // Obtener estadísticas de un set
  async getSetStatistics(canvasAssignmentId: string): Promise<any> {
    try {
      const responses = await LTIGroupedResponse.find({
        canvasAssignmentId,
        status: 'completed'
      });

      if (responses.length === 0) {
        return {
          totalAttempts: 0,
          uniqueStudents: 0,
          averageScore: 0,
          completionRate: 0
        };
      }

      const uniqueStudents = new Set(responses.map(r => r.canvasUserId)).size;
      const scores = responses.map(r => r.percentage);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

      return {
        totalAttempts: responses.length,
        uniqueStudents,
        averageScore: Math.round(averageScore * 100) / 100,
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        completionRate: uniqueStudents > 0 ? 100 : 0 // Simplificado
      };

    } catch (error) {
      throw new Error(`Error obteniendo estadísticas: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  private validateExercises(exercises: any[]): void {
    if (!exercises || exercises.length === 0) {
      throw new Error('Se requiere al menos un ejercicio');
    }

    if (exercises.length > 20) {
      throw new Error('Máximo 20 ejercicios por set');
    }

    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];
      if (!LTIUtils.validateExerciseStructure(exercise)) {
        throw new Error(`Ejercicio ${i + 1} tiene estructura inválida`);
      }
    }
  }

  private async syncWithCanvas(exerciseSet: ILTIExerciseSet): Promise<void> {
    try {
      // Opcional: actualizar assignment en Canvas con información del set
      // Por ejemplo, actualizar la descripción con el número de ejercicios
    } catch (error) {
      // No fallar la creación del set por errores de sincronización
      console.warn('Warning: No se pudo sincronizar con Canvas:', error);
    }
  }

  private async getNextAttemptNumber(userId: string, assignmentId: string): Promise<number> {
    const lastAttempt = await LTIGroupedResponse.findOne({
      canvasUserId: userId,
      canvasAssignmentId: assignmentId
    }).sort({ attemptNumber: -1 });

    return lastAttempt ? lastAttempt.attemptNumber + 1 : 1;
  }

  private async sendGradeToCanvas(
    courseId: string,
    assignmentId: string,
    userId: string,
    score: number,
    maxScore: number
  ): Promise<{ success: boolean; gradeId?: string }> {
    try {
      const percentage = (score / maxScore) * 100;
      const comment = `Puntuación: ${score}/${maxScore} (${percentage.toFixed(1)}%)`;
      
      const result = await canvasService.submitGrade(
        courseId,
        assignmentId,
        userId,
        percentage,
        comment
      );

      return result;

    } catch (error) {
      console.error('Error enviando calificación a Canvas:', error);
      return { success: false };
    }
  }
}

// Instancia singleton
export const exerciseService = new ExerciseService();