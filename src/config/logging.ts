// src/config/logging.ts
// Configuración de logging

import winston from 'winston';
import path from 'path';

export interface LoggingConfig {
  level: string;
  fileLogPath: string;
  errorLogPath: string;
  maxFileSize: string;
  maxFiles: string;
  format: winston.Logform.Format;
}

export const loggingConfig: LoggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  fileLogPath: process.env.LOG_FILE_PATH || './logs/app.log',
  errorLogPath: process.env.LOG_ERROR_FILE_PATH || './logs/error.log',
  maxFileSize: '10m',
  maxFiles: '5',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
};

// Crear logger principal
export const logger = winston.createLogger({
  level: loggingConfig.level,
  format: loggingConfig.format,
  defaultMeta: { 
    service: 'matuc-lti',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log
    new winston.transports.File({
      filename: loggingConfig.errorLogPath,
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // Combined log
    new winston.transports.File({
      filename: loggingConfig.fileLogPath,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

// Console transport para desarrollo
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Loggers específicos
export const ltiLogger = logger.child({ component: 'lti' });
export const canvasLogger = logger.child({ component: 'canvas' });
export const selectorLogger = logger.child({ component: 'selectors' });
export const dbLogger = logger.child({ component: 'database' });

// Función helper para logging de errores
export const logError = (error: Error, context: string, metadata?: any) => {
  logger.error(`Error in ${context}`, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context,
    metadata,
    timestamp: new Date().toISOString()
  });
};

// Función helper para logging de actividades LTI
export const logLTIActivity = (
  action: string, 
  userId: string, 
  courseId: string, 
  metadata?: any
) => {
  ltiLogger.info(`LTI Activity: ${action}`, {
    action,
    userId,
    courseId,
    metadata,
    timestamp: new Date().toISOString()
  });
};

// ================================