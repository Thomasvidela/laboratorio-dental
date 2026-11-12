export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDateTime(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function toLocalDateTimeInputValue(isoOrDate?: string | Date): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  const validDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = validDate.getFullYear();
  const month = pad(validDate.getMonth() + 1);
  const day = pad(validDate.getDate());
  const hours = pad(validDate.getHours());
  const minutes = pad(validDate.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Normaliza un número telefónico de Argentina para WhatsApp asegurando el prefijo 549 (+54 9).
 * Ejemplos:
 *  - "11 2345-6789" -> "5491123456789"
 *  - "011 2345 6789" -> "5491123456789"
 *  - "+54 9 351 555-1234" -> "5493515551234"
 *  - "+54 11 2345 6789" -> "5491123456789"
 */
export function formatArgentinaWhatsAppNumber(rawPhone: string): string {
  let digits = (rawPhone || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("549")) {
    return digits;
  }

  if (digits.startsWith("54")) {
    let rest = digits.slice(2);
    if (rest.startsWith("0")) rest = rest.slice(1);
    return `549${rest}`;
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return `549${digits}`;
}

/**
 * Formatea visualmente el teléfono mostrando +54 9 al principio.
 */
export function formatDisplayArgentinaPhone(rawPhone: string): string {
  const trimmed = (rawPhone || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+54 9") || trimmed.startsWith("+549")) {
    return trimmed.replace(/^\+549\s*/, "+54 9 ");
  }
  const wa = formatArgentinaWhatsAppNumber(trimmed);
  if (!wa) return trimmed;
  const localPart = wa.slice(3);
  return `+54 9 ${localPart}`;
}

