// src/config/lti.ts (Ya creado anteriormente, pero aquí está la versión final)

import { config } from 'dotenv';
config();

export interface LTIConfig {
  issuer: string;
  clientId: string;
  deploymentId: string;
  keySetUrl: string;
  privateKey: string;
  publicKey: string;
  databaseUrl: string;
  databaseName: string;
}

export interface CanvasConfig {
  apiUrl: string;
  apiToken: string;
  clientId: string;
  clientSecret: string;
  accountId: string;
  defaultPoints: number;
  timeout: number;
  retryAttempts: number;
}

export const ltiConfig: LTIConfig = {
  issuer: process.env.LTI_ISSUER || 'https://localhost:3000',
  clientId: process.env.LTI_CLIENT_ID || '',
  deploymentId: process.env.LTI_DEPLOYMENT_ID || '1',
  keySetUrl: process.env.LTI_KEY_SET_URL || 'https://canvas.instructure.com/api/lti/security/jwks',
  privateKey: process.env.LTI_PRIVATE_KEY || '',
  publicKey: process.env.LTI_PUBLIC_KEY || '',
  databaseUrl: process.env.LTI_DB_URL || process.env.DB_CNN || 'mongodb://localhost:27017/matuc-lti',
  databaseName: process.env.LTI_DB_NAME || 'matuc-lti'
};

export const canvasConfig: CanvasConfig = {
  apiUrl: process.env.CANVAS_API_URL || '',
  apiToken: process.env.CANVAS_API_TOKEN || '',
  clientId: process.env.CANVAS_CLIENT_ID || '',
  clientSecret: process.env.CANVAS_CLIENT_SECRET || '',
  accountId: process.env.CANVAS_ACCOUNT_ID || '1',
  defaultPoints: parseInt(process.env.CANVAS_DEFAULT_POINTS || '100'),
  timeout: 10000,
  retryAttempts: 3
};

// Validación de configuración crítica
export const validateLTIConfig = (): void => {
  const requiredEnvVars = [
    'LTI_ISSUER',
    'LTI_CLIENT_ID', 
    'LTI_PRIVATE_KEY',
    'LTI_PUBLIC_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `❌ Faltan variables de entorno críticas para LTI: ${missingVars.join(', ')}\n` +
      'Revisa tu archivo .env y asegúrate de que todas las variables requeridas estén configuradas.'
    );
  }
};

export const validateCanvasConfig = (): void => {
  if (process.env.NODE_ENV === 'production') {
    const requiredVars = ['CANVAS_API_URL', 'CANVAS_API_TOKEN'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(
        `❌ Faltan variables de entorno críticas para Canvas: ${missingVars.join(', ')}`
      );
    }
  }
};

export const validateSSLConfig = (): void => {
  if (process.env.NODE_ENV === 'production' && !process.env.SSL_CERT_PATH) {
    throw new Error('❌ SSL es obligatorio en producción. Configura SSL_CERT_PATH y SSL_KEY_PATH.');
  }
};

export const validateAllConfigs = (): void => {
  try {
    validateLTIConfig();
    validateCanvasConfig();
    validateSSLConfig();
    console.log('✅ Todas las configuraciones son válidas');
  } catch (error) {
    console.error(error.message);
    throw error;
  }
};

// ================================