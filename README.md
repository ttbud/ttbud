# ttbud

Your virtual table friend

We made TTBud so we can play DnD with our friends across the globe. It's a replacement for the classic physical dry-erase map for in-person DnD sessions. Everyone with the unique url can make changes, and other players will see the changes in real-time.

Try it out here:
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

### Redis

Go to localhost:8001 to use redisinsight to inspect the dev redis database.
The redis host address is `db` and the port is `6379`, there is no username or password

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

### S3 Setup

- Make ttbud-prod and ttbud-staging buckets
- Create one IAM user for each bucket with access key credentials
- Add an inline policy to allow each user ListBucket, GetObject, PutObject, and DeleteObject permissions for the appropriate bucket and all objects

### API

```bash
heroku update beta
heroku plugins:install @heroku-cli/plugin-manifest

# Create staging environment
heroku apps:create ttbud-staging --manifest --remote staging
heroku config:set ENVIRONMENT=staging --remote staging
heroku config:set JSON_LOGS=true --remote staging
heroku config:set BYPASS_RATE_LIMIT_KEY=$(uuidgen) --remote staging
heroku config:set REDIS_SSL_VALIDATION=self_signed --remote staging
heroku config:set AWS_KEY_ID=<staging_key_id> --remote staging
heroku config:set AWS_SECRET_KEY=<staging_secret_key> --remote staging
heroku config:set AWS_REGION=<aws_region> --remote staging
heroku config:set AWS_BUCKET=<staging_bucket_name> --remote staging

# Create prod environment
heroku apps:create ttbud --manifest --remote prod
heroku config:set ENVIRONMENT=prod --remote prod
heroku config:set JSON_LOGS=true --remote prod
heroku config:set BYPASS_RATE_LIMIT_KEY=$(uuidgen) --remote prod
heroku config:set REDIS_SSL_VALIDATION=self_signed --remote prod
heroku config:set AWS_KEY_ID=<prod_key_id> --remote prod
heroku config:set AWS_SECRET_KEY=<prod_secret_key> --remote prod
heroku config:set AWS_REGION=<aws_region> --remote prod
heroku config:set AWS_BUCKET=<prod_bucket_name> --remote prod
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

## Licenses

- icons in web/src/icon - Licensed from [game-icons.net](https://game-icons.net) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- web/public/favicon.ico - Font [Aref Ruqaa](https://fonts.google.com/attribution) licensed under SIL Open Font License, 1.1
- Everything else - Licensed under MIT, see LICENSE file in repo
