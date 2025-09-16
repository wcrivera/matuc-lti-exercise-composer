// src/selectors/FormulaSelector.ts
// Selector de fórmulas mejorado

import { BaseSelector } from './BaseSelector';
import { ValidationResult } from './types';
import { evaluate, equal } from 'mathjs';

export class FormulaSelector extends BaseSelector {
  
  async validate(input: string): Promise<ValidationResult> {
    const emptyCheck = this.validateEmpty(input);
    if (emptyCheck) return emptyCheck;

    const normalized = this.normalizeInput(input).replace(/x/g, 'X');
    this.debugLog(`Validando fórmula: ${normalized}`);

    try {
      // Verificar que es una expresión válida evaluando en varios puntos
      const testPoints = [0.1, 0.5, 1, 2, 5];
      const evaluationResults = [];

      for (const testPoint of testPoints) {
        try {
          const result = await this.safeEvaluate(normalized, { X: testPoint });
          
          if (typeof result !== 'number' || !isFinite(result)) {
            return this.createErrorResponse(
              'Fórmula inválida',
              `La fórmula no produce un número válido para x = ${testPoint}`,
              {
                type: 'invalid_formula_output',
                testPoint,
                evaluatedValue: result,
                valueType: typeof result
              }
            );
          }
          
          evaluationResults.push({ x: testPoint, y: result });
        } catch (error) {
          return this.createErrorResponse(
            'Error de evaluación',
            `No se pudo evaluar la fórmula para x = ${testPoint}`,
            {
              type: 'evaluation_error',
              testPoint,
              error: error instanceof Error ? error.message : 'Error desconocido'
            }
          );
        }
      }

      // Analizar el comportamiento de la fórmula
      const formulaAnalysis = this.analyzeFormula(evaluationResults);

      return this.createSuccessResponse(
        'Fórmula válida',
        `${input} es una fórmula válida en x`,
        {
          type: 'valid_formula',
          originalInput: input,
          processedInput: normalized,
          evaluationPoints: evaluationResults,
          analysis: formulaAnalysis
        }
      );

    } catch (error) {
      this.debugLog(`Error validando fórmula: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de formato',
        'Tu respuesta no representa una fórmula válida',
        {
          type: 'parsing_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  private analyzeFormula(evaluations: Array<{x: number, y: number}>): any {
    // Análisis básico del comportamiento de la fórmula
    const yValues = evaluations.map(e => e.y);
    const isConstant = yValues.every(y => yValues[0] && Math.abs(y - yValues[0]) < this.config.tolerance);
    const isMonotonic = this.isMonotonic(evaluations);
    
    return {
      isConstant,
      isMonotonic,
      range: {
        min: Math.min(...yValues),
        max: Math.max(...yValues)
      },
      averageValue: yValues.reduce((sum, y) => sum + y, 0) / yValues.length
    };
  }

  private isMonotonic(evaluations: Array<{x: number, y: number}>): 'increasing' | 'decreasing' | 'neither' {
    let increasing = true;
    let decreasing = true;

    for (let i = 1; i < evaluations.length; i++) {
      const prev = evaluations[i-1];
      const curr = evaluations[i];

      if (curr && prev && curr.y < prev.y) increasing = false;
      if (curr && prev && curr.y > prev.y) decreasing = false;
    }

    if (increasing) return 'increasing';
    if (decreasing) return 'decreasing';
    return 'neither';
  }

  async compare(correct: string, userInput: string): Promise<ValidationResult> {
    const emptyCheck = this.validateEmpty(userInput);
    if (emptyCheck) return emptyCheck;

    this.debugLog(`Comparando fórmulas: "${correct}" vs "${userInput}"`);

    // Validar ambas fórmulas
    const correctValidation = await this.validate(correct);
    const userValidation = await this.validate(userInput);

    if (!correctValidation.ok) {
      return this.createErrorResponse(
        'Error del sistema',
        'La fórmula de respuesta correcta es inválida'
      );
    }

    if (!userValidation.ok) {
      return userValidation;
    }

    try {
      const correctNorm = this.normalizeInput(correct).replace(/x/g, 'X');
      const userNorm = this.normalizeInput(userInput).replace(/x/g, 'X');

      // Evaluar en múltiples puntos para verificar equivalencia
      const testPoints = this.generateTestPoints();
      const matches = [];
      let totalMatches = 0;

      for (const testPoint of testPoints) {
        try {
          const correctValue = await this.safeEvaluate(correctNorm, { X: testPoint });
          const userValue = await this.safeEvaluate(userNorm, { X: testPoint });

          const difference = Math.abs(correctValue - userValue);
          const matches_point = difference <= this.config.tolerance;

          matches.push({
            x: testPoint,
            correctValue,
            userValue,
            difference,
            matches: matches_point
          });

          if (matches_point) totalMatches++;

        } catch (error) {
          // Si hay error en algún punto, considerar como no coincidente
          matches.push({
            x: testPoint,
            correctValue: null,
            userValue: null,
            difference: Infinity,
            matches: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }

      const successRate = (totalMatches / testPoints.length) * 100;
      const requiredSuccessRate = 90; // 90% de los puntos deben coincidir

      if (successRate >= requiredSuccessRate) {
        return this.createSuccessResponse(
          '¡Excelente!',
          'Tu fórmula coincide con la solución',
          {
            type: 'formula_match',
            successRate,
            totalMatches,
            totalTests: testPoints.length,
            matches,
            tolerance: this.config.tolerance
          }
        );
      } else {
        return this.createErrorResponse(
          'Fórmula incorrecta',
          `Tu fórmula coincide en ${successRate.toFixed(1)}% de los puntos evaluados (se requiere ${requiredSuccessRate}%)`,
          {
            type: 'formula_mismatch',
            successRate,
            totalMatches,
            totalTests: testPoints.length,
            matches,
            tolerance: this.config.tolerance,
            requiredSuccessRate
          }
        );
      }

    } catch (error) {
      this.debugLog(`Error comparando fórmulas: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de comparación',
        'No se pudo comparar las fórmulas',
        {
          type: 'comparison_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  private generateTestPoints(): number[] {
    // Generar puntos de prueba estratégicos
    return [
      -5, -2, -1, -0.5, -0.1,  // Negativos
      0,                        // Cero
      0.1, 0.5, 1, 2, 5,       // Positivos pequeños
      10, 20                    // Positivos grandes
    ];
  }
}

// Funciones de compatibilidad
export const compareFormulas = async (correct: string, userInput: string): Promise<ValidationResult> => {
  const selector = new FormulaSelector();
  return selector.compare(correct, userInput);
};

export const isFormula = async (input: string): Promise<ValidationResult> => {
  const selector = new FormulaSelector();
  return selector.validate(input);
};