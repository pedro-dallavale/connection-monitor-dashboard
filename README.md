# C9 Monitor Enterprise — Node.js/Express

Versão JavaScript do `main.py` original (FastAPI/Python).

## Instalação

```bash
npm install
npm start
# ou para desenvolvimento com auto-reload:
npm run dev
```

Dashboard: http://127.0.0.1:8000/

---

## Estrutura do Projeto

```
c9monitor/
├── server.js       ← equivalente ao main.py
└── package.json
```

> O arquivo `monitor.py` (que exportava `events_snapshot`, `pending_connections`, etc.)
> foi substituído pelo objeto `state` interno ao `server.js`.
> Conecte seu código de monitoramento SSH/PM2 via **POST /api/events** e **POST /api/alerts**.

---

## Mapeamento Python → JavaScript

| Python (FastAPI)                    | JavaScript (Express)                |
|-------------------------------------|-------------------------------------|
| `FastAPI()`                         | `express()`                         |
| `@app.get("/rota")`                 | `app.get('/rota', handler)`         |
| `HTMLResponse`                      | `res.send(html)`                    |
| `JSONResponse({...})`               | `res.json({...})`                   |
| `threading.Lock()`                  | Estado em memória (single-thread)   |
| `deque(maxlen=500)`                 | Array com `shift()` ao atingir 500  |
| `Counter()`                         | Função `counter()` local            |
| `threading.Thread(target=...).start()` | `setInterval()` / workers Node.js|
| `uvicorn.run(app, host=..., port=...)`  | `app.listen(PORT, host)`          |
| `datetime.now().strftime(...)`      | `new Date()` + formatação manual    |
| `Query` params FastAPI              | `req.query.empresa`, `req.query.usuario` |

---

## Endpoints disponíveis

### Páginas HTML
| Rota         | Descrição                     |
|--------------|-------------------------------|
| `GET /`      | Dashboard principal           |
| `GET /conexoes` | Lista de conexões (filtrável) |
| `GET /alertas`  | Centro de alertas           |
| `GET /relatorios` | Relatórios e rankings     |
| `GET /logs`     | Logs pendentes              |
| `GET /sistema`  | Status do sistema           |

### API JSON
| Rota               | Método | Descrição                          |
|--------------------|--------|------------------------------------|
| `/api/time`        | GET    | Hora atual                         |
| `/api/stats`       | GET    | Estatísticas gerais                |
| `/api/pending`     | GET    | Conexões pendentes                 |
| `/api/ping`        | GET    | Health check                       |
| `/api/events`      | POST   | Inserir novo evento de conexão     |
| `/api/alerts`      | POST   | Criar novo alerta                  |

### Exemplo: inserir evento via API
```bash
curl -X POST http://127.0.0.1:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{"company": "Acme Ltda", "user": "joao.silva", "timestamp": "2025-01-01 09:30:00"}'
```
