import { formatCurrency, formatDateTime } from "@/lib/format";

export interface PdfProductItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  updatedAt?: string;
}

export interface GeneratePriceListPdfOptions {
  labName?: string;
  protesistaName?: string;
  categoryFilter?: string;
  products: PdfProductItem[];
}

/**
 * Convierte texto Unicode a secuencia segura ASCII con escapes octales WinAnsi (Windows-1252)
 * para que todos los acentos en español (á, é, í, ó, ú, ñ, etc.) se vean perfectos en PDF.
 */
function encodePdfText(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    // Mapear algunos caracteres comunes fuera de Latin-1 a equivalentes WinAnsi
    if (code === 0x2013 || code === 0x2014) code = 0x2d; // guiones largos -> '-'
    if (code === 0x2018 || code === 0x2019) code = 0x27; // comillas simples
    if (code === 0x201c || code === 0x201d) code = 0x22; // comillas dobles
    if (code === 0x2022) code = 0xb7; // bullet -> punto medio

    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      // Escapar paréntesis y barra invertida
      out += "\\" + String.fromCharCode(code);
    } else if (code >= 0x20 && code <= 0x7e) {
      out += String.fromCharCode(code);
    } else if (code >= 0xa0 && code <= 0xff) {
      out += "\\" + code.toString(8).padStart(3, "0");
    } else {
      out += " ";
    }
  }
  return out;
}

/**
 * Estima el ancho aproximado de un texto en Helvetica para alinear a la derecha o truncar.
 */
function estimateTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ("ilI.,:;!|1' ".includes(ch)) units += 0.28;
    else if ("mwMW@#%&".includes(ch)) units += 0.82;
    else if (ch >= "A" && ch <= "Z") units += 0.66;
    else units += 0.53;
  }
  return units * fontSize;
}

function truncateToWidth(
  text: string,
  maxWidth: number,
  fontSize: number
): string {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  let trimmed = text;
  while (
    trimmed.length > 0 &&
    estimateTextWidth(trimmed + "...", fontSize) > maxWidth
  ) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed + "...";
}

/**
 * Genera un archivo PDF 1.4 vectorial (tamaño A4) con la lista de precios agrupada por categoría.
 */
