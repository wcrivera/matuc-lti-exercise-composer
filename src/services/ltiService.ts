// src/services/ltiService.ts
// Servicio principal para LTI (mejorado del anterior)

import { Application } from 'express';
import { Provider } from 'ltijs';
import jwt from 'jsonwebtoken';
import { ltiConfig, canvasConfig } from '../config/lti';
import { LTISession } from '../models/lti/ltiSession';
import { LTIUtils } from '../utils/ltiUtils';
import { ltiLogger } from '../config/logging';

let ltiProvider: Provider;

export class LTIService {
  
  static async setupProvider(app: Application): Promise<void> {
    try {
      ltiLogger.info('Configurando proveedor LTI...');
      
      // Inicializar proveedor LTI
      ltiProvider = Provider.setup(
        ltiConfig.issuer,
        {
          url: ltiConfig.databaseUrl,
          connection: { user: '', pass: '' }
        },
        {
          privateKey: ltiConfig.privateKey,
          publicKey: ltiConfig.publicKey,
          kid: 'matuc-lti-key-1'
        }
      );

      // Registrar plataforma Canvas
      await ltiProvider.registerPlatform({
        url: 'https://canvas.instructure.com',
        name: 'Canvas LMS',
        clientId: ltiConfig.clientId,
        authenticationEndpoint: 'https://canvas.instructure.com/api/lti/authorize_redirect',
        accesstokenEndpoint: 'https://canvas.instructure.com/login/oauth2/token',
        authConfig: { method: 'JWK_SET', key: ltiConfig.keySetUrl }
      });

      // Registrar deployment
      await ltiProvider.registerDeployment({
        clientId: ltiConfig.clientId,
        deploymentId: ltiConfig.deploymentId
      });

      // Configurar handlers principales
      this.setupLTIHandlers();
      
      // Integrar con Express
      app.use(ltiProvider.app);
      
      ltiLogger.info('✅ Proveedor LTI configurado exitosamente');
      
    } catch (error) {
      ltiLogger.error('❌ Error configurando LTI Provider:', error);
      throw error;
    }
  }

  private static setupLTIHandlers(): void {
    // Handler principal de LTI Launch
    ltiProvider.onConnect(async (token, req, res) => {
      try {
        ltiLogger.info('🚀 LTI Launch recibido', {
          userId: token.user,
          courseId: token.platformContext?.contextId,
          assignmentId: token.custom?.canvas_assignment_id
        });

        const session = await this.createLTISession(token, req);
        const appToken = await this.generateAppToken(session);
        
        return this.handleLTIRedirect(res, appToken, session.sessionId);
        
      } catch (error) {
        ltiLogger.error('Error procesando LTI Launch:', error);
        return res.status(500).json({ error: 'Error procesando LTI Launch' });
      }
    });

    // Handler para Deep Linking
    ltiProvider.onDeepLinking(async (token, req, res) => {
      try {
        ltiLogger.info('🔗 Deep Linking recibido');
        
        const resources = this.createDeepLinkingResources();
        
        return ltiProvider.redirect(
          res, 
          await ltiProvider.DeepLinking.createDeepLinkingMessage(
            token,
            resources,
            { message: 'Herramientas matemáticas disponibles' }
          )
        );
        
      } catch (error) {
        ltiLogger.error('Error en Deep Linking:', error);
        return res.status(500).json({ error: 'Error en Deep Linking' });
      }
    });
  }

  private static async createLTISession(token: any, req: any): Promise<any> {
    const context = token['https://purl.imsglobal.org/spec/lti/claim/context'];
    const custom = token['https://purl.imsglobal.org/spec/lti/claim/custom'] || {};
    const roles = token['https://purl.imsglobal.org/spec/lti/claim/roles'] || [];
    
    const userRole = this.determineUserRole(roles);
    const sessionId = LTIUtils.generateSessionId();
    
    const session = new LTISession({
      sessionId,
      canvasUserId: token.sub,
      canvasAssignmentId: custom.canvas_assignment_id || '',
      canvasCourseId: context.id,
      userRole,
      userName: token.name || token.given_name || 'Usuario',
      userEmail: token.email || '',
      contextTitle: context.title || 'Curso',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    await session.save();
    ltiLogger.info('✅ Sesión LTI creada', { sessionId });
    
    return session;
  }

  private static async generateAppToken(session: any): Promise<string> {
    const payload = {
      sessionId: session.sessionId,
      userId: session.canvasUserId,
      courseId: session.canvasCourseId,
      assignmentId: session.canvasAssignmentId,
      userRole: session.userRole,
      userName: session.userName,
      userEmail: session.userEmail,
      contextTitle: session.contextTitle,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
    };

    return jwt.sign(payload, ltiConfig.privateKey, {
      algorithm: 'RS256'
    });
  }

  private static handleLTIRedirect(res: any, token: string, sessionId: string): any {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = `${frontendUrl}/lti/launch?token=${token}&sessionId=${sessionId}`;
    
    return res.redirect(redirectUrl);
  }

  private static createDeepLinkingResources(): any[] {
    return [
      {
        type: 'ltiResourceLink',
        title: 'Mathematical Exercise Set',
        description: 'Crear conjunto de ejercicios matemáticos interactivos',
        url: `${ltiConfig.issuer}/api/lti/launch`,
        custom: {
          exercise_type: 'math_set',
          tool_version: '1.0'
        },
        icon: {
          url: `${ltiConfig.issuer}/public/icons/math-icon.png`,
          width: 64,
          height: 64
        }
      }
    ];
  }

  private static determineUserRole(roles: string[]): 'student' | 'instructor' | 'admin' {
    if (roles.some(role => role.includes('Instructor') || role.includes('Teacher'))) {
      return 'instructor';
    } else if (roles.some(role => role.includes('Admin'))) {
      return 'admin';
    }
    return 'student';
  }

  static getProvider(): Provider {
    if (!ltiProvider) {
      throw new Error('LTI Provider no inicializado');
    }
    return ltiProvider;
  }

  static async validateSession(sessionId: string): Promise<any | null> {
    try {
      const session = await LTISession.findOne({
        sessionId,
        status: 'active'
      });
      
      if (session && !session.isExpired()) {
        session.updateActivity();
        await session.save();
        return session;
      }
      
      return null;
    } catch (error) {
      ltiLogger.error('Error validando sesión:', error);
      return null;
    }
  }
}

// Función de conveniencia para setup
export const setupLTIProvider = LTIService.setupProvider;
export const getLTIProvider = LTIService.getProvider;

// ================================