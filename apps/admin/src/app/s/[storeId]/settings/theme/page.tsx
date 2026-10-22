import { findThemeTemplate, parseTheme, type Theme } from '@repo/contracts';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { storefrontUrlFor } from '@/lib/storefront';
import { applyTemplateAction } from '../commerce-actions';
import { CustomizeForm } from './customize-form';
import { TemplateGallery } from './template-gallery';
import { TemplateThumbnail } from './template-thumbnail';

type Tab = 'templates' | 'customize';

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ storeId }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab: Tab = rawTab === 'customize' ? 'customize' : 'templates';
  const [store, saved] = await Promise.all([
    getStore(storeId),
    api<Theme>(`/admin/stores/${storeId}/theme`),
  ]);
  // Fills defaults for any field the stored theme predates, so every control has a value.
  const theme = parseTheme(saved.preset, saved.settings);
  const canEdit = store.permissions.includes('themes:write');
  const s = theme.settings;
  const current = findThemeTemplate(s.template);
  const storefrontUrl = storefrontUrlFor(store.subdomain);
  const base = `/s/${storeId}/settings/theme`;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="w-full shrink-0 overflow-hidden rounded-md border border-slate-200 sm:w-56">
          <TemplateThumbnail
            preset={theme.preset}
            settings={s}
            storeName={store.name}
            heroTitle={s.heroTitle || store.name}
            announcement={s.announcement}
            height={140}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Current theme
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
            {current ? current.name : 'Custom theme'}
          </h2>
          <p className="text-sm text-slate-500">
            {current
              ? `${current.industryLabel} · ${current.styleLabel}`
              : 'Your own combination of colors, fonts and layout.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View storefront ↗
            </a>
          </div>
        </div>
      </section>

      <nav aria-label="Theme" className="flex gap-1 rounded-lg bg-slate-100 p-1 sm:w-fit">
        {(
          [
            ['templates', 'Templates'],
            ['customize', 'Customize'],
          ] as const
        ).map(([id, label]) => (
          <Link
            key={id}
            href={`${base}?tab=${id}`}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex-1 rounded-md px-4 py-1.5 text-center text-sm font-medium sm:flex-none ${
              tab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'templates' ? (
        <Card
          title="Template store"
          description="Pick a starting design for your industry. Applying a template changes colors, fonts and layout; your homepage text stays."
        >
          <TemplateGallery
            currentTemplate={s.template}
            storefrontUrl={storefrontUrl}
            applyAction={canEdit ? applyTemplateAction.bind(null, storeId) : undefined}
          />
        </Card>
      ) : (
        <div className="max-w-3xl">
          <Card
            title="Customize"
            description="Fine-tune every part of your storefront's look. Changes are live on save."
          >
            <CustomizeForm storeId={storeId} theme={theme} canEdit={canEdit} />
          </Card>
        </div>
      )}
    </div>
  );
}
