# Use Node base image
FROM node:20-alpine

# Set work directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Run the bot
CMD ["node", "bot.js"]
