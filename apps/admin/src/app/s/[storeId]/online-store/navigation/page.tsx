import {
  type Collection,
  type Menu,
  type MenuLink,
  type Page,
  type Paginated,
  POLICY_KINDS,
  POLICY_TITLES,
  type ProductListItem,
} from '@repo/contracts';
import { ActionForm, SubmitButton } from '@/components/form';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../confirm-button';
import { resetMenuAction, saveMenuAction } from '../actions';

const MENU_INFO: Record<Menu['handle'], { title: string; description: string }> = {
  main: {
    title: 'Main menu',
    description:
      'Links in the storefront header. Until you save it, the header shows “Shop all” and your collections.',
  },
  footer: {
    title: 'Footer menu',
    description:
      'Links in the storefront footer. Published policies are always listed after these.',
  },
};

/** Empty rows offered below the saved items (a menu holds at most 20 links). */
const SPARE_ROWS = 3;
const MAX_ITEMS = 20;

const inputClass =
  'block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50';

function targetValue(link: MenuLink): string {
  switch (link.type) {
    case 'collection':
    case 'product':
    case 'page':
      return `${link.type}:${link.handle}`;
    case 'policy':
      return `policy:${link.kind}`;
    default:
      return link.type;
  }
}

export default async function NavigationPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const base = `/admin/stores/${storeId}`;
  const [store, menus, collections, pages, products] = await Promise.all([
    getStore(storeId),
    api<Menu[]>(`${base}/menus`),
    api<Collection[]>(`${base}/collections`),
    api<Page[]>(`${base}/pages`),
    api<Paginated<ProductListItem>>(`${base}/products`, { query: { pageSize: 100 } }),
  ]);
  const canWrite = store.permissions.includes('themes:write');

  const targets: { group: string; options: { value: string; label: string }[] }[] = [
    {
      group: 'Store',
      options: [
        { value: 'home', label: 'Home page' },
        { value: 'catalog', label: 'All products' },
        { value: 'search', label: 'Search' },
        { value: 'url', label: 'Custom URL…' },
      ],
    },
    {
      group: 'Collections',
      options: collections.map((c) => ({ value: `collection:${c.handle}`, label: c.title })),
    },
    { group: 'Pages', options: pages.map((p) => ({ value: `page:${p.handle}`, label: p.title })) },
    {
      group: 'Policies',
      options: POLICY_KINDS.map((k) => ({ value: `policy:${k}`, label: POLICY_TITLES[k] })),
    },
    {
      group: 'Products',
      options: products.items.map((p) => ({ value: `product:${p.handle}`, label: p.title })),
    },
  ].filter((g) => g.options.length > 0);

  return (
    <div className="space-y-6">
      {menus.map((menu) => {
        const rows = Math.min(MAX_ITEMS, menu.items.length + SPARE_ROWS);
        const info = MENU_INFO[menu.handle];
        return (
          <Card key={menu.handle} title={info.title} description={info.description}>
            <ActionForm
              action={saveMenuAction.bind(null, storeId, menu.handle, rows)}
              className="space-y-3"
            >
              {/* Remount the inputs (not the form, which holds the result message) after a save. */}
              <fieldset key={JSON.stringify(menu.items)} disabled={!canWrite} className="space-y-2">
                <legend className="sr-only">{info.title} links</legend>
                <div className="hidden grid-cols-[4rem_1fr_1fr_1fr] gap-2 text-xs font-medium text-slate-500 sm:grid">
                  <span>Order</span>
                  <span>Label</span>
                  <span>Links to</span>
                  <span>Custom URL</span>
                </div>
                {Array.from({ length: rows }, (_, i) => {
                  const item = menu.items[i];
                  const link = item?.link;
                  return (
                    <div key={i} className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr_1fr]">
                      <input
                        name={`position-${i}`}
                        type="number"
                        min={1}
                        max={99}
                        defaultValue={i + 1}
                        aria-label={`Order of link ${i + 1}`}
                        className={inputClass}
                      />
                      <input
                        name={`title-${i}`}
                        defaultValue={item?.title ?? ''}
                        maxLength={60}
                        placeholder="Label (empty to remove)"
                        aria-label={`Label of link ${i + 1}`}
                        className={inputClass}
                      />
                      <select
                        name={`target-${i}`}
                        defaultValue={link ? targetValue(link) : 'home'}
                        aria-label={`Destination of link ${i + 1}`}
                        className={inputClass}
                      >
                        {targets.map((g) => (
                          <optgroup key={g.group} label={g.group}>
                            {g.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <input
                        name={`url-${i}`}
                        defaultValue={link?.type === 'url' ? link.url : ''}
                        maxLength={500}
                        placeholder="/path or https://…"
                        aria-label={`Custom URL of link ${i + 1}`}
                        className={inputClass}
                      />
                    </div>
                  );
                })}
              </fieldset>
              <p className="text-xs text-slate-500">
                Links to hidden collections, draft products or unpublished pages are not shown. Save
                to add more rows (up to {MAX_ITEMS}).
              </p>
              {canWrite ? (
                <SubmitButton variant="secondary">Save {info.title.toLowerCase()}</SubmitButton>
              ) : null}
            </ActionForm>
            {canWrite && menu.customized ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <ConfirmButton
                  action={resetMenuAction.bind(null, storeId, menu.handle)}
                  label="Reset to default"
                  confirmLabel="Yes, reset menu"
                />
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
