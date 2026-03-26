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
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Acesse `http://localhost:8000`.
