FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build 2>/dev/null || true
EXPOSE 3000
ENTRYPOINT ["node", "./dist/cli.js"]
CMD ["--help"]
LABEL org.opencontainers.image.title="@tabibhasan/pmtiles-kit" \
      org.opencontainers.image.source="https://github.com/tabibhasan/pmtiles-kit" \
      org.opencontainers.image.licenses="MIT"
