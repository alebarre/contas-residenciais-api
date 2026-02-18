import { z } from "zod";

export const registerSchema = z.object({
  nome: z.string().min(3).max(120),
  email: z.string().email().max(255),
  senha: z.string().min(6).max(72),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  senha: z.string().min(1).max(72),
});

// ESQUECI A SENHA  
export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

// Reset por código (uso único)
export const resetPasswordSchema = z.object({
  email: z.string().email().max(255),
  code: z.string().trim().min(1, 'Código é obrigatório').max(12),
  newPassword: z.string().min(6).max(72),
});