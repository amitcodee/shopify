import { findThemeTemplate, parseTheme, type Theme } from '@repo/contracts';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { buttonClass, Card } from '@/components/ui';
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
      <section className="flex flex-col gap-5 rounded-xl border border-slate-200/90 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:p-5">
        <div className="w-full shrink-0 overflow-hidden rounded-lg border border-slate-200 shadow-xs sm:w-60">
          <TemplateThumbnail
            photos={current?.industry}
            preset={theme.preset}
            settings={s}
            storeName={store.name}
            heroTitle={s.heroTitle || store.name}
            announcement={s.announcement}
            height={140}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Current theme · live
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            {current ? current.name : 'Custom theme'}
          </h2>
          <p className="text-sm text-slate-500">
            {current
              ? `${current.industryLabel} · ${current.styleLabel}`
              : 'Your own combination of colors, fonts and layout.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('secondary', 'sm')}
            >
              <Icon name="external" className="-ml-0.5 h-4 w-4 text-slate-500" />
              View storefront
            </a>
          </div>
        </div>
      </section>

      <nav
        aria-label="Theme"
        className="flex gap-0.5 rounded-lg bg-slate-900/[0.045] p-0.5 sm:w-fit"
      >
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
            className={`flex-1 rounded-md px-4 py-1.5 text-center text-sm font-medium transition-colors sm:flex-none ${
              tab === id
                ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/[0.06]'
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