export function generatePriceListPdfBytes(
  options: GeneratePriceListPdfOptions
): Uint8Array {
  const labName = options.labName || "Laboratorio de Prótesis Dental";
  const protesistaName = options.protesistaName || "";
  const products = options.products;

  // Dimensiones A4 en puntos (72 dpi)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;

  // Agrupar productos por categoría manteniendo orden
  const grouped = new Map<string, PdfProductItem[]>();
  for (const prod of products) {
    const cat = prod.category || "General";
    const list = grouped.get(cat) || [];
    list.push(prod);
    grouped.set(cat, list);
  }

  const pagesCommands: string[][] = [];
  let currentCommands: string[] = [];
  let cursorY = 0;

  const startNewPage = (isFirstPage: boolean) => {
    if (currentCommands.length > 0) {
      pagesCommands.push(currentCommands);
    }
    currentCommands = [];

    if (isFirstPage) {
      // Banner superior oscuro (A4 top)
      currentCommands.push("0.06 0.09 0.16 rg"); // slate-900
      currentCommands.push(
        `${marginX} ${pageHeight - 115} ${contentWidth} 75 re f`
      );

      // Franja de acento celeste
      currentCommands.push("0.01 0.52 0.78 rg"); // sky-600
      currentCommands.push(
        `${marginX} ${pageHeight - 119} ${contentWidth} 4 re f`
      );

      // Nombre del Laboratorio
      currentCommands.push("1 1 1 rg");
      currentCommands.push(
        `BT /F2 18 Tf ${marginX + 18} ${pageHeight - 68} Td (${encodePdfText(
          labName.toUpperCase()
        )}) Tj ET`
      );

      // Subtítulo Lista de Precios
      const subtitle = protesistaName
        ? `LISTA DE PRECIOS DE PROTESIS DENTAL  |  Protesista: ${protesistaName}`
        : "LISTA DE PRECIOS DE PROTESIS DENTAL";
      currentCommands.push("0.75 0.85 0.96 rg");
      currentCommands.push(
        `BT /F1 10 Tf ${marginX + 18} ${pageHeight - 86} Td (${encodePdfText(
          subtitle
        )}) Tj ET`
      );

      // Fecha de emisión y filtro
      const dateLabel = `Actualizado al: ${formatDateTime(new Date())}${
        options.categoryFilter && options.categoryFilter !== "TODAS"
          ? `  |  Categoría: ${options.categoryFilter}`
          : `  |  Total productos: ${products.length}`
      }`;
      currentCommands.push("0.65 0.74 0.85 rg");
      currentCommands.push(
        `BT /F1 9 Tf ${marginX + 18} ${pageHeight - 102} Td (${encodePdfText(
          dateLabel
        )}) Tj ET`
      );

      cursorY = pageHeight - 140;
    } else {
      // Encabezado compacto en páginas siguientes
      currentCommands.push("0.06 0.09 0.16 rg");
      currentCommands.push(
        `${marginX} ${pageHeight - 65} ${contentWidth} 28 re f`
      );
      currentCommands.push("1 1 1 rg");
      currentCommands.push(
        `BT /F2 11 Tf ${marginX + 12} ${pageHeight - 55} Td (${encodePdfText(
          `${labName} - Lista de Precios (Continuación)`
        )}) Tj ET`
      );

      cursorY = pageHeight - 85;
    }
  };

  startNewPage(true);

  if (products.length === 0) {
    currentCommands.push("0.3 0.35 0.4 rg");
    currentCommands.push(
      `BT /F1 12 Tf ${marginX + 12} ${cursorY - 20} Td (${encodePdfText(
        "No hay productos cargados para mostrar en la lista de precios."
      )}) Tj ET`
    );
  } else {
    for (const [category, items] of grouped.entries()) {
      // Verificar espacio para cabecera de categoría + al menos 1 producto
      if (cursorY < 115) {
        startNewPage(false);
      }

      // Cabecera de Categoría
      const catHeight = 24;
      currentCommands.push("0.01 0.52 0.78 rg"); // sky-600
      currentCommands.push(
        `${marginX} ${cursorY - catHeight} ${contentWidth} ${catHeight} re f`
      );

      currentCommands.push("1 1 1 rg");
      currentCommands.push(
        `BT /F2 10.5 Tf ${marginX + 10} ${cursorY - 16} Td (${encodePdfText(
          category.toUpperCase()
        )}) Tj ET`
      );

      const priceColLabel = "PRECIO UNITARIO";
      const labelW = estimateTextWidth(priceColLabel, 8.5);
      currentCommands.push(
        `BT /F2 8.5 Tf ${
          marginX + contentWidth - labelW - 12
        } ${cursorY - 15} Td (${encodePdfText(priceColLabel)}) Tj ET`
      );

      cursorY -= catHeight;

      // Filas de productos de esta categoría
      items.forEach((item, idx) => {
        const hasDesc = Boolean(item.description && item.description.trim());
        const rowHeight = hasDesc ? 32 : 22;

        if (cursorY - rowHeight < 60) {
          startNewPage(false);
        }

        // Fondo alternado
        if (idx % 2 === 0) {
          currentCommands.push("0.97 0.98 0.99 rg");
        } else {
          currentCommands.push("1 1 1 rg");
        }
        currentCommands.push(
          `${marginX} ${cursorY - rowHeight} ${contentWidth} ${rowHeight} re f`
        );

        // Línea divisoria inferior sutil
        currentCommands.push("0.89 0.91 0.94 RG 0.5 w");
        currentCommands.push(
          `${marginX} ${cursorY - rowHeight} m ${marginX + contentWidth} ${
            cursorY - rowHeight
          } l S`
        );

        // Nombre del Producto
        const cleanName = truncateToWidth(item.name, contentWidth - 130, 10);
        currentCommands.push("0.08 0.11 0.18 rg");
        currentCommands.push(
          `BT /F2 10 Tf ${marginX + 10} ${
            cursorY - (hasDesc ? 13 : 15)
          } Td (${encodePdfText(cleanName)}) Tj ET`
        );

        // Descripción opcional
        if (hasDesc) {
          const cleanDesc = truncateToWidth(
            item.description.trim(),
            contentWidth - 130,
            8.5
          );
          currentCommands.push("0.4 0.45 0.52 rg");
          currentCommands.push(
            `BT /F1 8.5 Tf ${marginX + 10} ${cursorY - 25} Td (${encodePdfText(
              cleanDesc
            )}) Tj ET`
          );
        }

        // Precio alineado a la derecha
        const priceFormatted = formatCurrency(item.price);
        const priceWidth = estimateTextWidth(priceFormatted, 10.5);
        currentCommands.push("0.05 0.1 0.2 rg");
        currentCommands.push(
          `BT /F2 10.5 Tf ${
            marginX + contentWidth - priceWidth - 12
          } ${cursorY - (hasDesc ? 19 : 15)} Td (${encodePdfText(
            priceFormatted
          )}) Tj ET`
        );

        cursorY -= rowHeight;
      });

      cursorY -= 14; // Espacio entre categorías
    }
  }

  if (currentCommands.length > 0) {
    pagesCommands.push(currentCommands);
  }

  // Agregar pie de página con datos del protesista y numeración a todas las páginas
  const totalPages = pagesCommands.length;
  pagesCommands.forEach((cmds, index) => {
    cmds.push("0.85 0.88 0.92 RG 0.5 w");
    cmds.push(`${marginX} 48 m ${marginX + contentWidth} 48 l S`);

    cmds.push("0.15 0.2 0.28 rg");
    cmds.push(
      `BT /F2 8.5 Tf ${marginX} 34 Td (${encodePdfText(
        "Tec. Superior en Prótesis Dental: Néstor Javier Videla  |  Santo Nobile (Norte) 1993 - Colonia Caroya - Córdoba"
      )}) Tj ET`
    );

    cmds.push("0.35 0.4 0.48 rg");
    cmds.push(
      `BT /F1 8 Tf ${marginX} 22 Td (${encodePdfText(
        "Tel: (03525) 462420 - 15447040   |   WhatsApp: 3525447040   |   Email: javi4097@gmail.com"
      )}) Tj ET`
    );

    const pageLabel = `Página ${index + 1} de ${totalPages}`;
    const pageLabelW = estimateTextWidth(pageLabel, 8.5);
    cmds.push(
      `BT /F1 8.5 Tf ${
        marginX + contentWidth - pageLabelW
      } 28 Td (${encodePdfText(pageLabel)}) Tj ET`
    );
  });

  // Construcción de objetos PDF 1.4
  // Obj 1: Catalog
  // Obj 2: Pages
  // Obj 3: Font Helvetica (/F1)
  // Obj 4: Font Helvetica-Bold (/F2)
  // Obj 5..N: Page + Content Stream por cada página
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(""); // Placeholder para 2 0 obj (Pages)
  objects.push(
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n"
  );
  objects.push(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n"
  );

  let nextObjId = 5;
  for (const cmds of pagesCommands) {
    const pageObjId = nextObjId++;
    const contentObjId = nextObjId++;
    pageObjectIds.push(pageObjId);

    const streamData = cmds.join("\n");
    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${streamData.length} >>\nstream\n${streamData}\nendstream\nendobj\n`
    );
  }

  const kidsArray = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kidsArray}] /Count ${pageObjectIds.length} >>\nendobj\n`;

  let pdfBody = "%PDF-1.4\n";
  const offsets: number[] = [0]; // Índice 0 libre

  for (const objStr of objects) {
    offsets.push(pdfBody.length);
    pdfBody += objStr;
  }

  const xrefOffset = pdfBody.length;
  pdfBody += `xref\n0 ${objects.length + 1}\n`;
  pdfBody += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdfBody += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdfBody += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const encoder = new TextEncoder();
  return encoder.encode(pdfBody);
}

/**
 * Descarga directamente el archivo .PDF en el teléfono o computadora.
 */
export function downloadPriceListPdf(options: GeneratePriceListPdfOptions) {
  const bytes = generatePriceListPdfBytes(options);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Lista_de_Precios_${dateStr}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface DentistPdfEntry {
  id: string;
  type: "CHARGE" | "PAYMENT";
  concept: string;
  patientOrNotes: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  occurredAt: string;
  runningBalance?: number;
}

export interface GenerateDentistStatementPdfOptions {
  labName?: string;
  protesistaName?: string;
  dentist: {
    fullName: string;
    clinicName?: string;
    phone?: string;
    email?: string;
    totalCharges: number;
    totalPayments: number;
    balance: number;
  };
  entries: DentistPdfEntry[];
}

/**
 * Genera el PDF con el detalle completo de los trabajos pedidos y pagos realizados por un dentista.
 */
export function generateDentistStatementPdfBytes(
  options: GenerateDentistStatementPdfOptions
): Uint8Array {
  const labName = options.labName || "Laboratorio de Prótesis Dental";
  const protesistaName = options.protesistaName || "";
  const { dentist, entries } = options;

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 36;
  const contentWidth = pageWidth - marginX * 2;

  const pagesCommands: string[][] = [];
  let currentCommands: string[] = [];
  let cursorY = 0;

  const drawTableHeader = (y: number): number => {
    const headerH = 22;
    currentCommands.push("0.01 0.52 0.78 rg"); // sky-600
    currentCommands.push(
      `${marginX} ${y - headerH} ${contentWidth} ${headerH} re f`
    );

    currentCommands.push("1 1 1 rg");
    currentCommands.push(
      `BT /F2 8.5 Tf ${marginX + 8} ${y - 14.5} Td (${encodePdfText(
        "FECHA Y HORA"
      )}) Tj ET`
    );
    currentCommands.push(
      `BT /F2 8.5 Tf ${marginX + 98} ${y - 14.5} Td (${encodePdfText(
        "TRABAJO PEDIDO / CONCEPTO / DETALLE"
      )}) Tj ET`
    );

    const colMonto = "MONTO";
    const colMontoW = estimateTextWidth(colMonto, 8.5);
    currentCommands.push(
      `BT /F2 8.5 Tf ${marginX + contentWidth - 95 - colMontoW} ${
        y - 14.5
      } Td (${encodePdfText(colMonto)}) Tj ET`
    );

    const colSaldo = "SALDO";
    const colSaldoW = estimateTextWidth(colSaldo, 8.5);
    currentCommands.push(
      `BT /F2 8.5 Tf ${marginX + contentWidth - 10 - colSaldoW} ${
        y - 14.5
      } Td (${encodePdfText(colSaldo)}) Tj ET`
    );

    return y - headerH;
  };

  const startNewPage = (isFirstPage: boolean) => {
    if (currentCommands.length > 0) {
      pagesCommands.push(currentCommands);
    }
    currentCommands = [];

    if (isFirstPage) {
      // Encabezado Principal Oscuro
      currentCommands.push("0.06 0.09 0.16 rg");
      currentCommands.push(
        `${marginX} ${pageHeight - 105} ${contentWidth} 68 re f`
      );

      currentCommands.push("0.01 0.52 0.78 rg");
      currentCommands.push(
        `${marginX} ${pageHeight - 109} ${contentWidth} 4 re f`
      );

      currentCommands.push("1 1 1 rg");
      currentCommands.push(
        `BT /F2 16 Tf ${marginX + 16} ${pageHeight - 62} Td (${encodePdfText(
          labName.toUpperCase()
        )}) Tj ET`
      );

      const sub = protesistaName
        ? `DETALLE DE TRABAJOS PEDIDOS Y ESTADO DE CUENTA  |  Protesista: ${protesistaName}`
        : "DETALLE DE TRABAJOS PEDIDOS Y ESTADO DE CUENTA";
      currentCommands.push("0.75 0.85 0.96 rg");
      currentCommands.push(
        `BT /F1 9.5 Tf ${marginX + 16} ${pageHeight - 80} Td (${encodePdfText(
          sub
        )}) Tj ET`
      );

      currentCommands.push("0.65 0.74 0.85 rg");
      currentCommands.push(
        `BT /F1 8.5 Tf ${marginX + 16} ${pageHeight - 95} Td (${encodePdfText(
          `Fecha de emisión: ${formatDateTime(new Date())}`
        )}) Tj ET`
      );

      // Recuadro con Datos del Dentista y Totales
      const boxTop = pageHeight - 122;
      const boxHeight = 68;
      currentCommands.push("0.96 0.97 0.99 rg");
      currentCommands.push(
        `${marginX} ${boxTop - boxHeight} ${contentWidth} ${boxHeight} re f`
      );
      currentCommands.push("0.82 0.86 0.91 RG 0.8 w");
      currentCommands.push(
        `${marginX} ${boxTop - boxHeight} ${contentWidth} ${boxHeight} re S`
      );

      // Nombre del Dentista y Consultorio
      currentCommands.push("0.07 0.1 0.17 rg");
      currentCommands.push(
        `BT /F2 12 Tf ${marginX + 14} ${boxTop - 22} Td (${encodePdfText(
          `Profesional: ${dentist.fullName}`
        )}) Tj ET`
      );

      const extraInfo = [
        dentist.clinicName ? `Consultorio: ${dentist.clinicName}` : "",
        dentist.phone ? `Tel: ${dentist.phone}` : "",
      ]
        .filter(Boolean)
        .join("   |   ");

      if (extraInfo) {
        currentCommands.push("0.35 0.4 0.48 rg");
        currentCommands.push(
          `BT /F1 9 Tf ${marginX + 14} ${boxTop - 38} Td (${encodePdfText(
            extraInfo
          )}) Tj ET`
        );
      }

      const totalsLine = `Total en Trabajos Pedidos: ${formatCurrency(
        dentist.totalCharges
      )}   |   Total Pagos Registrados: ${formatCurrency(
        dentist.totalPayments
      )}`;
      currentCommands.push("0.25 0.3 0.38 rg");
      currentCommands.push(
        `BT /F2 9 Tf ${marginX + 14} ${boxTop - 55} Td (${encodePdfText(
          totalsLine
        )}) Tj ET`
      );

      // Caja destacada de TOTAL ADEUDADO a la derecha
      const debtBoxW = 165;
      const debtBoxH = 48;
      const debtBoxX = marginX + contentWidth - debtBoxW - 10;
      const debtBoxY = boxTop - boxHeight + 10;

      if (dentist.balance > 0) {
        currentCommands.push("0.99 0.93 0.94 rg"); // rose-50
        currentCommands.push("0.92 0.25 0.35 RG 1 w");
      } else {
        currentCommands.push("0.92 0.98 0.95 rg"); // emerald-50
        currentCommands.push("0.08 0.65 0.42 RG 1 w");
      }
      currentCommands.push(
        `${debtBoxX} ${debtBoxY} ${debtBoxW} ${debtBoxH} re B`
      );

      if (dentist.balance > 0) {
        currentCommands.push("0.75 0.12 0.22 rg");
      } else {
        currentCommands.push("0.05 0.5 0.32 rg");
      }
      const debtLabel = "TOTAL ADEUDADO";
      const debtLabelW = estimateTextWidth(debtLabel, 8.5);
      currentCommands.push(
        `BT /F2 8.5 Tf ${debtBoxX + debtBoxW - debtLabelW - 10} ${
          debtBoxY + 32
        } Td (${encodePdfText(debtLabel)}) Tj ET`
      );

      const debtVal = formatCurrency(dentist.balance);
      const debtValW = estimateTextWidth(debtVal, 13);
      currentCommands.push(
        `BT /F2 13 Tf ${debtBoxX + debtBoxW - debtValW - 10} ${
          debtBoxY + 12
        } Td (${encodePdfText(debtVal)}) Tj ET`
      );

      cursorY = drawTableHeader(boxTop - boxHeight - 14);
    } else {
      // Encabezado compacto en páginas siguientes
      currentCommands.push("0.06 0.09 0.16 rg");
      currentCommands.push(
        `${marginX} ${pageHeight - 62} ${contentWidth} 26 re f`
      );
      currentCommands.push("1 1 1 rg");
      currentCommands.push(
        `BT /F2 10 Tf ${marginX + 12} ${pageHeight - 53} Td (${encodePdfText(
          `${dentist.fullName} — Listado de Trabajos y Movimientos (Continuación)`
        )}) Tj ET`
      );

      cursorY = drawTableHeader(pageHeight - 72);
    }
  };

  startNewPage(true);

  if (entries.length === 0) {
    currentCommands.push("0.35 0.4 0.48 rg");
    currentCommands.push(
      `BT /F1 10.5 Tf ${marginX + 12} ${cursorY - 24} Td (${encodePdfText(
        "No hay trabajos ni movimientos registrados para este dentista."
      )}) Tj ET`
    );
  } else {
    // Ordenamos cronológicamente para que el listado muestre la evolución clara
    const sorted = [...entries].sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    let running = 0;
    sorted.forEach((entry, idx) => {
      const isCharge = entry.type === "CHARGE";
      if (isCharge) running += entry.amount;
      else running -= entry.amount;
      const currentRunning = Math.round(running * 100) / 100;

      const hasSubline =
        Boolean(entry.patientOrNotes && entry.patientOrNotes.trim()) ||
        (isCharge && entry.quantity > 1);
      const rowH = hasSubline ? 32 : 22;

      if (cursorY - rowH < 55) {
        startNewPage(false);
      }

      // Fondo alternado
      if (idx % 2 === 0) {
        currentCommands.push("0.98 0.99 1 rg");
      } else {
        currentCommands.push("1 1 1 rg");
      }
      currentCommands.push(
        `${marginX} ${cursorY - rowH} ${contentWidth} ${rowH} re f`
      );

      currentCommands.push("0.89 0.91 0.94 RG 0.5 w");
      currentCommands.push(
        `${marginX} ${cursorY - rowH} m ${marginX + contentWidth} ${
          cursorY - rowH
        } l S`
      );

      // Fecha y Hora
      const dateStr = formatDateTime(entry.occurredAt);
      currentCommands.push("0.3 0.35 0.42 rg");
      currentCommands.push(
        `BT /F1 8.5 Tf ${marginX + 8} ${
          cursorY - (hasSubline ? 13 : 14.5)
        } Td (${encodePdfText(dateStr)}) Tj ET`
      );

      // Concepto / Producto pedido
      const badge = isCharge ? "[Trabajo] " : "[Pago] ";
      const mainTitle = truncateToWidth(
        badge + entry.concept,
        contentWidth - 265,
        9.5
      );
      currentCommands.push("0.08 0.11 0.18 rg");
      currentCommands.push(
        `BT /F2 9.5 Tf ${marginX + 98} ${
          cursorY - (hasSubline ? 13 : 14.5)
        } Td (${encodePdfText(mainTitle)}) Tj ET`
      );

      // Sub-línea: cantidad x precio unitario + paciente/notas
      if (hasSubline) {
        const subParts: string[] = [];
        if (isCharge && entry.quantity > 1) {
          subParts.push(
            `${entry.quantity} u. x ${formatCurrency(entry.unitPrice)}`
          );
        }
        if (entry.patientOrNotes && entry.patientOrNotes.trim()) {
          subParts.push(entry.patientOrNotes.trim());
        }
        const subText = truncateToWidth(
          subParts.join("  —  "),
          contentWidth - 265,
          8
        );
        currentCommands.push("0.42 0.47 0.55 rg");
        currentCommands.push(
          `BT /F1 8 Tf ${marginX + 98} ${cursorY - 25} Td (${encodePdfText(
            subText
          )}) Tj ET`
        );
      }

      // Monto (+ Trabajo o - Pago)
      const amountStr = `${isCharge ? "+" : "-"}${formatCurrency(entry.amount)}`;
      const amountW = estimateTextWidth(amountStr, 9.5);
      if (isCharge) {
        currentCommands.push("0.75 0.12 0.22 rg"); // rojo suave para cargos
      } else {
        currentCommands.push("0.05 0.52 0.32 rg"); // verde para pagos
      }
      currentCommands.push(
        `BT /F2 9.5 Tf ${marginX + contentWidth - 95 - amountW} ${
          cursorY - (hasSubline ? 18 : 14.5)
        } Td (${encodePdfText(amountStr)}) Tj ET`
      );

      // Saldo progresivo
      const runningStr = formatCurrency(currentRunning);
      const runningW = estimateTextWidth(runningStr, 9);
      currentCommands.push("0.15 0.2 0.28 rg");
      currentCommands.push(
        `BT /F2 9 Tf ${marginX + contentWidth - 10 - runningW} ${
          cursorY - (hasSubline ? 18 : 14.5)
        } Td (${encodePdfText(runningStr)}) Tj ET`
      );

      cursorY -= rowH;
    });
  }

  if (currentCommands.length > 0) {
    pagesCommands.push(currentCommands);
  }

  // Pie de página en todas las hojas
  const totalPages = pagesCommands.length;
  pagesCommands.forEach((cmds, index) => {
    cmds.push("0.85 0.88 0.92 RG 0.5 w");
    cmds.push(`${marginX} 48 m ${marginX + contentWidth} 48 l S`);

    cmds.push("0.15 0.2 0.28 rg");
    cmds.push(
      `BT /F2 8.5 Tf ${marginX} 34 Td (${encodePdfText(
        "Tec. Superior en Prótesis Dental: Néstor Javier Videla  |  Santo Nobile (Norte) 1993 - Colonia Caroya - Córdoba"
      )}) Tj ET`
    );

    cmds.push("0.35 0.4 0.48 rg");
    cmds.push(
      `BT /F1 8 Tf ${marginX} 22 Td (${encodePdfText(
        "Tel: (03525) 462420 - 15447040   |   WhatsApp: 3525447040   |   Email: javi4097@gmail.com"
      )}) Tj ET`
    );

    const pageLabel = `Página ${index + 1} de ${totalPages}`;
    const pageLabelW = estimateTextWidth(pageLabel, 8.5);
    cmds.push(
      `BT /F1 8.5 Tf ${
        marginX + contentWidth - pageLabelW
      } 28 Td (${encodePdfText(pageLabel)}) Tj ET`
    );
  });

  // Ensamblar objetos PDF 1.4
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("");
  objects.push(
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n"
  );
  objects.push(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n"
  );

  let nextObjId = 5;
  for (const cmds of pagesCommands) {
    const pageObjId = nextObjId++;
    const contentObjId = nextObjId++;
    pageObjectIds.push(pageObjId);

    const streamData = cmds.join("\n");
    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${streamData.length} >>\nstream\n${streamData}\nendstream\nendobj\n`
    );
  }

  const kidsArray = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kidsArray}] /Count ${pageObjectIds.length} >>\nendobj\n`;

  let pdfBody = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const objStr of objects) {
    offsets.push(pdfBody.length);
    pdfBody += objStr;
  }

  const xrefOffset = pdfBody.length;
  pdfBody += `xref\n0 ${objects.length + 1}\n`;
  pdfBody += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdfBody += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdfBody += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const encoder = new TextEncoder();
  return encoder.encode(pdfBody);
}

/**
 * Descarga directamente el archivo .PDF con el listado de trabajos pedidos y pagos del dentista.
 */
export function downloadDentistStatementPdf(
  options: GenerateDentistStatementPdfOptions
) {
  const bytes = generateDentistStatementPdfBytes(options);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = options.dentist.fullName
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, "_")
    .replace(/_+/g, "_");
  const a = document.createElement("a");
  a.href = url;
  a.download = `Detalle_Cuenta_${safeName}_${dateStr}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
