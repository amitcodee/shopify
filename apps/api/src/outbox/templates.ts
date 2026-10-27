import { formatMoney } from '@repo/contracts';
import type { EmailMessage } from '../email/email.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function layout(storeName: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;max-width:560px;margin:auto">
<h2>${escapeHtml(storeName)}</h2>${bodyHtml}
<p style="color:#666;font-size:12px">This email was sent by ${escapeHtml(storeName)}.</p></body></html>`;
}

export interface OrderEmailData {
  storeName: string;
  orderNumber: number;
  currency: string;
  total: number;
  lines: {
    title: string;
    variantTitle: string;
    quantity: number;
    total: number;
    /** Personalisation ("Engraving: For Sam"). */
    properties?: { label: string; value: string }[];
  }[];
  statusUrl?: string;
}

function propertyText(l: OrderEmailData['lines'][number]): string {
  return (l.properties ?? []).map((p) => `${p.label}: ${p.value}`).join(', ');
}

function lineText(order: OrderEmailData): string {
  return order.lines
    .map(
      (l) =>
        `- ${l.title}${l.variantTitle !== 'Default' ? ` (${l.variantTitle})` : ''} × ${l.quantity}: ${formatMoney(l.total, order.currency)}${
          propertyText(l)
            ? `
  ${propertyText(l)}`
            : ''
        }`,
    )
    .join('\n');
}

function lineHtml(order: OrderEmailData): string {
  return `<ul>${order.lines
    .map(
      (l) =>
        `<li>${escapeHtml(l.title)}${l.variantTitle !== 'Default' ? ` (${escapeHtml(l.variantTitle)})` : ''} × ${l.quantity} — ${escapeHtml(formatMoney(l.total, order.currency))}${propertyText(l) ? `<br><small>${escapeHtml(propertyText(l))}</small>` : ''}</li>`,
    )
    .join('')}</ul>`;
}

export function orderConfirmationEmail(to: string, order: OrderEmailData): EmailMessage {
  const total = formatMoney(order.total, order.currency);
  return {
    to,
    subject: `Order #${order.orderNumber} confirmed`,
    text: `Thanks for your order!\n\nOrder #${order.orderNumber}\n${lineText(order)}\nTotal: ${total}\n${order.statusUrl ? `\nTrack your order: ${order.statusUrl}\n` : ''}`,
    html: layout(
      order.storeName,
      `<p>Thanks for your order!</p><p><strong>Order #${order.orderNumber}</strong></p>${lineHtml(order)}<p>Total: <strong>${escapeHtml(total)}</strong></p>${
        order.statusUrl
          ? `<p><a href="${escapeHtml(order.statusUrl)}">View your order status</a></p>`
          : ''
      }`,
    ),
  };
}

export function merchantNewOrderEmail(
  to: string,
  order: OrderEmailData,
  adminUrl: string,
): EmailMessage {
  const total = formatMoney(order.total, order.currency);
  return {
    to,
    subject: `[${order.storeName}] New order #${order.orderNumber} — ${total}`,
    text: `You have a new paid order.\n\n${lineText(order)}\nTotal: ${total}\n\nOpen it in your admin: ${adminUrl}`,
    html: layout(
      order.storeName,
      `<p>You have a new paid order.</p>${lineHtml(order)}<p>Total: <strong>${escapeHtml(total)}</strong></p><p><a href="${escapeHtml(adminUrl)}">Open in admin</a></p>`,
    ),
  };
}

export function shippingConfirmationEmail(
  to: string,
  data: {
    storeName: string;
    orderNumber: number;
    trackingCompany?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
  },
): EmailMessage {
  const tracking = [data.trackingCompany, data.trackingNumber].filter(Boolean).join(' ');
  return {
    to,
    subject: `Order #${data.orderNumber} is on its way`,
    text: `Good news — your order #${data.orderNumber} has shipped.${tracking ? `\nTracking: ${tracking}` : ''}${data.trackingUrl ? `\n${data.trackingUrl}` : ''}`,
    html: layout(
      data.storeName,
      `<p>Good news — your order #${data.orderNumber} has shipped.</p>${tracking ? `<p>Tracking: ${escapeHtml(tracking)}</p>` : ''}${
        data.trackingUrl ? `<p><a href="${escapeHtml(data.trackingUrl)}">Track package</a></p>` : ''
      }`,
    ),
  };
}

export function refundEmail(
  to: string,
  data: { storeName: string; orderNumber: number; amount: number; currency: string },
): EmailMessage {
  const amount = formatMoney(data.amount, data.currency);
  return {
    to,
    subject: `Refund for order #${data.orderNumber}`,
    text: `We've refunded ${amount} for order #${data.orderNumber}. It may take a few days to appear on your statement.`,
    html: layout(
      data.storeName,
      `<p>We've refunded <strong>${escapeHtml(amount)}</strong> for order #${data.orderNumber}.</p><p>It may take a few days to appear on your statement.</p>`,
    ),
  };
}

