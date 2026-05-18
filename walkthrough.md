# Walkthrough - Via Verde and Carregamentos Fixes

I have applied critical fixes to the application code, but a **database update is required** to make it work.

## 1. Code Fixes (Applied)
- **Manual Registration**: Fixed a bug where `created_by` was missing, causing the database to reject new records.
- **Error Messages**: Added detailed error messages (e.g., "Misisng permission", "Invalid Date") instead of a generic "Erro".
- **Import Logic**: Improved Excel date parsing to handle text, numbers, and Date objects.

## 2. Database Update (REQUIRED)
The "Manual Registration" and "Import" failures are likely due to missing permissions or table definitions in your Supabase database.

> [!IMPORTANT]
> **You must run the provided SQL script to fix the database.**

### How to Apply the Fix:
1.  Download or copy the content of [supabase_fix.sql](file:///c:/Users/mglma/.gemini/antigravity/brain/b4e426ed-1abb-474b-87d7-e4ff07b6774d/supabase_fix.sql).
2.  Go to your **Supabase Dashboard** -> **SQL Editor**.
3.  Paste the SQL content.
4.  Click **Run**.

This script will:
- Ensure the tables `via_verde_toll_records` and `electric_charging_records` exist.
- Grant `INSERT` and `SELECT` permissions to authenticated users (fixing the "Permission denied" or "new row violates RLS" errors).

## 3. Verification & Troubleshooting
After running the SQL:
1.  Try **Novo Registo** again. It should now succeed.
2.  Try **Importar** again. It should now work with the improved parsing logic (handles commas in numbers).

### Still not working?
I have added a new **"Diagnóstico (TESTE)"** button inside the **"Novo Registo"** modal (Both in Via Verde and Carregamentos).
1. Click **Novo Registo**.
2. Click the red **Diagnóstico (TESTE)** button.
3. It will tell you EXACTLY if the table exists or if permissions are wrong.

If it says "Tabela não existe", you **MUST** run the SQL script.

### New Feature: Bulk Delete (Via Verde)
To delete tolls faster:
1.  Click the **checkbox** in the table header to **Select All**.
2.  Or select individual rows.
3.  Click the red **"Eliminar (N)"** button at the top.

### New Feature: Parking Support (Via Verde)
You can now distinguish between **Tolls** and **Parking**.
- **Manual**: Use the toggle button at the top of the form.
- **Import**: Add a column "Tipo" to your Excel with "Estacionamento" or "Portagem".
- **Table**: Parking records show a blue Parking icon <img src="https://lucide.dev/icons/circle-parking" width="16" height="16" />.

### Financial Integration
- **Accounting**: Via Verde (Tolls/Parking) and Electric Charging records now automatically appear in the **Accounting** (Contabilidade) module as expenses.
- **Cost Centers**: 
    - **Totals**: "Combustível" now includes Electric Charging costs. "Requisições" (or separate line) includes Tolls/Parking.
    - **Reports**: The PDF report and Detailed View for each Cost Center now have dedicated sections for "Via Verde / Portagens" and "Carregamentos", ensuring all costs are visible.
- **Breakdown**:
    - **Combustível**: Fuel only (Blue).
    - **Carregamentos**: Electric Charging only (Cyan).
    - **Via Verde**: Tolls + Parking (Green).
    - **Requisições**: Parts & Service (Amber).
    - **Mão de Obra**: Labor costs (Indigo).

### 4. Fix Missing Cost Centers (0.00€ Totals)
If your charts show **0.00€** for Via Verde/Charging despite having data, it's because the records are not linked to a Cost Center.

**Solution:**
I have created two scripts to fix this.

1. **Add Cost Center to Vehicles (First Run This)**:
   Download and run [add_cost_center_to_vehicles.sql](file:///c:/Users/mglma/.gemini/antigravity/brain/b4e426ed-1abb-474b-87d7-e4ff07b6774d/add_cost_center_to_vehicles.sql). This adds the missing field to the Vehicles table.

2. **Assign Cost Centers**:
   Go to the **Viaturas** page, click on a vehicle, and select its Cost Center.

3. **Backfill Existing Records**:
   Download and run [fix_missing_cost_centers.sql](file:///c:/Users/mglma/.gemini/antigravity/brain/b4e426ed-1abb-474b-87d7-e4ff07b6774d/fix_missing_cost_centers.sql). This links all existing Via Verde/Charging records to the Vehicle's Cost Center.

**Future Imports:**
I have updated the Import logic. From now on, if you don't specify a Cost Center in the Excel file, the system will **automatically** use the one assigned to the Vehicle.
