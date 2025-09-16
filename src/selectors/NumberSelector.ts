// src/selectors/NumberSelector.ts
// Selector de números mejorado

import { BaseSelector } from './BaseSelector';
import { ValidationResult } from './types';

export class NumberSelector extends BaseSelector {

  async validate(input: string): Promise<ValidationResult> {
    // Verificar entrada vacía
    const emptyCheck = this.validateEmpty(input);

    if (emptyCheck) return emptyCheck;

    const normalized = this.normalizeInput(input);
    this.debugLog(`Validando número: ${normalized}`);

    try {
      const result = await this.safeEvaluate(normalized);

      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return this.createSuccessResponse(
          'Número válido',
          `${input} es un número válido`,
          {
            type: 'number_validation',
            originalInput: input,
            processedInput: normalized,
            evaluatedValue: result
          }
        );
      } else {
        return this.createErrorResponse(
          '¡Cuidado!',
          'Tu respuesta no representa un número válido',
          {
            type: 'invalid_number',
            evaluatedValue: result,
            valueType: typeof result
          }
        );
      }
    } catch (error) {
      this.debugLog(`Error evaluando: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de evaluación',
        'No se pudo evaluar la expresión como número',
        {
          type: 'evaluation_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  async compare(correct: string, userInput: string): Promise<ValidationResult> {
    // Verificar entrada vacía
    const emptyCheck = this.validateEmpty(userInput);
    if (emptyCheck) return emptyCheck;

    this.debugLog(`Comparando números: "${correct}" vs "${userInput}"`);

    // Validar ambas entradas
    const correctValidation = await this.validate(correct);
    const userValidation = await this.validate(userInput);

    if (!correctValidation.ok) {
      return this.createErrorResponse(
        'Error del sistema',
        'La respuesta correcta no es un número válido',
        { type: 'system_error' }
      );
    }

    if (!userValidation.ok) {
      return userValidation;
    }

    try {
      const correctNorm = this.normalizeInput(correct);
      const userNorm = this.normalizeInput(userInput);

      const correctValue = await this.safeEvaluate(correctNorm);
      const userValue = await this.safeEvaluate(userNorm);

      // Comparación con tolerancia
      const difference = Math.abs(correctValue - userValue);
      const isWithinTolerance = difference <= this.config.tolerance;

      this.debugLog(`Comparación: ${correctValue} vs ${userValue}, diferencia: ${difference}, tolerancia: ${this.config.tolerance}`);

      if (isWithinTolerance) {
        return this.createSuccessResponse(
          '¡Excelente!',
          'Has encontrado la respuesta correcta',
          {
            type: 'correct_answer',
            correctValue,
            userValue,
            difference,
            tolerance: this.config.tolerance,
            withinTolerance: true
          }
        );
      } else {
        return this.createErrorResponse(
          'Sigue intentando',
          `Tu respuesta difiere por ${difference.toFixed(4)}. Tolerancia permitida: ±${this.config.tolerance}`,
          {
            type: 'tolerance_exceeded',
            correctValue,
            userValue,
            difference,
            tolerance: this.config.tolerance,
            withinTolerance: false
          }
        );
      }
    } catch (error) {
      this.debugLog(`Error en comparación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de comparación',
        'No se pudo comparar las respuestas numéricas',
        {
          type: 'comparison_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }
}

// Funciones de compatibilidad con tu sistema existente
export const compareNumbers = async (correct: string, userInput: string): Promise<ValidationResult> => {
  const selector = new NumberSelector();
  return selector.compare(correct, userInput);
};

export const isNumber = async (input: string): Promise<ValidationResult> => {
  const selector = new NumberSelector();
  return selector.validate(input);
};