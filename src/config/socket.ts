// src/config/socket.ts
// Configuración de Socket.IO

export interface SocketConfig {
  corsOrigin: string;
  transports: string[];
  pingTimeout: number;
  pingInterval: number;
  maxConnections: number;
  enableCompression: boolean;
}

export const socketConfig: SocketConfig = {
  corsOrigin: process.env.SOCKET_IO_CORS_ORIGIN || '*',
  transports: (process.env.SOCKET_IO_TRANSPORTS || 'websocket,polling').split(','),
  pingTimeout: parseInt(process.env.SOCKET_IO_PING_TIMEOUT || '60000'),
  pingInterval: parseInt(process.env.SOCKET_IO_PING_INTERVAL || '25000'),
  maxConnections: 1000,
  enableCompression: true
};

// Configuración de namespaces para Socket.IO
export const socketNamespaces = {
  lti: '/lti',
  exercises: '/exercises',
  admin: '/admin',
  stats: '/stats'
};

// Configuración de rooms dinámicos
export const getRoomName = (type: string, identifier: string): string => {
  return `${type}:${identifier}`;
};

export const socketRoomTypes = {
  course: 'course',
  assignment: 'assignment',
  session: 'session',
  user: 'user'
};

// ================================