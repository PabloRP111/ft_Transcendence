FROM node:20-alpine

WORKDIR /app

# First, we copy `package.json` and `package-lock.json` to the cache
COPY package*.json ./

# Install all dependencies (including devDependencies)

RUN npm install

# Copy the rest of the code
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]