
// src/database/health.ts
// Verificaciones de salud de la base de datos

export class DatabaseHealthCheck {
  static async checkConnection(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      const startTime = Date.now();
      
      // Verificar conexión básica
      const adminDb = mongoose.connection.db?.admin();
      const serverStatus = await adminDb?.serverStatus();
      
      // Verificar operación de lectura
      const readTest = await mongoose.connection.db?.collection('test').findOne({});
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        details: {
          connected: mongoose.connection.readyState === 1,
          databaseName: mongoose.connection.db?.databaseName,
          serverVersion: serverStatus?.version,
          responseTimeMs: responseTime,
          activeConnections: mongoose.connection.db?.serverConfig?.connections?.current || 0,
          maxConnections: mongoose.connection.db?.serverConfig?.connections?.available || 0,
          uptime: serverStatus?.uptime,
          collections: await mongoose.connection.db?.listCollections().toArray().then(cols => cols.length),
          lastCheck: new Date().toISOString()
        }
      };
      
    } catch (error) {
      dbLogger.error('Health check fallido', error);
      
      return {
        status: 'unhealthy',
        details: {
          connected: mongoose.connection.readyState === 1,
          error: error instanceof Error ? error.message : 'Error desconocido',
          lastCheck: new Date().toISOString()
        }
      };
    }
  }
  
  static async getCollectionStats(): Promise<any> {
    try {
      const collections = await mongoose.connection.db?.listCollections().toArray();
      const stats = {};
      
      if (collections) {
        for (const collection of collections) {
          const collectionStats = await mongoose.connection.db?.collection(collection.name).stats();
          stats[collection.name] = {
            documentCount: collectionStats?.count || 0,
            storageSize: collectionStats?.storageSize || 0,
            avgDocumentSize: collectionStats?.avgObjSize || 0,
            indexCount: collectionStats?.nindexes || 0,
            totalIndexSize: collectionStats?.totalIndexSize || 0
          };
        }
      }
      
      return stats;
      
    } catch (error) {
      dbLogger.error('Error obteniendo estadísticas de colecciones', error);
      return {};
    }
  }
}

// ================================