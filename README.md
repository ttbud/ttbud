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

## Infrastructure setup

### Requirements

- [heroku cli](https://devcenter.heroku.com/articles/heroku-cli#download-and-install)
- [netlify cli](https://docs.netlify.com/cli/get-started/#installation)

### API

```bash
heroku update beta
heroku plugins:install @heroku-cli/plugin-manifest

# Create staging environment
heroku apps:create ttbud-staging --manifest --remote staging
heroku config:set ENVIRONMENT=staging --remote prod
heroku config:set ROOM_STORE_DIR=/var/ttbud/rooms --remote staging
heroku config:set JSON_LOGS=true --remote staging

# Create prod environment
heroku apps:create ttbud --manifest --remote prod
heroku config:set ENVIRONMENT=prod --remote prod
heroku config:set ROOM_STORE_DIR=/var/ttbud/rooms --remote prod
heroku config:set JSON_LOGS=true --remote prod
```

### Web

```bash
netlify sites:create -n ttbud
netlify sites:create -n ttbud-staging
```

### CI

Connect circleci to the github repository

Set up the following API keys:

- `HEROKU_API_KEY`: An API key that has access to your heroku apps
- `NETLIFY_AUTH_TOKEN`: An API key that has access to your Netlify sites
- `NETLIFY_STAGING_SITE_ID`: The site id returned when creating the staging Netlify site above
- `NETLIFY_PROD_SITE_ID`: The site id returned when creating the prod Netlify site above

## Deploy

All code in master automatically deploys to staging. To deploy to prod, navigate to the circleci UI for the build you
want to deploy, and click approve on the await-approval step

## Licenses

- icons in web/src/icon - Licensed from [game-icons.net](https://game-icons.net) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- web/public/favicon.ico - Font [Aref Ruqaa](https://fonts.google.com/attribution) licensed under SIL Open Font License, 1.1
- Everything else - Licensed under MIT, see LICENSE file in repo
