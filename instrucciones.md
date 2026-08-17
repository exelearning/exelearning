# Construir e instalar la imagen Docker de eXeLearning

Tag usado en el ejemplo: `v4.0.3-X`

## 1. Arrancar Docker Desktop

Abrirlo desde el menú Inicio, o:

```powershell
& "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
```

Verificar (debe imprimir un número de versión):

```powershell
docker version --format '{{.Server.Version}}'
```

## 2. Construir la imagen

En PowerShell, desde `C:\Datos\exelearning\git_code\exelearning`:

```powershell
docker build -t exelearning:v4.0.3-X --build-arg VERSION=v4.0.3-X .
```

Comprobar:

```powershell
docker images exelearning:v4.0.3-X
```

## 3. Probarla en local (opcional)

```powershell
docker run --rm -p 8080:8080 -e APP_SECRET=local-test-secret -e APP_VERSION=v4.0.3-X -e DB_DRIVER=pdo_sqlite -e DB_PATH=/mnt/data/exelearning.db -e FILES_DIR=/mnt/data/ -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=1234 --name exe-test exelearning:v4.0.3-X
```

Abrir http://localhost:8080 y entrar con `admin@example.com` / `1234`.
Parar con `Ctrl+C`.

## 4. Exportar a fichero

PowerShell (no usar pipes con `gzip` en PowerShell):

```powershell
docker save -o C:\Datos\exelearning-v4.0.3-X.tar exelearning:v4.0.3-X
```

Comprimir, en **Git Bash** (rutas con `/c/...`, no `C:\...`):

```bash
gzip -9 /c/Datos/exelearning-v4.0.3-X.tar
```

Resultado: `C:\Datos\exelearning-v4.0.3-X.tar.gz` (~200-250 MB).

## 5. Transferir al servidor

```powershell
scp C:\Datos\exelearning-v4.0.3-X.tar.gz usuario@servidor:/tmp/
```

## 6. Cargar la imagen en el servidor

```bash
docker load -i /tmp/exelearning-v4.0.3-X.tar.gz
docker images exelearning
```

Comprobar los flags de CPU que exige Bun (deben salir `avx`, `avx2`, `sse4_2`):

```bash
grep -o -E 'sse4_2|avx2?' /proc/cpuinfo | sort -u
```

## 7. Desplegar

Partir de `doc/deploy/docker-compose.sqlite.yml`, quitar la línea `build: ../../` y dejar:

```yaml
    image: exelearning:v4.0.3-X
    environment:
      APP_SECRET: "<secreto real>"
      APP_VERSION: "v4.0.3-X"
```

Levantar:

```bash
docker compose up -d
docker compose logs -f exelearning
```

## Notas

- `APP_VERSION` es obligatoria para que la interfaz muestre la versión correcta. Sin ella se lee de `package.json` y aparece `v0.0.0-alpha`. El `--build-arg VERSION` solo afecta a los metadatos de la imagen.
- La imagen no contiene ningún `.env`. Toda la configuración se inyecta en runtime.
- La imagen se construye con el working tree actual, incluidos los cambios sin commitear.
