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
   cp ../doc/deploy/docker-compose.postgres.yml docker-compose.yml
   
   # For MariaDB
   cp ../doc/deploy/docker-compose.mariadb.yml docker-compose.yml
   
   # For SQLite
   cp ../doc/deploy/docker-compose.sqlite.yml docker-compose.yml
   ```

2. Start the application:
   ```bash
   # Set required environment variables (or use defaults)
   export APP_PORT=8080
   export APP_SECRET=YourSecretKey
   export DB_NAME=exelearning
   export DB_USER=exelearning
   export DB_PASSWORD=secure_password
   
   # Start the containers
   docker compose up -d
   ```

3. Access the application at http://localhost:8080 (or the port specified in your APP_PORT variable)

## Environment Variables

You can customize the deployment by setting these environment variables:

### Common Variables
- `APP_PORT`: Port to access the application (default: 8080)
- `APP_SECRET`: Secret key for Symfony (required for production)
- `TEST_USER_EMAIL`, `TEST_USER_USERNAME`, `TEST_USER_PASSWORD`: Credentials for the first test user
- `MERCURE_JWT_SECRET_KEY`: Secret key for Mercure real-time updates
- `ONLINE_THEMES_INSTALL`: Allow users to import/install styles
- `ONLINE_IDEVICES_INSTALL`: Allow users to import/install iDevices

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

1. Set a strong `APP_SECRET` value
2. Change all default passwords
3. Consider setting up a backup strategy for your volumes
4. For high-traffic sites, consider using PostgreSQL or MariaDB instead of SQLite
