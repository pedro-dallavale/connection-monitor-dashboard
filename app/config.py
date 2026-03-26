from dataclasses import dataclass, field
import os


@dataclass(frozen=True)
class Config:
    host: str = field(default_factory=lambda: os.getenv("MONITOR_SSH_HOST", ""))
    port: int = field(default_factory=lambda: int(os.getenv("MONITOR_SSH_PORT", "3022")))
    user: str = field(default_factory=lambda: os.getenv("MONITOR_SSH_USER", ""))
    key_path: str = field(default_factory=lambda: os.getenv("MONITOR_SSH_KEY_PATH", "./credentials/key"))
    known_hosts_path: str = field(default_factory=lambda: os.getenv("MONITOR_SSH_KNOWN_HOSTS", "./credentials/known_hosts"))
    pm2_process: int = field(default_factory=lambda: int(os.getenv("MONITOR_PM2_PROCESS", "0")))
    pm2_snapshot_lines: int = field(default_factory=lambda: int(os.getenv("MONITOR_PM2_SNAPSHOT_LINES", "5000")))
    history_limit: int = field(default_factory=lambda: int(os.getenv("MONITOR_HISTORY_LIMIT", "2000")))
    reconnect_delays: tuple[int, ...] = (5, 15, 30, 60, 120)


CFG = Config()
