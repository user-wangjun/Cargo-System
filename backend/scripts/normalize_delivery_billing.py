from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Dict, List, Tuple


ROOT = Path(r"D:\Users\Desktop\CargoSystem")
STAGING_DIR = ROOT / "data" / "imports" / "staging" / "2-送货单及帐单"
OUT_DIR = ROOT / "data" / "imports" / "normalized"


def read_csv(path: Path) -> List[List[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return [[c.strip() for c in row] for row in csv.reader(f)]


def write_csv(path: Path, fieldnames: List[str], rows: List[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def normalize_text(s: str) -> str:
    return re.sub(r"\s+", "", s or "")


def parse_num(s: str) -> str:
    if not s:
        return ""
    s2 = s.replace(",", "").strip()
    try:
        return str(float(s2))
    except Exception:
        return ""


def find_value_near_label(rows: List[List[str]], label_patterns: List[str]) -> str:
    for row in rows[:8]:
        for i, c in enumerate(row):
            c0 = c.replace(" ", "")
            if any(p in c0 for p in label_patterns):
                if "：" in c:
                    right = c.split("：", 1)[1].strip()
                    if right:
                        return right
                if ":" in c:
                    right = c.split(":", 1)[1].strip()
                    if right:
                        return right
                if i + 1 < len(row) and row[i + 1].strip():
                    return row[i + 1].strip()
    return ""


def header_index_map(row: List[str]) -> Dict[str, int]:
    idx: Dict[str, int] = {}
    for i, c in enumerate(row):
        n = normalize_text(c)
        if not n:
            continue
        if "订单号" in n or "客户单号" in n or "采购单号" in n:
            idx.setdefault("order_no", i)
        if "指令" in n or "型体" in n or "货号" in n:
            idx.setdefault("instruction_no", i)
        if "料号" in n:
            idx.setdefault("product_code", i)
        if "品名" in n or "名称" in n or "材料名称" in n:
            idx.setdefault("product_name", i)
        if "规格" in n:
            idx.setdefault("spec", i)
        if "颜色" in n or "辅助属性" in n:
            idx.setdefault("color", i)
        if "数量" in n:
            idx.setdefault("qty", i)
        if n == "单位" or "单位" in n:
            idx.setdefault("unit", i)
        if "单价" in n:
            idx.setdefault("unit_price", i)
        if "金额" in n:
            idx.setdefault("amount", i)
        if "备注" in n:
            idx.setdefault("remark", i)
        if n in {"日期", "日期", "交货日期", "交货\n日期"} or "日期" in n:
            idx.setdefault("date", i)
        if "送货单号" in n or "货单号" in n:
            idx.setdefault("delivery_no", i)
    return idx


def is_break_row(row: List[str]) -> bool:
    t = "".join(row)
    return ("合计" in t) or ("以下空白" in t) or ("人民币大写" in t) or ("签章" in t) or ("附言" in t)


def find_header_row(rows: List[List[str]]) -> Tuple[int, Dict[str, int]]:
    for i, r in enumerate(rows[:16]):
        m = header_index_map(r)
        if "qty" in m and ("product_name" in m or "product_code" in m):
            return i, m
    return -1, {}


def parse_delivery_sheet(sheet_name: str, rows: List[List[str]]) -> Tuple[dict | None, List[dict]]:
    customer = find_value_near_label(rows, ["收货单位"])
    delivery_no = find_value_near_label(rows, ["NO.", "NO：", "送货单号"])
    delivery_date = find_value_near_label(rows, ["送货日期"])
    hidx, hmap = find_header_row(rows)
    if hidx < 0:
        return None, []

    items: List[dict] = []
    line_no = 0
    for r in rows[hidx + 1 :]:
        if not any(r):
            continue
        if is_break_row(r):
            break
        qty = parse_num(r[hmap["qty"]] if hmap.get("qty", -1) < len(r) else "")
        pname = r[hmap["product_name"]] if hmap.get("product_name", -1) < len(r) else ""
        pcode = r[hmap["product_code"]] if ("product_code" in hmap and hmap["product_code"] < len(r)) else ""
        if not qty and not pname and not pcode:
            continue
        if not qty:
            continue
        line_no += 1
        items.append(
            {
                "delivery_no": delivery_no,
                "line_no": line_no,
                "customer_name": customer,
                "delivery_date": delivery_date,
                "customer_order_no": r[hmap["order_no"]] if ("order_no" in hmap and hmap["order_no"] < len(r)) else "",
                "instruction_no": r[hmap["instruction_no"]] if ("instruction_no" in hmap and hmap["instruction_no"] < len(r)) else "",
                "product_code": pcode,
                "product_name": pname,
                "spec": r[hmap["spec"]] if ("spec" in hmap and hmap["spec"] < len(r)) else "",
                "color": r[hmap["color"]] if ("color" in hmap and hmap["color"] < len(r)) else "",
                "delivered_qty": qty,
                "unit": r[hmap["unit"]] if ("unit" in hmap and hmap["unit"] < len(r)) else "",
                "unit_price": parse_num(r[hmap["unit_price"]] if ("unit_price" in hmap and hmap["unit_price"] < len(r)) else ""),
                "amount": parse_num(r[hmap["amount"]] if ("amount" in hmap and hmap["amount"] < len(r)) else ""),
                "remark": r[hmap["remark"]] if ("remark" in hmap and hmap["remark"] < len(r)) else "",
                "source_sheet": sheet_name,
            }
        )

    if not delivery_no and items:
        delivery_no = f"AUTO-{sheet_name[:20]}-{line_no}"

    header = None
    if items:
        header = {
            "delivery_no": delivery_no,
            "customer_name": customer,
            "delivery_date": delivery_date,
            "source_sheet": sheet_name,
            "remarks": "",
        }
    return header, items


def parse_invoice_sheet(sheet_name: str, rows: List[List[str]]) -> List[dict]:
    customer = find_value_near_label(rows, ["TO"])
    hidx, hmap = find_header_row(rows)
    if hidx < 0:
        return []
    out: List[dict] = []
    for r in rows[hidx + 1 :]:
        if not any(r):
            continue
        if is_break_row(r):
            break
        delivery_no = r[hmap["delivery_no"]] if hmap.get("delivery_no", -1) < len(r) else ""
        amount = parse_num(r[hmap["amount"]] if hmap.get("amount", -1) < len(r) else "")
        qty = parse_num(r[hmap["qty"]] if hmap.get("qty", -1) < len(r) else "")
        if not delivery_no and not amount and not qty:
            continue
        out.append(
            {
                "delivery_no": delivery_no,
                "customer_name": customer,
                "invoice_date_raw": r[hmap["date"]] if ("date" in hmap and hmap["date"] < len(r)) else "",
                "customer_order_no": r[hmap["order_no"]] if ("order_no" in hmap and hmap["order_no"] < len(r)) else "",
                "instruction_no": r[hmap["instruction_no"]] if ("instruction_no" in hmap and hmap["instruction_no"] < len(r)) else "",
                "product_name": r[hmap["product_name"]] if ("product_name" in hmap and hmap["product_name"] < len(r)) else "",
                "spec": r[hmap["spec"]] if ("spec" in hmap and hmap["spec"] < len(r)) else "",
                "color": r[hmap["color"]] if ("color" in hmap and hmap["color"] < len(r)) else "",
                "qty": qty,
                "unit": r[hmap["unit"]] if ("unit" in hmap and hmap["unit"] < len(r)) else "",
                "unit_price": parse_num(r[hmap["unit_price"]] if ("unit_price" in hmap and hmap["unit_price"] < len(r)) else ""),
                "amount": amount,
                "remark": r[hmap["remark"]] if ("remark" in hmap and hmap["remark"] < len(r)) else "",
                "source_sheet": sheet_name,
            }
        )
    return out


def main() -> None:
    if not STAGING_DIR.exists():
        raise SystemExit(f"Staging directory not found: {STAGING_DIR}")

    delivery_orders: Dict[str, dict] = {}
    delivery_items: List[dict] = []
    invoice_lines: List[dict] = []

    for path in sorted(STAGING_DIR.glob("*.csv")):
        sheet_name = path.stem
        rows = read_csv(path)
        if not rows:
            continue
        if ("帐单" in sheet_name) or ("账单" in sheet_name):
            invoice_lines.extend(parse_invoice_sheet(sheet_name, rows))
            continue
        if "汇总表" in sheet_name:
            continue
        header, items = parse_delivery_sheet(sheet_name, rows)
        if header and header["delivery_no"]:
            delivery_orders[header["delivery_no"]] = header
        delivery_items.extend(items)

    # Derive invoices grouped by delivery_no from invoice lines
    invoices_map: Dict[str, dict] = {}
    for line in invoice_lines:
        dno = line["delivery_no"] or f"AUTO-INV-{line['source_sheet']}"
        key = dno
        if key not in invoices_map:
            invoices_map[key] = {
                "invoice_no": f"INV-{dno}"[:50],
                "delivery_no": dno,
                "customer_name": line["customer_name"],
                "invoice_date_raw": line["invoice_date_raw"],
                "total_amount": 0.0,
                "source_sheet": line["source_sheet"],
            }
        amt = float(line["amount"]) if line["amount"] else 0.0
        invoices_map[key]["total_amount"] += amt

    write_csv(
        OUT_DIR / "delivery_orders.csv",
        ["delivery_no", "customer_name", "delivery_date", "source_sheet", "remarks"],
        list(delivery_orders.values()),
    )
    write_csv(
        OUT_DIR / "delivery_order_items.csv",
        [
            "delivery_no",
            "line_no",
            "customer_name",
            "delivery_date",
            "customer_order_no",
            "instruction_no",
            "product_code",
            "product_name",
            "spec",
            "color",
            "delivered_qty",
            "unit",
            "unit_price",
            "amount",
            "remark",
            "source_sheet",
        ],
        delivery_items,
    )
    write_csv(
        OUT_DIR / "invoice_lines.csv",
        [
            "delivery_no",
            "customer_name",
            "invoice_date_raw",
            "customer_order_no",
            "instruction_no",
            "product_name",
            "spec",
            "color",
            "qty",
            "unit",
            "unit_price",
            "amount",
            "remark",
            "source_sheet",
        ],
        invoice_lines,
    )
    write_csv(
        OUT_DIR / "invoices.csv",
        ["invoice_no", "delivery_no", "customer_name", "invoice_date_raw", "total_amount", "source_sheet"],
        list(invoices_map.values()),
    )

    print(f"Generated delivery/invoice normalized files in: {OUT_DIR}")
    print(f"delivery_orders: {len(delivery_orders)}")
    print(f"delivery_order_items: {len(delivery_items)}")
    print(f"invoices: {len(invoices_map)}")
    print(f"invoice_lines: {len(invoice_lines)}")


if __name__ == "__main__":
    main()
