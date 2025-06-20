<div align="center">
  <a href="https://github.com/exelearning/exelearning">
    <img src="public/exelearning.png" alt="eXeLearning Logo" height="120">
  </a>

  <h1 align="center">eXeLearning</h1>

  <p align="center">
    <strong>eXeLearning</strong> is an AGPL-licensed free/libre tool to create and publish open educational resources.
    <br />
    <a href="https://github.com/exelearning/exelearning"><strong>Explore the project »</strong></a>
    <br />
    <br />
    <a href="https://github.com/exelearning/exelearning/issues/new?labels=bug">Report a Bug</a>
    ·
    <a href="https://github.com/exelearning/exelearning/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

## About the Project

eXeLearning 3.0 is a modern re-implementation of the original eXeLearning authoring tool, initially created in the eXeLearning.org project in New Zealand and subsequently continued by eXeLearning.net project by the Spanish Ministry of Education, Vocational Training and Sports (MEFPD) through Cedec-INTEF.

The new code has been created within the collaboration between the MEFPD and the regional educational administrations of Andalucía and Extremadura. The revision and further developments of eXe 3.0 are carried out also with the participation of other regional administrations (Canarias, Madrid, Comunidad Valenciana and Galicia).

This version is built with modern technologies (PHP 8, Symfony 7) and provides an accessible and up-to-date user interface for creating interactive educational content.

### Key Features

* Creation and edition of interactive educational content
* Multiple iDevices (interactive elements)
* Multilingual support
* Exportation to various formats
* Moodle integration
* Real-time collaborative features powered by [Mercure](https://mercure.rocks/)
* Modern and accessible interface built with [Bootstrap](https://getbootstrap.com/)
* Multiple authentication methods (Password, CAS, OpenID Connect)
* Compatible with MySQL, PostgreSQL, and SQLite databases
* Offline installers supported via [Electron](https://www.electronjs.org/) and [nativePHP](https://nativephp.com/)

### Built With

* [![PHP][PHP.badge]][PHP-url]
* [![Symfony][Symfony.badge]][Symfony-url]
* [![Docker][Docker.badge]][Docker-url]

## Quick Start

First install Docker if you don't have it yet. Then...

To try out eXeLearning instantly, run:

```bash
docker run -d -p 8080:8080 --name exelearning exelearning/exelearning
```

Then create a user:

```bash
docker exec -it exelearning php bin/console app:create-user user@exelearning.net 1234 demouser --no-fail
```

This will start eXeLearning at `http://localhost:8080` with your custom user.

Offline installers for Linux, Windows and macOS are also available on the [Releases page](https://github.com/exelearning/exelearning/releases). The online version is recommended for most use cases.

## Deployment

To deploy eXeLearning in a production environment, see:

📦 [doc/05-deployment.md](./doc/05-deployment.md)

## Development Environment

See [doc/03-development-environment.md](./doc/03-development-environment.md) for full setup instructions.

To start developing:

```bash
git clone https://github.com/exelearning/exelearning.git
cd exelearning
make up
```

This will start all services and make the app available at `http://localhost:8080`.

More development tools, options, and real-time collaboration info are documented in the `doc/` folder.

## Project Structure

The application follows the standard Symfony project structure, with some specific folders for managing iDevices and educational resources.

```
exelearning/
├── bin/                   # Symfony CLI commands
├── config/                # Configuration files
├── doc/                   # Full project documentation
├── docker/                # Docker configuration
├── public/                # Public files
├── src/                   # Application source code
│   ├── Controller/        # Controllers
│   ├── Entity/            # Entities and models
│   ├── Repository/        # Data repositories
│   └── ...
├── templates/             # Twig templates
├── tests/                 # Automated tests
├── translations/          # Translation files
├── docker-compose.yml     # Docker Compose configuration
├── Makefile               # Useful development commands
└── README.md              # This file
```

## Usage

eXeLearning enables educators to:

1. Create interactive educational projects
2. Add different types of content using iDevices
3. Structure content with a hierarchical index
4. Export content for use in Moodle or other platforms
5. Share and collaborate on educational resources

## Internationalization

The project supports multiple languages and uses Symfony's Translation component. Currently available:

* English (default)
* Español
* Català
* Euskara
* Galego
* Valencià
* Esperanto

For more information on translation management, see the [internationalization documentation](./doc/08-internationalization.md).

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See our [versioning guide](./doc/04-version-control.md) for details about our Git workflow.

### Useful Makefile Commands

The project includes a Makefile to simplify development tasks:

```
make up               # Start Docker containers in interactive mode
make upd              # Start Docker containers in background mode
make down             # Stop and remove Docker containers
make lint             # Run the linter to check PHP code style
make fix              # Automatically fix PHP style issues
make test             # Run unit tests with PHPUnit
make test-e2e         # Run e2e tests with PHPUnit
make shell            # Open a shell inside the exelearning container
make translations     # Update translation strings
make create-user      # Create a user using the Symfony console
```

To see all available commands, run:

```
make help
```

## Documentation

The full project documentation is available in the [`doc`](./doc/00-index.md) directory.

## Contributors

<a href="https://github.com/exelearning/exelearning/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=exelearning/exelearning" alt="Contributors" />
</a>

## License

Distributed under the GNU AFFERO GENERAL PUBLIC LICENSE v3.0. See `LICENSE` for more information.

---

**eXeLearning** is a free/libre tool to create and publish open educational resources.

<!-- MARKDOWN LINKS & IMAGES -->

[PHP.badge]: https://img.shields.io/badge/PHP-777BB4?style=for-the-badge&logo=php&logoColor=white
[PHP-url]: https://www.php.net/
[Symfony.badge]: https://img.shields.io/badge/Symfony-000000?style=for-the-badge&logo=symfony&logoColor=white
[Symfony-url]: https://symfony.com/
[Docker.badge]: https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[Docker-url]: https://www.docker.com/

