import { getCachedToken } from './firebase';

const SPREADSHEET_ID = '1zwY4dQdaaLnoMOEkkDG6iBICalb1rpr2LPsnHVMaLCM';

export interface SheetRow {
  fecha: string;
  producto: string;
  categoria: string;
  subcategoria: string;
  lugarCompra: string;
  precio: number;
  cantidad: number;
  tipo: 'Regular' | 'Esporádica';
  existencias: number;
}

/**
 * Appends a list of columns as a row in the Google Sheets spreadsheet.
 * Handles token presence verification and attempts multi-language fallback for sheet range.
 */
export async function appendPurchaseToSheet(row: SheetRow): Promise<void> {
  const token = getCachedToken();
  if (!token) {
    throw new Error('No se detectó la sesión autorizada de Google Sheets. Por favor, vuelve a iniciar sesión o haz clic en "Autorizar Google Sheets".');
  }

  const values = [
    [
      row.fecha,
      row.producto,
      row.categoria,
      row.subcategoria || 'N/A',
      row.lugarCompra || 'No especificado',
      row.precio,
      row.cantidad,
      row.tipo,
      row.existencias
    ]
  ];

  // Try standard range names in sequence to handle localized sheet files (Sheet1 vs Hoja 1 vs general A:H)
  const rangesToTry = ['A:I', 'Sheet1!A:I', 'Hoja 1!A:I'];
  let lastError: any = null;

  for (const range of rangesToTry) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range,
          majorDimension: 'ROWS',
          values,
        }),
      });

      if (response.ok) {
        console.log(`Successfully appended to Google Sheet with range: ${range}`);
        return; // Success!
      }

      const errText = await response.text();
      lastError = new Error(`HTTP error ${response.status}: ${errText}`);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('No se pudo guardar la compra en Google Sheets. Por favor verifique los accesos.');
}

/**
 * Fetches sheet info from the target Google Sheets spreadsheet.
 * Useful to verify read/write permission and check sheet existances.
 */
export async function verifySheetConnection(): Promise<any> {
  const token = getCachedToken();
  if (!token) {
    throw new Error('Token de Google Sheets no disponible.');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error de conexión con Sheets (${response.status}): ${errText}`);
  }

  return await response.json();
}
