#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Yiting Workbench —— 张义廷的本地研究工作台服务器。

只用 Python 标准库，只监听 127.0.0.1，在公开静态站点旁提供三件「只在本机」的事：

  1. 读取研究工作区里最近的文件（只读；按 private.json 的 roots 白名单扫描，
     强制排除个人文件 / 奖学金 / 身份证 / 学历 / 学位、隐藏目录、.git、
     node_modules 与超过 30 MB 的文件）；
  2. 用系统默认程序打开文件、在资源管理器中定位文件（严格限制在 researchRoot 内）；
  3. 经 /go/latex、/go/draw 302 跳到私有 LaTeX / 绘图链接；
     私密链接只写在 workbench/private.json，接口只返回布尔值，不返回 URL。

站点本身仍然是纯静态的：不启动本服务时工作台页面自动进入离线状态；
部署到 GitHub Pages 时 /api/* 不存在，页面只显示提示，不暴露任何本地路径。

用法：
    python workbench/server.py            # 启动并自动打开浏览器
    python workbench/server.py --no-open  # 只启动，不打开浏览器
    python workbench/server.py --port 8766

配置：
    workbench/private.json（本地创建，不要提交）> workbench/private.example.json > 内置默认值
"""

import argparse
import datetime
import json
import mimetypes
import os
import stat
import subprocess
import sys
import threading
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

import oc_sync

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

APP_NAME = "张义廷 · 研究工作台"
APP_VERSION = "2.0.0"

HOST = "127.0.0.1"          # 只绑定回环地址：局域网内其他机器无法访问
DEFAULT_PORT = 8765
DEFAULT_LATEX_URL = "https://latex.sjtu.edu.cn/"
DEFAULT_DRAW_URL = "https://app.diagrams.net/"
DEFAULT_LIMIT = 80
MAX_LIMIT = 800
MAX_REQUEST_BYTES = 64 * 1024
SCAN_CACHE_SECONDS = 3.0
MAX_SCAN_DEPTH = 32

# Windows 文件属性
FILE_ATTRIBUTE_REPARSE_POINT = 0x400

# 站点根目录 = workbench 的父目录
WORKBENCH_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT = os.path.dirname(WORKBENCH_DIR)
SITE_ROOT_REAL = os.path.realpath(SITE_ROOT)
PRIVATE_JSON = os.path.join(WORKBENCH_DIR, "private.json")
PRIVATE_JSON_REAL = os.path.realpath(PRIVATE_JSON)
PRIVATE_EXAMPLE = os.path.join(WORKBENCH_DIR, "private.example.json")

# 永远排除的敏感目录名（即使 private.json 的 exclude 被改小也生效）
SENSITIVE_NAMES = ("个人文件", "奖学金", "身份证", "学历", "学位", "宿舍", "比赛")

# 永远跳过的工程垃圾目录（隐藏目录另按前缀跳过）
SKIP_DIR_NAMES = ("node_modules", "__pycache__", "venv", "site-packages", ".git", ".svn", ".hg")

# 临时/锁文件不进「最近文件」列表（Office 的 ~$ 锁文件、编辑器临时文件等）
TEMP_FILE_PREFIXES = ("~$",)
TEMP_FILE_SUFFIXES = ("~",)
TEMP_FILE_EXTENSIONS = ("tmp", "temp", "cache", "lock", "swp", "swo")

# private.json 缺失时的内置默认值；private.example.json 也写同样的默认值
BUILTIN_DEFAULTS = {
    "researchRoot": os.path.join("..", ".."),
    "roots": ["论文", "项目", "课程", "助教"],
    "exclude": [],
    "maxFileMB": 30,
    "latexUrl": "",
    "drawUrl": "",
}

# 扩展名 -> 粗分类，供前端或别的脚本按类型筛选
KIND_EXTENSIONS = {
    "pdf": ("pdf",),
    "doc": ("doc", "docx", "odt", "rtf", "md", "markdown", "txt", "tex", "bib", "typ", "pages"),
    "sheet": ("xls", "xlsx", "xlsm", "csv", "ods"),
    "slide": ("ppt", "pptx", "odp", "key"),
    "image": ("png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tif", "tiff", "heic"),
    "archive": ("zip", "rar", "7z", "tar", "gz", "bz2", "xz", "zst"),
    "code": (
        "py", "m", "js", "mjs", "ts", "tsx", "jsx", "c", "h", "cpp", "hpp", "java",
        "kt", "go", "rs", "rb", "php", "sql", "sh", "bat", "ps1", "html", "htm",
        "css", "scss", "json", "yaml", "yml", "toml", "xml", "ipynb",
    ),
}
KIND_BY_EXT = {}
for _kind, _exts in KIND_EXTENSIONS.items():
    for _ext in _exts:
        KIND_BY_EXT[_ext] = _kind
del _kind, _exts, _ext

# 静态文件 Content-Type：Windows 注册表里的 MIME 不一定可靠，先查这张表
MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".map": "application/json; charset=utf-8",
}

SETTINGS = None  # 由 main() 初始化
FILE_INDEX = None  # 由 main() 初始化
ALLOWED_HOSTS = set()  # 由 main() 按实际端口初始化，用于同源 / 防 DNS rebinding


# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------


class ApiError(Exception):
    """接口错误：带 HTTP 状态码与稳定的 code，最终以 JSON 返回。"""

    def __init__(self, status, code, message, headers=None):
        super(ApiError, self).__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers or {}


def _configure_stdio():
    """统一输出为 UTF-8；pythonw 下 stdout/stderr 为 None，重定向到 devnull。"""
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def _now_iso():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def _is_within(path, root):
    """判断 path 是否在 root 目录内部（Windows 不区分大小写，且避免前缀误判）。"""
    left = os.path.normcase(os.path.normpath(path))
    right = os.path.normcase(os.path.normpath(root))
    if left == right:
        return True
    prefix = right if right.endswith(os.sep) else right + os.sep
    return left.startswith(prefix)


def _describe_os_error(exc):
    message = str(exc) or exc.__class__.__name__
    return message


def _read_json_file(path):
    """读取 JSON 配置；文件不存在返回 None，格式错误时返回 None 并记录警告。"""
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8-sig") as handle:
            data = json.load(handle)
    except (OSError, ValueError) as exc:
        print("[提示] 配置文件读取失败：%s（%s）" % (path, _describe_os_error(exc)))
        return None
    if not isinstance(data, dict):
        print("[提示] 配置文件不是 JSON 对象，已忽略：%s" % path)
        return None
    return data


def _normalize_http_url(value):
    """只接受 http/https 外链；非法值返回空字符串，防止 Location 头被注入。"""
    if not isinstance(value, str):
        return ""
    url = value.strip()
    if not url:
        return ""
    try:
        scheme = urlsplit(url).scheme.lower()
    except ValueError:
        return ""
    if scheme not in ("http", "https") or " " in url or "\n" in url or "\r" in url:
        return ""
    return url


def _guess_content_type(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in MIME_TYPES:
        return MIME_TYPES[ext]
    guessed = mimetypes.guess_type(path)[0]
    if not guessed:
        return "application/octet-stream"
    if guessed.startswith("text/") or guessed in (
        "application/javascript",
        "application/json",
        "application/xml",
        "image/svg+xml",
    ):
        return guessed + "; charset=utf-8"
    return guessed


def _now_text_stamp():
    return time.strftime("%H:%M:%S")


# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------


class Settings(object):
    """一次启动内生效的配置（private.example.json 打底，private.json 覆盖）。"""

    def __init__(self, site_root, research_root, roots, excludes, skip_dirs,
                 max_bytes, latex_url, draw_url, config_source, warnings):
        self.site_root = site_root
        self.research_root = research_root
        self.roots = roots                # [(显示名, 绝对路径)]
        self.excludes = excludes          # 小写目录/文件名集合
        self.skip_dirs = skip_dirs        # 小写工程垃圾目录集合
        self.max_bytes = max_bytes        # 单文件大小上限
        self.latex_url = latex_url        # 私有 LaTeX 链接；未配置为空字符串
        self.draw_url = draw_url
        self.config_source = config_source
        self.warnings = warnings


def load_settings():
    warnings = []

    example_data = _read_json_file(PRIVATE_EXAMPLE)
    private_data = _read_json_file(PRIVATE_JSON)

    raw = dict(BUILTIN_DEFAULTS)
    for source in (example_data, private_data):
        if not source:
            continue
        for key, value in source.items():
            if value is not None:
                raw[key] = value

    if private_data is not None:
        config_source = "workbench/private.json"
        if example_data is not None:
            config_source += "（private.example.json 补齐缺省项）"
    elif example_data is not None:
        config_source = "workbench/private.example.json（默认值）"
    else:
        config_source = "内置默认值"

    # ---- 研究工作区根目录 ----
    research_value = raw.get("researchRoot", BUILTIN_DEFAULTS["researchRoot"])
    if not isinstance(research_value, str) or not research_value.strip():
        warnings.append("researchRoot 不是有效字符串，改用默认值 ../..")
        research_value = BUILTIN_DEFAULTS["researchRoot"]
    research_value = os.path.expandvars(os.path.expanduser(research_value.strip()))
    if not os.path.isabs(research_value):
        research_value = os.path.join(SITE_ROOT, research_value)
    research_root = os.path.realpath(research_value)

    # ---- 扫描目录白名单 ----
    root_items = raw.get("roots", [])
    if not isinstance(root_items, list):
        warnings.append("roots 不是数组，已忽略")
        root_items = []

    roots = []
    seen_roots = set()
    for item in root_items:
        if not isinstance(item, str) or not item.strip():
            continue
        name = item.strip()
        candidate = name if os.path.isabs(name) else os.path.join(research_root, name)
        real = os.path.realpath(candidate)
        label = os.path.basename(os.path.normpath(name)) or name

        if not _is_within(real, research_root):
            warnings.append("roots 中的“%s”不在 researchRoot 内，已忽略" % name)
            continue
        relative = os.path.relpath(real, research_root)
        segments = [seg for seg in relative.replace("\\", "/").split("/") if seg not in ("", ".")]
        if any(seg.casefold() in {s.casefold() for s in SENSITIVE_NAMES} for seg in segments):
            warnings.append("roots 中的“%s”属于敏感目录，已忽略" % name)
            continue
        if not os.path.isdir(real):
            warnings.append("roots 中的“%s”不存在，已忽略（%s）" % (name, real))
            continue
        key = os.path.normcase(real)
        if key in seen_roots:
            continue
        seen_roots.add(key)
        roots.append((label, real))

    # ---- 排除名单：内置敏感目录 + 配置追加（配置不能删掉内置项） ----
    excludes = set(name.casefold() for name in SENSITIVE_NAMES)
    extra_excludes = raw.get("exclude", [])
    if isinstance(extra_excludes, list):
        for item in extra_excludes:
            if isinstance(item, str) and item.strip():
                excludes.add(item.strip().casefold())
    else:
        warnings.append("exclude 不是数组，已忽略")

    # ---- 单文件大小上限 ----
    try:
        max_mb = float(raw.get("maxFileMB", 30))
    except (TypeError, ValueError):
        max_mb = 30.0
    if not (0 < max_mb <= 4096):
        warnings.append("maxFileMB 超出合理范围，改用 30")
        max_mb = 30.0
    max_bytes = int(max_mb * 1024 * 1024)

    # ---- 私有链接 ----
    latex_url = _normalize_http_url(raw.get("latexUrl") or raw.get("latex"))
    if (raw.get("latexUrl") or raw.get("latex")) and not latex_url:
        warnings.append("latexUrl 不是 http/https 链接，已忽略")
    draw_url = _normalize_http_url(raw.get("drawUrl") or raw.get("draw"))
    if (raw.get("drawUrl") or raw.get("draw")) and not draw_url:
        warnings.append("drawUrl 不是 http/https 链接，已忽略")

    if not os.path.isdir(research_root):
        warnings.append("研究工作区不存在：%s（请修改 private.json 的 researchRoot）" % research_root)
    if not roots:
        warnings.append("没有可扫描的 roots 目录，/api/files 会返回空列表")

    settings = Settings(
        site_root=SITE_ROOT,
        research_root=research_root,
        roots=roots,
        excludes=excludes,
        skip_dirs=set(name.casefold() for name in SKIP_DIR_NAMES),
        max_bytes=max_bytes,
        latex_url=latex_url,
        draw_url=draw_url,
        config_source=config_source,
        warnings=warnings,
    )
    return settings


# ---------------------------------------------------------------------------
# 文件索引：只读扫描 + 3 秒快照缓存
# ---------------------------------------------------------------------------


class FileIndex(object):
    def __init__(self, settings):
        self._settings = settings
        self._lock = threading.Lock()
        self._files = []
        self._scanned_at = 0.0
        self._warned = set()

    def snapshot(self):
        """返回最近一次扫描的文件列表；缓存过期后重新扫描。"""
        with self._lock:
            now = time.monotonic()
            if self._scanned_at and (now - self._scanned_at) < SCAN_CACHE_SECONDS:
                return self._files
            files = self._scan_all()
            self._files = files
            self._scanned_at = time.monotonic()
            return files

    # -- 扫描 --

    def _scan_all(self):
        collected = []
        for root_name, root_path in self._settings.roots:
            collected.extend(self._scan_root(root_name, root_path))
        collected.sort(key=lambda item: (-item["mtime"], item["rel"].casefold()))
        return collected

    def _scan_root(self, root_name, root_path):
        settings = self._settings
        results = []
        stack = [(root_path, 0)]
        visited = set()

        while stack:
            directory, depth = stack.pop()
            if depth > MAX_SCAN_DEPTH:
                self._warn_once("超过最大扫描深度，已跳过：%s" % directory)
                continue
            try:
                real_dir = os.path.normcase(os.path.realpath(directory))
            except OSError:
                continue
            if real_dir in visited:
                continue
            visited.add(real_dir)
            try:
                with os.scandir(directory) as iterator:
                    entries = list(iterator)
            except OSError as exc:
                self._warn_once("目录无法读取：%s（%s）" % (directory, _describe_os_error(exc)))
                continue

            for entry in entries:
                name = entry.name
                try:
                    st = entry.stat(follow_symlinks=False)
                except OSError:
                    continue
                # 符号链接 / Windows 联接点一律不进入、不展示，避免越界和循环
                if stat.S_ISLNK(st.st_mode):
                    continue
                if getattr(st, "st_file_attributes", 0) & FILE_ATTRIBUTE_REPARSE_POINT:
                    continue
                # 隐藏文件/目录一律跳过（.git、.venv、.idea 等都在这里被排除）
                if name.startswith("."):
                    continue

                lower_name = name.casefold()
                if stat.S_ISDIR(st.st_mode):
                    if lower_name in settings.skip_dirs or lower_name in settings.excludes:
                        continue
                    stack.append((entry.path, depth + 1))
                elif stat.S_ISREG(st.st_mode):
                    if lower_name in settings.excludes:
                        continue
                    if st.st_size > settings.max_bytes:
                        continue
                    # 临时文件 / Office 锁文件不算「最近文件」
                    ext_for_skip = os.path.splitext(name)[1].lower().lstrip(".")
                    if (
                        ext_for_skip in TEMP_FILE_EXTENSIONS
                        or name.startswith(TEMP_FILE_PREFIXES)
                        or name.endswith(TEMP_FILE_SUFFIXES)
                    ):
                        continue
                    results.append(self._make_item(root_name, entry.path, st))
        return results

    def _make_item(self, root_name, absolute_path, st):
        absolute_path = os.path.normpath(absolute_path)
        relative = os.path.relpath(absolute_path, self._settings.research_root)
        rel_posix = relative.replace(os.sep, "/")
        name = os.path.basename(rel_posix)
        ext = os.path.splitext(name)[1].lower().lstrip(".")
        directory = os.path.dirname(rel_posix)
        return {
            "name": name,
            "path": absolute_path,          # Windows 绝对路径，前端原样回传给 /api/open
            "rel": rel_posix,               # 相对 researchRoot，正斜杠
            "dir": directory,               # 相对 researchRoot 的父目录，正斜杠
            "ext": ext,                     # 小写扩展名，不带点；无扩展名时为空串
            "size": int(st.st_size),
            "mtime": int(st.st_mtime),      # Unix 秒
            "kind": KIND_BY_EXT.get(ext, "other"),
            "root": root_name,              # 来自哪个扫描根（论文 / 项目 / ...）
        }

    def _warn_once(self, message):
        if message in self._warned:
            return
        self._warned.add(message)
        print("[提示] %s" % message)


# ---------------------------------------------------------------------------
# 打开 / 定位
# ---------------------------------------------------------------------------


def resolve_target(raw_path):
    """把前端传来的路径解析成安全的绝对路径，并做全部权限校验。"""
    settings = SETTINGS
    if not isinstance(raw_path, str) or not raw_path.strip():
        raise ApiError(400, "bad_request", "缺少 path 参数")
    value = raw_path.strip()
    if "\x00" in value:
        raise ApiError(400, "bad_request", "path 含非法字符")
    value = os.path.expandvars(os.path.expanduser(value))
    if not os.path.isabs(value):
        value = os.path.join(settings.research_root, value)
    real = os.path.realpath(value)

    if not _is_within(real, settings.research_root):
        raise ApiError(403, "forbidden", "该路径不在研究工作区（researchRoot）内")
    if os.path.normcase(real) == os.path.normcase(PRIVATE_JSON_REAL):
        raise ApiError(403, "forbidden", "私有配置文件不允许通过接口打开")
    if not os.path.exists(real):
        raise ApiError(404, "not_found", "路径不存在")

    relative = os.path.relpath(real, settings.research_root)
    if relative != ".":
        for segment in relative.replace("\\", "/").split("/"):
            if not segment:
                continue
            lowered = segment.casefold()
            if segment.startswith(".") or lowered in settings.excludes or lowered in settings.skip_dirs:
                raise ApiError(403, "forbidden", "该路径属于受保护目录，服务器不会打开")
    return real


def launch_path(real, reveal):
    """调用系统程序打开或定位路径；不等待子进程。"""
    try:
        if os.name == "nt":
            # Windows：os.startfile 对文件和目录都适用
            if reveal and not os.path.isdir(real):
                subprocess.Popen(["explorer", "/select,", os.path.normpath(real)])
            else:
                os.startfile(real)  # noqa: 只在 Windows 上存在
        elif sys.platform == "darwin":
            if reveal:
                subprocess.Popen(["open", "-R", real])
            else:
                subprocess.Popen(["open", real])
        else:
            target = os.path.dirname(real) if reveal and not os.path.isdir(real) else real
            subprocess.Popen(["xdg-open", target or real])
    except (OSError, AttributeError) as exc:
        raise ApiError(500, "launch_failed", "系统未能打开该路径：%s" % _describe_os_error(exc))


# ---------------------------------------------------------------------------
# HTTP 处理
# ---------------------------------------------------------------------------


def _json_bytes(payload):
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8", "replace")


class WorkbenchHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "YitingWorkbench/" + APP_VERSION
    sys_version = ""

    # ---- 基础响应 ----

    def _send_bytes(self, status, body, content_type, extra_headers=None):
        extra_headers = dict(extra_headers or {})
        # POST 出错时通常没有消费请求体；关闭连接，避免 body 被当成下一个请求解析。
        if self.command == "POST" and status >= 400:
            self.close_connection = True
            extra_headers.setdefault("Connection", "close")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for key, value in extra_headers.items():
            self.send_header(key, value)
        self.end_headers()
        if body and self.command != "HEAD":
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

    def _send_json(self, status, payload, extra_headers=None):
        body = _json_bytes(payload)
        self._send_bytes(status, body, "application/json; charset=utf-8", extra_headers)

    def _send_redirect(self, location):
        self._send_bytes(302, b"", "text/plain; charset=utf-8", {"Location": location})

    def _json_not_found(self):
        self._send_json(404, {"ok": False, "error": "接口不存在", "code": "not_found"})

    def _json_method_not_allowed(self, allow):
        self._send_json(
            405,
            {"ok": False, "error": "请求方法不被允许", "code": "method_not_allowed"},
            {"Allow": ", ".join(allow)},
        )

    def _send_404(self):
        """静态 404：优先回站点自带的 404.html。"""
        page = os.path.join(SITE_ROOT, "404.html")
        if os.path.isfile(page):
            try:
                with open(page, "rb") as handle:
                    body = handle.read()
                self._send_bytes(404, body, "text/html; charset=utf-8")
                return
            except OSError:
                pass
        self._send_bytes(404, b"<h1>404 Not Found</h1>", "text/html; charset=utf-8")

    def _serve_file(self, path):
        try:
            size = os.path.getsize(path)
        except OSError:
            self._send_404()
            return
        self.send_response(200)
        self.send_header("Content-Type", _guess_content_type(path))
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        if self.command == "HEAD":
            return
        try:
            with open(path, "rb") as handle:
                while True:
                    chunk = handle.read(64 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except OSError:
            pass

    # ---- 请求分发 ----

    def do_GET(self):
        self._dispatch("GET")

    def do_HEAD(self):
        self._dispatch("HEAD")

    def do_POST(self):
        self._dispatch("POST")

    def _check_same_origin(self):
        """只接受本机地址与同源请求：防 DNS rebinding、防跨站伪造 POST。"""
        host = (self.headers.get("Host") or "").strip()
        if host and host.casefold() not in ALLOWED_HOSTS:
            raise ApiError(403, "forbidden", "只接受通过 127.0.0.1 或 localhost 访问")
        origin = (self.headers.get("Origin") or "").strip().rstrip("/")
        if origin:
            allowed_origins = set("http://" + item for item in ALLOWED_HOSTS)
            if origin.casefold() not in set(item.casefold() for item in allowed_origins):
                raise ApiError(403, "forbidden", "拒绝跨站请求")
        fetch_site = (self.headers.get("Sec-Fetch-Site") or "").strip()
        if fetch_site and fetch_site not in ("same-origin", "none"):
            raise ApiError(403, "forbidden", "拒绝跨站请求")

    def _dispatch(self, method):
        try:
            self._check_same_origin()
            parsed = urlsplit(self.path)
            decoded = unquote(parsed.path or "/")
            route = decoded if decoded == "/" else (decoded.rstrip("/") or "/")
            query = parse_qs(parsed.query, keep_blank_values=True)

            if route in ("/api/status", "/api/files", "/api/tools"):
                if method not in ("GET", "HEAD"):
                    self._json_method_not_allowed(["GET", "HEAD"])
                    return
                if route == "/api/status":
                    self._api_status()
                elif route == "/api/files":
                    self._api_files(query)
                else:
                    self._api_tools()
                return

            # OC（Canvas）只读同步：令牌只在本机，不返回给页面
            if route.startswith("/api/oc/"):
                if route in ("/api/oc/status", "/api/oc/data"):
                    if method not in ("GET", "HEAD"):
                        self._json_method_not_allowed(["GET", "HEAD"])
                        return
                    if route == "/api/oc/status":
                        self._send_json(200, oc_sync.status())
                    else:
                        self._send_json(200, oc_sync.cached_data())
                    return
                if route in ("/api/oc/config", "/api/oc/sync", "/api/oc/clear"):
                    if method != "POST":
                        self._json_method_not_allowed(["POST"])
                        return
                    body = self._read_json_body()
                    if route == "/api/oc/config":
                        self._send_json(200, oc_sync.configure(body))
                    elif route == "/api/oc/sync":
                        self._send_json(200, oc_sync.sync())
                    else:
                        self._send_json(200, oc_sync.clear())
                    return
                self._json_not_found()
                return

            if route in ("/api/open", "/api/reveal"):
                if method != "POST":
                    self._json_method_not_allowed(["POST"])
                    return
                if route == "/api/open":
                    self._api_open()
                else:
                    self._api_reveal()
                return

            if route.startswith("/api/"):
                self._json_not_found()
                return

            if route in ("/go/latex", "/go/draw"):
                if method not in ("GET", "HEAD"):
                    self._json_method_not_allowed(["GET", "HEAD"])
                    return
                self._go(route)
                return

            if route.startswith("/go/"):
                self._send_404()
                return

            # 其余一律当作静态文件
            if method not in ("GET", "HEAD"):
                self._send_bytes(
                    405, b"Method Not Allowed", "text/plain; charset=utf-8", {"Allow": "GET, HEAD"}
                )
                return
            self._serve_static(parsed)

        except oc_sync.OcError as exc:
            self._send_json(exc.status, {"ok": False, "error": exc.message, "code": exc.code})
        except ApiError as exc:
            self._send_json(exc.status, {"ok": False, "error": exc.message, "code": exc.code}, exc.headers)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except Exception as exc:  # noqa: BLE001 —— 兜底，避免单个请求打崩线程
            traceback.print_exc()
            print("[错误] %s -> %s" % (self.path, exc))
            try:
                self._send_json(500, {"ok": False, "error": "服务器内部错误", "code": "internal_error"})
            except Exception:
                pass

    # ---- API ----

    def _api_status(self):
        settings = SETTINGS
        self._send_json(200, {
            "ok": True,
            "name": APP_NAME,
            "version": APP_VERSION,
            "root": os.path.normpath(settings.research_root),
            "site": os.path.normpath(settings.site_root),
            "time": _now_iso(),
        })

    def _api_tools(self):
        settings = SETTINGS
        self._send_json(200, {
            "ok": True,
            "latex": bool(settings.latex_url),
            "draw": bool(settings.draw_url),
            "roots": [name for name, _path in settings.roots],
        })

    def _api_files(self, query):
        settings = SETTINGS
        raw_limit = (query.get("limit") or [str(DEFAULT_LIMIT)])[0]
        try:
            limit = int(raw_limit)
        except (TypeError, ValueError):
            limit = DEFAULT_LIMIT
        limit = max(1, min(limit, MAX_LIMIT))

        raw_query = (query.get("q") or [""])[0]
        search = raw_query.strip()
        terms = [term for term in search.casefold().split() if term] if search else []

        all_files = FILE_INDEX.snapshot()
        if terms:
            matched = [item for item in all_files if all(term in _search_blob(item) for term in terms)]
        else:
            matched = all_files

        self._send_json(200, {
            "ok": True,
            "root": os.path.normpath(settings.research_root),
            "roots": [
                {"name": name, "path": os.path.normpath(path)}
                for name, path in settings.roots
                if os.path.isdir(path)
            ],
            "files": matched[:limit],
            "total": len(matched),
            "limit": limit,
            "query": search,
        })

    def _api_open(self):
        data = self._read_json_body()
        real = resolve_target(data.get("path"))
        launch_path(real, reveal=False)
        self._send_json(200, {"ok": True, "action": "open", "path": real, "name": os.path.basename(real)})

    def _api_reveal(self):
        data = self._read_json_body()
        real = resolve_target(data.get("path"))
        launch_path(real, reveal=True)
        self._send_json(200, {"ok": True, "action": "reveal", "path": real, "name": os.path.basename(real)})

    def _go(self, route):
        settings = SETTINGS
        if route == "/go/latex":
            target = settings.latex_url or DEFAULT_LATEX_URL
        else:
            target = settings.draw_url or DEFAULT_DRAW_URL
        if not _normalize_http_url(target):
            raise ApiError(500, "bad_redirect", "跳转链接配置无效")
        self._send_redirect(target)

    def _read_json_body(self):
        content_type = (self.headers.get("Content-Type") or "").strip().lower()
        if content_type and not content_type.startswith("application/json"):
            raise ApiError(415, "unsupported_media_type", "POST 只接受 application/json")
        header = self.headers.get("Content-Length")
        if header is None:
            raise ApiError(400, "bad_request", "缺少 Content-Length 请求头")
        try:
            length = int(header)
        except (TypeError, ValueError):
            raise ApiError(400, "bad_request", "Content-Length 无效")
        if length < 0 or length > MAX_REQUEST_BYTES:
            raise ApiError(413, "payload_too_large", "请求体过大")
        raw = self.rfile.read(length) if length else b""
        if not raw:
            raise ApiError(400, "bad_request", "请求体为空")
        try:
            data = json.loads(raw.decode("utf-8-sig"))
        except (UnicodeDecodeError, ValueError):
            raise ApiError(400, "bad_request", "请求体不是合法 JSON")
        if not isinstance(data, dict):
            raise ApiError(400, "bad_request", "请求体必须是 JSON 对象")
        return data

    # ---- 静态文件 ----

    def _serve_static(self, parsed):
        decoded = unquote(parsed.path or "/")
        if "\x00" in decoded:
            self._send_404()
            return
        normalized = decoded.replace("\\", "/")
        parts = [part for part in normalized.split("/") if part not in ("", ".")]
        if any(part == ".." for part in parts) or any(":" in part for part in parts):
            self._send_404()
            return

        local = os.path.join(SITE_ROOT, *parts) if parts else SITE_ROOT
        real = os.path.realpath(local)
        if not _is_within(real, SITE_ROOT_REAL):
            self._send_404()
            return

        if os.path.isdir(real):
            if not decoded.endswith("/"):
                location = (parsed.path or "/") + "/"
                if parsed.query:
                    location += "?" + parsed.query
                self._send_redirect(location)
                return
            index = os.path.join(real, "index.html")
            if not os.path.isfile(index):
                self._send_404()
                return
            real = index

        if not os.path.isfile(real):
            self._send_404()
            return

        relative = os.path.relpath(real, SITE_ROOT_REAL)
        segments = [seg for seg in relative.split(os.sep) if seg not in ("", ".")]
        if any(seg.startswith(".") for seg in segments):
            self._send_404()
            return
        # 私有配置文件永远不通过静态服务暴露
        if os.path.normcase(real) == os.path.normcase(PRIVATE_JSON_REAL):
            self._send_404()
            return
        oc_private = {
            os.path.normcase(oc_sync.CONFIG_PATH),
            os.path.normcase(oc_sync.CACHE_PATH),
            os.path.normcase(oc_sync.CONFIG_PATH + ".tmp"),
            os.path.normcase(oc_sync.CACHE_PATH + ".tmp"),
        }
        if os.path.normcase(real) in oc_private:
            self._send_404()
            return
        self._serve_file(real)

    # ---- 访问日志 ----

    def log_message(self, fmt, *args):
        try:
            sys.stdout.write("[%s] %s\n" % (_now_text_stamp(), fmt % args))
            sys.stdout.flush()
        except Exception:
            pass


def _search_blob(item):
    return (item["name"] + "\n" + item["rel"] + "\n" + item["dir"] + "\n" + item["root"]).casefold()


class WorkbenchServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, TimeoutError)):
            return
        super(WorkbenchServer, self).handle_error(request, client_address)


# ---------------------------------------------------------------------------
# 启动
# ---------------------------------------------------------------------------


def _print_banner(settings, url):
    print("")
    print("%s %s" % (APP_NAME, APP_VERSION))
    print("  站点根目录  %s" % settings.site_root)
    print("  研究工作区  %s" % settings.research_root)
    if settings.roots:
        print("  扫描目录    %s" % " / ".join(name for name, _path in settings.roots))
    else:
        print("  扫描目录    （无，请检查 private.json 的 roots）")
    print("  私有配置    %s" % settings.config_source)
    if settings.latex_url:
        print("  LaTeX 链接  已配置（只经 /go/latex 跳转，不在接口里返回 URL）")
    else:
        print("  LaTeX 链接  未配置（在 workbench/private.json 里填 latexUrl 后启用；/go/latex 默认跳学校平台）")
    print("  访问地址    %s" % url)
    print("  停止服务    Ctrl+C；私有文件只在本机读取，不会上传。")
    for warning in settings.warnings:
        print("  [提示] %s" % warning)
    print("", flush=True)


def main(argv=None):
    _configure_stdio()
    parser = argparse.ArgumentParser(
        description="Yiting Workbench 本地服务器（只监听 127.0.0.1，零第三方依赖）"
    )
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="监听端口，默认 %d" % DEFAULT_PORT)
    parser.add_argument("--no-open", action="store_true", help="启动后不自动打开浏览器")
    args = parser.parse_args(argv)

    if not (1 <= args.port <= 65535):
        parser.error("--port 必须在 1-65535 之间")

    global SETTINGS, FILE_INDEX, ALLOWED_HOSTS
    SETTINGS = load_settings()
    FILE_INDEX = FileIndex(SETTINGS)
    ALLOWED_HOSTS = {"127.0.0.1:%d" % args.port, "localhost:%d" % args.port}
    if args.port == 80:
        ALLOWED_HOSTS.update(("127.0.0.1", "localhost"))

    try:
        httpd = WorkbenchServer((HOST, args.port), WorkbenchHandler)
    except OSError as exc:
        print("启动失败：无法监听 %s:%d（%s）" % (HOST, args.port, _describe_os_error(exc)))
        print("端口可能已被占用，换一个端口试试：python workbench/server.py --port %d" % (args.port + 1))
        return 1

    url = "http://%s:%d/workbench/" % (HOST, args.port)
    _print_banner(SETTINGS, url)
    if not args.no_open:
        opener = threading.Timer(0.6, lambda: webbrowser.open(url))
        opener.daemon = True
        opener.start()

    try:
        httpd.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
