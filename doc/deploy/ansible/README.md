# eXeLearning Ansible Deployment

Automated deployment of eXeLearning using Ansible and Docker Compose.

## Prerequisites

- **Ansible** (version 2.9+): `ansible-galaxy collection install community.docker`
- **Multipass** (optional, for local testing)
- **Ubuntu 24.04** on target server
- **SSH access** with sudo privileges

## Quick Start

### Using the Makefile

```bash
# Show all available commands
make help

# Deploy to a remote server (prompts for IP and user)
make deploy-remote

# Deploy locally (current machine must be Ubuntu)
make deploy-local

# Test with a local VM (launches + deploys)
make up

# Access the VM
make shell

# Clean up the VM
make clean
```

## Configuration

Edit variables in `playbook-exelearning-ubuntu.yaml` under the `vars` section:

```yaml
vars:
  app_secret: "your-secret-here"
  app_base_path: ""
  test_user_email: user@example.com
  test_user_username: user
  test_user_password: 1234
```

## Deployment Components

The playbook deploys:
- **eXeLearning** (latest Docker image)
- **MariaDB 10.5.8** database
- **Watchtower** (automatic updates at 3:00 AM)

## Accessing eXeLearning

After deployment:
```
http://<server-ip>
```

Default credentials: `user` / `1234`

## Manual Ansible Execution

```bash
# Deploy to remote server
ansible-playbook -i "192.168.1.100," -u ubuntu playbook-exelearning-ubuntu.yaml

# Deploy with custom variables
ansible-playbook -i "192.168.1.100," -u ubuntu playbook-exelearning-ubuntu.yaml \
  --extra-vars "app_secret=mysecret"
```

## Files

- **`Makefile`**: Convenience commands
- **`playbook-exelearning-ubuntu.yaml`**: Ansible playbook
- **`.env.j2`**: Environment template
- **`docker-compose.yml`**: Docker Compose configuration
