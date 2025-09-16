// src/services/canvasService.ts
// Servicio para integración con Canvas API

import axios, { AxiosInstance } from 'axios';
import { canvasConfig } from '../config/lti';
import { canvasLogger } from '../config/logging';

export interface CanvasUser {
  id: number;
  name: string;
  email: string;
  login_id: string;
  avatar_url?: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  points_possible: number;
  due_at?: string;
  course_id: number;
}

export interface CanvasGradeResult {
  success: boolean;
  submission?: any;
  gradeId?: string;
  error?: string;
}

export class CanvasService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: canvasConfig.apiUrl,
      headers: {
        'Authorization': `Bearer ${canvasConfig.apiToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MATUC-LTI-Tool/1.0'
      },
      timeout: canvasConfig.timeout
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        canvasLogger.debug('Canvas API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        canvasLogger.error('Canvas API Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        canvasLogger.debug('Canvas API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      async (error) => {
        canvasLogger.error('Canvas API Response Error', {
          status: error.response?.status,
        canvasLogger.error('Canvas API Response Error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          data: error.response?.data
        });

        // Implementar retry logic para errores temporales
        if (this.shouldRetry(error)) {
          return this.retryRequest(error.config);
        }

        return Promise.reject(error);
      }
    );
  }

  private shouldRetry(error: any): boolean {
    return error.response?.status >= 500 || error.code === 'ECONNRESET';
  }

  private async retryRequest(config: any, attempt: number = 1): Promise<any> {
    if (attempt > canvasConfig.retryAttempts) {
      throw new Error(`Max retry attempts (${canvasConfig.retryAttempts}) reached`);
    }

    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));

    canvasLogger.info(`Retrying Canvas API request (attempt ${attempt})`, {
      url: config.url,
      method: config.method
    });

    try {
      return await this.client.request(config);
    } catch (error) {
      return this.retryRequest(config, attempt + 1);
    }
  }

  // Obtener información del usuario
  async getUser(userId: string): Promise<CanvasUser> {
    try {
      const response = await this.client.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      canvasLogger.error(`Error obteniendo usuario ${userId}`, error);
      throw new Error(`No se pudo obtener información del usuario ${userId}`);
    }
  }

  // Obtener assignment por ID
  async getAssignment(courseId: string, assignmentId: string): Promise<CanvasAssignment> {
    try {
      const response = await this.client.get(`/courses/${courseId}/assignments/${assignmentId}`);
      return response.data;
    } catch (error) {
      canvasLogger.error(`Error obteniendo assignment ${assignmentId}`, error);
      throw new Error(`No se pudo obtener el assignment ${assignmentId}`);
    }
  }

  // Enviar calificación a Canvas
  async submitGrade(
    courseId: string,
    assignmentId: string,
    userId: string,
    score: number,
    comment?: string
  ): Promise<CanvasGradeResult> {
    try {
      const submissionData = {
        submission: {
          posted_grade: score.toString(),
          ...(comment && { 
            comment: { 
              text_comment: comment,
              group_comment: false
            } 
          })
        }
      };

      canvasLogger.info('Enviando calificación a Canvas', {
        courseId,
        assignmentId,
        userId,
        score
      });

      const response = await this.client.put(
        `/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
        submissionData
      );

      return {
        success: true,
        submission: response.data,
        gradeId: response.data.id?.toString()
      };

    } catch (error: any) {
      canvasLogger.error('Error enviando calificación a Canvas', error);
      
      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  // Obtener estudiantes del curso
  async getCourseStudents(courseId: string): Promise<CanvasUser[]> {
    try {
      const response = await this.client.get(`/courses/${courseId}/students`, {
        params: {
          per_page: 100,
          include: ['enrollments', 'avatar_url']
        }
      });
      
      return response.data;
    } catch (error) {
      canvasLogger.error(`Error obteniendo estudiantes del curso ${courseId}`, error);
      throw new Error(`No se pudieron obtener los estudiantes del curso ${courseId}`);
    }
  }

  // Crear assignment (para deep linking)
  async createAssignment(
    courseId: string,
    assignmentData: {
      name: string;
      description: string;
      points_possible: number;
      due_at?: string;
      external_tool_tag_attributes?: any;
    }
  ): Promise<CanvasAssignment> {
    try {
      const response = await this.client.post(
        `/courses/${courseId}/assignments`,
        { assignment: assignmentData }
      );
      
      canvasLogger.info('Assignment creado en Canvas', {
        courseId,
        assignmentId: response.data.id,
        name: assignmentData.name
      });
      
      return response.data;
    } catch (error) {
      canvasLogger.error('Error creando assignment en Canvas', error);
      throw new Error('No se pudo crear el assignment en Canvas');
    }
  }

  // Obtener submissions de un assignment
  async getAssignmentSubmissions(
    courseId: string,
    assignmentId: string
  ): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/courses/${courseId}/assignments/${assignmentId}/submissions`,
        {
          params: {
            include: ['user', 'submission_comments'],
            per_page: 100
          }
        }
      );
      
      return response.data;
    } catch (error) {
      canvasLogger.error(`Error obteniendo submissions del assignment ${assignmentId}`, error);
      throw new Error(`No se pudieron obtener las submissions del assignment ${assignmentId}`);
    }
  }

  // Obtener información del curso
  async getCourse(courseId: string): Promise<any> {
    try {
      const response = await this.client.get(`/courses/${courseId}`, {
        params: {
          include: ['term', 'account']
        }
      });
      
      return response.data;
    } catch (error) {
      canvasLogger.error(`Error obteniendo curso ${courseId}`, error);
      throw new Error(`No se pudo obtener información del curso ${courseId}`);
    }
  }

  // Verificar salud de la API de Canvas
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const startTime = Date.now();
      await this.client.get('/accounts/self');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        details: {
          responseTime,
          baseURL: canvasConfig.apiUrl,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: this.extractErrorMessage(error),
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private extractErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    } else if (error.response?.data?.errors) {
      return JSON.stringify(error.response.data.errors);
    } else if (error.message) {
      return error.message;
    } else {
      return 'Error desconocido en Canvas API';
    }
  }
}

// Instancia singleton
export const canvasService = new CanvasService();

// Funciones de conveniencia
export const sendGradeToCanvas = canvasService.submitGrade.bind(canvasService);

// ================================