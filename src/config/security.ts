// src/config/security.ts
// Configuración de seguridad

export interface SecurityConfig {
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  corsOrigin: string[];
  corsCredentials: boolean;
  contentSecurityPolicy: boolean;
  hstsMaxAge: number;
  sessionTimeout: number;
  jwtExpiration: string;
  bcryptRounds: number;
}

export const securityConfig: SecurityConfig = {
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  corsOrigin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean),
  corsCredentials: process.env.CORS_CREDENTIALS === 'true',
  contentSecurityPolicy: process.env.SECURITY_CONTENT_SECURITY_POLICY === 'true',
  hstsMaxAge: parseInt(process.env.SECURITY_HSTS_MAX_AGE || '31536000'), // 1 año
  sessionTimeout: 30 * 60 * 1000, // 30 minutos
  jwtExpiration: process.env.JWT_EXPIRE || '24h',
  bcryptRounds: 12
};

// CSP Policy para LTI
export const getContentSecurityPolicy = () => {
  return {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Requerido para MathJax/LaTeX
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Requerido para estilos dinámicos
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "*.instructure.com", // Canvas assets
        "*.canvaslms.com"
      ],
      connectSrc: [
        "'self'",
        "https:",
        "wss:", // WebSocket para Socket.IO
        "*.instructure.com" // Canvas API
      ],
      frameSrc: [
        "'self'",
        "*.instructure.com" // Canvas embedding
      ],
      frameAncestors: [
        "*.instructure.com", // Permitir embedding en Canvas
        "*.canvaslms.com"
      ]
    }
  };
};

// Rate limiting específico para diferentes endpoints
export const rateLimitConfigs = {
  general: {
    windowMs: securityConfig.rateLimitWindowMs,
    max: securityConfig.rateLimitMaxRequests,
    message: 'Demasiadas solicitudes, intenta más tarde'
  },
  ltiLaunch: {
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // Máximo 10 launches por minuto
    message: 'Demasiados launches LTI, intenta más tarde'
  },
  validation: {
    windowMs: 60 * 1000, // 1 minuto
    max: 100, // Máximo 100 validaciones por minuto
    message: 'Demasiadas validaciones, intenta más tarde'
  },
  canvasAPI: {
    windowMs: 60 * 1000, // 1 minuto
    max: 50, // Máximo 50 llamadas a Canvas por minuto
    message: 'Límite de API Canvas alcanzado'
  }
};

// ================================