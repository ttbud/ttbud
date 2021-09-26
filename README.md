# ttbud

Your virtual table friend

We made TTBud so we can play DnD with our friends across the globe. It's a replacement for the classic physical dry-erase map for in-person DnD sessions. Everyone with the unique url can make changes, and other players will see the changes in real-time.

Try it out here:
[ttbud.app](https://ttbud.app)


## Development

### Requirements

- [mkcert](https://github.com/FiloSottile/mkcert)
- [docker](https://docs.docker.com/v17.09/engine/installation/)
- [docker-compose](https://docs.docker.com/compose/install/)

### Setup
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
# Build all the images (Needs to re-run each time api dependencies change)
docker-compose build
# Install web dependencies (Needs to re-run each time web dependencies change)
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

## Licenses

- icons in web/src/icon - Licensed from [game-icons.net](https://game-icons.net) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- web/public/favicon.ico - Font [Aref Ruqaa](https://fonts.google.com/attribution) licensed under SIL Open Font License, 1.1
- Everything else - Licensed under MIT, see LICENSE file in repo
