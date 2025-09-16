// src/selectors/BaseSelector.ts
// Clase base abstracta para todos los selectores

import { evaluate } from 'mathjs';
import { ValidationResult, SelectorConfig } from './types';

export abstract class BaseSelector {
  protected config: Required<SelectorConfig>;

  constructor(config: SelectorConfig = {}) {
    this.config = {
      tolerance: config.tolerance ?? 0.01,
      caseSensitive: config.caseSensitive ?? false,
      stripSpaces: config.stripSpaces ?? true,
      customFormatters: config.customFormatters ?? {},
      timeout: config.timeout ?? 5000,
      maxIterations: config.maxIterations ?? 1000,
      debugMode: config.debugMode ?? false
    };
  }

  // Normalización común mejorada
  protected normalizeInput(input: string): string {
    let normalized = input;

    if (this.config.stripSpaces) {
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }

    if (!this.config.caseSensitive) {
      normalized = normalized.toLowerCase();
    }

    // Reemplazos matemáticos estándar
    normalized = this.applyMathematicalNormalizations(normalized);

    // Aplicar formateadores personalizados
    for (const [pattern, formatter] of Object.entries(this.config.customFormatters)) {
      normalized = formatter(normalized);
    }

    this.debugLog(`Input normalizado: "${input}" -> "${normalized}"`);
    return normalized;
  }

  private applyMathematicalNormalizations(input: string): string {
    return input
      // Símbolos de infinito
      .replace(/∞/g, 'infty')
      .replace(/infty/g, '1e309')

      // Funciones trigonométricas inversas
      .replace(/arcsin/g, 'asin')
      .replace(/arccos/g, 'acos')
      .replace(/arctan/g, 'atan')

      // Símbolos matemáticos comunes
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')

      // Símbolos de conjuntos
      .replace(/∪/g, 'U')
      .replace(/∩/g, 'I')
      .replace(/∈/g, 'in')
      .replace(/∉/g, 'notin')
      .replace(/⊂/g, 'subset')
      .replace(/⊆/g, 'subseteq')

      // Espacios múltiples
      .replace(/\s+/g, ' ');
  }

  // Validación de entrada vacía mejorada
  protected validateEmpty(input: string): ValidationResult | null {
    const trimmed = input.trim();

    if (trimmed === '') {
      return {
        ok: null,
        title: '¡Atención!',
        msg: 'No has ingresado una respuesta',
        metadata: {
          type: 'empty_input',
          originalInput: input,
          timestamp: new Date().toISOString()
        }
      };
    }

    return null;
  }

  // Evaluación segura con timeout
  protected async safeEvaluate(expression: string, scope?: { [key: string]: number | Function }): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Evaluación timeout después de ${this.config.timeout}ms`));
      }, this.config.timeout);

      try {
        if (scope === undefined) {
          const result = evaluate(expression);
          clearTimeout(timeout);
          resolve(result);
        } else {
          const result = evaluate(expression, scope);
          clearTimeout(timeout);
          resolve(result);
        }

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // Logging de debug
  protected debugLog(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`[${this.constructor.name}] ${message}`, data || '');
    }
  }

  // Crear respuesta de error estándar
  protected createErrorResponse(
    title: string,
    message: string,
    metadata?: any
  ): ValidationResult {
    return {
      ok: false,
      title,
      msg: message,
      metadata: {
        type: 'error',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  // Crear respuesta de éxito estándar
  protected createSuccessResponse(
    title: string,
    message: string,
    metadata?: any
  ): ValidationResult {
    return {
      ok: true,
      title,
      msg: message,
      metadata: {
        type: 'success',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  // Métodos abstractos
  abstract validate(input: string): Promise<ValidationResult>;
  abstract compare(correct: string, userInput: string): Promise<ValidationResult>;

  // Método de utilidad para validación rápida
  async validateQuick(input: string): Promise<boolean> {
    const result = await this.validate(input);
    return result.ok === true;
  }
}