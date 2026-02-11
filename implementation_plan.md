# Cost Center Breakdown Plan

## Goal
Separate Via Verde (Tolls) and Electric Charging costs from "Requisitions" and "Fuel" totals in the Cost Center card view and detailed modal.

## User Review Required
None. This is a purely visual/reporting enhancement requested by the user.

## Proposed Changes

### `src/pages/CentrosCustos/index.tsx`

#### [MODIFY] CentrosCustos Card Logic
- Separate `fuelExpenses` calculation into `fuelOnly` and `chargingExpenses`.
- Separate `reqExpenses` calculation into `reqOnly` and `tollsExpenses`.
- Update the "Financial View" progress bar and legend to show 5 distinct categories:
    1. **Fuel** (Blue)
    2. **Charging** (Cyan/Sky)
    3. **Tolls** (Green)
    4. **Requisitions** (Amber)
    5. **Labor** (Emerald) - *Wait, previous code had Labor as Emerald. I should check colors.*

#### [MODIFY] CentrosCustos Detailed Modal
- **Stats Grid**: Ensure 5 distinct boxes are shown (Fuel, Charging, Tolls, Reqs, Labor). Currently Charging is missing or merged.
- **Tables**: Add specific tables for "Via Verde History" and "Charging History" below the existing tables, or add tabs to switch between them to save space. Given the "Detailed Report" nature, stacking them is fine.

## Verification Plan
### Manual Verification
- Open "Centros de Custos".
- Verify the Card now shows distinct values for Via Verde and Charging in the legend/bar.
- Click "Ver Relatório" (Modal).
- Verify distinct Stat Boxes for all 5 categories.
- Verify distinct Tables for Fuel, Reqs, Via Verde, and Charging.
