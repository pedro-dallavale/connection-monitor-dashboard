# connection-monitor-dashboard

Dashboard web em FastAPI para monitoramento em tempo real de conexões PM2 via SSH.

## Funcionalidades
- Coleta contínua de logs via SSH (`pm2 logs --raw`).
- Parse de eventos `Usuario conectou`.
- Métricas de monitoramento em endpoint JSON.
- Interface web simples para operação (auto-refresh a cada 5s).

## Variáveis de ambiente
- `MONITOR_SSH_HOST`
- `MONITOR_SSH_PORT` (padrão: `22`)
- `MONITOR_SSH_USER`
- `MONITOR_SSH_KEY_PATH` (padrão: `./credentials/key`)
- `MONITOR_SSH_KNOWN_HOSTS` (padrão: `./credentials/known_hosts`)
- `MONITOR_PM2_PROCESS` (padrão: `0`)
- `MONITOR_PM2_SNAPSHOT_LINES` (padrão: `5000`)
- `MONITOR_HISTORY_LIMIT` (padrão: `2000`)

## Execução
```bash
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn paramiko jinja2
uvicorn main:app --host 0.0.0.0 --port 8000
```

Acesse `http://localhost:8000`.

## Como testar

### 1) Preparar ambiente
Configure variáveis reais antes de subir:

```bash
export MONITOR_SSH_HOST="seu-host"
export MONITOR_SSH_PORT=3022
export MONITOR_SSH_USER="seu-usuario"
export MONITOR_SSH_KEY_PATH="./credentials/key"
export MONITOR_PM2_PROCESS=0
```

No Windows PowerShell:

```bash
$env:MONITOR_SSH_HOST="seu-host"
$env:MONITOR_SSH_PORT="3022"
$env:MONITOR_SSH_USER="seu-usuario"
$env:MONITOR_SSH_KEY_PATH="./credentials/key"
$env:MONITOR_PM2_PROCESS="0"
```

### 2) Subir API e dashboard

```bash
uvicorn main:app --reload
```

### 3) Validar API

```bash
curl -s http://localhost:8000/api/metrics | python -m json.tool
```

### 4) Se aparecer `ModuleNotFoundError: No module named 'app'`
- Execute o comando dentro da pasta do projeto (onde está o `main.py`).
- Prefira `uvicorn main:app` em vez de `uvicorn app.main:app`.
