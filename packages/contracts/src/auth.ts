import { z } from 'zod';
import { emailSchema } from './common.js';

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Use at most 128 characters');

export const signupInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupInputSchema>;

export const loginInputSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const platformRoleSchema = z.enum(['NONE', 'SUPPORT', 'SUPER_ADMIN']);
export type PlatformRole = z.infer<typeof platformRoleSchema>;

export const currentUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  platformRole: platformRoleSchema,
  twoFactorEnabled: z.boolean(),
  /** False until the sign-up email link is opened; creating a store requires it. */
  emailVerified: z.boolean(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

/** Returned on signup/login. The token is opaque; the admin app stores it in an HttpOnly cookie. */
export const authSessionSchema = z.object({
  token: z.string(),
  expiresAt: z.iso.datetime(),
  user: currentUserSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

/** Login either returns a session or asks for a second factor. */
export const loginResultSchema = z.union([
  authSessionSchema.extend({ mfaRequired: z.literal(false).optional() }),
  z.object({ mfaRequired: z.literal(true), mfaToken: z.string() }),
]);
export type LoginResult = z.infer<typeof loginResultSchema>;

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your app');

export const mfaLoginInputSchema = z.strictObject({
  mfaToken: z.string().min(10).max(2000),
  code: totpCodeSchema,
});

export const verifyEmailInputSchema = z.strictObject({ token: z.string().min(10).max(2000) });

export const forgotPasswordInputSchema = z.strictObject({ email: emailSchema });

export const resetPasswordInputSchema = z.strictObject({
  token: z.string().min(10).max(2000),
  password: passwordSchema,
});

export const unlockAccountInputSchema = z.strictObject({ token: z.string().min(10).max(2000) });

export const totpCodeInputSchema = z.strictObject({ code: totpCodeSchema });

export const twoFactorSetupSchema = z.object({
  /** Base32 secret for manual entry in an authenticator app. */
  secret: z.string(),
  otpauthUrl: z.string(),
});
export type TwoFactorSetup = z.infer<typeof twoFactorSetupSchema>;
