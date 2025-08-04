# Use official Node.js LTS image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose no ports (bot connects outbound)
# If you need a healthcheck endpoint, you can add one here

# Default command to run your bot
CMD ["node", "bot.js"]
