// src/config/selectors.ts
// Configuración específica para selectores matemáticos

import { SelectorConfig } from '../types/selectors';

export interface SelectorsGlobalConfig {
  defaultTolerance: number;
  defaultFormulaPoints: number;
  mathJSTimeout: number;
  maxIterations: number;
  strictSetComparison: boolean;
  enableDebugLogging: boolean;
}

export const selectorsConfig: SelectorsGlobalConfig = {
  defaultTolerance: parseFloat(process.env.DEFAULT_NUMBER_TOLERANCE || '0.01'),
  defaultFormulaPoints: parseInt(process.env.DEFAULT_FORMULA_POINTS || '20'),
  mathJSTimeout: parseInt(process.env.MATHJS_TIMEOUT || '5000'),
  maxIterations: parseInt(process.env.SELECTOR_MAX_ITERATIONS || '1000'),
  strictSetComparison: process.env.DEFAULT_SET_COMPARISON_STRICT === 'true',
  enableDebugLogging: process.env.DEBUG_SELECTORS === 'true'
};

// Configuraciones por defecto por tipo de selector
export const defaultSelectorConfigs: Record<string, SelectorConfig> = {
  numero: {
    tolerance: selectorsConfig.defaultTolerance,
    stripSpaces: true,
    caseSensitive: false
  },
  conjunto: {
    tolerance: 0,
    stripSpaces: true,
    caseSensitive: false
  },
  vector: {
    tolerance: selectorsConfig.defaultTolerance,
    stripSpaces: true,
    caseSensitive: false
  },
  punto: {
    tolerance: selectorsConfig.defaultTolerance,
    stripSpaces: true,
    caseSensitive: false
  },
  formula: {
    tolerance: selectorsConfig.defaultTolerance,
    stripSpaces: true,
    caseSensitive: false
  },
  ecuacion: {
    tolerance: selectorsConfig.defaultTolerance,
    stripSpaces: true,
    caseSensitive: false
  },
  antiderivada: {
    tolerance: selectorsConfig.defaultTolerance,
    stripSpaces: true,
    caseSensitive: false
  }
};

// Timeout específico por tipo de selector
export const selectorTimeouts: Record<string, number> = {
  numero: 1000, // 1 segundo
  conjunto: 3000, // 3 segundos (más complejo)
  vector: 2000, // 2 segundos
  punto: 1500, // 1.5 segundos
  formula: 5000, // 5 segundos (evaluación múltiple)
  ecuacion: 4000, // 4 segundos
  antiderivada: 6000 // 6 segundos (derivación)
};

// ================================