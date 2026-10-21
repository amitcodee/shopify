'use server';

import {
  type MenuHandle,
  type MenuItem,
  type MenuLink,
  type Page,
  type PolicyKind,
  policyKindSchema,
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

function pageBody(formData: FormData) {
  return {
    title: requiredString(formData, 'title'),
    handle: optionalString(formData, 'handle'),
    body: requiredString(formData, 'body'),
    published: formData.get('published') === 'on',
  };
}

export async function savePageAction(
  storeId: string,
  pageId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let saved: Page;
  try {
    saved = pageId
      ? await api<Page>(`/admin/stores/${storeId}/pages/${pageId}`, {
          method: 'PUT',
          body: pageBody(formData),
        })
      : await api<Page>(`/admin/stores/${storeId}/pages`, {
          method: 'POST',
          body: pageBody(formData),
        });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/online-store/pages`);
  if (!pageId) redirect(`/s/${storeId}/online-store/pages/${saved.id}`);
  return { success: 'Page saved.' };
}

export async function deletePageAction(storeId: string, pageId: string) {
  await api(`/admin/stores/${storeId}/pages/${pageId}`, { method: 'DELETE' });
  revalidatePath(`/s/${storeId}/online-store/pages`);
  redirect(`/s/${storeId}/online-store/pages`);
}

export async function savePolicyAction(
  storeId: string,
  kind: PolicyKind,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const body = requiredString(formData, 'body');
  try {
    await api(`/admin/stores/${storeId}/policies/${policyKindSchema.parse(kind)}`, {
      method: 'PUT',
      body: { body },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/online-store/policies`);
  return { success: body.trim() ? 'Policy saved.' : 'Policy removed.' };
}

/**
 * Parses a "Link to" option value: "home", "catalog", "search", "url",
 * "collection:<handle>", "product:<handle>", "page:<handle>" or "policy:<kind>".
 */
function parseLink(target: string, url: string): MenuLink | null {
  const [type, value = ''] = target.split(':', 2);
  switch (type) {
    case 'home':
    case 'catalog':
    case 'search':
      return { type };
    case 'collection':
    case 'product':
    case 'page':
      return { type, handle: value };
    case 'policy':
      return { type, kind: value as PolicyKind };
    case 'url':
      return { type, url: url.trim() };
    default:
      return null;
  }
}

/** Rows are numbered fields (title-0, target-0, url-0, position-0, ...); blank titles are skipped. */
export async function saveMenuAction(
  storeId: string,
  handle: MenuHandle,
  rows: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const entries: { position: number; index: number; item: MenuItem }[] = [];
  for (let i = 0; i < rows; i++) {
    const title = requiredString(formData, `title-${i}`).trim();
    if (!title) continue;
    const link = parseLink(
      requiredString(formData, `target-${i}`),
      requiredString(formData, `url-${i}`),
    );
    if (!link) return { error: `Choose where “${title}” links to.`, values: formValues(formData) };
    const position = Number(requiredString(formData, `position-${i}`)) || i + 1;
    entries.push({ position, index: i, item: { title, link } });
  }
  entries.sort((a, b) => a.position - b.position || a.index - b.index);
  try {
    await api(`/admin/stores/${storeId}/menus/${handle}`, {
      method: 'PUT',
      body: { items: entries.map((e) => e.item) },
    });
  } catch (error) {
    // Validation paths look like "items.3.link.url"; name the row instead of a hidden field.
    const state = toFormState(error, formData);
    const [path, message] = Object.entries(state?.fieldErrors ?? {})[0] ?? [];
    const row = /^items\.(\d+)/.exec(path ?? '');
    const title = row ? entries[Number(row[1])]?.item.title : undefined;
    return title ? { error: `“${title}”: ${message}`, values: state?.values } : state;
  }
  revalidatePath(`/s/${storeId}/online-store/navigation`);
  return { success: 'Menu saved.' };
}

export async function resetMenuAction(storeId: string, handle: MenuHandle) {
  await api(`/admin/stores/${storeId}/menus/${handle}`, { method: 'DELETE' });
  revalidatePath(`/s/${storeId}/online-store/navigation`);
}

export async function saveStorefrontAccessAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/storefront-access`, {
      method: 'PUT',
      body: {
        enabled: formData.get('enabled') === 'on',
        password: optionalString(formData, 'password'),
        message: requiredString(formData, 'message'),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/online-store/password`);
  return { success: 'Saved.' };
}
