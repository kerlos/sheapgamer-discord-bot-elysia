# use the official Bun image
FROM oven/bun:1 as base
WORKDIR /app

# install dependencies
# Copy only package.json first to cache dependencies
COPY package.json .
RUN bun install --production

# copy source code
COPY src ./src

# run the app
EXPOSE 3000
CMD ["bun", "src/index.ts"]