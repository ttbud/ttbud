# E2E Tests for TTBud

## Requirements
* [nodejs 14.x](https://nodejs.org/en/download/releases/)
* [yarn 1.x](https://classic.yarnpkg.com/en/docs/install)

## Running tests
### Production
```bash
DOMAIN=https://ttbud.app API_DOMAIN=wss://ttbud.herokuapp.com yarn test
```

### Staging
```bash
DOMAIN=https://ttbud-staging.netlify.app API_DOMAIN=wss://ttbud-staging.herokuapp.com yarn test
```

### Local dev
Running tests against your local instance requires some extra setup to get node to recognize your local SSL certificate:

```bash
IGNORE_CERT_ERRORS=true NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem DOMAIN=https://ttbud.local:3000 API_DOMAIN=wss://ttbud.local:8443 yarn test
```
