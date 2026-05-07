from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, List


ROOT = Path(r"D:\Users\Desktop\CargoSystem")
STAGING_ROOT = ROOT / "data" / "imports" / "staging"
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


def main() -> None:
    workbook_dir = STAGING_ROOT / "1-接单汇总及入库"
    if not workbook_dir.exists():
        raise SystemExit("Missing staging data for 1-接单汇总及入库. Run extract script first.")

    # Usually first sheet is "2025接单汇总.csv"
    source_candidates = sorted(workbook_dir.glob("*.csv"))
    if not source_candidates:
        raise SystemExit("No staging csv found in workbook directory.")
    source = source_candidates[0]
    rows = read_csv(source)

    header_idx = -1
    for i, r in enumerate(rows):
        if len(r) > 0 and r[0] == "接单日期":
            header_idx = i
            break
    if header_idx < 0:
        raise SystemExit("Cannot find header row (接单日期).")

    data = rows[header_idx + 2 :]

    customers: Dict[str, dict] = {}
    suppliers: Dict[str, dict] = {}
    products: Dict[str, dict] = {}
    orders: Dict[str, dict] = {}
    order_items: List[dict] = []
    receipt_seed: List[dict] = []
    order_line_no: Dict[str, int] = {}

    def col(r: List[str], idx: int) -> str:
        return r[idx] if idx < len(r) else ""

    for r in data:
        if not any(r):
            continue
        order_date = col(r, 0)
        customer = col(r, 2)
        external_order_no = col(r, 3)
        product_code = col(r, 6).replace("\n", " ").strip()
        product_name = col(r, 8)
        spec = col(r, 11)
        color = col(r, 12)
        ordered_qty = col(r, 13)
        unit = col(r, 14) or "Y"
        remarks = col(r, 15)
        supplier = col(r, 16)
        supplier_date = col(r, 17)
        supplier_qty = col(r, 18)

        if customer:
            customers[customer] = {"customer_code": customer[:50], "name": customer}
        if supplier and supplier != "扣库":
            suppliers[supplier] = {"supplier_code": supplier[:50], "name": supplier}
        if product_code:
            products[product_code] = {
                "product_code": product_code[:80],
                "name": product_name or product_code,
                "spec": spec,
                "color": color,
                "base_unit": unit,
            }

        if external_order_no:
            if external_order_no not in orders:
                orders[external_order_no] = {
                    "external_order_no": external_order_no,
                    "customer_name": customer,
                    "order_date": order_date,
                    "remarks": remarks,
                }
                order_line_no[external_order_no] = 0

            order_line_no[external_order_no] += 1
            order_items.append(
                {
                    "external_order_no": external_order_no,
                    "line_no": order_line_no[external_order_no],
                    "product_code": product_code,
                    "product_name": product_name,
                    "color": color,
                    "ordered_qty": ordered_qty,
                    "unit": unit,
                    "supplier_name": supplier,
                    "supplier_delivery_date": supplier_date,
                    "supplier_qty": supplier_qty,
                    "remarks": remarks,
                }
            )

        if supplier and supplier_qty:
            receipt_seed.append(
                {
                    "supplier_name": supplier,
                    "receipt_date": supplier_date,
                    "product_code": product_code,
                    "product_name": product_name,
                    "received_qty": supplier_qty,
                    "unit": unit,
                    "related_external_order_no": external_order_no,
                }
            )

    write_csv(
        OUT_DIR / "customers.csv",
        ["customer_code", "name"],
        list(customers.values()),
    )
    write_csv(
        OUT_DIR / "suppliers.csv",
        ["supplier_code", "name"],
        list(suppliers.values()),
    )
    write_csv(
        OUT_DIR / "products.csv",
        ["product_code", "name", "spec", "color", "base_unit"],
        list(products.values()),
    )
    write_csv(
        OUT_DIR / "sales_orders.csv",
        ["external_order_no", "customer_name", "order_date", "remarks"],
        list(orders.values()),
    )
    write_csv(
        OUT_DIR / "sales_order_items.csv",
        [
            "external_order_no",
            "line_no",
            "product_code",
            "product_name",
            "color",
            "ordered_qty",
            "unit",
            "supplier_name",
            "supplier_delivery_date",
            "supplier_qty",
            "remarks",
        ],
        order_items,
    )
    write_csv(
        OUT_DIR / "purchase_receipt_items_seed.csv",
        [
            "supplier_name",
            "receipt_date",
            "product_code",
            "product_name",
            "received_qty",
            "unit",
            "related_external_order_no",
        ],
        receipt_seed,
    )

    print(f"Normalized csv generated in: {OUT_DIR}")


if __name__ == "__main__":
    main()
