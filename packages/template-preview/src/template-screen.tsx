import type { ThemeTemplate } from '@repo/contracts';
import { TemplateThumb } from './template-thumb';

/**
 * A whole template page in a fixed-height window. Hovering or focusing anything inside the nearest
 * `group/template` scrolls the page slowly from top to bottom. It scales with the window's width,
 * so a card shows the same proportions as a real desktop screen.
 */
export function TemplateScreen({
  template,
  height,
  className = '',
  priority = false,
}: {
  template: ThemeTemplate;
  /** CSS length of the window. */
  height: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden [container-type:inline-size] ${className}`}
      style={{ height, ['--screen-height' as string]: height }}
    >
      <div className="transition-transform duration-700 ease-out group-hover/template:[transform:translateY(calc(-100%+var(--screen-height)))] group-hover/template:duration-[7000ms] group-hover/template:ease-linear group-focus-within/template:[transform:translateY(calc(-100%+var(--screen-height)))] group-focus-within/template:duration-[7000ms] group-focus-within/template:ease-linear motion-reduce:[transform:none]!">
        <TemplateThumb
          template={template}
          fullPage
          tiles={Math.min(template.settings.gridColumns, 4)}
          scale="2.6cqw"
          priority={priority}
        />
      </div>
    </div>
  );
}
