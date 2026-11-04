# eXeLearning Deployment Configurations

This directory contains sample Docker Compose configurations for deploying eXeLearning with different database backends.

## Available Configurations

- **PostgreSQL**: [docker-compose.postgres.yml](docker-compose.postgres.yml)
- **MariaDB**: [docker-compose.mariadb.yml](docker-compose.mariadb.yml)
- **SQLite**: [docker-compose.sqlite.yml](docker-compose.sqlite.yml) (simplest option)

## How to Use

1. Create a deployment directory and copy the desired configuration file:
   ```bash
   # Create a deployment directory
   mkdir -p deploy
   cd deploy
   
   # Copy the desired configuration file
   # For PostgreSQL
   curl -L https://raw.githubusercontent.com/exelearning/exelearning/main/doc/deploy/docker-compose.postgres.yml -o docker-compose.yml
   
   # For MariaDB
   curl -L https://raw.githubusercontent.com/exelearning/exelearning/main/doc/deploy/docker-compose.mariadb.yml -o docker-compose.yml
   
   # For SQLite
   curl -L https://raw.githubusercontent.com/exelearning/exelearning/main/doc/deploy/docker-compose.sqlite.yml -o docker-compose.yml
   ```

2. Create a `.env` file for the installation:
   ```bash
   APP_PORT=8080
   APP_SECRET=
   API_JWT_SECRET=
   DB_NAME=exelearning
   DB_USER=exelearning
   DB_PASSWORD=secure_password
   ```

   The empty secret values intentionally make Docker Compose fail. Generate two different secrets once (for example,
   run `openssl rand -base64 48` twice), paste one after each `=`, and store the resulting `.env` file securely. Keep
   these values unchanged across normal restarts and upgrades.

3. Start the application:
   ```bash
   docker compose up
   ```

4. Access the application at http://localhost:8080 (or the port specified in your APP_PORT variable)

## Environment Variables

You can customize the deployment by setting these environment variables:

### Common Variables
- `APP_PORT`: Port to access the application (default: 8080)
- `APP_SECRET`: Secret for platform integrations (required; no default)
- `API_JWT_SECRET`: Secret for sessions and API authentication (required; no default)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: Admin user credentials (created/updated when ADMIN_PASSWORD is set)
- `ONLINE_THEMES_INSTALL`: Allow users to import/install styles
- `ONLINE_IDEVICES_INSTALL`: Allow users to import/install iDevices
- `PUBLIC_VIEW_ENABLED`: Allow project owners to publish a public read-only link to their projects (default: `false`). Administrators can also change it from `/admin` > Sharing; the value saved there takes precedence.

### Database-Specific Variables
- PostgreSQL:
  - `DB_NAME`: Database name (default: exelearning)
  - `DB_USER`: Database user (default: postgres)
  - `DB_PASSWORD`: Database password (default: postgres)
  - `DB_PORT`: Database port (default: 5432)

- MariaDB:
  - `DB_NAME`: Database name (default: exelearning)
  - `DB_USER`: Database user (default: exelearning)
  - `DB_PASSWORD`: Database password (default: exelearning)
  - `DB_PORT`: Database port (default: 3306)
  - `MARIADB_ROOT_PASSWORD`: Root password (default: root)

- SQLite:
  - No specific variables required

## Data Persistence

All configurations use Docker volumes for data persistence:

- PostgreSQL: `postgres-data` volume for database files
- MariaDB: `mariadb-data` volume for database files
- SQLite: `exelearning-data` volume for the SQLite database file and application files

## Production Deployment Notes

For production deployments:

1. Generate unique `APP_SECRET` and `API_JWT_SECRET` values once for each installation
2. Store both secrets outside the Compose file, preserve them across restarts, and rotate any value copied from an
   older deployment example
3. Change all default passwords
4. Consider setting up a backup strategy for your volumes
5. For high-traffic sites, consider using PostgreSQL or MariaDB instead of SQLite
