// src/selectors/VectorSelector.ts
// Selector de vectores mejorado

import { BaseSelector } from './BaseSelector';
import { ValidationResult } from './types';

export class VectorSelector extends BaseSelector {

  async validate(input: string): Promise<ValidationResult> {
    const emptyCheck = this.validateEmpty(input);
    if (emptyCheck) return emptyCheck;

    const normalized = this.normalizeInput(input);
    this.debugLog(`Validando vector: ${normalized}`);

    try {
      // Verificar formato básico [a,b,c,...]
      if (!this.hasVectorFormat(normalized)) {
        return this.createErrorResponse(
          'Error de formato',
          'Un vector debe tener la forma [a, b, c, ...]',
          {
            type: 'invalid_format',
            expectedFormat: '[a, b, c, ...]'
          }
        );
      }

      const components = this.extractVectorComponents(normalized);
      const evaluatedComponents = [];

      // Validar cada componente
      for (let i = 0; i < components.length; i++) {
        const component = components[i];
        if (!component) {
          return this.createErrorResponse(
            'Componente inválido',
            `El componente ${i + 1} está vacío o indefinido`,
            {
              type: 'invalid_component',
              componentIndex: i,
              componentValue: component
            }
          );
        }

        try {
          const value = await this.safeEvaluate(component);
          if (typeof value !== 'number' || !isFinite(value)) {
            return this.createErrorResponse(
              'Componente inválido',
              `El componente ${i + 1} (${component}) no es un número válido`,
              {
                type: 'invalid_component',
                componentIndex: i,
                componentValue: component,
                evaluatedValue: value
              }
            );
          }
          evaluatedComponents.push(value);
        } catch (error) {
          return this.createErrorResponse(
            'Error de evaluación',
            `No se pudo evaluar el componente ${i + 1}: ${component}`,
            {
              type: 'evaluation_error',
              componentIndex: i,
              componentValue: component,
              error: error instanceof Error ? error.message : 'Error desconocido'
            }
          );
        }
      }

      return this.createSuccessResponse(
        'Vector válido',
        `${input} es un vector de ${evaluatedComponents.length} dimensiones`,
        {
          type: 'valid_vector',
          dimension: evaluatedComponents.length,
          components: evaluatedComponents,
          magnitude: this.calculateMagnitude(evaluatedComponents)
        }
      );

    } catch (error) {
      this.debugLog(`Error validando vector: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de formato',
        'No se pudo interpretar como vector',
        {
          type: 'parsing_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  private hasVectorFormat(input: string): boolean {
    return /^\s*\[\s*[^\[\]]*\s*\]\s*$/.test(input);
  }

  private extractVectorComponents(input: string): string[] {
    const content = input.substring(input.indexOf('[') + 1, input.lastIndexOf(']'));
    return content.split(',').map(component => component.trim()).filter(c => c !== '');
  }

  private calculateMagnitude(components: number[]): number {
    const sumOfSquares = components.reduce((sum, comp) => sum + comp * comp, 0);
    return Math.sqrt(sumOfSquares);
  }

  async compare(correct: string, userInput: string): Promise<ValidationResult> {
    const emptyCheck = this.validateEmpty(userInput);
    if (emptyCheck) return emptyCheck;

    this.debugLog(`Comparando vectores: "${correct}" vs "${userInput}"`);

    // Validar ambos vectores
    const correctValidation = await this.validate(correct);
    const userValidation = await this.validate(userInput);

    if (!correctValidation.ok) {
      return this.createErrorResponse(
        'Error del sistema',
        'El vector de respuesta correcta es inválido'
      );
    }

    if (!userValidation.ok) {
      return userValidation;
    }

    try {
      const correctComponents = this.extractVectorComponents(this.normalizeInput(correct));
      const userComponents = this.extractVectorComponents(this.normalizeInput(userInput));

      // Verificar misma dimensión
      if (correctComponents.length !== userComponents.length) {
        return this.createErrorResponse(
          'Dimensión incorrecta',
          `Tu vector tiene ${userComponents.length} componentes, pero debería tener ${correctComponents.length}`,
          {
            type: 'dimension_mismatch',
            expectedDimension: correctComponents.length,
            actualDimension: userComponents.length
          }
        );
      }

      // Evaluar componentes y comparar
      const correctValues = await Promise.all(
        correctComponents.map(comp => this.safeEvaluate(comp))
      );
      const userValues = await Promise.all(
        userComponents.map(comp => this.safeEvaluate(comp))
      );

      // Comparar componente por componente
      const componentMatches = correctValues.map((correctVal, i) => {
        const userVal = userValues[i];
        const difference = Math.abs(correctVal - userVal);
        return {
          index: i,
          matches: difference <= this.config.tolerance,
          difference,
          correctValue: correctVal,
          userValue: userVal
        };
      });

      const allMatch = componentMatches.every(match => match.matches);
      const matchCount = componentMatches.filter(match => match.matches).length;

      if (allMatch) {
        return this.createSuccessResponse(
          '¡Excelente!',
          'Tu vector coincide exactamente con la solución',
          {
            type: 'perfect_vector_match',
            dimension: correctValues.length,
            componentMatches,
            maxDifference: Math.max(...componentMatches.map(m => m.difference))
          }
        );
      } else {
        return this.createErrorResponse(
          'Vector incorrecto',
          `${matchCount} de ${correctValues.length} componentes son correctos`,
          {
            type: 'partial_vector_match',
            dimension: correctValues.length,
            correctComponents: matchCount,
            componentMatches,
            tolerance: this.config.tolerance
          }
        );
      }

    } catch (error) {
      this.debugLog(`Error comparando vectores: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de comparación',
        'No se pudo comparar los vectores',
        {
          type: 'comparison_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }
}

// Funciones de compatibilidad
export const compareVectors = async (correct: string, userInput: string): Promise<ValidationResult> => {
  const selector = new VectorSelector();
  return selector.compare(correct, userInput);
};

export const isVector = async (input: string): Promise<ValidationResult> => {
  const selector = new VectorSelector();
  return selector.validate(input);
};