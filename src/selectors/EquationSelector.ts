// src/selectors/EquationSelector.ts
// Selector de ecuaciones mejorado

import { BaseSelector } from './BaseSelector';
import { ValidationResult } from './types';
import { evaluate, parse } from 'mathjs';

export class EquationSelector extends BaseSelector {

    async validate(input: string): Promise<ValidationResult> {
        const emptyCheck = this.validateEmpty(input);
        if (emptyCheck) return emptyCheck;

        const normalized = this.normalizeInput(input).replace(/x/g, 'X');
        this.debugLog(`Validando ecuación: ${normalized}`);

        try {
            // Verificar que contiene el símbolo de igualdad
            if (!normalized.includes('=')) {
                return this.createErrorResponse(
                    'Formato inválido',
                    'Una ecuación debe contener el símbolo de igualdad (=)',
                    {
                        type: 'missing_equals',
                        suggestion: 'Ejemplo: x^2 + 2*x = 0'
                    }
                );
            }

            // Dividir en lado izquierdo y derecho
            const parts = normalized.split('=');

            if (parts.length !== 2) {
                return this.createErrorResponse(
                    'Formato inválido',
                    'Una ecuación debe tener exactamente un símbolo de igualdad',
                    {
                        type: 'multiple_equals',
                        partsFound: parts.length
                    }
                );
            }

            const [leftSide, rightSide] = parts.map(part => part.trim());

            if (!leftSide || !rightSide || leftSide === '' || rightSide === '') {
                return this.createErrorResponse(
                    'Ecuación incompleta',
                    'Ambos lados de la ecuación deben contener expresiones',
                    {
                        type: 'incomplete_equation',
                        leftSide,
                        rightSide
                    }
                );
            }

            // Validar que ambos lados son expresiones válidas
            const leftValidation = await this.validateExpression(leftSide);
            const rightValidation = await this.validateExpression(rightSide);

            if (!leftValidation.isValid) {
                return this.createErrorResponse(
                    'Lado izquierdo inválido',
                    `Error en el lado izquierdo: ${leftValidation.error}`,
                    {
                        type: 'invalid_left_side',
                        expression: leftSide,
                        error: leftValidation.error
                    }
                );
            }

            if (!rightValidation.isValid) {
                return this.createErrorResponse(
                    'Lado derecho inválido',
                    `Error en el lado derecho: ${rightValidation.error}`,
                    {
                        type: 'invalid_right_side',
                        expression: rightSide,
                        error: rightValidation.error
                    }
                );
            }

            // Analizar la ecuación
            const equationAnalysis = await this.analyzeEquation(leftSide, rightSide);

            return this.createSuccessResponse(
                'Ecuación válida',
                `${input} es una ecuación válida`,
                {
                    type: 'valid_equation',
                    originalInput: input,
                    processedInput: normalized,
                    leftSide,
                    rightSide,
                    analysis: equationAnalysis
                }
            );

        } catch (error) {
            this.debugLog(`Error validando ecuación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            return this.createErrorResponse(
                'Error de formato',
                'No se pudo interpretar como ecuación válida',
                {
                    type: 'parsing_error',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                }
            );
        }
    }

    private async validateExpression(expression: string): Promise<{ isValid: boolean, error?: string }> {
        try {
            // Intentar evaluar la expresión en varios puntos
            const testPoints = [0, 1, -1, 2];

            for (const point of testPoints) {
                const result = await this.safeEvaluate(expression, { X: point });
                if (typeof result !== 'number' || !isFinite(result)) {
                    return {
                        isValid: false,
                        error: `Produce resultado inválido para x=${point}: ${result}`
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

    private async analyzeEquation(leftSide: string, rightSide: string): Promise<any> {
        try {
            // Crear la expresión diferencia: leftSide - rightSide
            const diffExpression = `(${leftSide}) - (${rightSide})`;

            // Evaluar en varios puntos para detectar raíces aproximadas
            const testPoints = [-10, -5, -2, -1, -0.5, 0, 0.5, 1, 2, 5, 10];
            const evaluations = [];

            for (const point of testPoints) {
                try {
                    const value = await this.safeEvaluate(diffExpression, { X: point });
                    evaluations.push({ x: point, diff: value });
                } catch (error) {
                    // Ignorar puntos donde no se puede evaluar
                }
            }

            // Detectar posibles raíces (cambios de signo)
            const possibleRoots = [];
            for (let i = 1; i < evaluations.length; i++) {
                const prev = evaluations[i - 1];
                const curr = evaluations[i];

                if (!!prev && !!curr && prev.diff * curr.diff < 0) {
                    // Cambio de signo indica posible raíz
                    possibleRoots.push({
                        interval: [prev.x, curr.x],
                        signChange: true
                    });
                }
            }

            return {
                hasPossibleRoots: possibleRoots.length > 0,
                possibleRootIntervals: possibleRoots,
                evaluationPoints: evaluations.length,
                diffExpression
            };

        } catch (error) {
            return {
                analysisError: error instanceof Error ? error.message : 'Error en análisis'
            };
        }
    }

    async compare(correct: string, userInput: string): Promise<ValidationResult> {
        const emptyCheck = this.validateEmpty(userInput);
        if (emptyCheck) return emptyCheck;

        this.debugLog(`Comparando ecuaciones: "${correct}" vs "${userInput}"`);

        // Validar ambas ecuaciones
        const correctValidation = await this.validate(correct);
        const userValidation = await this.validate(userInput);

        if (!correctValidation.ok) {
            return this.createErrorResponse(
                'Error del sistema',
                'La ecuación de respuesta correcta es inválida'
            );
        }

        if (!userValidation.ok) {
            return userValidation;
        }

        try {
            const correctNorm = this.normalizeInput(correct).replace(/x/g, 'X');
            const userNorm = this.normalizeInput(userInput).replace(/x/g, 'X');

            // Extraer lados de ambas ecuaciones
            const [correctLeft, correctRight] = correctNorm.split('=').map(s => s.trim());
            const [userLeft, userRight] = userNorm.split('=').map(s => s.trim());

            // Crear expresiones de diferencia para ambas ecuaciones
            const correctDiff = `(${correctLeft}) - (${correctRight})`;
            const userDiff = `(${userLeft}) - (${userRight})`;

            // Evaluar en múltiples puntos para verificar equivalencia
            const testPoints = [-5, -2, -1, -0.5, 0, 0.5, 1, 2, 5];
            const matches = [];
            let totalMatches = 0;

            for (const testPoint of testPoints) {
                try {
                    const correctValue = await this.safeEvaluate(correctDiff, { X: testPoint });
                    const userValue = await this.safeEvaluate(userDiff, { X: testPoint });

                    const difference = Math.abs(correctValue - userValue);
                    const matchesPoint = difference <= this.config.tolerance;

                    matches.push({
                        x: testPoint,
                        correctValue,
                        userValue,
                        difference,
                        matches: matchesPoint
                    });

                    if (matchesPoint) totalMatches++;

                } catch (error) {
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
            const requiredSuccessRate = 85; // 85% de los puntos deben coincidir

            if (successRate >= requiredSuccessRate) {
                return this.createSuccessResponse(
                    '¡Excelente!',
                    'Tu ecuación es equivalente a la solución',
                    {
                        type: 'equation_match',
                        successRate,
                        totalMatches,
                        totalTests: testPoints.length,
                        matches,
                        tolerance: this.config.tolerance
                    }
                );
            } else {
                return this.createErrorResponse(
                    'Ecuación incorrecta',
                    `Tu ecuación coincide en ${successRate.toFixed(1)}% de los puntos evaluados (se requiere ${requiredSuccessRate}%)`,
                    {
                        type: 'equation_mismatch',
                        successRate,
                        totalMatches,
                        totalTests: testPoints.length,
                        matches,
                        tolerance: this.config.tolerance,
                        requiredSuccessRate,
                        suggestion: 'Verifica que ambos lados de tu ecuación sean correctos'
                    }
                );
            }

        } catch (error) {
            this.debugLog(`Error comparando ecuaciones: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            return this.createErrorResponse(
                'Error de comparación',
                'No se pudo comparar las ecuaciones',
                {
                    type: 'comparison_error',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                }
            );
        }
    }
}

// Funciones de compatibilidad
export const compareEquations = async (correct: string, userInput: string): Promise<ValidationResult> => {
    const selector = new EquationSelector();
    return selector.compare(correct, userInput);
};

export const isEquation = async (input: string): Promise<ValidationResult> => {
    const selector = new EquationSelector();
    return selector.validate(input);
};