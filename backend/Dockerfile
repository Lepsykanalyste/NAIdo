FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip && pip3 install qrcode pillow --break-system-packages
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "src/server.js"]
