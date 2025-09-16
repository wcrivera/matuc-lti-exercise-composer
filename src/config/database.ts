// src/config/database.ts
// Configuración de base de datos (migrada y mejorada de tu sistema)

import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

export interface DatabaseConfig {
  url: string;
  options: mongoose.ConnectOptions;
}

export const databaseConfig: DatabaseConfig = {
  url: process.env.DB_CNN || 'mongodb://localhost:27017/matuc-lti-dev',
  options: {
    // Configuraciones modernas de Mongoose
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    // bufferMaxEntries: 0,
  }
};

export const dbConnection = async (): Promise<void> => {
  try {
    await mongoose.connect(databaseConfig.url, databaseConfig.options);
    
    console.log('✅ Base de datos conectada exitosamente');
    console.log(`📊 MongoDB URL: ${databaseConfig.url.replace(/\/\/.*@/, '//***:***@')}`);
    
    // Event listeners para monitoreo
    mongoose.connection.on('error', (error) => {
      console.error('❌ Error de conexión MongoDB:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB desconectado');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconectado');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('💤 Conexión MongoDB cerrada correctamente');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error cerrando conexión MongoDB:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error);
    throw error;
  }
};

// ================================