# # Base image
# FROM node:20-alpine

# # Set working directory inside the container
# WORKDIR /app

# # Copy package files first (for faster caching)
# COPY package*.json ./

# # Install dependencies
# RUN npm install

# # Copy all source code
# COPY . .

# # Expose app port
# EXPOSE 8082

# # Start the app
# CMD ["npm", "start"]

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV NODE_OPTIONS="--experimental-specifier-resolution=node"
EXPOSE 8082
CMD ["npm", "start"]
