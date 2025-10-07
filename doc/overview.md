# Project Overview

| Key                      | Value                                                                                    |
| ------------------------ | -----------------------------------------------------------------------------------------|
| Awarded Company          |                                                                                          |
| Responsible Organisation | INTEF - CEDEC                                                                            |
| Contact           	   | eXeLearning Team ([info@exelearning.net](mailto:info@exelearning.net)) 				  |
| Company Contacts         |                                                                                          |
| Project Title            | eXeLearning (versión PHP)                                                                |
| Code                     | exeonline                                                                                |
| Start Date               | 2024-03-26                                                                               |
| Official Repository URL  | [https://github.com/exelearning/exelearning](https://github.com/exelearning/exelearning) |

This project was originally developed within the collaboration agreement between Spanish Ministry of Education, Vocational Training and Sports and the educational administrations of Junta de Andalucía and Junta de Extremadura, through a public bidding launched by Junta de Andalucía with the awarded company responsible for the development being:

* Sdweb Soluciones Digitales, S.L. C.I.F. B70151113, inscrita en el Registro Mercantil de Santiago de Compostela, Tomo 3285, Folio 112, Hoja 42964.

The Spanish Ministry of Education, Vocational Training and Sports, through CEDEC-INTEF.

# History

## 2024-04-15

Based on the technical documentation delivered by SdWeb, we set up a Docker-based installation.
To achieve this, we had to apply several fixes to the installation manual and the code itself.

Although the delivered codebase was in an advanced state, the software did not work as expected in all areas.
The repository ([https://git.intef.es/recursos/exelearning-web](https://git.intef.es/recursos/exelearning-web)) was created with the aim of continuing development, to eventually replace the current `exelearning-online` ([https://git.intef.es/recursos/exelearning-online](https://git.intef.es/recursos/exelearning-online)), which, while stable and complete, is built with outdated technology (Python 2.7) and has an old and inaccessible user interface.

## 2024-06-10

Migration from Symfony 5 to Symfony 6 is completed.

## 2024-07-05

The project reorganization process begins to adopt CI/CD practices:

* The Docker image of the application is improved.
* A Docker-based development environment is created with all installation steps automated, so developers do not need to handle setup manually.
* Symfony’s recommended strategy is adopted for database generation based on entity classes.
* Dependencies are installed during project setup, allowing the `vendor` folder to be excluded from the repository.
* Developer tools are added via a `Makefile`.
* The codebase is standardized following Symfony coding standards.
* The deployment pipeline for staging (PRE) and production (PRO) is improved.
* The `gitflow` branching model is adopted for development.
* A `docker-compose-moodle` file is added to spin up a Moodle instance with the `exescorm` and `exeweb` plugins.

## 2024-07-15

The repository `https://git.intef.es/recursos/exelearning` is migrated to GitHub:
`https://github.com/exelearning/exelearning`.
From this point on, the GitHub repository becomes the **official** repository for developing `exelearning`.
