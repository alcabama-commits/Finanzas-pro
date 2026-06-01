import { getCachedToken } from './firebase';

const DRIVE_FOLDER_ID = '1iAYe9ovNugUIgv0vTVswLkPifw4h981B';

export async function uploadLogoToDrive(file: File): Promise<{ fileId: string; viewUrl: string }> {
  const token = getCachedToken();
  if (!token) {
    throw new Error('No se detectó la sesión autorizada de Google Drive. Por favor, vuelve a iniciar sesión o autoriza los accesos.');
  }

  const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const metadata = {
    name: fileName,
    parents: [DRIVE_FOLDER_ID]
  };

  const boundary = '314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const header = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${file.type}\r\n\r\n`;

  const bodyBlob = new Blob([header, file, closeDelimiter], {
    type: `multipart/related; boundary=${boundary}`
  });

  const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: bodyBlob
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Error de Google Drive (${uploadResponse.status}): ${errorText}`);
  }

  const uploadData = await uploadResponse.json();
  const fileId = uploadData.id;

  // Intentar crear permisos públicos para que cualquier persona con el link pueda renderizar el logo
  try {
    const permResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
    if (!permResponse.ok) {
      console.warn('Failed to set public permissions on file:', await permResponse.text());
    }
  } catch (e) {
    console.error('Error setting public permissions:', e);
  }

  // URL directa de renderizado (usando thumbnail para que cargue rapidísimo y sin límites estrictos)
  const viewUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w128`;
  return { fileId, viewUrl };
}
