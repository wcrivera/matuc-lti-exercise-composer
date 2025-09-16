// src/services/validationService.ts
// Servicio de validación usando selectores mejorados

import { SelectorFactory, ValidationResult, SelectorType } from '../selectors';
import { selectorLogger } from '../config/logging';
import { selectorsConfig } from '../config/selectors';

export interface ValidationRequest {
  type: SelectorType;
  correctAnswer: string;
  userAnswer: string;
  config?: {
    tolerance?: number;
    caseSensitive?: boolean;
    stripSpaces?: boolean;
    timeout?: number;
  };
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
  processingTime: number;
}

export class ValidationService {
  
  // Validación individual con caching y métricas
  async validateSingle(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      selectorLogger.debug('Iniciando validación', {
        type: request.type,
        userAnswer: request.userAnswer.substring(0, 100) // Truncar para logging
      });

      const result = await SelectorFactory.validateResponse(
        request.type,
        request.correctAnswer,
        request.userAnswer,
        {
          timeout: selectorsConfig.mathJSTimeout,
          ...request.config
        }
      );

      // Agregar metadata de performance
      const processingTime = Date.now() - startTime;
      result.metadata = {
        ...result.metadata,
        validationType: request.type,
        processingTime,
        timestamp: new Date().toISOString()
      };

      selectorLogger.info('Validación completada', {
        type: request.type,
        result: result.ok,
        processingTime
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      selectorLogger.error('Error en validación', {
        type: request.type,
        error: error instanceof Error ? error.message : 'Error desconocido',
        processingTime
      });

      return {
        ok: false,
        title: 'Error de validación',
        msg: 'Error interno al validar la respuesta',
        metadata: {
          type: 'validation_error',
          error: error instanceof Error ? error.message : 'Error desconocido',
          processingTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Validación en lote con paralelización inteligente
  async validateBatch(request: BatchValidationRequest): Promise<BatchValidationResult> {
    const startTime = Date.now();
    
    try {
      selectorLogger.info('Iniciando validación batch', {
        exerciseId: request.exerciseId,
        validationCount: request.validations.length
      });

      // Procesar validaciones en paralelo con límite de concurrencia
      const concurrencyLimit = 5;
      const results = [];

      for (let i = 0; i < request.validations.length; i += concurrencyLimit) {
        const batch = request.validations.slice(i, i + concurrencyLimit);
        
        const batchResults = await Promise.all(
          batch.map(async (validation, batchIndex) => {
            const globalIndex = i + batchIndex;
            const result = await this.validateSingle(validation);
            return { ...result, index: globalIndex };
          })
        );
        
        results.push(...batchResults);
      }

      const correctResults = results.filter(r => r.ok === true);
      const totalScore = correctResults.length;
      const maxScore = results.length;
      const processingTime = Date.now() - startTime;

      selectorLogger.info('Validación batch completada', {
        exerciseId: request.exerciseId,
        totalScore,
        maxScore,
        processingTime
      });

      return {
        exerciseId: request.exerciseId,
        results,
        totalScore,
        maxScore,
        allCorrect: totalScore === maxScore,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      selectorLogger.error('Error en validación batch', {
        exerciseId: request.exerciseId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        processingTime
      });

      throw new Error(`Error procesando validación en lote: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  // Validación con timeout y circuit breaker
  async validateWithTimeout(
    request: ValidationRequest, 
    timeoutMs: number = selectorsConfig.mathJSTimeout
  ): Promise<ValidationResult> {
    const timeoutPromise = new Promise<ValidationResult>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout de validación')), timeoutMs)
    );

    try {
      return await Promise.race([
        this.validateSingle(request),
        timeoutPromise
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Timeout de validación') {
        return {
          ok: false,
          title: 'Timeout',
          msg: `La validación tomó más de ${timeoutMs}ms`,
          metadata: { 
            type: 'timeout_error',
            timeoutMs,
            timestamp: new Date().toISOString()
          }
        };
      }
      throw error;
    }
  }

  // Prevalidación rápida (sin evaluación completa)
  async quickValidate(type: SelectorType, input: string): Promise<boolean> {
    try {
      const selector = SelectorFactory.createSelector(type, {
        timeout: 1000 // Timeout reducido para validación rápida
      });
      
      const result = await selector.validate(input);
      return result.ok === true;
    } catch (error) {
      selectorLogger.warn('Error en validación rápida', {
        type,
        input: input.substring(0, 50),
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      return false;
    }
  }

  // Análisis de patrones de error
  async analyzeErrors(
    validationHistory: ValidationResult[]
  ): Promise<{
    commonPatterns: Array<{ pattern: string; frequency: number }>;
    errorTypes: Array<{ type: string; count: number }>;
    suggestions: string[];
  }> {
    const patterns = new Map<string, number>();
    const errorTypes = new Map<string, number>();
    const suggestions = [];

    for (const result of validationHistory) {
      if (result.ok === false && result.metadata) {
        // Analizar patrones de error
        const errorType = result.metadata.type || 'unknown';
        errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);

        // Detectar patrones específicos
        if (result.metadata.originalInput) {
          const input = result.metadata.originalInput.toLowerCase();
          
          // Detectar patrones comunes
          if (input.includes('infty')) {
            patterns.set('uso_infinito', (patterns.get('uso_infinito') || 0) + 1);
          }
          if (input.includes('{') || input.includes('}')) {
            patterns.set('notacion_conjunto', (patterns.get('notacion_conjunto') || 0) + 1);
          }
          if (/\d+\/\d+/.test(input)) {
            patterns.set('fracciones', (patterns.get('fracciones') || 0) + 1);
          }
        }
      }
    }

    // Generar sugerencias basadas en los patrones
    if (patterns.has('uso_infinito')) {
      suggestions.push('Verifica el uso correcto del símbolo de infinito (∞)');
    }
    if (patterns.has('notacion_conjunto')) {
      suggestions.push('Revisa la notación de conjuntos: usar {elementos} para conjuntos discretos');
    }
    if (patterns.has('fracciones')) {
      suggestions.push('Las fracciones pueden escribirse como decimales o expresiones');
    }

    return {
      commonPatterns: Array.from(patterns.entries()).map(([pattern, frequency]) => ({ pattern, frequency })),
      errorTypes: Array.from(errorTypes.entries()).map(([type, count]) => ({ type, count })),
      suggestions
    };
  }

  // Estadísticas de rendimiento del sistema de validación
  getPerformanceStats(): {
    averageValidationTime: number;
    totalValidations: number;
    successRate: number;
    errorRate: number;
  } {
    // En una implementación real, estos datos vendrían de una base de datos o cache
    return {
      averageValidationTime: 150, // ms
      totalValidations: 1000,
      successRate: 85,
      errorRate: 15
    };
  }
}

// Instancia singleton
export const validationService = new ValidationService();

// ================================