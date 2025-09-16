// src/database/indexes.ts
// Gestión centralizada de índices

export interface IndexDefinition {
  collection: string;
  key: any;
  options?: any;
  description: string;
}

export const requiredIndexes: IndexDefinition[] = [
  // Índices para modelos existentes (migrados de tu sistema)
  {
    collection: 'usuarios',
    key: { email: 1 },
    options: { unique: true },
    description: 'Índice único para email de usuarios'
  },
  {
    collection: 'ejercicios',
    key: { cid: 1, mid: 1, numero: 1 },
    options: {},
    description: 'Índice compuesto para ejercicios por curso y módulo'
  },
  {
    collection: 'preguntas',
    key: { eid: 1, numero: 1 },
    options: {},
    description: 'Índice para preguntas por ejercicio'
  },
  {
    collection: 'dbps',
    key: { uid: 1, pid: 1, fecha: -1 },
    options: {},
    description: 'Índice para respuestas por usuario y pregunta'
  },
  
  // Nuevos índices para LTI
  {
    collection: 'lti_exercise_sets',
    key: { canvasAssignmentId: 1 },
    options: { unique: true },
    description: 'Índice único para assignment ID de Canvas'
  },
  {
    collection: 'lti_exercise_sets',
    key: { canvasCourseId: 1, isActive: 1 },
    options: {},
    description: 'Índice para sets activos por curso'
  },
  {
    collection: 'lti_grouped_responses',
    key: { canvasUserId: 1, canvasAssignmentId: 1, attemptNumber: -1 },
    options: {},
    description: 'Índice para respuestas por usuario y assignment'
  },
  {
    collection: 'lti_sessions',
    key: { sessionId: 1 },
    options: { unique: true },
    description: 'Índice único para session ID'
  },
  {
    collection: 'lti_sessions',
    key: { lastActivity: 1 },
    options: { expireAfterSeconds: 86400 },
    description: 'TTL index para auto-expiración de sesiones'
  }
];

export class IndexManager {
  static async ensureIndexes(): Promise<void> {
    dbLogger.info('Verificando índices requeridos...');
    
    let createdCount = 0;
    let existingCount = 0;
    
    for (const indexDef of requiredIndexes) {
      try {
        const collection = mongoose.connection.db?.collection(indexDef.collection);
        
        if (!collection) {
          dbLogger.warn(`Colección ${indexDef.collection} no encontrada, saltando índice`);
          continue;
        }
        
        // Verificar si el índice ya existe
        const existingIndexes = await collection.indexes();
        const indexExists = existingIndexes.some(index => 
          JSON.stringify(index.key) === JSON.stringify(indexDef.key)
        );
        
        if (indexExists) {
          existingCount++;
          dbLogger.debug(`Índice ya existe: ${indexDef.description}`);
        } else {
          await collection.createIndex(indexDef.key, indexDef.options);
          createdCount++;
          dbLogger.info(`✅ Índice creado: ${indexDef.description}`);
        }
        
      } catch (error) {
        dbLogger.error(`❌ Error creando índice: ${indexDef.description}`, error);
      }
    }
    
    dbLogger.info(`Índices procesados: ${createdCount} creados, ${existingCount} existentes`);
  }
  
  static async dropUnusedIndexes(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Drop de índices no permitido en producción');
    }
    
    dbLogger.info('Eliminando índices no utilizados...');
    
    const collections = await mongoose.connection.db?.listCollections().toArray();
    
    if (!collections) return;
    
    for (const collectionInfo of collections) {
      try {
        const collection = mongoose.connection.db?.collection(collectionInfo.name);
        if (!collection) continue;
        
        const indexes = await collection.indexes();
        const requiredForCollection = requiredIndexes
          .filter(idx => idx.collection === collectionInfo.name)
          .map(idx => JSON.stringify(idx.key));
        
        for (const index of indexes) {
          // No eliminar el índice _id por defecto
          if (index.name === '_id_') continue;
          
          const keyString = JSON.stringify(index.key);
          
          if (!requiredForCollection.includes(keyString)) {
            await collection.dropIndex(index.name!);
            dbLogger.info(`🗑️ Índice eliminado: ${index.name} en ${collectionInfo.name}`);
          }
        }
        
      } catch (error) {
        dbLogger.error(`Error procesando índices para ${collectionInfo.name}`, error);
      }
    }
  }
}

// ================================