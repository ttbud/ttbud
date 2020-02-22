# ttbud

Your virtual table friend

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

## Licenses

- icons in web/src/icon - Licensed from [game-icons.net](https://game-icons.net) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- web/public/favicon.ico - Made by [Kiranshastry](https://www.flaticon.com/authors/kiranshastry) from
[www.flaticon.com](https://www.flaticon.com). Licensed under the [FlatIcon license](https://file000.flaticon.com/downloads/license/license.pdf)
- Everything else - Licensed under MIT, see LICENSE file in repo
