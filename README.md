# ttbud

Your virtual table friend

[ttbud.app](https://ttbud.app)

## Requirements

- [docker](https://docs.docker.com/v17.09/engine/installation/)
- [docker-compose](https://docs.docker.com/compose/install/)

## Development

```bash
# Configure your environment
cp .env.example .env
# Use the development setup (for hot-reload, etc..)
export COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml
# Build all the images
docker-compose build
# Install web dependencies
docker-compose run --rm web yarn install
# Start the development server in the background
docker-compose up -d
```

## Initial Deploy Setup

```bash
heroku update beta
heroku plugins:istall @heroku-cli/plugin-manifest

heroku apps:create ttbud-prod --manifest
heroku apps:create ttbud-staging --manifest --remote staging
```

## Deploy

```bash
git push heroku master
```

## Licenses

- icons in web/src/icon - Licensed from [game-icons.net](https://game-icons.net) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- web/public/favicon.ico - Font [Aref Ruqaa](https://fonts.google.com/attribution) licensed under SIL Open Font License, 1.1
- Everything else - Licensed under MIT, see LICENSE file in repo
