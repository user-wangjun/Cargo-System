from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence

import psycopg2
from psycopg2.extras import RealDictCursor


ROOT = Path(r"D:\Users\Desktop\CargoSystem")
REPORT_PATH = ROOT / "data" / "imports" / "logs" / "validation-report.md"
TODO_CSV_PATH = ROOT / "data" / "imports" / "logs" / "validation-todos.csv"


def get_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        dbname=os.getenv("DB_NAME", "cargosystem"),
    )


def fetch_all(cur: RealDictCursor, sql: str, params: Sequence[Any] | None = None) -> List[dict]:
    cur.execute(sql, params or ())
    rows = cur.fetchall()
    return [dict(r) for r in rows]


def md_table(rows: Iterable[dict], columns: List[str]) -> str:
    rows = list(rows)
    if not rows:
        return "_无数据_\n"
    header = "| " + " | ".join(columns) + " |"
    sep = "| " + " | ".join(["---"] * len(columns)) + " |"
    body = []
    for r in rows:
        body.append("| " + " | ".join(str(r.get(c, "")) for c in columns) + " |")
    return "\n".join([header, sep, *body]) + "\n"


def to_float(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def evaluate_findings(
    diff_amount: List[dict],
    diff_qty: List[dict],
    missing_checks: List[dict],
    uninvoiced: List[dict],
) -> List[Dict[str, str]]:
    findings: List[Dict[str, str]] = []
    miss = {str(r.get("check_name")): int(r.get("value") or 0) for r in missing_checks}
    amount_diff = abs(to_float(diff_amount[0].get("diff"))) if diff_amount else 0.0
    qty_diff = abs(to_float(diff_qty[0].get("diff"))) if diff_qty else 0.0
    uninvoiced_count = len(uninvoiced)

    if miss.get("orphan_delivery_items", 0) > 0:
        findings.append(
            {
                "priority": "P0",
                "rule": "孤儿出货明细",
                "value": str(miss["orphan_delivery_items"]),
                "risk": "出货数据结构损坏，库存与单据追溯不可信",
                "suggestion": "先修复 delivery_order_id 关联，再进行任何业务过账",
            }
        )
    if miss.get("invoice_missing_customer", 0) > 0 or miss.get("delivery_missing_customer", 0) > 0:
        findings.append(
            {
                "priority": "P0",
                "rule": "单据缺失客户主数据",
                "value": f"invoice={miss.get('invoice_missing_customer', 0)}, delivery={miss.get('delivery_missing_customer', 0)}",
                "risk": "应收归属不明确，账款与客户报表失真",
                "suggestion": "补齐 customers 映射，再重新执行 03 导入 SQL",
            }
        )
    if amount_diff >= 1:
        findings.append(
            {
                "priority": "P1",
                "rule": "发票金额对账差异",
                "value": f"{amount_diff:.2f}",
                "risk": "财务对账不平，影响请款与回款核销",
                "suggestion": "核查 import_stg.invoices 与 invoices 的金额口径（含小缸费/税额）",
            }
        )
    if qty_diff >= 0.001:
        findings.append(
            {
                "priority": "P1",
                "rule": "出货数量对账差异",
                "value": f"{qty_diff:.3f}",
                "risk": "库存台账与历史送货数量不一致",
                "suggestion": "核查单位换算和被过滤行（空数量/合计行）",
            }
        )
    if uninvoiced_count > 0:
        level = "P1" if uninvoiced_count >= 20 else "P2"
        findings.append(
            {
                "priority": level,
                "rule": "送货单未关联合同发票",
                "value": str(uninvoiced_count),
                "risk": "存在漏开票或开票未回写送货单风险",
                "suggestion": "按 delivery_no 批量回填 invoices.delivery_order_id 或补开票",
            }
        )

    if not findings:
        findings.append(
            {
                "priority": "OK",
                "rule": "未发现阻塞性异常",
                "value": "0",
                "risk": "低",
                "suggestion": "可以进入联调/试运行",
            }
        )
    return findings


def write_todo_csv(findings: List[Dict[str, str]]) -> None:
    import csv

    rows = [f for f in findings if f.get("priority") in {"P0", "P1", "P2"}]
    TODO_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with TODO_CSV_PATH.open("w", encoding="utf-8-sig", newline="") as f:
      w = csv.DictWriter(
          f,
          fieldnames=["priority", "rule", "value", "risk", "suggestion", "owner_hint", "status"],
      )
      w.writeheader()
      for r in rows:
          owner = "数据工程" if r["priority"] == "P0" else "业务+财务"
          w.writerow(
              {
                  "priority": r["priority"],
                  "rule": r["rule"],
                  "value": r["value"],
                  "risk": r["risk"],
                  "suggestion": r["suggestion"],
                  "owner_hint": owner,
                  "status": "TODO",
              }
          )


def main() -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            master_counts = fetch_all(
                cur,
                """
                select 'customers' as metric, count(*)::bigint as value from customers
                union all select 'suppliers', count(*)::bigint from suppliers
                union all select 'products', count(*)::bigint from products
                union all select 'units', count(*)::bigint from units
                union all select 'warehouses', count(*)::bigint from warehouses
                """,
            )

            trx_counts = fetch_all(
                cur,
                """
                select 'sales_orders' as metric, count(*)::bigint as value from sales_orders
                union all select 'sales_order_items', count(*)::bigint from sales_order_items
                union all select 'delivery_orders', count(*)::bigint from delivery_orders
                union all select 'delivery_order_items', count(*)::bigint from delivery_order_items
                union all select 'invoices', count(*)::bigint from invoices
                """,
            )

            diff_amount = fetch_all(
                cur,
                """
                select
                  coalesce(sum(total_amount), 0)::numeric(18,2) as biz_invoice_total,
                  coalesce((select sum(total_amount) from import_stg.invoices), 0)::numeric(18,2) as stg_invoice_total,
                  (coalesce(sum(total_amount), 0) - coalesce((select sum(total_amount) from import_stg.invoices), 0))::numeric(18,2) as diff
                from invoices
                """,
            )

            diff_qty = fetch_all(
                cur,
                """
                select
                  coalesce(sum(delivered_qty), 0)::numeric(18,3) as biz_delivery_qty,
                  coalesce((select sum(delivered_qty) from import_stg.delivery_order_items), 0)::numeric(18,3) as stg_delivery_qty,
                  (coalesce(sum(delivered_qty), 0) - coalesce((select sum(delivered_qty) from import_stg.delivery_order_items), 0))::numeric(18,3) as diff
                from delivery_order_items
                """,
            )

            missing_checks = fetch_all(
                cur,
                """
                select 'orphan_delivery_items' as check_name, (
                  select count(*)::bigint
                  from delivery_order_items doi
                  left join delivery_orders d on d.id = doi.delivery_order_id
                  where d.id is null
                ) as value
                union all
                select 'invoice_missing_customer', (
                  select count(*)::bigint
                  from invoices i
                  left join customers c on c.id = i.customer_id
                  where c.id is null
                )
                union all
                select 'delivery_missing_customer', (
                  select count(*)::bigint
                  from delivery_orders d
                  left join customers c on c.id = d.customer_id
                  where c.id is null
                )
                """,
            )

            top_customers = fetch_all(
                cur,
                """
                select
                  c.name as customer_name,
                  count(i.id)::bigint as invoice_count,
                  coalesce(sum(i.total_amount), 0)::numeric(18,2) as total_amount
                from invoices i
                join customers c on c.id = i.customer_id
                group by c.name
                order by total_amount desc
                limit 20
                """,
            )

            uninvoiced = fetch_all(
                cur,
                """
                select
                  d.delivery_no,
                  c.name as customer_name,
                  d.delivery_date
                from delivery_orders d
                join customers c on c.id = d.customer_id
                left join invoices i on i.delivery_order_id = d.id
                where i.id is null
                order by d.delivery_date desc
                limit 100
                """,
            )

            so_status = fetch_all(
                cur,
                "select status, count(*)::bigint as count from sales_orders group by status order by count(*) desc",
            )
            do_status = fetch_all(
                cur,
                "select status, count(*)::bigint as count from delivery_orders group by status order by count(*) desc",
            )

    findings = evaluate_findings(diff_amount, diff_qty, missing_checks, uninvoiced)

    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    content = []
    content.append(f"# CargoSystem 导入验收报告\n\n生成时间：`{ts}`\n")
    content.append("## 1. 主数据数量\n")
    content.append(md_table(master_counts, ["metric", "value"]))
    content.append("## 2. 交易数据数量\n")
    content.append(md_table(trx_counts, ["metric", "value"]))
    content.append("## 3. 对账差异（金额）\n")
    content.append(md_table(diff_amount, ["biz_invoice_total", "stg_invoice_total", "diff"]))
    content.append("## 4. 对账差异（数量）\n")
    content.append(md_table(diff_qty, ["biz_delivery_qty", "stg_delivery_qty", "diff"]))
    content.append("## 5. 缺失关联检查\n")
    content.append(md_table(missing_checks, ["check_name", "value"]))
    content.append("## 6. 异常分级与修复建议\n")
    content.append(md_table(findings, ["priority", "rule", "value", "risk", "suggestion"]))
    content.append("## 7. 客户应收 Top20\n")
    content.append(md_table(top_customers, ["customer_name", "invoice_count", "total_amount"]))
    content.append("## 8. 未关联合同发票的送货单（Top100）\n")
    content.append(md_table(uninvoiced, ["delivery_no", "customer_name", "delivery_date"]))
    content.append("## 9. 销售订单状态分布\n")
    content.append(md_table(so_status, ["status", "count"]))
    content.append("## 10. 送货单状态分布\n")
    content.append(md_table(do_status, ["status", "count"]))

    REPORT_PATH.write_text("\n".join(content), encoding="utf-8")
    write_todo_csv(findings)
    print(f"Validation report generated: {REPORT_PATH}")
    print(f"Validation todo csv generated: {TODO_CSV_PATH}")


if __name__ == "__main__":
    main()
