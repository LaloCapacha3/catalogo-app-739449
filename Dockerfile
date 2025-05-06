# Dockerfile para catalogo-app
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Crear directorio para configuración
RUN mkdir -p /app/config

# Compilar TypeScript
RUN npm run build

# Exponer puertos
EXPOSE 3000

# Variables de entorno predeterminadas
ENV NODE_ENV=production
ENV PORT=3000
ENV AWS_REGION=us-east-1

# Comando para iniciar la aplicación
CMD ["node", "dist/index.js"] 