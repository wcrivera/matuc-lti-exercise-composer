// src/selectors/types.ts
// Tipos centralizados para el sistema de selectores

export interface ValidationResult {
  ok: boolean | null;
  title: string;
  msg: string;
  metadata?: {
    type: string;
    originalInput?: string;
    processedInput?: string;
    evaluatedValue?: any;
    tolerance?: number;
    expectedParts?: number;
    actualParts?: number;
    difference?: number;
    timestamp?: string;
    processingTime?: number;
    [key: string]: any;
  };
}

export interface SelectorConfig {
  tolerance?: number;
  caseSensitive?: boolean;
  stripSpaces?: boolean;
  customFormatters?: Record<string, (input: string) => string>;
  timeout?: number;
  maxIterations?: number;
  debugMode?: boolean;
}

export type SelectorType = 'numero' | 'conjunto' | 'vector' | 'punto' | 'formula' | 'ecuacion' | 'antiderivada';

export interface ValidationRequest {
  type: SelectorType;
  correctAnswer: string;
  userAnswer: string;
  config?: SelectorConfig;
}