// src/selectors/index.ts
// Exportaciones principales del sistema de selectores

// Tipos base
export * from './types';

// Clase base y factory
export { BaseSelector } from './BaseSelector';
export { SelectorFactory } from './SelectorFactory';

// Selectores individuales
export { NumberSelector } from './NumberSelector';
export { SetSelector } from './SetSelector';
export { VectorSelector } from './VectorSelector';
export { PointSelector } from './PointSelector';
export { FormulaSelector } from './FormulaSelector';
export { EquationSelector } from './EquationSelector';
export { AntiderivativeSelector } from './AntiderivativeSelector';

// Funciones de compatibilidad con tu sistema existente
export {
    compareNumbers,
    isNumber
} from './NumberSelector';

export {
    compareSets,
    isSet
} from './SetSelector';

export {
    compareVectors,
    isVector
} from './VectorSelector';

export {
    comparePoints,
    isPoint
} from './PointSelector';

export {
    compareFormulas,
    isFormula
} from './FormulaSelector';

export {
    compareEquations,
    isEquation
} from './EquationSelector';

export {
    compareAntiderivadas,
    isAntiderivada
} from './AntiderivativeSelector';