
// src/database/seeds.ts
// Datos de prueba para desarrollo

import { Usuario } from '../models/usuario';
import { Curso } from '../models/curso';
import { LTIExerciseSet } from '../models/lti/ltiExerciseSet';
import { dbLogger } from '../config/logging';

export class DatabaseSeeder {
  static async seedDevelopmentData(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      dbLogger.warn('Seeding no permitido en producción');
      return;
    }
    
    try {
      await this.seedUsers();
      await this.seedCourses();
      await this.seedLTIExerciseSets();
      
      dbLogger.info('✅ Datos de desarrollo creados exitosamente');
      
    } catch (error) {
      dbLogger.error('❌ Error creando datos de desarrollo', error);
      throw error;
    }
  }
  
  private static async seedUsers(): Promise<void> {
    // Verificar si ya existen usuarios
    const existingUsers = await Usuario.countDocuments();
    if (existingUsers > 0) {
      dbLogger.info('Usuarios ya existen, saltando seeding');
      return;
    }
    
    const users = [
      {
        nombre: 'Profesor',
        apellido: 'Demo',
        email: 'profesor@demo.com',
        rol: 'Profesor',
        curso: 'DEMO101',
        activo: true
      },
      {
        nombre: 'Estudiante',
        apellido: 'Demo',
        email: 'estudiante@demo.com',
        rol: 'Estudiante',
        curso: 'DEMO101',
        grupo: 1,
        activo: true
      }
    ];
    
    await Usuario.insertMany(users);
    dbLogger.info(`Creados ${users.length} usuarios de demo`);
  }
  
  private static async seedCourses(): Promise<void> {
    const existingCourses = await Curso.countDocuments();
    if (existingCourses > 0) {
      dbLogger.info('Cursos ya existen, saltando seeding');
      return;
    }
    
    const courses = [
      {
        nombre: 'Matemáticas Demo',
        codigo: 'DEMO101',
        descripcion: 'Curso de demostración para LTI',
        activo: true
      }
    ];
    
    await Curso.insertMany(courses);
    dbLogger.info(`Creados ${courses.length} cursos de demo`);
  }
  
  private static async seedLTIExerciseSets(): Promise<void> {
    const existingSets = await LTIExerciseSet.countDocuments();
    if (existingSets > 0) {
      dbLogger.info('Sets LTI ya existen, saltando seeding');
      return;
    }
    
    const exerciseSets = [
      {
        canvasAssignmentId: 'demo_assignment_001',
        canvasCourseId: 'demo_course_001',
        title: 'Ejercicios de Números Demo',
        mainStatement: 'Resuelve los siguientes ejercicios numéricos:',
        exercises: [
          {
            exerciseId: 'demo_ex_001',
            order: 1,
            prompt: 'Calcula: 2 + 3 = ',
            correctAnswer: '5',
            validationType: 'numero',
            points: 10,
            selectorConfig: { tolerance: 0.01 }
          },
          {
            exerciseId: 'demo_ex_002', 
            order: 2,
            prompt: 'Encuentra el conjunto solución: x ∈ ',
            correctAnswer: '{1,2,3}',
            validationType: 'conjunto',
            points: 15,
            selectorConfig: {}
          }
        ],
        maxScore: 25,
        timeLimit: 30,
        allowMultipleAttempts: true,
        showFeedback: true,
        createdBy: 'demo_instructor_001',
        isActive: true
      }
    ];
    
    await LTIExerciseSet.insertMany(exerciseSets);
    dbLogger.info(`Creados ${exerciseSets.length} sets LTI de demo`);
  }
  
  static async clearDevelopmentData(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      dbLogger.warn('Clear data no permitido en producción');
      return;
    }
    
    try {
      await Usuario.deleteMany({ email: { $regex: '@demo.com$' } });
      await Curso.deleteMany({ codigo: 'DEMO101' });
      await LTIExerciseSet.deleteMany({ canvasAssignmentId: { $regex: '^demo_' } });
      
      dbLogger.info('✅ Datos de desarrollo eliminados');
      
    } catch (error) {
      dbLogger.error('❌ Error eliminando datos de desarrollo', error);
      throw error;
    }
  }
}

// ================================