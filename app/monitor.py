from __future__ import annotations

from collections import Counter, deque
from dataclasses import asdict, dataclass
from datetime import datetime
import logging
import os
import re
import threading
import traceback
from typing import Any

import paramiko as pk

from app.config import CFG

ANSI_ESCAPE = re.compile(r"\x1B[@-_][0-?]*[ -/]*[@-~]")
CONNECTION_RE = re.compile(r"^\[(.*?)\]\s*-\s*Usuario conectou:\s*(.*?)\s*-\s*(?:Empresa:\s*)?(.*)$")


@dataclass
class ConnectionEvent:
    timestamp: str
    user: str
    company: str
    captured_at: str


class ConnectionMonitor:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._events: deque[ConnectionEvent] = deque(maxlen=CFG.history_limit)
        self._status = "idle"
        self._last_error = ""
        self._last_update: str | None = None
        self._thread: threading.Thread | None = None

    @staticmethod
    def strip_ansi(text: str) -> str:
        return ANSI_ESCAPE.sub("", text)

    @staticmethod
    def parse_connection_line(line: str) -> dict[str, str] | None:
        match = CONNECTION_RE.match(line)
        if not match:
            return None
        log_time, user_name, company_name = match.groups()
        return {
            "timestamp": log_time.strip(),
            "user": user_name.strip() or "Sem nome",
            "company": company_name.strip() or "Sem empresa",
        }

    def _create_ssh_client(self) -> pk.SSHClient:
        ssh = pk.SSHClient()

        if os.path.exists(CFG.known_hosts_path):
            ssh.load_host_keys(CFG.known_hosts_path)
            ssh.set_missing_host_key_policy(pk.RejectPolicy())
        else:
            logging.warning("known_hosts não encontrado, usando AutoAddPolicy local")
            ssh.set_missing_host_key_policy(pk.AutoAddPolicy())

        key = pk.RSAKey.from_private_key_file(CFG.key_path)
        ssh.connect(hostname=CFG.host, port=CFG.port, username=CFG.user, pkey=key)
        return ssh

    def _append_event(self, parsed: dict[str, str]) -> None:
        event = ConnectionEvent(
            timestamp=parsed["timestamp"],
            user=parsed["user"],
            company=parsed["company"],
            captured_at=datetime.utcnow().isoformat() + "Z",
        )
        with self._lock:
            self._events.append(event)
            self._last_update = event.captured_at

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._stream_logs, daemon=True, name="ssh-stream")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)

    def _stream_logs(self) -> None:
        attempt = 0
        while not self._stop_event.is_set():
            ssh = None
            try:
                self._status = "connecting"
                logging.info("Conectando no SSH tentativa %s", attempt + 1)
                ssh = self._create_ssh_client()
                self._status = "connected"
                self._last_error = ""
                attempt = 0

                cmd = f"sudo pm2 logs {CFG.pm2_process} --raw"
                _, stdout, _ = ssh.exec_command(cmd, get_pty=True)

                for raw in iter(stdout.readline, ""):
                    if self._stop_event.is_set():
                        break
                    clean = self.strip_ansi(raw).strip()
                    if "Usuario conectou:" not in clean:
                        continue
                    parsed = self.parse_connection_line(clean)
                    if parsed:
                        self._append_event(parsed)
            except Exception as exc:
                self._status = "error"
                self._last_error = f"{exc}"
                logging.error("Erro no stream SSH: %s\n%s", exc, traceback.format_exc())
            finally:
                if ssh:
                    try:
                        ssh.close()
                    except Exception:
                        pass

            if self._stop_event.is_set():
                break

            delay = CFG.reconnect_delays[min(attempt, len(CFG.reconnect_delays) - 1)]
            attempt += 1
            self._status = f"reconnecting ({delay}s)"
            self._stop_event.wait(delay)

        self._status = "stopped"

    def snapshot_metrics(self) -> dict[str, Any]:
        with self._lock:
            events = list(self._events)

        by_company = Counter(event.company for event in events)
        recent = sorted(events, key=lambda e: e.captured_at, reverse=True)[:50]

        return {
            "status": self._status,
            "last_error": self._last_error,
            "last_update": self._last_update,
            "total_events": len(events),
            "unique_users": len({event.user for event in events}),
            "unique_companies": len(by_company),
            "top_companies": [{"company": k, "count": v} for k, v in by_company.most_common(10)],
            "recent_events": [asdict(ev) for ev in recent],
        }
