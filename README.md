# ttbud

Your virtual table friend

[ttbud.app](https://ttbud.app)

## Requirements

- [mkcert](https://github.com/FiloSottile/mkcert)
- [docker](https://docs.docker.com/v17.09/engine/installation/)
- [docker-compose](https://docs.docker.com/compose/install/)

## Development

```bash
# Create a dev ssl cert
mkcert -install
mkcert -cert-file certs/ttbud.local.pem -key-file certs/ttbud.local-key.pem ttbud.local

# Add a hosts file entry for local ttbud
echo "127.0.0.1 ttbud.local" | sudo tee -a /etc/hosts

# Increase the number of file watchers allowed so automatic reloading works
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p

# Configure your environment
cp .env.example .env
# Build all the images
docker-compose build
# Install web dependencies
docker-compose run --rm web yarn install
# Start the development server in the background
docker-compose up -d

# Configure git hooks to enforce lint rules pre commit (optional)
git config core.hooksPath hooks/
```

To test it out, go to https://ttbud.local:3000 in your browser

### Logs

For more detailed api logs in local dev, add `JSON_LOGS=true` to your `.env` file.
You can render them nicely with this command ([jq](https://stedolan.github.io/jq/) must be installed):

```bash
docker-compose logs -f --no-color api | jq --raw-input 'split("|")| .[length  - 1]|fromjson'
```

### Tests

#### Lint and typecheck:

```bash
./hooks/pre-commit
```

#### api tests

```bash
docker-compose run --rm api pytest tests
```

#### api tests with coverage

```bash
docker-compose run --rm api pytest --cov=src --cov-report=html tests
```

#### web tests

```
docker-compose run --rm web yarn test
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
heroku config:set ENVIRONMENT=staging --remote staging
heroku config:set JSON_LOGS=true --remote staging

# Create prod environment
heroku apps:create ttbud --manifest --remote prod
heroku config:set ENVIRONMENT=prod --remote prod
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
