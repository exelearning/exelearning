# Makefile for eXeLearning deployment with Ansible and Multipass

# Variables
PLAYBOOK_FILE=playbook-exelearning-ubuntu.yaml
MULTIPASS_NAME=ubuntu24exelearning
MULTIPASS_USER=ubuntu

# Check if Ansible is installed
check-ansible:
	@ansible --version >/dev/null 2>&1 || (echo "❌ Ansible is not installed. Please install it." && exit 1)

# Check if Multipass is installed
check-multipass:
	@multipass version >/dev/null 2>&1 || (echo "❌ Multipass is not installed. Please install it." && exit 1)

# Check if VM exists
vm-exists:
	@multipass info $(MULTIPASS_NAME) >/dev/null 2>&1

# Run playbook on the current machine
deploy-local: check-ansible
	@read -p "🖥️  Enter the hostname for this machine (e.g. $(shell hostname -f)): " host; \
	ansible-playbook -i "$${host}," -c local -u $$USER $(PLAYBOOK_FILE)

# Remote deployment (prompts for IP and user)
deploy-remote: check-ansible
	@read -p "🔗 Enter remote host (IP or hostname): " host; \
	read -p "👤 Enter SSH user: " user; \
	ansible-playbook -i "$${host}," -u "$${user}" $(PLAYBOOK_FILE)

# Launch local VM (only if it doesn't exist)
launch-vm: check-multipass
	@if multipass info $(MULTIPASS_NAME) >/dev/null 2>&1; then \
		echo "⚠️  VM '$(MULTIPASS_NAME)' already exists. Skipping launch."; \
	else \
		echo "🔑 Preparing cloud-init configuration..."; \
		if [ -f ~/.ssh/id_rsa.pub ]; then \
			SSH_KEY=$$(cat ~/.ssh/id_rsa.pub); \
		else \
			echo "❌ No SSH public key found (id_rsa.pub)"; \
			echo "Generate it with ssh-keygen"; \
			exit 1; \
		fi; \
		sed "s|SSH_PUBLIC_KEY_PLACEHOLDER|$$SSH_KEY|" cloud-init.yaml > cloud-init-generated.yaml; \
		echo "🚀 Launching VM '$(MULTIPASS_NAME)' with cloud-init..."; \
		multipass launch 24.04 --name $(MULTIPASS_NAME) --memory 2G --cpus 2 --disk 10G --cloud-init cloud-init-generated.yaml; \
		echo "⏳ Waiting for cloud-init to complete..."; \
		sleep 15; \
		rm -f cloud-init-generated.yaml; \
	fi

# Get VM IP address
vm-ip:
	@multipass info $(MULTIPASS_NAME) | awk '/IPv4/ {print $$2}'

# Complete virtual deployment
up: check-ansible launch-vm deploy-virtual

# Run playbook on the virtual machine
deploy-virtual: check-ansible launch-vm
	@echo "⏳ Ensuring SSH connectivity before Ansible deployment..."
	@VM_IP=$$(multipass info $(MULTIPASS_NAME) | awk '/IPv4/ {print $$2}'); \
	for i in 1 2 3 4 5; do \
		if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes $(MULTIPASS_USER)@$$VM_IP "echo ready" >/dev/null 2>&1; then \
			echo "✅ SSH connection successful!"; \
			break; \
		fi; \
		echo "  Waiting for SSH... (attempt $$i/5)"; \
		sleep 3; \
	done; \
	ansible-playbook -i "$$VM_IP," -u $(MULTIPASS_USER) $(PLAYBOOK_FILE) \
		--extra-vars "use_https=false"

# SSH access to the VM
shell: check-multipass
	ssh $(MULTIPASS_USER)@$(shell multipass info $(MULTIPASS_NAME) | awk '/IPv4/ {print $$2}')

# Completely remove the VM
clean: check-multipass
	@echo "🧹 Cleaning VM '$(MULTIPASS_NAME)'..."
	-multipass stop $(MULTIPASS_NAME)
	-multipass delete $(MULTIPASS_NAME)
	multipass purge

# Help
help:
	@echo ""
	@echo "📘 eXeLearning Makefile - Available commands:"
	@echo ""
	@echo "  up                - Deploy virtualized (launch VM if not exists + ansible)"
	@echo "  deploy-remote     - Run playbook on a remote server (IP and user)"
	@echo "  launch-vm         - Launch Ubuntu 24.04 VM with Multipass (if not exists)"
	@echo "  deploy-local      - Run playbook on the current machine (must be Ubuntu)"
	@echo "  deploy-virtual    - Run playbook on the virtual machine created with Multipass"
	@echo "  shell             - SSH access to the virtual machine (VM)"
	@echo "  clean             - Stop, delete and purge the virtual machine (VM)"
	@echo "  vm-ip             - Show the IP address of the virtual machine (VM)"
	@echo "  help              - Show this help"
	@echo ""

.DEFAULT_GOAL := help
