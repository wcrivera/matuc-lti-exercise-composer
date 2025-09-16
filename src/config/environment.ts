// src/config/environment.ts
// Configuración por entorno

export type Environment = 'development' | 'test' | 'production';

export const currentEnvironment: Environment = 
  (process.env.NODE_ENV as Environment) || 'development';

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
  enableDebugLogs: boolean;
  enableDetailedErrors: boolean;
  requireSSL: boolean;
  enableCORS: boolean;
  enableRateLimit: boolean;
}

export const environmentConfig: EnvironmentConfig = {
  isDevelopment: currentEnvironment === 'development',
  isTest: currentEnvironment === 'test',
  isProduction: currentEnvironment === 'production',
  enableDebugLogs: currentEnvironment !== 'production',
  enableDetailedErrors: currentEnvironment !== 'production',
  requireSSL: currentEnvironment === 'production',
  enableCORS: true,
  enableRateLimit: currentEnvironment === 'production'
};

// Configuraciones específicas por entorno
export const getEnvironmentSpecificConfig = () => {
  switch (currentEnvironment) {
    case 'development':
      return {
        logLevel: 'debug',
        rateLimitMax: 1000,
        corsOrigin: ['http://localhost:3000', 'http://localhost:3001'],
        enableStackTraces: true
      };
    case 'test':
      return {
        logLevel: 'error',
        rateLimitMax: 10000,
        corsOrigin: ['http://localhost:3000'],
        enableStackTraces: true
      };
    case 'production':
      return {
        logLevel: 'info',
        rateLimitMax: 100,
        corsOrigin: process.env.CORS_ORIGIN?.split(',') || [],
        enableStackTraces: false
      };
    default:
      return {
        logLevel: 'info',
        rateLimitMax: 100,
        corsOrigin: [],
        enableStackTraces: false
      };
  }
};