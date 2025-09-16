// src/database/config.ts
// Configuración principal de MongoDB (mejorada de tu sistema existente)

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { logger, dbLogger } from '../config/logging';

config();

export interface DatabaseConnectionOptions {
  url: string;
  options: mongoose.ConnectOptions;
}

export const databaseOptions: mongoose.ConnectOptions = {
  // Configuraciones modernas de Mongoose 7+
  maxPoolSize: 10, // Mantener hasta 10 conexiones socket
  serverSelectionTimeoutMS: 5000, // Tiempo para seleccionar servidor
  socketTimeoutMS: 45000, // Cerrar sockets después de 45 segundos de inactividad
  bufferCommands: false, // Deshabilitar buffering de comandos
  // bufferMaxEntries: 0, // Sin buffering de entradas

  // Configuraciones adicionales para LTI
  connectTimeoutMS: 10000, // Timeout de conexión inicial
  heartbeatFrequencyMS: 10000, // Verificar conexión cada 10 segundos
  retryWrites: true, // Reintentar escrituras automáticamente
  readPreference: 'primary', // Leer desde primario para consistencia
};

export const getDatabaseURL = (): string => {
  const url = process.env.DB_CNN;

  if (!url) {
    throw new Error('❌ Variable de entorno DB_CNN no configurada');
  }

  return url;
};

export const dbConnection = async (): Promise<typeof mongoose> => {
  try {
    const url = getDatabaseURL();

    dbLogger.info('Iniciando conexión a MongoDB...', { url: url.replace(/\/\/.*@/, '//***:***@') });

    const connection = await mongoose.connect(url, databaseOptions);

    console.log('✅ Base de datos conectada exitosamente');
    console.log(`📊 MongoDB: ${url.replace(/\/\/.*@/, '//***:***@')}`);
    console.log(`🏷️  Database: ${mongoose.connection.db?.databaseName}`);

    // Configurar event listeners para monitoreo
    setupConnectionEventListeners();

    // Configurar graceful shutdown
    setupGracefulShutdown();

    return connection;

  } catch (error) {
    dbLogger.error('Error conectando a la base de datos', error);
    console.error('❌ Error conectando a la base de datos:', error);
    throw error;
  }
};

const setupConnectionEventListeners = () => {
  const db = mongoose.connection;

  // Evento: Error después de establecer conexión inicial
  db.on('error', (error) => {
    dbLogger.error('Error de conexión MongoDB después del setup inicial', error);
    console.error('❌ Error de conexión MongoDB:', error);
  });

  // Evento: Desconexión
  db.on('disconnected', () => {
    dbLogger.warn('MongoDB desconectado');
    console.warn('⚠️ MongoDB desconectado');
  });

  // Evento: Reconexión
  db.on('reconnected', () => {
    dbLogger.info('MongoDB reconectado');
    console.log('🔄 MongoDB reconectado');
  });

  // Evento: Conexión cerrada
  db.on('close', () => {
    dbLogger.info('Conexión MongoDB cerrada');
    console.log('🔒 Conexión MongoDB cerrada');
  });

  // Evento: Conexión establecida por primera vez
  db.once('open', () => {
    dbLogger.info('Primera conexión a MongoDB establecida');
    console.log('🚀 Primera conexión a MongoDB establecida');
  });

  // Evento: Todos los servidores están abajo
  db.on('serverClosed', () => {
    dbLogger.error('Todos los servidores MongoDB están cerrados');
    console.error('❌ Todos los servidores MongoDB están cerrados');
  });

  // Evento: Servidor seleccionado
  db.on('serverOpening', () => {
    dbLogger.debug('Abriendo conexión al servidor MongoDB');
  });
};

const setupGracefulShutdown = () => {
  const gracefulShutdown = async (signal: string) => {
    dbLogger.info(`Recibida señal ${signal}. Cerrando conexión MongoDB...`);
    console.log(`💤 Recibida señal ${signal}. Cerrando conexión MongoDB...`);

    try {
      await mongoose.connection.close();
      dbLogger.info('Conexión MongoDB cerrada correctamente');
      console.log('✅ Conexión MongoDB cerrada correctamente');
      process.exit(0);
    } catch (error) {
      dbLogger.error('Error cerrando conexión MongoDB', error);
      console.error('❌ Error cerrando conexión MongoDB:', error);
      process.exit(1);
    }
  };

  // Manejar diferentes señales de terminación
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart

  // Manejar uncaught exceptions
  process.on('uncaughtException', (error) => {
    dbLogger.error('Uncaught Exception', error);
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  // Manejar unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    dbLogger.error('Unhandled Rejection', { reason, promise });
    console.error('❌ Unhandled Rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });
};

// ================================