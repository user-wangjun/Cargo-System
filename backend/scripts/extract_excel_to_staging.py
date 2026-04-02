from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable, List

import openpyxl
import xlrd


ROOT = Path(r"D:\Users\Desktop\CargoSystem")
SOURCE_DIR = ROOT / "data" / "imports" / "raw"
OUT_DIR = ROOT / "data" / "imports" / "staging"
LOG_FILE = ROOT / "data" / "imports" / "logs" / "extract.log"


def sanitize(name: str) -> str:
    bad = '\\/:*?"<>| '
    out = name
    for ch in bad:
        out = out.replace(ch, "_")
    return out or "sheet"


def trim_row(row: Iterable[object]) -> List[str]:
    vals = ["" if v is None else str(v).strip() for v in row]
    if any(vals):
        return vals
    return []


def write_csv(path: Path, rows: List[List[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        for r in rows:
            w.writerow(r)


def export_xlsx(path: Path, out_root: Path) -> None:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    wb_dir = out_root / sanitize(path.stem)
    wb_dir.mkdir(parents=True, exist_ok=True)
    for ws in wb.worksheets:
        rows: List[List[str]] = []
        for row in ws.iter_rows(values_only=True):
            vals = trim_row(row)
            if vals:
                rows.append(vals)
        write_csv(wb_dir / f"{sanitize(ws.title)}.csv", rows)


def export_xls(path: Path, out_root: Path) -> None:
    wb = xlrd.open_workbook(path.as_posix())
    wb_dir = out_root / sanitize(path.stem)
    wb_dir.mkdir(parents=True, exist_ok=True)
    for ws in wb.sheets():
        rows: List[List[str]] = []
        for r in range(ws.nrows):
            vals = trim_row(ws.row_values(r))
            if vals:
                rows.append(vals)
        write_csv(wb_dir / f"{sanitize(ws.name)}.csv", rows)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    files = [p for p in SOURCE_DIR.glob("*") if p.suffix.lower() in {".xlsx", ".xls"}]
    if not files:
        raise SystemExit(f"No excel files in {SOURCE_DIR}")

    for p in files:
        try:
            if p.suffix.lower() == ".xlsx":
                export_xlsx(p, OUT_DIR)
            else:
                export_xls(p, OUT_DIR)
            print(f"Exported: {p.name}")
        except Exception as e:  # noqa: BLE001
            with LOG_FILE.open("a", encoding="utf-8") as f:
                f.write(f"FAILED: {p} - {e}\n")
            print(f"FAILED: {p.name}: {e}")


if __name__ == "__main__":
    main()
