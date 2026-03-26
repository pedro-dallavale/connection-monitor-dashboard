from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

from app.monitor import ConnectionMonitor

app = FastAPI(title="Connection Monitor Dashboard", version="1.0.0")
monitor = ConnectionMonitor()

base_dir = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(base_dir / "templates"))
app.mount("/static", StaticFiles(directory=str(base_dir / "static")), name="static")


@app.on_event("startup")
async def startup_event() -> None:
    monitor.start()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    monitor.stop()


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/api/metrics")
async def metrics() -> dict:
    return monitor.snapshot_metrics()
