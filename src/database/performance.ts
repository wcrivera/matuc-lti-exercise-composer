// src/database/performance.ts
// Utilidades para monitoreo de rendimiento

export class DatabasePerformance {
  static async getSlowQueries(thresholdMs: number = 100): Promise<any[]> {
    try {
      // En MongoDB, esto requiere habilitar profiling
      const profilingData = await mongoose.connection.db?.collection('system.profile')
        .find({
          ts: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Últimas 24 horas
          millis: { $gte: thresholdMs }
        })
        .sort({ millis: -1 })
        .limit(50)
        .toArray();
        
      return profilingData || [];
      
    } catch (error) {
      dbLogger.error('Error obteniendo queries lentas', error);
      return [];
    }
  }
  
  static async analyzePerfomance(): Promise<{
    connectionStats: any;
    operationCounters: any;
    indexUsage: any[];
    recommendations: string[];
  }> {
    try {
      const adminDb = mongoose.connection.db?.admin();
      const serverStatus = await adminDb?.serverStatus();
      
      // Estadísticas de conexión
      const connectionStats = {
        current: serverStatus?.connections?.current || 0,
        available: serverStatus?.connections?.available || 0,
        totalCreated: serverStatus?.connections?.totalCreated || 0
      };
      
      // Contadores de operaciones
      const operationCounters = {
        insert: serverStatus?.opcounters?.insert || 0,
        query: serverStatus?.opcounters?.query || 0,
        update: serverStatus?.opcounters?.update || 0,
        delete: serverStatus?.opcounters?.delete || 0,
        getmore: serverStatus?.opcounters?.getmore || 0,
        command: serverStatus?.opcounters?.command || 0
      };
      
      // Análisis de uso de índices (simplificado)
      const indexUsage = await this.getIndexUsageStats();
      
      // Generar recomendaciones básicas
      const recommendations = this.generatePerformanceRecommendations(
        connectionStats, 
        operationCounters, 
        indexUsage
      );
      
      return {
        connectionStats,
        operationCounters,
        indexUsage,
        recommendations
      };
      
    } catch (error) {
      dbLogger.error('Error analizando rendimiento', error);
      throw error;
    }
  }
  
  private static async getIndexUsageStats(): Promise<any[]> {
    // Esta es una implementación simplificada
    // En producción, usarías $indexStats aggregation pipeline
    return [];
  }
  
  private static generatePerformanceRecommendations(
    connectionStats: any, 
    operationCounters: any, 
    indexUsage: any[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Analizar conexiones
    const connectionUtilization = connectionStats.current / connectionStats.available;
    if (connectionUtilization > 0.8) {
      recommendations.push('Alto uso de conexiones. Considerar aumentar pool size.');
    }
    
    // Analizar operaciones
    const totalOps = Object.values(operationCounters).reduce((sum: number, count: any) => sum + count, 0);
    if (operationCounters.query / totalOps > 0.7) {
      recommendations.push('Alto ratio de queries. Revisar índices y optimizar consultas.');
    }
    
    return recommendations;
  }
}