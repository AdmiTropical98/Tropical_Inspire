
# Walkthrough - Link Requisitions to Invoices

I have successfully linked Requisitions to the Accounting invoices view, treating them as Expenses.

## Changes Verified

### 1. Database & Schema
- Added `custo` column to `requisicoes` table in Supabase.
- Updated typescript interfaces to support `custo`.

### 2. Requisition Confirmation Logic
- When clicking "Concluir" on a pending Requisition, the modal now asks for:
    - **Numero da Fatura** (Invoice Number)
    - **Valor Total** (Amount in €)
- This ensures every confirmed requisition has an associated cost.

### 3. Accounting (Contabilidade)
- **Faturas Tab**: Now displays confirmed Requisitions mixed with Sales Invoices.
    - Requisitions are shown with negative/red values to indicate Expense.
    - "Cliente" column shows the Vendor/Supplier name for these items.
- **Dashboard**:
    - "Despesas Totais" now includes the sum of all confirmed requisitions.
    - "Distribuição de Custos" chart now includes a "Requisições" category.

### 4. Rentals Display (Alugueres)
- **Grouping**: Rentals are now grouped by **Client** and **Month/Year** only.
    - This consolidates multiple cost centers for the same client in the same month into a single group.
- **Cost Centers**: 
    - **Group View**: Displays "Vários Centros de Custo" if the group contains mixed cost centers.
    - **Detail View**: Only when expanded does the list show the details. If multiple Cost Centers exist, items are visually grouped under **Cost Center Sub-headers** for clarity.
- **Terminology**: Replaced "Faturas" with "Relatórios" in the list view.

## How to Test

1.  **Navigate to Requisições**:
    - Create a new valid requisition (or pick a pending one).
2.  **Confirm**:
    - Click "Concluir".
    - Enter Invoice: `FT-EXP-001`
    - Enter Amount: `123.45`
    - Click Confirm.
3.  **Check Accounting**:
    - Go to `Contabilidade` -> `Faturas`.
    - Find `FT-EXP-001` in the list.
    - Verify Value is `-123.45 €` (Red).
4.  **Check Rentals**:
    - Go to `Alugueres`.
    - Verify groups are by Client/Month.
    - Expand a group with multiple cost centers to see "Vários" in header and specific names in details.


### 5. Accounting Overhaul (Professional Suite)
- **Dashboard**: New real-time financial dashboard with P&L, KPI cards (Revenue, Expenses, Net Profit), and charts.
- **Unified Expenses**: Centralized view merging:
    - Fuel Transactions
    - Maintenance Records
    - Confirmed Requisitions
    - Manual/Fixed Expenses
- **Fixed Costs Manager**: New module to manage recurring expenses (Rent, Utilities, Subscriptions).
- **Financial Context**: Created `FinancialContext` to aggregate data from all disparate modules into a single financial stream.

## How to Test

1.  **Navigate to Requisições**:
    - Create a new valid requisition (or pick a pending one).
2.  **Confirm**:
    - Click "Concluir".
    - Enter Invoice: `FT-EXP-001`
    - Enter Amount: `123.45`
    - Click Confirm.
3.  **Check Accounting**:
    - Go to `Contabilidade` -> `Despesas` (New Tab).
    - Verify the Requisition appears as a unified expense line.
    - Check the Dashboard for updated totals.
4.  **Fixed Costs**:
    - Go to `Contabilidade` -> `Custos Fixos`.
    - Add a new recurring cost (e.g., Internet).
    - Verify it appears in the list and affects the dashboard.

## Files Modified
- `src/types.ts`
- `src/contexts/FinancialContext.tsx` [NEW]
- `src/components/Contabilidade/index.tsx`
- `src/components/Contabilidade/ExpensesList.tsx` [NEW]
- `src/components/Contabilidade/FixedCostsManager.tsx` [NEW]
- `src/components/Contabilidade/Faturas.tsx`
- `src/components/Contabilidade/Alugueres.tsx`

# Deployment Fix

I have corrected the GitHub Actions deployment workflow to target the correct directory on the Hostinger FTP server.

## Problem
The deployment was failing because the FTP `server-dir` was configured to `./` instead of the required `public_html/`.

## Solution
Updated `.github/workflows/deploy.yml`:
- Changed `server-dir` from `./` to `public_html/`.

## Verification
- Use the **Link to Deployment** provided by GitHub Actions (or check the website).
- Verify that the **Geofences** tab is now visible in the application sidebar, confirming the new code (including the geofences feature) has been successfully deployed.
