// src/selectors/SetSelector.ts
// Selector de conjuntos mejorado
// PENDIENTE CON ERRORES - REVISAR

import { BaseSelector } from './BaseSelector';
import { ValidationResult } from './types';

export class SetSelector extends BaseSelector {

  async validate(input: string): Promise<ValidationResult> {
    const emptyCheck = this.validateEmpty(input);
    if (emptyCheck) return emptyCheck;

    const normalized = this.normalizeInput(input);
    this.debugLog(`Validando conjunto: ${normalized}`);

    try {
      const unionParts = this.parseUnionParts(normalized);
      const validationResults = await Promise.all(
        unionParts.map(part => this.validateSetPart(part.trim()))
      );

      const invalidParts = validationResults.filter(result => !result.ok);

      if (invalidParts.length === 0) {
        return this.createSuccessResponse(
          'Conjunto válido',
          `${input.replace(/1e309/g, '∞')} es un conjunto válido`,
          {
            type: 'valid_set',
            parts: unionParts.length,
            originalInput: input,
            processedInput: normalized,
            unionParts
          }
        );
      } else {
        return this.createErrorResponse(
          'Conjunto inválido',
          `El conjunto contiene ${invalidParts.length} parte(s) inválida(s)`,
          {
            type: 'invalid_set',
            invalidParts: invalidParts.map(r => r.msg),
            totalParts: unionParts.length,
            validParts: unionParts.length - invalidParts.length
          }
        );
      }
    } catch (error) {
      this.debugLog(`Error validando conjunto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de formato',
        'Tu respuesta no tiene el formato de conjunto válido',
        {
          type: 'parsing_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  private parseUnionParts(input: string): string[] {
    // Reemplazar símbolos de unión y dividir
    // Manejar tanto U como ∪
    return input.replace(/∪/g, "U").split("U").map(part => part.trim()).filter(part => part !== '');
  }

  private async validateSetPart(part: string): Promise<ValidationResult> {
    this.debugLog(`Validando parte del conjunto: ${part}`);

    // Verificar si es un intervalo
    if (this.isInterval(part)) {
      return this.validateInterval(part);
    }

    // Verificar si es un conjunto discreto
    if (this.isDiscreteSet(part)) {
      return this.validateDiscreteSet(part);
    }

    return this.createErrorResponse(
      'Parte inválida',
      `${part} no es ni intervalo ni conjunto discreto válido`,
      {
        type: 'invalid_part',
        part: part,
        detectedType: this.detectPartType(part)
      }
    );
  }

  private detectPartType(str: string): string {
    if (/^[\(\[].*[\)\]]$/.test(str)) return 'posible_intervalo';
    if (/^\{.*\}$/.test(str)) return 'posible_conjunto_discreto';
    return 'formato_desconocido';
  }

  private isInterval(str: string): boolean {
    // Mejorado para detectar intervalos más robustamente
    const intervalRegex = /^[\(\[]([^,\[\]\(\)]+),([^,\[\]\(\)]+)[\)\]]$/;
    return intervalRegex.test(str.trim());
  }

  private isDiscreteSet(str: string): boolean {
    const discreteRegex = /^\{[^}]*\}$/;
    return discreteRegex.test(str.trim());
  }

  private async validateInterval(interval: string): Promise<ValidationResult> {
    try {
      const trimmed = interval.trim();
      const leftBracket = trimmed.charAt(0);
      const rightBracket = trimmed.charAt(trimmed.length - 1);
      const content = trimmed.substring(1, trimmed.length - 1);

      // Verificar que hay exactamente una coma
      const commaCount = (content.match(/,/g) || []).length;
      if (commaCount !== 1) {
        return this.createErrorResponse(
          'Error de formato',
          'Un intervalo debe tener exactamente dos valores separados por una coma'
        );
      }

      const parts = content.split(',');

      // Validar brackets
      if (!['(', '['].includes(leftBracket) || ![')', ']'].includes(rightBracket)) {
        return this.createErrorResponse(
          'Error de formato',
          'Un intervalo debe usar paréntesis () o corchetes []'
        );
      }

      const [left, right] = parts.map(p => p.trim());

      // Validar que no estén vacíos
      if (left === undefined || right === undefined || left === '' || right === '') return this.createErrorResponse(
        'Error de formato',
        'Los valores del intervalo no pueden estar vacíos'
      );

      // Validar que sean expresiones evaluables
      const leftValue = await this.safeEvaluate(left);
      const rightValue = await this.safeEvaluate(right);

      if (typeof leftValue !== 'number' || !isFinite(leftValue)) {
        return this.createErrorResponse(
          'Error en el primer valor',
          `"${left}" no es un número válido`
        );
      }

      if (typeof rightValue !== 'number' || !isFinite(rightValue)) {
        return this.createErrorResponse(
          'Error en el segundo valor',
          `"${right}" no es un número válido`
        );
      }

      // Validar orden
      if (leftValue >= rightValue) {
        return this.createErrorResponse(
          'Error en el orden',
          `El primer valor (${leftValue}) debe ser menor que el segundo (${rightValue})`
        );
      }

      return this.createSuccessResponse(
        'Intervalo válido',
        `${trimmed.replace(/1e309/g, '∞')} es un intervalo válido`,
        {
          type: 'valid_interval',
          leftValue,
          rightValue,
          leftBracket,
          rightBracket,
          length: rightValue - leftValue,
          intervalType: `${leftBracket}${rightBracket}`
        }
      );

    } catch (error) {
      this.debugLog(`Error validando intervalo "${interval}": ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de evaluación',
        `No se pudo evaluar el intervalo "${interval}"`,
        {
          type: 'evaluation_error',
          interval: interval,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  private async validateDiscreteSet(discreteSet: string): Promise<ValidationResult> {
    try {
      const content = discreteSet.substring(1, discreteSet.length - 1).trim();

      // Conjunto vacío es válido
      if (content === '') {
        return this.createSuccessResponse(
          'Conjunto vacío válido',
          'El conjunto vacío es válido',
          {
            type: 'valid_empty_set',
            elementCount: 0
          }
        );
      }

      const elements = content.split(',').map(el => el.trim()).filter(el => el !== '');
      const evaluatedElements = [];

      // Validar cada elemento
      for (const element of elements) {
        const value = await this.safeEvaluate(element);
        if (typeof value !== 'number') {
          return this.createErrorResponse(
            'Elemento inválido',
            `${element} no es un número válido`,
            {
              type: 'invalid_element',
              invalidElement: element,
              evaluatedValue: value
            }
          );
        }
        evaluatedElements.push(value);
      }

      // Verificar elementos duplicados
      const uniqueElements = [...new Set(evaluatedElements)];
      const hasDuplicates = uniqueElements.length !== evaluatedElements.length;

      return this.createSuccessResponse(
        'Conjunto discreto válido',
        `Conjunto con ${uniqueElements.length} elemento(s) ${hasDuplicates ? '(duplicados removidos)' : ''}`,
        {
          type: 'valid_discrete_set',
          elementCount: uniqueElements.length,
          originalElementCount: evaluatedElements.length,
          hasDuplicates,
          elements: uniqueElements.sort((a, b) => a - b) // Ordenar para comparaciones
        }
      );

    } catch (error) {
      this.debugLog(`Error validando conjunto discreto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de evaluación',
        'No se pudo evaluar el conjunto discreto',
        {
          type: 'evaluation_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  async compare(correct: string, userInput: string): Promise<ValidationResult> {
    const emptyCheck = this.validateEmpty(userInput);
    if (emptyCheck) return emptyCheck;

    this.debugLog(`Comparando conjuntos: "${correct}" vs "${userInput}"`);

    // Validar formato de ambas respuestas
    const correctValidation = await this.validate(correct);
    const userValidation = await this.validate(userInput);

    if (!userValidation.ok) {
      return userValidation;
    }

    if (!correctValidation.ok) {
      return this.createErrorResponse(
        'Error del sistema',
        'El conjunto de respuesta correcta es inválido'
      );
    }

    // Comparar estructuralmente los conjuntos
    return this.compareSetStructure(correct, userInput);
  }

  private async compareSetStructure(correct: string, userInput: string): Promise<ValidationResult> {
    try {
      const correctNorm = this.normalizeInput(correct);
      const userNorm = this.normalizeInput(userInput);

      const correctParts = this.parseUnionParts(correctNorm);
      const userParts = this.parseUnionParts(userNorm);

      this.debugLog(`Partes del conjunto correcto: ${correctParts.length}`);
      this.debugLog(`Partes del conjunto usuario: ${userParts.length}`);

      // Verificar mismo número de partes
      if (correctParts.length !== userParts.length) {
        return this.createErrorResponse(
          'Número de partes incorrecto',
          `Tu conjunto tiene ${userParts.length} parte(s), pero debería tener ${correctParts.length}`,
          {
            type: 'part_count_mismatch',
            expectedParts: correctParts.length,
            actualParts: userParts.length
          }
        );
      }

      // Comparar cada parte (permite diferentes órdenes)
      const matches = await this.findPartMatches(correctParts, userParts);

      if (matches.perfectMatches === correctParts.length) {
        return this.createSuccessResponse(
          '¡Perfecto!',
          'Tu conjunto coincide exactamente con la solución',
          {
            type: 'perfect_match',
            parts: correctParts.length,
            matches: matches
          }
        );
      } else {
        return this.createErrorResponse(
          'Partes no coinciden',
          `${matches.perfectMatches} de ${correctParts.length} partes coinciden correctamente`,
          {
            type: 'partial_match',
            expectedParts: correctParts.length,
            matchedParts: matches.perfectMatches,
            unmatchedParts: matches.unmatchedCorrect,
            extraParts: matches.unmatchedUser
          }
        );
      }

    } catch (error) {
      this.debugLog(`Error comparando estructura: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return this.createErrorResponse(
        'Error de comparación',
        'No se pudo comparar los conjuntos',
        {
          type: 'comparison_error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }

  private async findPartMatches(correctParts: string[], userParts: string[]): Promise<{
    perfectMatches: number;
    unmatchedCorrect: string[];
    unmatchedUser: string[];
  }> {
    const correctRemaining = [...correctParts];
    const userRemaining = [...userParts];
    let perfectMatches = 0;

    // Buscar coincidencias exactas primero
    for (let i = correctRemaining.length - 1; i >= 0; i--) {
      const correctPart = correctRemaining[i];
      const matchIndex = userRemaining.findIndex(userPart =>
        !!correctPart && this.arePartsEquivalent(correctPart, userPart)
      );

      if (matchIndex !== -1) {
        perfectMatches++;
        correctRemaining.splice(i, 1);
        userRemaining.splice(matchIndex, 1);
      }
    }

    return {
      perfectMatches,
      unmatchedCorrect: correctRemaining,
      unmatchedUser: userRemaining
    };
  }

  private arePartsEquivalent(part1: string, part2: string): boolean {
    // Normalizar ambas partes
    const norm1 = part1.trim();
    const norm2 = part2.trim();

    // Comparación directa
    if (norm1 === norm2) return true;

    // Para conjuntos discretos, comparar elementos ordenados
    if (this.isDiscreteSet(norm1) && this.isDiscreteSet(norm2)) {
      return this.compareDiscreteSets(norm1, norm2);
    }

    // Para intervalos, comparar valores y tipos de bracket
    if (this.isInterval(norm1) && this.isInterval(norm2)) {
      return this.compareIntervals(norm1, norm2);
    }

    return false;
  }

  private compareDiscreteSets(set1: string, set2: string): boolean {
    try {
      const content1 = set1.substring(1, set1.length - 1);
      const content2 = set2.substring(1, set2.length - 1);

      if (content1.trim() === '' && content2.trim() === '') return true;

      const elements1 = content1.split(',').map(el => parseFloat(el.trim())).sort();
      const elements2 = content2.split(',').map(el => parseFloat(el.trim())).sort();

      return elements1.length === elements2.length &&
        elements1.every((val, index) => elements2[index] !== undefined && Math.abs(val - elements2[index]) <= this.config.tolerance);
    } catch {
      return false;
    }
  }

  private compareIntervals(interval1: string, interval2: string): boolean {
    try {
      // Extraer brackets y valores
      const left1 = interval1.charAt(0);
      const right1 = interval1.charAt(interval1.length - 1);
      const content1 = interval1.substring(1, interval1.length - 1).split(',');

      const left2 = interval2.charAt(0);
      const right2 = interval2.charAt(interval2.length - 1);
      const content2 = interval2.substring(1, interval2.length - 1).split(',');

      // Los brackets deben ser iguales
      if (left1 !== left2 || right1 !== right2) return false;

      // Los valores deben ser equivalentes
      if (content1.length < 2 || content2.length < 2) return false;
      
      const val1Left = parseFloat(content1[0]?.trim() ?? '');
      const val1Right = parseFloat(content1[1]?.trim() ?? '');
      const val2Left = parseFloat(content2[0]?.trim() ?? '');
      const val2Right = parseFloat(content2[1]?.trim() ?? '');

      return Math.abs(val1Left - val2Left) <= this.config.tolerance &&
        Math.abs(val1Right - val2Right) <= this.config.tolerance;
    } catch {
      return false;
    }
  }
}

// Funciones de compatibilidad
export const compareSets = async (correct: string, userInput: string): Promise<ValidationResult> => {
  const selector = new SetSelector();
  return selector.compare(correct, userInput);
};

export const isSet = async (input: string): Promise<ValidationResult> => {
  const selector = new SetSelector();
  return selector.validate(input);
};