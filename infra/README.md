# Infrastructure Setup

## Requirements

- [terraform cli](https://www.terraform.io/downloads.html)
- [heroku account](https://heroku.com)
- [netlify account](https://netlify.com)
- [aws account](https://aws.amazon.com)
- [terraform cloud account](https://www.terraform.io/cloud)

## AWS Setup
```bash
# Set up local aws credentials
aws configure

# Create terraform aws user with necessary permissions
./bootstrap_aws
```

## Terraform Setup

### Set up your local terraform environment
```bash
# Sign into your terraform cloud account
terraform login

# Create staging and prod workspaces
terraform workspace new staging
terraform workspace new prod
```

### Set up terraform cloud
In each workspace in the [terraform cloud UI](https://app.terraform.io), set up the following terraform variables and
environment variables:

#### Variables
- bypass_rate_limit_key: A random uuid
#### Environment Variables
- HEROKU_API_KEY: API key for a user with access to create/update apps and addons
- HEROKU_EMAIL: Email address for the API key
- NETLIFY_TOKEN: Netlify API token with access to create and update sites
- AWS_ACCESS_KEY_ID: Access key ID for ttbud-terraform user created in AWS setup section
- AWS_SECRET_ACCESS_KEY: Secret key for ttbud-terraform user created in AWS setup section

#### Spin up each workspace

```bash
terraform init

# Note, at this use paid heroku features and cost you money
terraform workspace select staging
terraform apply

terraform workspace select prod
terraform apply
```

## CI

Connect circleci to the github repository

Set up the following API keys:
- `TERRAFORM_TOKEN`: A terraform token with access to the terraform cloud account
