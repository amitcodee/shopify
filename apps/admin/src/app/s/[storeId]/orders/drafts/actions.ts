'use server';

import {
  type DraftLineInput,
  type DraftOrder,
  type DraftOrderInput,
  parseMoney,
} from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import {
  type FormState,
  formValues,
  optionalString,
  requiredString,
  toFormState,
} from '@/lib/form';

const ADDRESS_FIELDS = ['name', 'line1', 'line2', 'city', 'region', 'postalCode', 'country'];

class FieldError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

function money(formData: FormData, key: string, currency: string, label: string): number {
  const value = parseMoney(requiredString(formData, key), currency);
  if (value === null) throw new FieldError(key, `Enter a price for ${label}`);
  return value;
}

/** Rows are numbered fields: item-0 ("variant:<id>" or "custom"), title-0, qty-0, price-0. */
function draftBody(formData: FormData, rows: number, currency: string): DraftOrderInput {
  const lines: DraftLineInput[] = [];
  for (let i = 0; i < rows; i++) {
    const item = requiredString(formData, `item-${i}`);
    if (!item) continue;
    const quantity = Number(requiredString(formData, `qty-${i}`)) || 1;
    if (item === 'custom') {
      const title = requiredString(formData, `title-${i}`).trim();
      if (!title) throw new FieldError(`title-${i}`, 'Name the custom item');
      lines.push({
        title,
        quantity,
        unitPrice: money(formData, `price-${i}`, currency, title),
        requiresShipping: formData.get(`ship-${i}`) === 'on',
      });
    } else {
      const override = optionalString(formData, `price-${i}`);
      lines.push({
        variantId: item.replace(/^variant:/, ''),
        quantity,
        ...(override ? { unitPrice: money(formData, `price-${i}`, currency, 'this item') } : {}),
      });
    }
  }

  const address = (field: string) => optionalString(formData, `shippingAddress.${field}`) ?? '';
  const hasAddress = ADDRESS_FIELDS.some((f) => address(f) !== '');
  const shippingTitle = optionalString(formData, 'shipping.title');
  const discountType = requiredString(formData, 'discount.type');
  const discountValue = optionalString(formData, 'discount.value') ?? '';
  return {
    email: optionalString(formData, 'email') ?? null,
    lines,
    // Required parts are always sent so the API can point at the missing one.
    shippingAddress: hasAddress
      ? {
          name: address('name'),
          line1: address('line1'),
          city: address('city'),
          postalCode: address('postalCode'),
          country: address('country'),
          ...(address('line2') ? { line2: address('line2') } : {}),
          ...(address('region') ? { region: address('region') } : {}),
        }
      : null,
    shipping: shippingTitle
      ? { title: shippingTitle, price: money(formData, 'shipping.price', currency, 'shipping') }
      : null,
    discount:
      discountType === 'PERCENTAGE'
        ? { type: 'PERCENTAGE', value: Number(discountValue) }
        : discountType === 'FIXED_AMOUNT'
          ? {
              type: 'FIXED_AMOUNT',
              value: money(formData, 'discount.value', currency, 'the discount'),
            }
          : null,
    note: optionalString(formData, 'note') ?? null,
  };
}

export async function saveDraftAction(
  storeId: string,
  draftId: string | null,
  rows: number,
  currency: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let saved: DraftOrder;
  try {
    const body = draftBody(formData, rows, currency);
    if (body.lines.length === 0) {
      return { error: 'Add at least one item.', values: formValues(formData) };
    }
    const path = `/admin/stores/${storeId}/draft-orders`;
    saved = draftId
      ? await api<DraftOrder>(`${path}/${draftId}`, { method: 'PUT', body })
      : await api<DraftOrder>(path, { method: 'POST', body });
  } catch (error) {
    if (error instanceof FieldError) {
      return {
        error: 'Please fix the highlighted fields.',
        fieldErrors: { [error.field]: error.message },
        values: formValues(formData),
      };
    }
    const state = toFormState(error, formData);
    // Line errors ("lines.2.quantity") have no single field; say which row.
    const lineError = Object.entries(state?.fieldErrors ?? {}).find(([k]) =>
      k.startsWith('lines.'),
    );
    return lineError
      ? { ...state, error: `Item ${Number(lineError[0].split('.')[1]) + 1}: ${lineError[1]}` }
      : state;
  }
  revalidatePath(`/s/${storeId}/orders/drafts`);
  if (!draftId) redirect(`/s/${storeId}/orders/drafts/${saved.id}`);
  return { success: 'Draft saved.' };
}

export async function sendInvoiceAction(
  storeId: string,
  draftId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/draft-orders/${draftId}/send-invoice`, {
      method: 'POST',
      body: { message: optionalString(formData, 'message') },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/orders/drafts/${draftId}`);
  return { success: 'Invoice sent.' };
}

export async function completeDraftAction(
  storeId: string,
  draftId: string,
  _: FormState,
): Promise<FormState> {
  let draft: DraftOrder;
  try {
    draft = await api<DraftOrder>(`/admin/stores/${storeId}/draft-orders/${draftId}/complete`, {
      method: 'POST',
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/orders`);
  redirect(draft.order ? `/s/${storeId}/orders/${draft.order.id}` : `/s/${storeId}/orders/drafts`);
}

export async function deleteDraftAction(storeId: string, draftId: string) {
  await api(`/admin/stores/${storeId}/draft-orders/${draftId}`, { method: 'DELETE' });
  revalidatePath(`/s/${storeId}/orders/drafts`);
  redirect(`/s/${storeId}/orders/drafts`);
}
