FROM node:22

# Copy app code from our local folder into the docker /app working directory
COPY . /app

# Set the /app directory as working directory
WORKDIR /app

# Install app dependicies
RUN npm install

# Expose app on given port
EXPOSE 3000

# Start app
ENTRYPOINT ["npm", "start"]