// src/database/migrations.ts
// Sistema de migraciones para actualizar la base de datos

import mongoose from 'mongoose';
import { dbLogger } from '../config/logging';

export interface Migration {
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Modelo para tracking de migraciones
const migrationSchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now },
  executionTimeMs: { type: Number }
});

const MigrationModel = mongoose.model('Migration', migrationSchema);

// Lista de migraciones disponibles
const migrations: Migration[] = [
  {
    version: '1.0.0',
    description: 'Crear índices iniciales para colecciones LTI',
    up: async () => {
      const collections = await mongoose.connection.db?.listCollections().toArray();
      
      // Crear índices para LTI Exercise Sets
      if (collections?.find(c => c.name === 'lti_exercise_sets')) {
        await mongoose.connection.db?.collection('lti_exercise_sets').createIndex({ 
          canvasAssignmentId: 1 
        }, { unique: true });
        
        await mongoose.connection.db?.collection('lti_exercise_sets').createIndex({ 
          canvasCourseId: 1, 
          isActive: 1 
        });
        
        await mongoose.connection.db?.collection('lti_exercise_sets').createIndex({ 
          createdBy: 1, 
          createdAt: -1 
        });
      }
      
      // Crear índices para LTI Responses
      if (collections?.find(c => c.name === 'lti_grouped_responses')) {
        await mongoose.connection.db?.collection('lti_grouped_responses').createIndex({ 
          canvasUserId: 1, 
          canvasAssignmentId: 1, 
          attemptNumber: -1 
        });
        
        await mongoose.connection.db?.collection('lti_grouped_responses').createIndex({ 
          canvasCourseId: 1, 
          status: 1, 
          timeCompleted: -1 
        });
        
        await mongoose.connection.db?.collection('lti_grouped_responses').createIndex({ 
          gradeSentToCanvas: 1, 
          timeCompleted: 1 
        });
      }
      
      // Crear índices para LTI Sessions
      if (collections?.find(c => c.name === 'lti_sessions')) {
        await mongoose.connection.db?.collection('lti_sessions').createIndex({ 
          sessionId: 1 
        }, { unique: true });
        
        await mongoose.connection.db?.collection('lti_sessions').createIndex({ 
          canvasUserId: 1, 
          status: 1 
        });
        
        // TTL index para auto-expiration de sesiones (24 horas)
        await mongoose.connection.db?.collection('lti_sessions').createIndex({ 
          lastActivity: 1 
        }, { expireAfterSeconds: 86400 });
      }
      
      dbLogger.info('Índices LTI creados exitosamente');
    },
    down: async () => {
      // Eliminar índices específicos si es necesario
      const collections = ['lti_exercise_sets', 'lti_grouped_responses', 'lti_sessions'];
      
      for (const collectionName of collections) {
        try {
          const collection = mongoose.connection.db?.collection(collectionName);
          if (collection) {
            await collection.dropIndexes();
            dbLogger.info(`Índices eliminados para ${collectionName}`);
          }
        } catch (error) {
          dbLogger.warn(`No se pudieron eliminar índices para ${collectionName}`, error);
        }
      }
    }
  },
  
  {
    version: '1.0.1',
    description: 'Agregar campos de análisis a respuestas existentes',
    up: async () => {
      // Actualizar documentos existentes que no tengan los nuevos campos
      await mongoose.connection.db?.collection('lti_grouped_responses').updateMany(
        { totalTimeSpent: { $exists: false } },
        { 
          $set: { 
            totalTimeSpent: null,
            attemptNumber: 1
          } 
        }
      );
      
      dbLogger.info('Campos de análisis agregados a respuestas existentes');
    },
    down: async () => {
      await mongoose.connection.db?.collection('lti_grouped_responses').updateMany(
        {},
        { 
          $unset: { 
            totalTimeSpent: "",
            attemptNumber: ""
          } 
        }
      );
    }
  }
];

export class MigrationRunner {
  static async getPendingMigrations(): Promise<Migration[]> {
    const appliedMigrations = await MigrationModel.find({}).select('version');
    const appliedVersions = appliedMigrations.map(m => m.version);
    
    return migrations.filter(m => !appliedVersions.includes(m.version));
  }
  
  static async runMigrations(): Promise<void> {
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      dbLogger.info('No hay migraciones pendientes');
      return;
    }
    
    dbLogger.info(`Ejecutando ${pendingMigrations.length} migración(es)...`);
    
    for (const migration of pendingMigrations) {
      const startTime = Date.now();
      
      try {
        dbLogger.info(`Aplicando migración ${migration.version}: ${migration.description}`);
        
        await migration.up();
        
        const executionTime = Date.now() - startTime;
        
        // Registrar migración como aplicada
        await new MigrationModel({
          version: migration.version,
          description: migration.description,
          executionTimeMs: executionTime
        }).save();
        
        dbLogger.info(`✅ Migración ${migration.version} aplicada exitosamente (${executionTime}ms)`);
        
      } catch (error) {
        dbLogger.error(`❌ Error aplicando migración ${migration.version}`, error);
        throw error;
      }
    }
  }
  
  static async rollbackMigration(version: string): Promise<void> {
    const migration = migrations.find(m => m.version === version);
    
    if (!migration) {
      throw new Error(`Migración ${version} no encontrada`);
    }
    
    const appliedMigration = await MigrationModel.findOne({ version });
    
    if (!appliedMigration) {
      throw new Error(`Migración ${version} no ha sido aplicada`);
    }
    
    try {
      dbLogger.info(`Revirtiendo migración ${version}: ${migration.description}`);
      
      await migration.down();
      
      await MigrationModel.deleteOne({ version });
      
      dbLogger.info(`✅ Migración ${version} revertida exitosamente`);
      
    } catch (error) {
      dbLogger.error(`❌ Error revirtiendo migración ${version}`, error);
      throw error;
    }
  }
}

// ================================