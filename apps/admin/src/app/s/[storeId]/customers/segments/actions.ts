'use server';

import { parseMoney, type Segment, type SegmentCondition } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, formValues, requiredString, toFormState } from '@/lib/form';

/** Rows are numbered fields: field-0, op-0, value-0; rows without a field are skipped. */
function conditions(formData: FormData, rows: number, currency: string): SegmentCondition[] {
  const result: SegmentCondition[] = [];
  for (let i = 0; i < rows; i++) {
    const field = requiredString(formData, `field-${i}`);
    if (!field) continue;
    const op = requiredString(formData, `op-${i}`);
    const raw = requiredString(formData, `value-${i}`).trim();
    if (field === 'acceptsMarketing' || field === 'hasAccount') {
      result.push({ field, value: raw !== 'no' });
      continue;
    }
    const value = field === 'totalSpent' ? parseMoney(raw, currency) : Number(raw);
    if (value === null || !Number.isInteger(value) || value < 0) {
      throw new Error(
        `Condition ${i + 1}: enter a whole number${field === 'totalSpent' ? ' or amount' : ''}.`,
      );
    }
    result.push({ field, op, value } as SegmentCondition);
  }
  return result;
}

export async function saveSegmentAction(
  storeId: string,
  segmentId: string | null,
  rows: number,
  currency: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let saved: Segment;
  try {
    const body = {
      name: requiredString(formData, 'name'),
      conditions: conditions(formData, rows, currency),
    };
    const path = `/admin/stores/${storeId}/segments`;
    saved = segmentId
      ? await api<Segment>(`${path}/${segmentId}`, { method: 'PUT', body })
      : await api<Segment>(path, { method: 'POST', body });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Condition ')) {
      return { error: error.message, values: formValues(formData) };
    }
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/customers/segments`);
  if (!segmentId) redirect(`/s/${storeId}/customers/segments/${saved.id}`);
  return { success: `Segment saved: ${saved.customerCount} customer(s) match.` };
}

export async function deleteSegmentAction(storeId: string, segmentId: string) {
  await api(`/admin/stores/${storeId}/segments/${segmentId}`, { method: 'DELETE' });
  revalidatePath(`/s/${storeId}/customers/segments`);
  redirect(`/s/${storeId}/customers/segments`);
}
