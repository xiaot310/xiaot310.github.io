#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OC (Canvas) 只读同步：本机保存访问令牌，读取课程、待办和公告。

设计边界：
- 不使用、不接收学校密码；只支持 Canvas 个人访问令牌；
- 令牌只保存在 workbench/oc.json（已在 .gitignore，静态服务也会拦截）；
- 只向 https://oc.sjtu.edu.cn 发请求，不把令牌发到其他域；
- 只读，不会提交作业、发公告或修改 Canvas。
"""
from __future__ import annotations

import json
import os
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

WORKBENCH_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(WORKBENCH_DIR, "oc.json")
CACHE_PATH = os.path.join(WORKBENCH_DIR, "oc-cache.json")
CANVAS_BASE = "https://oc.sjtu.edu.cn"
MAX_COURSES = 40
MAX_TODOS = 40
MAX_ANNOUNCEMENTS = 16
HTTP_TIMEOUT = 20


class OcError(Exception):
    def __init__(self, status, code, message):
        super(OcError, self).__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _read_json(path):
    try:
        with open(path, "r", encoding="utf-8-sig") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    try:
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    os.replace(tmp, path)


def _iso_now():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _clean_text(value, limit=300):
    if value is None:
        return ""
    text = str(value).replace("\r", " ").replace("\n", " ").strip()
    return text[:limit]


def _normalize_base(value):
    base = str(value or CANVAS_BASE).strip().rstrip("/")
    if not base:
        base = CANVAS_BASE
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != "https" or parsed.netloc.casefold() != "oc.sjtu.edu.cn":
        raise OcError(400, "bad_base_url", "只支持 https://oc.sjtu.edu.cn")
    return CANVAS_BASE


def _http_json(path_or_url, token):
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        url = path_or_url
    else:
        url = CANVAS_BASE + path_or_url
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.netloc.casefold() != "oc.sjtu.edu.cn":
        raise OcError(400, "bad_url", "拒绝向非 OC 地址发送令牌")
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/json",
            "User-Agent": "YitingWorkbench/2.0 (local; read-only)",
        },
        method="GET",
    )
    try:
        context = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT, context=context) as resp:
            raw = resp.read()
            try:
                return json.loads(raw.decode("utf-8-sig"))
            except ValueError:
                raise OcError(502, "bad_json", "OC 返回了无法解析的数据")
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise OcError(401, "invalid_token", "OC 访问令牌无效或已过期")
        if exc.code == 403:
            raise OcError(403, "forbidden", "该令牌没有读取此内容的权限")
        if exc.code == 404:
            raise OcError(404, "not_found", "OC 接口不存在，请检查地址")
        raise OcError(502, "http_error", "OC 返回 HTTP %s" % exc.code)
    except urllib.error.URLError as exc:
        reason = getattr(exc, "reason", exc)
        raise OcError(502, "network", "无法连接 OC：%s" % _clean_text(reason, 160))
    except (socket.timeout, TimeoutError):
        raise OcError(504, "timeout", "连接 OC 超时，请稍后重试")
    except ssl.SSLError as exc:
        raise OcError(502, "tls", "OC TLS 校验失败：%s" % _clean_text(exc, 160))


def _query(path, params, token):
    pairs = []
    for key, value in params:
        pairs.append((key, value))
    sep = "&" if "?" in path else "?"
    return _http_json(path + sep + urllib.parse.urlencode(pairs), token)


def load_config():
    cfg = _read_json(CONFIG_PATH)
    if not isinstance(cfg, dict):
        return {}
    return cfg


def load_cache():
    return _read_json(CACHE_PATH)


def status():
    cfg = load_config()
    cache = load_cache()
    payload = cache.get("payload") if isinstance(cache.get("payload"), dict) else {}
    configured = bool(cfg.get("token"))
    return {
        "ok": True,
        "configured": configured,
        "baseUrl": CANVAS_BASE,
        "userName": _clean_text(cfg.get("userName"), 80),
        "savedAt": _clean_text(cfg.get("savedAt"), 40),
        "lastSync": _clean_text(cache.get("syncedAt") or cfg.get("lastSync"), 40),
        "counts": {
            "courses": len(payload.get("courses") or []),
            "todos": len(payload.get("todos") or []),
            "announcements": len(payload.get("announcements") or []),
        },
    }


def configure(body):
    token = _clean_text(body.get("token"), 4000)
    if not token:
        raise OcError(400, "missing_token", "请填写 Canvas 访问令牌")
    if len(token) < 20:
        raise OcError(400, "bad_token", "访问令牌看起来不完整")
    base = _normalize_base(body.get("baseUrl"))
    me = _http_json(base + "/api/v1/users/self", token)
    if not isinstance(me, dict) or not me.get("id"):
        raise OcError(401, "invalid_token", "令牌验证失败")
    now = _iso_now()
    _write_json(CONFIG_PATH, {
        "baseUrl": base,
        "token": token,
        "userName": _clean_text(me.get("name"), 80),
        "userId": me.get("id"),
        "savedAt": now,
    })
    return status()


def clear():
    for path in (CONFIG_PATH, CACHE_PATH):
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        except OSError as exc:
            raise OcError(500, "clear_failed", "清除本地 OC 配置失败：%s" % _clean_text(exc, 160))
    return {"ok": True, "configured": False}


def _course_role(raw):
    enrollments = raw.get("enrollments")
    if not isinstance(enrollments, list) or not enrollments:
        return ""
    first = enrollments[0] if isinstance(enrollments[0], dict) else {}
    role = _clean_text(first.get("type") or first.get("role"), 60).casefold()
    if "teacher" in role:
        return "teacher"
    if role == "ta" or role.startswith("ta") or "teaching" in role:
        return "ta"
    if "student" in role:
        return "student"
    return role


def _fetch_announcements(courses, token):
    announcements = []
    # 优先显示有教师/助教身份的课程公告，再补充其他课程
    ordered = sorted(courses, key=lambda c: 0 if c.get("role") in ("teacher", "ta") else 1)
    for course in ordered[:6]:
        cid = course.get("id")
        if not cid:
            continue
        try:
            rows = _query(
                "/api/v1/courses/%s/discussion_topics" % urllib.parse.quote(str(cid)),
                [("only_announcements", "true"), ("per_page", "3"), ("order_by", "recent_activity")],
                token,
            )
        except OcError:
            continue
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            announcements.append({
                "title": _clean_text(row.get("title") or "未命名公告", 160),
                "postedAt": _clean_text(row.get("posted_at") or row.get("created_at"), 40),
                "url": _clean_text(row.get("html_url"), 500),
                "author": _clean_text(row.get("user_name"), 80),
                "course": course.get("name") or "",
                "courseId": cid,
            })
    announcements.sort(key=lambda a: a.get("postedAt") or "", reverse=True)
    return announcements[:MAX_ANNOUNCEMENTS]


def sync():
    cfg = load_config()
    token = _clean_text(cfg.get("token"), 4000)
    if not token:
        raise OcError(400, "not_configured", "还没有配置 OC 访问令牌")
    base = _normalize_base(cfg.get("baseUrl"))
    courses_raw = _query(
        "/api/v1/courses",
        [("enrollment_state", "active"), ("per_page", "50"),
         ("include[]", "term"), ("include[]", "teachers"), ("include[]", "enrollments")],
        token,
    )
    if not isinstance(courses_raw, list):
        raise OcError(502, "bad_courses", "OC 课程数据格式异常")
    courses = []
    for raw in courses_raw:
        if not isinstance(raw, dict) or not raw.get("id"):
            continue
        term = raw.get("term") if isinstance(raw.get("term"), dict) else {}
        teachers = raw.get("teachers") if isinstance(raw.get("teachers"), list) else []
        teacher = ""
        if teachers and isinstance(teachers[0], dict):
            teacher = _clean_text(teachers[0].get("display_name") or teachers[0].get("name"), 80)
        courses.append({
            "id": raw.get("id"),
            "name": _clean_text(raw.get("name") or raw.get("course_code") or "未命名课程", 160),
            "code": _clean_text(raw.get("course_code"), 80),
            "term": _clean_text(term.get("name"), 80),
            "role": _course_role(raw),
            "teacher": teacher,
            "url": _clean_text(raw.get("html_url") or ("%s/courses/%s" % (base, raw.get("id"))), 500),
        })
    courses = courses[:MAX_COURSES]

    todos_raw = _query("/api/v1/users/self/todo", [("per_page", "50")], token)
    todos = []
    if isinstance(todos_raw, list):
        for item in todos_raw:
            if not isinstance(item, dict):
                continue
            assignment = item.get("assignment") if isinstance(item.get("assignment"), dict) else {}
            quiz = item.get("quiz") if isinstance(item.get("quiz"), dict) else {}
            obj = assignment or quiz
            title = obj.get("name") or item.get("title")
            due = obj.get("due_at") or item.get("due_at")
            if not title:
                continue
            todos.append({
                "title": _clean_text(title, 160),
                "due": _clean_text(due, 40),
                "courseId": item.get("course_id") or obj.get("course_id"),
                "url": _clean_text(obj.get("html_url") or item.get("html_url"), 500),
                "type": _clean_text(item.get("type"), 40),
            })
    todos = todos[:MAX_TODOS]

    announcements = _fetch_announcements(courses, token)
    payload = {
        "syncedAt": _iso_now(),
        "userName": _clean_text(cfg.get("userName"), 80),
        "courses": courses,
        "todos": todos,
        "announcements": announcements,
    }
    _write_json(CACHE_PATH, {"syncedAt": payload["syncedAt"], "payload": payload})
    # 不把 token 写入缓存
    return {"ok": True, **payload}


def cached_data():
    cache = load_cache()
    if not cache:
        return {"ok": True, "configured": bool(load_config().get("token")), "syncedAt": "", "courses": [], "todos": [], "announcements": []}
    payload = cache.get("payload") if isinstance(cache.get("payload"), dict) else {}
    return {
        "ok": True,
        "configured": bool(load_config().get("token")),
        "syncedAt": _clean_text(cache.get("syncedAt"), 40),
        "userName": _clean_text(payload.get("userName"), 80),
        "courses": payload.get("courses") or [],
        "todos": payload.get("todos") or [],
        "announcements": payload.get("announcements") or [],
    }
