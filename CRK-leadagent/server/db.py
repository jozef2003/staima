"""Supabase REST client — kein psycopg, keine SSL-Konfig nötig.

Single client für sources, articles, leads, lead_feedback. Service-Role-Key
bypassed RLS — Server-only, niemals client-seitig exposen.
"""
from __future__ import annotations

import os
from typing import Any

import httpx


SB_URL = (
    os.environ.get('SUPABASE_URL')
    or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    or ''
).rstrip('/')
SB_KEY = (
    os.environ.get('SUPABASE_SERVICE_KEY')
    or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    or os.environ.get('SUPABASE_KEY')
    or ''
)


def _headers(prefer: str | None = None) -> dict[str, str]:
    h = {
        'apikey': SB_KEY,
        'Authorization': f'Bearer {SB_KEY}',
        'Content-Type': 'application/json',
    }
    if prefer:
        h['Prefer'] = prefer
    return h


def _check() -> None:
    if not SB_URL or not SB_KEY:
        raise RuntimeError('SUPABASE_URL + SUPABASE_SERVICE_KEY müssen gesetzt sein')


def select(table: str, params: dict[str, Any] | None = None) -> list[dict]:
    _check()
    r = httpx.get(f'{SB_URL}/rest/v1/{table}',
                  headers=_headers(), params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()


def insert(table: str, rows: list[dict] | dict, *, on_conflict: str | None = None,
           ignore_duplicates: bool = False) -> list[dict]:
    """INSERT mit optionalem ON CONFLICT DO NOTHING via Prefer header."""
    _check()
    if isinstance(rows, dict):
        rows = [rows]
    prefer = 'return=representation'
    if ignore_duplicates:
        prefer = 'return=representation,resolution=ignore-duplicates'
    params = {}
    if on_conflict:
        params['on_conflict'] = on_conflict
    r = httpx.post(f'{SB_URL}/rest/v1/{table}', headers=_headers(prefer),
                   params=params, json=rows, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f'insert {table} {r.status_code}: {r.text[:300]}')
    return r.json()


def update(table: str, where: dict[str, Any], patch: dict[str, Any]) -> list[dict]:
    _check()
    params = {f'{k}': f'eq.{v}' for k, v in where.items()}
    r = httpx.patch(f'{SB_URL}/rest/v1/{table}',
                    headers=_headers('return=representation'),
                    params=params, json=patch, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f'update {table} {r.status_code}: {r.text[:300]}')
    return r.json()


def count(table: str, params: dict[str, Any] | None = None) -> int:
    _check()
    h = _headers('count=exact')
    h['Range'] = '0-0'
    r = httpx.get(f'{SB_URL}/rest/v1/{table}',
                  headers=h, params=params or {}, timeout=30)
    r.raise_for_status()
    cr = r.headers.get('content-range', '')
    return int(cr.split('/')[-1]) if '/' in cr else len(r.json())
