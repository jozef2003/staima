"""Crawlers — ein Modul pro Quelle.

Jedes Modul exportiert eine `fetch()` Funktion die eine Liste von Artikel-Dicts
zurückgibt: [{url, title, published, fulltext}]. Persistenz übernimmt der
zentrale Runner in `run_all.py`.
"""
