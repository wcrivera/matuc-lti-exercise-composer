// src/config/lti.ts
// Configuración base para LTI 1.3 con Canvas

import { config } from 'dotenv';
import crypto from 'crypto';

// Cargar variables de entorno
config();

export interface LTIConfig {
  issuer: string;
  clientId: string;
  deploymentId: string;
  keySetUrl: string;
  authLoginUrl: string;
  authTokenUrl: string;
  privateKey: string;
  publicKey: string;
  databaseUrl: string;
  databaseName: string;
}

export interface CanvasConfig {
  apiUrl: string;
  apiToken: string;
  accountId: string;
  defaultPoints: number;
  timeout: number;
  retryAttempts: number;
}

export interface SecurityConfig {
  rateLimitWindow: number;
  rateLimitMax: number;
  corsOrigin: string[];
  enableLogging: boolean;
}

// Generar claves RSA si no existen
const generateKeyPair = (): { privateKey: string; publicKey: string } => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return { privateKey, publicKey };
};

// Configuración LTI principal
export const ltiConfig: LTIConfig = (() => {
  // Generar claves si no existen
  const keys = (!process.env.LTI_PRIVATE_KEY || !process.env.LTI_PUBLIC_KEY) 
    ? generateKeyPair() 
    : { 
        privateKey: process.env.LTI_PRIVATE_KEY, 
        publicKey: process.env.LTI_PUBLIC_KEY 
      };

  return {
    issuer: process.env.LTI_ISSUER || 'https://localhost:3000',
    clientId: process.env.LTI_CLIENT_ID || '10000000000001',
    deploymentId: process.env.LTI_DEPLOYMENT_ID || '1',
    keySetUrl: process.env.LTI_KEY_SET_URL || 'https://canvas.instructure.com/api/lti/security/jwks',
    authLoginUrl: process.env.LTI_AUTH_LOGIN_URL || 'https://canvas.instructure.com/api/lti/authorize_redirect',
    authTokenUrl: process.env.LTI_AUTH_TOKEN_URL || 'https://canvas.instructure.com/login/oauth2/token',
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    databaseUrl: process.env.LTI_DB_URL || process.env.DB_CNN || 'mongodb://localhost:27017/matuc-lti',
    databaseName: process.env.LTI_DB_NAME || 'matuc-lti'
  };
})();

// Configuración Canvas API
export const canvasConfig: CanvasConfig = {
  apiUrl: process.env.CANVAS_API_URL || '',
  apiToken: process.env.CANVAS_API_TOKEN || '',
  accountId: process.env.CANVAS_ACCOUNT_ID || '1',
  defaultPoints: parseInt(process.env.CANVAS_DEFAULT_POINTS || '100'),
  timeout: 10000,
  retryAttempts: 3
};

// Configuración de seguridad
export const securityConfig: SecurityConfig = {
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
  enableLogging: process.env.LOG_LTI_ENABLED === 'true'
};

// Validaciones de configuración
export const validateLTIConfig = (): boolean => {
  const requiredFields = ['issuer', 'clientId', 'privateKey', 'publicKey'];
  const missingFields = requiredFields.filter(field => !ltiConfig[field as keyof LTIConfig]);

  if (missingFields.length > 0) {
    console.error('❌ Configuración LTI incompleta. Faltan:', missingFields);
    return false;
  }

  console.log('✅ Configuración LTI válida');
  return true;
};

export const validateCanvasConfig = (): boolean => {
  if (process.env.NODE_ENV === 'production' && !canvasConfig.apiUrl) {
    console.warn('⚠️  Canvas API URL no configurada (necesaria para funciones avanzadas)');
  }
  return true;
};

export const validateSSLConfig = (): boolean => {
  if (process.env.NODE_ENV === 'production' && !ltiConfig.issuer.startsWith('https://')) {
    console.error('❌ HTTPS es obligatorio para LTI en producción');
    return false;
  }
  return true;
};

// Validar todas las configuraciones
export const validateAllConfigs = (): boolean => {
  return validateLTIConfig() && validateCanvasConfig() && validateSSLConfig();
};

// Mostrar configuración actual (sin datos sensibles)
export const showConfigSummary = (): void => {
  console.log('\n🔧 CONFIGURACIÓN LTI ACTUAL:');
  console.log(`   Issuer: ${ltiConfig.issuer}`);
  console.log(`   Client ID: ${ltiConfig.clientId}`);
  console.log(`   Deployment ID: ${ltiConfig.deploymentId}`);
  console.log(`   Base de datos: ${ltiConfig.databaseName}`);
  console.log(`   Canvas API: ${canvasConfig.apiUrl || 'No configurada'}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
};