export function orderCancelledEmail(
  to: string,
  data: { storeName: string; orderNumber: number },
): EmailMessage {
  return {
    to,
    subject: `Order #${data.orderNumber} was cancelled`,
    text: `Your order #${data.orderNumber} has been cancelled. If you were charged, a refund has been issued.`,
    html: layout(
      data.storeName,
      `<p>Your order #${data.orderNumber} has been cancelled. If you were charged, a refund has been issued.</p>`,
    ),
  };
}

export function customerLinkEmail(
  to: string,
  data: { storeName: string; purpose: 'ACTIVATE' | 'RESET_PASSWORD'; url: string },
): EmailMessage {
  const activate = data.purpose === 'ACTIVATE';
  const subject = activate
    ? `Activate your ${data.storeName} account`
    : `Reset your ${data.storeName} password`;
  const intro = activate
    ? 'Finish creating your account by choosing a password.'
    : 'Someone asked to reset your password. If it was you, choose a new one below.';
  return {
    to,
    subject,
    text: `${intro}\n\n${data.url}\n\nThis link expires in 24 hours. If you did not request this, ignore this email.`,
    html: layout(
      data.storeName,
      `<p>${intro}</p><p><a href="${escapeHtml(data.url)}">${activate ? 'Activate account' : 'Reset password'}</a></p><p>This link expires in 24 hours.</p>`,
    ),
  };
}

export function disputeEmail(
  to: string,
  data: { storeName: string; orderNumber: number; message: string; orderUrl: string },
): EmailMessage {
  return {
    to,
    subject: `[${data.storeName}] Chargeback update on order #${data.orderNumber}`,
    text: `${data.message}\n\nOpen the order: ${data.orderUrl}`,
    html: layout(
      data.storeName,
      `<p>${escapeHtml(data.message)}</p><p><a href="${escapeHtml(data.orderUrl)}">Open order #${data.orderNumber}</a></p>`,
    ),
  };
}

export function abandonedCheckoutEmail(
  to: string,
  data: {
    storeName: string;
    currency: string;
    lines: OrderEmailData['lines'];
    recoverUrl: string;
  },
): EmailMessage {
  const order = { ...data, orderNumber: 0, total: 0 };
  return {
    to,
    subject: `You left something in your cart at ${data.storeName}`,
    text: `Your checkout wasn't completed, so we saved your items:

${lineText(order)}

Pick up where you left off: ${data.recoverUrl}

Prices and availability are confirmed when you check out.`,
    html: layout(
      data.storeName,
      `<p>Your checkout wasn't completed, so we saved your items:</p>${lineHtml(order)}<p><a href="${escapeHtml(data.recoverUrl)}">Return to your cart</a></p><p style="color:#666;font-size:13px">Prices and availability are confirmed when you check out.</p>`,
    ),
  };
}

export function draftInvoiceEmail(
  to: string,
  data: {
    storeName: string;
    number: number;
    currency: string;
    total: number;
    lines: OrderEmailData['lines'];
    message: string | null;
    payUrl: string;
  },
): EmailMessage {
  const order = { ...data, orderNumber: data.number };
  const total = formatMoney(data.total, data.currency);
  return {
    to,
    subject: `Invoice #D${data.number} from ${data.storeName}`,
    text: `${
      data.message
        ? `${data.message}

`
        : ''
    }${lineText(order)}
Total: ${total}

Pay securely online: ${data.payUrl}`,
    html: layout(
      data.storeName,
      `${data.message ? `<p>${escapeHtml(data.message)}</p>` : ''}<p><strong>Invoice #D${data.number}</strong></p>${lineHtml(order)}<p>Total: <strong>${escapeHtml(total)}</strong></p><p><a href="${escapeHtml(data.payUrl)}">Pay now</a></p>`,
    ),
  };
}

export function giftCardIssuedEmail(
  to: string,
  data: {
    storeName: string;
    code: string;
    value: number;
    currency: string;
    expiresOn: string | null;
    shopUrl: string;
  },
): EmailMessage {
  const value = formatMoney(data.value, data.currency);
  const expiry = data.expiresOn ? `It is valid until ${data.expiresOn}.` : 'It does not expire.';
  return {
    to,
    subject: `Your ${value} gift card for ${data.storeName}`,
    text: `You have a ${value} gift card for ${data.storeName}.

Gift card code: ${data.code}
${expiry}

Enter the code at checkout: ${data.shopUrl}`,
    html: layout(
      data.storeName,
      `<p>You have a <strong>${escapeHtml(value)}</strong> gift card.</p><p style="font-size:20px;letter-spacing:2px"><strong>${escapeHtml(data.code)}</strong></p><p>${escapeHtml(expiry)}</p><p><a href="${escapeHtml(data.shopUrl)}">Start shopping</a> and enter the code at checkout.</p>`,
    ),
  };
}

export function returnUpdateEmail(
  to: string,
  data: { storeName: string; orderNumber: number; message: string },
): EmailMessage {
  return {
    to,
    subject: `[${data.storeName}] Return for order #${data.orderNumber}`,
    text: `${data.message}
`,
    html: layout(data.storeName, `<p>${escapeHtml(data.message)}</p>`),
  };
}
