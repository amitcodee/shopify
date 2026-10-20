import { createHash } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import {
  type CreatedPayment,
  type CreatePaymentInput,
  type DisputeStatus,
  InvalidWebhookError,
  type PaymentProvider,
  type RefundRequest,
  type RefundResult,
  type WebhookOutcome,
} from '../payment-provider.js';
import {
  headerValue,
  str,
  type RazorpayClient,
  type RazorpayEvent,
  verifyRazorpaySignature,
} from './razorpay-client.js';

/** Payment Links must stay open longer than our unpaid-order timeout (Razorpay minimum: 15 min). */
const LINK_TTL_SECONDS = 60 * 60;

interface PaymentLink {
  id: string;
  short_url: string;
}

interface RazorpayRefund {
  id: string;
  status: 'pending' | 'processed' | 'failed';
}

/**
 * Razorpay adapter: shoppers pay on a hosted Payment Link (cards, UPI, netbanking, wallets;
 * PCI SAQ-A like Stripe Checkout). With Route, the link's order carries a transfer of the sale
 * minus the platform fee to the store's linked account; the fee stays with the platform.
 * Orders are marked paid only from a verified `payment_link.paid` webhook.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'razorpay';

  constructor(
    private readonly client: RazorpayClient,
    private readonly webhookSecret: string,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const transfer = input.amount - input.destination.applicationFee;
    const link = await this.client.request<PaymentLink>('POST', '/v1/payment_links', {
      amount: input.amount,
      currency: input.currency,
      accept_partial: false,
      // Unique per merchant on Razorpay's side: a retried request cannot create a second link.
      reference_id: input.orderId.replaceAll('-', ''),
      description: `Order #${input.orderNumber}`,
      customer: { email: input.email },
      notify: { sms: false, email: false },
      reminder_enable: false,
      callback_url: input.successUrl,
      callback_method: 'get',
      expire_by: Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
      notes: { orderId: input.orderId, storeId: input.storeId },
      options: {
        order: {
          transfers:
            transfer > 0
              ? [
                  {
                    account: input.destination.accountId,
                    amount: transfer,
                    currency: input.currency,
                    notes: { orderId: input.orderId },
                    on_hold: false,
                  },
                ]
              : [],
        },
      },
    });
    return { providerRef: link.id, checkoutUrl: link.short_url };
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): WebhookOutcome {
    if (
      !verifyRazorpaySignature(
        rawBody,
        headerValue(headers['x-razorpay-signature']),
        this.webhookSecret,
      )
    ) {
      throw new InvalidWebhookError('Invalid Razorpay signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as RazorpayEvent;
    // Razorpay sends the event id as a header; fall back to the body digest for de-duplication.
    const eventId =
      headerValue(headers['x-razorpay-event-id']) ??
      `sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
    const type = event.event;
    const entity = (name: string) => event.payload[name]?.entity ?? {};

    switch (type) {
      case 'payment_link.paid': {
        const link = entity('payment_link');
        const payment = entity('payment');
        return {
          kind: 'payment_succeeded',
          eventId,
          type,
          providerRef: str(link.id),
          providerPaymentId: typeof payment.id === 'string' ? payment.id : null,
          amount: Number(payment.amount ?? link.amount_paid ?? 0),
          currency: str(payment.currency ?? link.currency).toUpperCase(),
        };
      }
      case 'payment_link.expired':
      case 'payment_link.cancelled':
        return {
          kind: 'payment_failed',
          eventId,
          type,
          providerRef: str(entity('payment_link').id),
        };
      case 'payment.dispute.created':
      case 'payment.dispute.action_required':
      case 'payment.dispute.under_review':
      case 'payment.dispute.won':
      case 'payment.dispute.lost':
      case 'payment.dispute.closed': {
        const dispute = entity('dispute');
        const paymentId = dispute.payment_id;
        if (typeof paymentId !== 'string') return { kind: 'ignored', eventId, type };
        const respondBy = Number(dispute.respond_by ?? 0);
        return {
          kind: 'dispute',
          eventId,
          type,
          providerPaymentId: paymentId,
          dispute: {
            id: str(dispute.id),
            amount: Number(dispute.amount ?? 0),
            currency: str(dispute.currency).toUpperCase(),
            reason:
              typeof dispute.reason_code === 'string'
                ? dispute.reason_code
                : typeof dispute.reason_description === 'string'
                  ? dispute.reason_description
                  : null,
            status: razorpayDisputeStatus(type),
            evidenceDueBy: respondBy > 0 ? new Date(respondBy * 1000) : null,
          },
        };
      }
      default:
        return { kind: 'ignored', eventId, type };
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    if (!request.providerPaymentId) throw new Error('Missing Razorpay payment id for refund');
    const refund = await this.client.request<RazorpayRefund>(
      'POST',
      `/v1/payments/${encodeURIComponent(request.providerPaymentId)}/refund`,
      {
        amount: request.amount,
        // Route: pull the refunded share back from the linked account proportionally.
        ...(request.reverseTransfer ? { reverse_all: 1 } : {}),
        notes: { idempotencyKey: request.idempotencyKey },
      },
      { 'X-Razorpay-Idempotency': request.idempotencyKey },
    );
    const status =
      refund.status === 'processed'
        ? 'SUCCEEDED'
        : refund.status === 'failed'
          ? 'FAILED'
          : 'PENDING';
    return { providerRef: refund.id, status };
  }
}

export function razorpayDisputeStatus(event: string): DisputeStatus {
  if (event === 'payment.dispute.won') return 'WON';
  // "closed" means the merchant accepted the dispute: the funds stay with the customer.
  if (event === 'payment.dispute.lost' || event === 'payment.dispute.closed') return 'LOST';
  if (event === 'payment.dispute.under_review') return 'UNDER_REVIEW';
  return 'NEEDS_RESPONSE';
}
