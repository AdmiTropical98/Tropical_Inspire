# Task: Fix Via Verde and Carregamentos Import/Registration

- [x] Investigate `src/pages/Carregamentos/index.tsx` for import/registration logic errors. <!-- id: 0 -->
- [x] Investigate `src/pages/ViaVerde/index.tsx` for import/registration logic errors. <!-- id: 1 -->
- [x] Check Supabase tables and RLS policies. <!-- id: 2 -->
    - [x] Find migration files (created new one `fix_records_schema_and_rls.sql`).
    - [x] Verify column constraints (Fixed `created_by` in code).
    - [x] Check RLS policies (Created SQL fix script).
- [x] Debug "Manual Registration" failure. <!-- id: 3 -->
    - [x] Review `handleSubmit` payload vs Schema (Found missing `created_by`).
- [x] Fix identified issues in `Carregamentos` and `ViaVerde`. <!-- id: 4 -->
- [x] Verify fixes (User must run SQL script). <!-- id: 5 -->
- [x] Push changes to remote. <!-- id: 6 -->
- [/] Attempt Supabase MCP connection to fix DB directly. <!-- id: 7 -->
- [x] Implement robust number parsing (comma handling). <!-- id: 8 -->
- [x] Add visible "Connection Test" or debug logging in UI. <!-- id: 9 -->
- [x] Create in-app "System Diagnostic" to confirm DB state (Carregamentos). <!-- id: 10 -->
- [x] Create in-app "System Diagnostic" to confirm DB state (Via Verde). <!-- id: 11 -->
- [x] Implement Bulk Delete for Via Verde. <!-- id: 13 -->
- [x] Add "Parking" support to Via Verde (Type column). <!-- id: 14 -->
- [x] Integrate Via Verde & Carregamentos with Accounting (Auto-create Expenses?). <!-- id: 15 -->
- [x] Fix Cost Center Totals to include Via Verde (Tolls/Parking) and Charging. <!-- id: 16 -->
    - [x] Resolved `useFinancial` context error by moving `FinancialProvider` to Global App level.
    - [x] Created SQL script to backfill missing `cost_center_id` on existing records.
    - [x] Created SQL migration `add_cost_center_to_vehicles.sql` to add column to Viaturas table.
    - [x] Updated Import logic to automatically inherit Cost Center from Vehicle.
    - [x] Separate Via Verde & Charging in Cost Center Screens

