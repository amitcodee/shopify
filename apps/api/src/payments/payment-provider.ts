import type { IncomingHttpHeaders } from 'node:http';

export interface CreatePaymentInput {
  storeId: string;
  orderId: string;
  orderNumber: number;
  amount: number;
  currency: string;
  email: string;
  /** Where the provider sends the shopper after paying / cancelling. */
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface CreatedPayment {
  providerRef: string;
  checkoutUrl: string;
  /** Stored only for the sandbox provider, which redirects itself. */
  returnUrl?: string;
}

export type WebhookOutcome =
  | {
      kind: 'payment_succeeded';
      eventId: string;
      type: string;
      providerRef: string;
      providerPaymentId: string | null;
      amount: number;
      currency: string;
    }
  | { kind: 'payment_failed'; eventId: string; type: string; providerRef: string }
  | { kind: 'ignored'; eventId: string; type: string };

export interface RefundRequest {
  providerRef: string;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface RefundResult {
  providerRef: string;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
}

/**
 * Port for card payments. Card data never touches our servers: shoppers pay on a
 * provider-hosted page (PCI SAQ-A); we only store provider references.
 */
export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  /** Verifies the signature and normalizes the event; throws on an invalid signature. */
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): WebhookOutcome;
  refund(request: RefundRequest): Promise<RefundResult>;
}

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
export const ACTIVE_PAYMENT_PROVIDER = Symbol('ACTIVE_PAYMENT_PROVIDER');

export class InvalidWebhookError extends Error {}
