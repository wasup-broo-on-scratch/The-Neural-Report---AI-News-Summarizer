FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
ENV NODE_ENV=production
EXPOSE 8787
CMD ["npm", "start"]