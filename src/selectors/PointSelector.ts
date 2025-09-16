// src/selectors/PointSelector.ts
// Selector de puntos mejorado

import { BaseSelector } from './BaseSelector';
import { ValidationResult } from './types';

export class PointSelector extends BaseSelector {

    async validate(input: string): Promise<ValidationResult> {
        const emptyCheck = this.validateEmpty(input);
        if (emptyCheck) return emptyCheck;

        const normalized = this.normalizeInput(input);
        this.debugLog(`Validando punto: ${normalized}`);

        try {
            // Verificar formato básico (a,b) o (a,b,c) etc.
            if (!this.hasPointFormat(normalized)) {
                return this.createErrorResponse(
                    'Error de formato',
                    'Un punto debe tener la forma (a, b) o (a, b, c, ...)',
                    {
                        type: 'invalid_format',
                        expectedFormat: '(a, b, c, ...)'
                    }
                );
            }

            const coordinates = this.extractPointCoordinates(normalized);
            const evaluatedCoordinates = [];

            // Validar cada coordenada
            for (let i = 0; i < coordinates.length; i++) {
                const coordinate = coordinates[i];
                if (!coordinate) {
                    return this.createErrorResponse(
                        'Coordenada vacía',
                        `La coordenada ${i + 1} está vacía`,
                        {
                            type: 'empty_coordinate',
                            coordinateIndex: i
                        }
                    );
                }
                try {
                    const value = await this.safeEvaluate(coordinate);
                    if (typeof value !== 'number' || !isFinite(value)) {
                        return this.createErrorResponse(
                            'Coordenada inválida',
                            `La coordenada ${i + 1} (${coordinate}) no es un número válido`,
                            {
                                type: 'invalid_coordinate',
                                coordinateIndex: i,
                                coordinateValue: coordinate,
                                evaluatedValue: value
                            }
                        );
                    }
                    evaluatedCoordinates.push(value);
                } catch (error) {
                    return this.createErrorResponse(
                        'Error de evaluación',
                        `No se pudo evaluar la coordenada ${i + 1}: ${coordinate}`,
                        {
                            type: 'evaluation_error',
                            coordinateIndex: i,
                            coordinateValue: coordinate,
                            error: error instanceof Error ? error.message : 'Error desconocido'
                        }
                    );
                }
            }

            // Determinar tipo de punto por dimensión
            const dimension = evaluatedCoordinates.length;
            let pointType = 'punto';
            if (dimension === 2) pointType = 'punto_2d';
            else if (dimension === 3) pointType = 'punto_3d';
            else if (dimension > 3) pointType = 'punto_nd';

            return this.createSuccessResponse(
                'Punto válido',
                `${input} es un ${pointType} válido de ${dimension} dimensiones`,
                {
                    type: 'valid_point',
                    dimension: dimension,
                    coordinates: evaluatedCoordinates,
                    pointType: pointType,
                    distanceFromOrigin: this.calculateDistanceFromOrigin(evaluatedCoordinates)
                }
            );

        } catch (error) {
            this.debugLog(`Error validando punto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            return this.createErrorResponse(
                'Error de formato',
                'No se pudo interpretar como punto',
                {
                    type: 'parsing_error',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                }
            );
        }
    }

    private hasPointFormat(input: string): boolean {
        // Formato (a,b,c,...) - paréntesis obligatorios para puntos
        return /^\s*\(\s*[^\(\)]*\s*\)\s*$/.test(input);
    }

    private extractPointCoordinates(input: string): string[] {
        const content = input.substring(input.indexOf('(') + 1, input.lastIndexOf(')'));
        return content.split(',').map(coord => coord.trim()).filter(c => c !== '');
    }

    private calculateDistanceFromOrigin(coordinates: number[]): number {
        const sumOfSquares = coordinates.reduce((sum, coord) => sum + coord * coord, 0);
        return Math.sqrt(sumOfSquares);
    }

    async compare(correct: string, userInput: string): Promise<ValidationResult> {
        const emptyCheck = this.validateEmpty(userInput);
        if (emptyCheck) return emptyCheck;

        this.debugLog(`Comparando puntos: "${correct}" vs "${userInput}"`);

        // Validar ambos puntos
        const correctValidation = await this.validate(correct);
        const userValidation = await this.validate(userInput);

        if (!correctValidation.ok) {
            return this.createErrorResponse(
                'Error del sistema',
                'El punto de respuesta correcta es inválido'
            );
        }

        if (!userValidation.ok) {
            return userValidation;
        }

        try {
            const correctCoords = this.extractPointCoordinates(this.normalizeInput(correct));
            const userCoords = this.extractPointCoordinates(this.normalizeInput(userInput));

            // Verificar misma dimensión
            if (correctCoords.length !== userCoords.length) {
                return this.createErrorResponse(
                    'Dimensión incorrecta',
                    `Tu punto tiene ${userCoords.length} coordenadas, pero debería tener ${correctCoords.length}`,
                    {
                        type: 'dimension_mismatch',
                        expectedDimension: correctCoords.length,
                        actualDimension: userCoords.length
                    }
                );
            }

            // Evaluar coordenadas y comparar
            const correctValues = await Promise.all(
                correctCoords.map(coord => this.safeEvaluate(coord))
            );
            const userValues = await Promise.all(
                userCoords.map(coord => this.safeEvaluate(coord))
            );

            // Comparar coordenada por coordenada
            const coordinateMatches = correctValues.map((correctVal, i) => {
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

            const allMatch = coordinateMatches.every(match => match.matches);
            const matchCount = coordinateMatches.filter(match => match.matches).length;

            if (allMatch) {
                const distance = this.calculateDistance(correctValues, userValues);
                return this.createSuccessResponse(
                    '¡Excelente!',
                    'Tu punto coincide exactamente con la solución',
                    {
                        type: 'perfect_point_match',
                        dimension: correctValues.length,
                        coordinateMatches,
                        euclideanDistance: distance,
                        maxCoordinateDifference: Math.max(...coordinateMatches.map(m => m.difference))
                    }
                );
            } else {
                return this.createErrorResponse(
                    'Punto incorrecto',
                    `${matchCount} de ${correctValues.length} coordenadas son correctas`,
                    {
                        type: 'partial_point_match',
                        dimension: correctValues.length,
                        correctCoordinates: matchCount,
                        coordinateMatches,
                        tolerance: this.config.tolerance
                    }
                );
            }

        } catch (error) {
            this.debugLog(`Error comparando puntos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            return this.createErrorResponse(
                'Error de comparación',
                'No se pudo comparar los puntos',
                {
                    type: 'comparison_error',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                }
            );
        }
    }

    private calculateDistance(point1: number[], point2: number[]): number {
        if (point1.length !== point2.length) return Infinity;

        const sumOfSquaredDiffs = point1.reduce((sum, val, i) => {
            const point2Val = point2[i];
            if (point2Val === undefined) return sum;
            const diff = val - point2Val;
            return sum + diff * diff;
        }, 0);

        return Math.sqrt(sumOfSquaredDiffs);
    }
}

// Funciones de compatibilidad
export const comparePoints = async (correct: string, userInput: string): Promise<ValidationResult> => {
    const selector = new PointSelector();
    return selector.compare(correct, userInput);
};

export const isPoint = async (input: string): Promise<ValidationResult> => {
    const selector = new PointSelector();
    return selector.validate(input);
};