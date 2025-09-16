// src/selectors/SelectorFactory.ts
// Factory pattern mejorado para crear selectores

import { BaseSelector } from './BaseSelector';
import { SelectorConfig, SelectorType, ValidationResult } from './types';


// Importar todos los selectores
import { NumberSelector } from './NumberSelector';
import { SetSelector } from './SetSelector';
import { VectorSelector } from './VectorSelector';
import { PointSelector } from './PointSelector';
import { FormulaSelector } from './FormulaSelector';
import { EquationSelector } from './EquationSelector';
import { AntiderivativeSelector } from './AntiderivativeSelector';

export class SelectorFactory {
  private static selectors: Map<SelectorType, new (config: SelectorConfig) => BaseSelector> = new Map([
    ['numero', NumberSelector],
    ['conjunto', SetSelector],
    ['vector', VectorSelector],
    ['punto', PointSelector],
    ['formula', FormulaSelector],
    ['ecuacion', EquationSelector],
    ['antiderivada', AntiderivativeSelector]
  ]);

  static createSelector(type: SelectorType, config: SelectorConfig = {}): BaseSelector {
    const SelectorClass = this.selectors.get(type);

    if (!SelectorClass) {
      throw new Error(`Selector tipo '${type}' no está implementado aún`);
    }

    return new SelectorClass(config);
  }

  static async validateResponse(
    type: SelectorType,
    correct: string,
    userInput: string,
    config: SelectorConfig = {}
  ): Promise<ValidationResult> {
    try {
      const selector = this.createSelector(type, config);
      return await selector.compare(correct, userInput);
    } catch (error) {
      return {
        ok: false,
        title: 'Error del sistema',
        msg: `Error creando selector de tipo '${type}': ${error instanceof Error ? error.message : 'Error desconocido'}`,
        metadata: {
          type: 'factory_error',
          selectorType: type,
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  static async validateFormat(
    type: SelectorType,
    input: string,
    config: SelectorConfig = {}
  ): Promise<ValidationResult> {
    try {
      const selector = this.createSelector(type, config);
      return await selector.validate(input);
    } catch (error) {
      return {
        ok: false,
        title: 'Error del sistema',
        msg: `Error validando formato para tipo '${type}': ${error instanceof Error ? error.message : 'Error desconocido'}`,
        metadata: {
          type: 'validation_error',
          selectorType: type,
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  static getSupportedTypes(): SelectorType[] {
    return Array.from(this.selectors.keys());
  }

  static registerSelector(type: SelectorType, selectorClass: new (config: SelectorConfig) => BaseSelector): void {
    this.selectors.set(type, selectorClass);
  }
}