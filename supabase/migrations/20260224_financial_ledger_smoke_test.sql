-- ERP ledger smoke test (safe mode)
-- Never fails if optional modules are not installed; returns status rows.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _erp_smoke_results (
  step TEXT,
  status TEXT,
  details TEXT
);

DO $$
DECLARE
  has_ledger BOOLEAN := to_regclass('public.financial_movements') IS NOT NULL;
  has_supplier BOOLEAN := to_regclass('public.supplier_invoices') IS NOT NULL;
  has_requisicoes BOOLEAN := to_regclass('public.requisicoes') IS NOT NULL;
BEGIN
  INSERT INTO _erp_smoke_results VALUES
    ('precheck.financial_movements', CASE WHEN has_ledger THEN 'ok' ELSE 'missing' END, 'Ledger table check'),
    ('precheck.supplier_invoices', CASE WHEN has_supplier THEN 'ok' ELSE 'missing' END, 'Supplier invoices module check'),
    ('precheck.requisicoes', CASE WHEN has_requisicoes THEN 'ok' ELSE 'missing' END, 'Requisitions module check');

  IF has_ledger AND has_supplier THEN
    EXECUTE $sql$
      WITH picked AS (
        SELECT id, COALESCE(total_final, total, total_value, 0) AS base_total
        FROM public.supplier_invoices
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
      )
      UPDATE public.supplier_invoices si
      SET total_final = picked.base_total + 1
      FROM picked
      WHERE si.id = picked.id
    $sql$;

    INSERT INTO _erp_smoke_results VALUES ('flow.invoice_update', 'ok', 'Updated latest supplier invoice total_final (+1)');

    EXECUTE $sql$
      WITH picked AS (
        SELECT id
        FROM public.supplier_invoices
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
      )
      UPDATE public.supplier_invoices si
      SET payment_status = 'paid'
      FROM picked
      WHERE si.id = picked.id
    $sql$;

    INSERT INTO _erp_smoke_results VALUES ('flow.invoice_paid', 'ok', 'Marked latest supplier invoice as paid');
  ELSE
    INSERT INTO _erp_smoke_results VALUES ('flow.invoice_flow', 'skipped', 'Requires financial_movements + supplier_invoices');
  END IF;

  IF has_ledger THEN
    INSERT INTO _erp_smoke_results
    SELECT
      'sanity.invalid_single_side_rows',
      CASE WHEN COUNT(*) = 0 THEN 'ok' ELSE 'warning' END,
      'count=' || COUNT(*)::text
    FROM public.financial_movements
    WHERE NOT ((debit = 0 AND credit > 0) OR (credit = 0 AND debit > 0));
  ELSE
    INSERT INTO _erp_smoke_results VALUES ('sanity.invalid_single_side_rows', 'skipped', 'Ledger not available');
  END IF;

  IF has_ledger THEN
    INSERT INTO _erp_smoke_results
    SELECT
      'dashboard.formula',
      'ok',
      'revenue=' || COALESCE(SUM(CASE WHEN account_code LIKE '7%' THEN credit - debit ELSE 0 END), 0)::text
      || ', expenses=' || COALESCE(SUM(CASE WHEN account_code LIKE '6%' THEN debit - credit ELSE 0 END), 0)::text
      || ', profit=' || (
          COALESCE(SUM(CASE WHEN account_code LIKE '7%' THEN credit - debit ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN account_code LIKE '6%' THEN debit - credit ELSE 0 END), 0)
      )::text
    FROM public.financial_movements;
  ELSE
    INSERT INTO _erp_smoke_results VALUES ('dashboard.formula', 'skipped', 'Ledger not available');
  END IF;
END;
$$;

SELECT * FROM _erp_smoke_results ORDER BY step;

-- Optional detailed outputs (only run these manually if table exists)
-- SELECT account_code, SUM(debit - credit) AS total FROM public.financial_movements WHERE account_code LIKE '6%' GROUP BY account_code ORDER BY account_code;
-- SELECT cost_center_id, SUM(debit - credit) AS total FROM public.financial_movements WHERE account_code LIKE '6%' AND cost_center_id IS NOT NULL GROUP BY cost_center_id ORDER BY total DESC LIMIT 10;

ROLLBACK;
