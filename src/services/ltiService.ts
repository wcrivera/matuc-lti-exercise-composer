// src/services/ltiService.ts
// Servicio LTI simplificado (sin ltijs por ahora)

import { Application, Request, Response } from 'express';
import { ltiConfig, validateAllConfigs, showConfigSummary } from '../config/lti';

export class LTIService {
  
  /**
   * Configurar el proveedor LTI (versión simplificada)
   */
  static async setupProvider(app: Application): Promise<void> {
    try {
      console.log('🚀 Iniciando configuración LTI...');
      
      // Validar configuraciones
      if (!validateAllConfigs()) {
        console.warn('⚠️ Configuración LTI incompleta, usando versión simplificada');
      }
      
      showConfigSummary();

      // Configurar rutas LTI básicas
      this.setupBasicLTIRoutes(app);
      
      console.log('✅ LTI Service configurado (versión simplificada)');
      console.log('💡 Para LTI completo, instala y configura ltijs en Fase 2');
      
    } catch (error) {
      console.error('❌ Error configurando LTI Service:', error);
      console.warn('⚠️ Continuando sin funcionalidad LTI completa');
    }
  }

  /**
   * Configurar rutas LTI básicas
   */
  private static setupBasicLTIRoutes(app: Application): void {
    
    // Ruta para claves públicas JWKS
    app.get('/lti/keys', (req: Request, res: Response) => {
      res.json({
        keys: [],
        message: 'JWKS endpoint - Configurar ltijs para claves reales',
        issuer: ltiConfig.issuer,
        algorithm: 'RS256'
      });
    });

    // Ruta de login LTI
    app.get('/lti/login', (req: Request, res: Response) => {
      console.log('🎯 LTI Login solicitado');
      res.json({
        message: 'LTI Login endpoint',
        issuer: ltiConfig.issuer,
        client_id: ltiConfig.clientId,
        note: 'Configurar ltijs para autenticación real'
      });
    });

    // Ruta de launch LTI
    app.post('/lti/launch', (req: Request, res: Response) => {
      console.log('🚀 LTI Launch solicitado');
      console.log('Body:', req.body);
      
      // Crear sesión mock para desarrollo
      const mockSession = {
        ltiContext: {
          userId: 'mock_user_' + Date.now(),
          courseId: 'mock_course_123',
          roles: ['Learner'],
          resourceLinkId: 'mock_resource_456',
          contextTitle: 'Curso de Matemáticas - Mock'
        },
        isTeacher: false,
        isStudent: true,
        timestamp: new Date().toISOString()
      };

      const token = Buffer.from(JSON.stringify(mockSession)).toString('base64');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const redirectUrl = `${frontendUrl}/lti/launch?token=${token}`;

      res.json({
        message: 'LTI Launch procesado (versión mock)',
        session: mockSession,
        token,
        redirect_url: redirectUrl,
        note: 'Configurar ltijs para launch real desde Canvas'
      });
    });

    // Ruta GET para launch (algunos LMS usan GET)
    app.get('/lti/launch', (req: Request, res: Response) => {
      console.log('🚀 LTI Launch GET solicitado');
      res.json({
        message: 'LTI Launch endpoint (GET)',
        query: req.query,
        note: 'Canvas normalmente usa POST para launch'
      });
    });

    // Ruta para Deep Linking
    app.post('/lti/deep-linking', (req: Request, res: Response) => {
      console.log('🔗 Deep Linking solicitado');
      
      res.json({
        message: 'Deep Linking endpoint',
        available_tools: [
          {
            title: 'Generador de Ejercicios Matemáticos',
            description: 'Herramienta para crear ejercicios matemáticos automáticamente',
            url: `${ltiConfig.issuer}/lti/launch`
          }
        ],
        note: 'Configurar ltijs para Deep Linking real'
      });
    });

    console.log('✅ Rutas LTI básicas configuradas');
  }

  /**
   * Obtener JWKS público para Canvas (versión mock)
   */
  static async getJWKS(): Promise<any> {
    return {
      keys: [],
      message: 'Mock JWKS - Configurar ltijs para claves reales',
      issuer: ltiConfig.issuer,
      note: 'En producción, ltijs generará claves RSA reales'
    };
  }

  /**
   * Generar token de sesión LTI mock
   */
  static generateMockLTISession(userType: 'teacher' | 'student' = 'student'): string {
    const mockSession = {
      ltiContext: {
        userId: `mock_${userType}_${Date.now()}`,
        courseId: 'mock_course_123',
        roles: userType === 'teacher' ? ['Instructor'] : ['Learner'],
        resourceLinkId: 'mock_resource_456',
        contextTitle: 'Curso de Matemáticas - Mock'
      },
      isTeacher: userType === 'teacher',
      isStudent: userType === 'student',
      timestamp: new Date().toISOString()
    };

    return Buffer.from(JSON.stringify(mockSession)).toString('base64');
  }

  /**
   * Validar token de sesión LTI
   */
  static validateLTISession(token: string): { valid: boolean; data?: any; error?: string } {
    try {
      const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (!sessionData.ltiContext || !sessionData.timestamp) {
        return { valid: false, error: 'Token LTI malformado' };
      }

      // Verificar que no sea muy antiguo (24 horas)
      const tokenTime = new Date(sessionData.timestamp);
      const now = new Date();
      const maxAge = 24 * 60 * 60 * 1000;

      if (now.getTime() - tokenTime.getTime() > maxAge) {
        return { valid: false, error: 'Token LTI expirado' };
      }

      return { valid: true, data: sessionData };

    } catch (error) {
      return { valid: false, error: 'Error decodificando token LTI' };
    }
  }

  /**
   * Obtener información de configuración LTI
   */
  static getConfiguration(): any {
    return {
      issuer: ltiConfig.issuer,
      client_id: ltiConfig.clientId,
      deployment_id: ltiConfig.deploymentId,
      version: 'simplified',
      status: 'development',
      endpoints: {
        login: `${ltiConfig.issuer}/lti/login`,
        launch: `${ltiConfig.issuer}/lti/launch`,
        keys: `${ltiConfig.issuer}/lti/keys`,
        deep_linking: `${ltiConfig.issuer}/lti/deep-linking`
      },
      note: 'Versión simplificada para desarrollo. Configurar ltijs para producción.'
    };
  }
}

export default LTIService;