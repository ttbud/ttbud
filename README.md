# ttbud
Your virtual table friend

## Requirements
* [docker](https://docs.docker.com/v17.09/engine/installation/)
* [docker-compose](https://docs.docker.com/compose/install/)

## Development
```bash
# Configure your environment
cp .env.example .env
# Use the development setup (for hot-reload, etc..)
export COMPOSE_FILE=docker-compose.dev.yml:docker-compose.yml
# Build all the images
docker-compose build
# Install web dependencies
docker-compose run --rm web yarn install
# Start the development server in the background
docker-compose up -d
```
