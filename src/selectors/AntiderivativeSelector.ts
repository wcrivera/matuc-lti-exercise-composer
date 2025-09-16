// src/selectors/AntiderivativeSelector.ts
// Selector de antiderivadas mejorado

import { BaseSelector } from './BaseSelector';
import { ValidationResult } from './types';
import { evaluate, parse, derivative } from 'mathjs';

export class AntiderivativeSelector extends BaseSelector {
  
  async validate(input: string): Promise<ValidationResult> {
    const emptyCheck = this.validateEmpty(input);
    if (emptyCheck) return emptyCheck;

    const normalized = this.normalizeInput(input).replace(/x/g, 'X');
    this.debugLog(`Validando antiderivada: ${normalized}`);

    try {
      // Verificar que es una expresión válida en X y C
      const isValidExpression = await this.validateAntiderivativeExpression(normalized);
      
      if (!isValidExpression.isValid) {
        return this.createErrorResponse(
          'Expresión inválida',
          isValidExpression.error || 'La expresión no es válida como antiderivada',
          {
            type: 'invalid_antiderivative_expression',
            error: isValidExpression.error
          }
        );
      }

      // Verificar que contiene la constante de integración C
      const hasConstant = await this.checkForConstantOfIntegration(normalized);
      
      if (!hasConstant.hasConstant) {
        return this.createErrorResponse(
          'Falta constante de integración',
          'Una antiderivada general debe incluir la constante de integración C',
          {
            type: 'missing_constant',
            suggestion: 'Agrega "+ C" a tu respuesta',
            analysis: hasConstant.analysis
          }
        );
      }

      // Verificar que es efectivamente una antiderivada (derivada respecto a C es constante)
      const derivativeCheck = await this.checkDerivativeRespectToC(normalized);
      
      if (!derivativeCheck.isValidAntiderivative) {
        return this.createErrorResponse(
          'No es una antiderivada válida',
          derivativeCheck.error || 'La derivada respecto a C no es constante',
          {
            type: 'invalid_antiderivative',
            derivativeAnalysis: derivativeCheck.analysis
          }
        );
      }

      return this.createSuccessResponse(
        'Antiderivada válida',
        `${input} es una antiderivada general válida`,
        {
          type: 'valid_antiderivative',
          originalInput: input,
          processedInput: normalized,
          hasConstant: true,
          constantAnalysis: derivativeCheck.analysis
        }
      );

    } catch (error) {
      this.debugLog(`Error validando antiderivada: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de formato',
        'No se pudo interpretar como antiderivada válida',
        {
          type: 'parsing_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  private async validateAntiderivativeExpression(expression: string): Promise<{isValid: boolean, error?: string}> {
    try {
      // Evaluar la expresión en varios valores de X y C
      const testValues = [
        { X: 1, C: 0 }, { X: 1, C: 1 }, { X: 1, C: 5 },
        { X: 2, C: 0 }, { X: 2, C: 1 }, { X: -1, C: 2 }
      ];

      for (const values of testValues) {
        const result = await this.safeEvaluate(expression, values);
        
        if (typeof result !== 'number' || !isFinite(result)) {
          return {
            isValid: false,
            error: `Produce resultado inválido para X=${values.X}, C=${values.C}: ${result}`
          };
        }
      }

      return { isValid: true };

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Error de evaluación'
      };
    }
  }

  private async checkForConstantOfIntegration(expression: string): Promise<{hasConstant: boolean, analysis: any}> {
    try {
      // Verificar que la expresión contiene C
      if (!expression.includes('C')) {
        return {
          hasConstant: false,
          analysis: { reason: 'No contiene la variable C' }
        };
      }

      // Verificar que C aparece de manera apropiada (no solo en denominadores o exponentes)
      const parsedExpression = parse(expression);
      
      // Derivar respecto a C
      const derivativeRespectToC = derivative(parsedExpression, 'C');
      
      // Evaluar la derivada en varios puntos
      const testPoints = [1, 2, 5, 10];
      const derivativeValues = [];
      
      for (const point of testPoints) {
        try {
          const value = derivativeRespectToC.evaluate({ C: point, X: 1 });
          derivativeValues.push(value);
        } catch (error) {
          // Si no se puede evaluar, probablemente C no aparece correctamente
          return {
            hasConstant: false,
            analysis: { reason: 'C no aparece como constante aditiva' }
          };
        }
      }

      // Verificar que todas las derivadas son iguales y no cero
      const firstValue = derivativeValues[0];
      const allEqual = derivativeValues.every(val => Math.abs(val - firstValue) < this.config.tolerance);
      const isNonZero = Math.abs(firstValue) > this.config.tolerance;

      return {
        hasConstant: allEqual && isNonZero,
        analysis: {
          derivativeValues,
          allEqual,
          isNonZero,
          constantValue: firstValue
        }
      };

    } catch (error) {
      return {
        hasConstant: false,
        analysis: { 
          error: error instanceof Error ? error.message : 'Error en análisis',
          reason: 'Error evaluando derivada respecto a C'
        }
      };
    }
  }

  private async checkDerivativeRespectToC(expression: string): Promise<{isValidAntiderivative: boolean, error?: string, analysis?: any}> {
    try {
      const parsedExpression = parse(expression);
      const derivativeRespectToC = derivative(parsedExpression, 'C');
      
      // Evaluar en múltiples valores de X y C
      const testCombinations = [
        { X: 0, C: 1 }, { X: 1, C: 1 }, { X: 2, C: 1 },
        { X: 0, C: 5 }, { X: 1, C: 5 }, { X: 2, C: 5 }
      ];
      
      const evaluations = [];
      
      for (const values of testCombinations) {
        const derivValue = derivativeRespectToC.evaluate(values);
        evaluations.push({ ...values, derivValue });
      }
      
      // Verificar que la derivada es constante respecto a X y C
      const firstValue = evaluations[0]?.derivValue;
      const allConstant = evaluations.every(evaluation => 
        Math.abs(evaluation.derivValue - firstValue) < this.config.tolerance
      );
      
      const isNonZero = Math.abs(firstValue) > this.config.tolerance;
      
      return {
        isValidAntiderivative: allConstant && isNonZero,
        analysis: {
          evaluations,
          constantDerivative: allConstant,
          nonZeroDerivative: isNonZero,
          derivativeValue: firstValue
        }
      };

    } catch (error) {
      return {
        isValidAntiderivative: false,
        error: error instanceof Error ? error.message : 'Error verificando derivada'
      };
    }
  }

  async compare(correct: string, userInput: string): Promise<ValidationResult> {
    const emptyCheck = this.validateEmpty(userInput);
    if (emptyCheck) return emptyCheck;

    this.debugLog(`Comparando antiderivadas: "${correct}" vs "${userInput}"`);

    // Validar ambas antiderivadas
    const correctValidation = await this.validate(correct);
    const userValidation = await this.validate(userInput);

    if (!correctValidation.ok) {
      return this.createErrorResponse(
        'Error del sistema',
        'La antiderivada de respuesta correcta es inválida'
      );
    }

    if (!userValidation.ok) {
      return userValidation;
    }

    try {
      const correctNorm = this.normalizeInput(correct).replace(/x/g, 'X');
      const userNorm = this.normalizeInput(userInput).replace(/x/g, 'X');

      // Verificar que las derivadas de ambas antiderivadas son iguales
      const derivativeComparison = await this.compareDerivatives(correctNorm, userNorm);

      if (derivativeComparison.areEquivalent) {
        return this.createSuccessResponse(
          '¡Excelente!',
          'Tu antiderivada es correcta',
          {
            type: 'antiderivative_match',
            derivativeComparison: derivativeComparison.analysis,
            tolerance: this.config.tolerance
          }
        );
      } else {
        return this.createErrorResponse(
          'Antiderivada incorrecta',
          `Las derivadas no coinciden. Tasa de coincidencia: ${derivativeComparison.matchRate.toFixed(1)}%`,
          {
            type: 'antiderivative_mismatch',
            derivativeComparison: derivativeComparison.analysis,
            matchRate: derivativeComparison.matchRate,
            tolerance: this.config.tolerance,
            suggestion: 'Verifica tu proceso de integración'
          }
        );
      }

    } catch (error) {
      this.debugLog(`Error comparando antiderivadas: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de comparación',
        'No se pudo comparar las antiderivadas',
        {
          type: 'comparison_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  private async compareDerivatives(antiderivative1: string, antiderivative2: string): Promise<{
    areEquivalent: boolean;
    matchRate: number;
    analysis: any;
  }> {
    try {
      // Calcular las derivadas de ambas antiderivadas respecto a X
      const f = parse(antiderivative1);
      const g = parse(antiderivative2);
      
      const Df = derivative(f, 'X');
      const Dg = derivative(g, 'X');
      
      // Evaluar las derivadas en múltiples puntos
      const testPoints = [-2, -1, -0.5, 0.5, 1, 2, 3, 5];
      const comparisons = [];
      let matches = 0;
      
      for (const x of testPoints) {
        try {
          // Evaluar con un valor fijo de C para ambas
          const context = { X: x, C: 1 };
          
          const dfValue = Df.evaluate(context);
          const dgValue = Dg.evaluate(context);
          
          const difference = Math.abs(dfValue - dgValue);
          const isMatch = difference <= this.config.tolerance;
          
          comparisons.push({
            x,
            dfValue,
            dgValue,
            difference,
            matches: isMatch
          });
          
          if (isMatch) matches++;
          
        } catch (error) {
          comparisons.push({
            x,
            dfValue: null,
            dgValue: null,
            difference: Infinity,
            matches: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }
      
      const matchRate = (matches / testPoints.length) * 100;
      const areEquivalent = matchRate >= 90; // 90% de coincidencia requerida
      
      return {
        areEquivalent,
        matchRate,
        analysis: {
          comparisons,
          totalTests: testPoints.length,
          matches,
          derivativeExpressions: {
            first: Df.toString(),
            second: Dg.toString()
          }
        }
      };
      
    } catch (error) {
      return {
        areEquivalent: false,
        matchRate: 0,
        analysis: {
          error: error instanceof Error ? error.message : 'Error comparando derivadas'
        }
      };
    }
  }
}

// Funciones de compatibilidad
export const compareAntiderivadas = async (correct: string, userInput: string): Promise<ValidationResult> => {
  const selector = new AntiderivativeSelector();
  return selector.compare(correct, userInput);
};

export const isAntiderivada = async (input: string): Promise<ValidationResult> => {
  const selector = new AntiderivativeSelector();
  return selector.validate(input);
};