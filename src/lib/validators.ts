import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "Nombre demasiado largo"),
  labName: z
    .string()
    .trim()
    .min(2, "El nombre del laboratorio debe tener al menos 2 caracteres")
    .max(100, "Nombre demasiado largo")
    .default("Laboratorio Dental"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Ingresa un correo electrónico válido")
    .max(120),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(100, "Contraseña demasiado larga"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Ingresa un correo electrónico válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres")
    .max(100),
});

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre del producto es obligatorio")
    .max(140),
  category: z.string().trim().min(1, "La categoría es obligatoria").max(80),
  description: z.string().trim().max(400).optional().default(""),
  price: z.coerce
    .number()
    .min(0, "El precio no puede ser negativo")
    .max(1000000000),
  active: z.boolean().optional().default(true),
});

export const bulkPriceAdjustmentSchema = z.object({
  percentage: z.coerce
    .number()
    .min(-90, "El ajuste mínimo es -90%")
    .max(500, "El ajuste máximo es 500%"),
  category: z.string().optional(),
  roundTo: z.coerce.number().min(0).optional().default(0),
});

export const dentistSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "El nombre del dentista es obligatorio")
    .max(120),
  clinicName: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().max(120).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(600).optional().default(""),
  initialBalance: z.coerce
    .number()
    .min(0, "El saldo anterior no puede ser negativo")
    .max(1000000000)
    .optional()
    .default(0),
});

export const ledgerEntrySchema = z.object({
  type: z.enum(["CHARGE", "PAYMENT"]),
  productId: z.string().nullable().optional(),
  concept: z
    .string()
    .trim()
    .min(1, "El concepto o producto es obligatorio")
    .max(160),
  patientOrNotes: z.string().trim().max(400).optional().default(""),
  quantity: z.coerce.number().int().min(1).max(1000).optional().default(1),
  unitPrice: z.coerce.number().min(0).max(1000000000).optional().default(0),
  amount: z.coerce
    .number()
    .positive("El monto debe ser mayor a 0")
    .max(1000000000),
  occurredAt: z
    .string()
    .refine((val) => !Number.isNaN(Date.parse(val)), {
      message: "Fecha y hora inválida",
    })
    .optional(),
});
