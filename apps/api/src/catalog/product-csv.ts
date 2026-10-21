import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Injectable,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  csvRowsToProducts,
  parseCsv,
  type ProductCsvImportResult,
  productInputSchema,
  productsToCsvRows,
  toCsv,
} from '@repo/contracts';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';
import { PlanLimitError } from '../platform/plans.service.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { ProductsService } from './products.service.js';

const MAX_CSV_BYTES = 4 * 1024 * 1024;

@Injectable()
export class ProductCsvService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly products: ProductsService,
  ) {}

  async export(store: StoreContext): Promise<{ filename: string; csv: string }> {
    const rows = await this.tenantDb.run(store.id, (tx) =>
      tx.product.findMany({
        where: { storeId: store.id },
        orderBy: { createdAt: 'asc' },
        include: {
          options: { orderBy: { position: 'asc' } },
          variants: { orderBy: { position: 'asc' } },
        },
      }),
    );
    const csv = toCsv(
      productsToCsvRows(
        rows.map((p) => ({
          handle: p.handle,
          title: p.title,
          description: p.description,
          vendor: p.vendor,
          productType: p.productType,
          tags: p.tags,
          status: p.status,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          options: p.options.map((o) => ({ name: o.name, values: o.values })),
          variants: p.variants.map((v) => ({
            options: v.options,
            sku: v.sku,
            barcode: v.barcode,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            weightGrams: v.weightGrams,
            requiresShipping: v.requiresShipping,
            taxable: v.taxable,
            trackInventory: v.trackInventory,
            allowBackorder: v.allowBackorder,
            inventoryQuantity: v.inventoryQuantity,
          })),
        })),
        store.currency,
      ),
    );
    return { filename: `products-${new Date().toISOString().slice(0, 10)}.csv`, csv };
  }

  /**
   * Creates the products in a CSV. Each product is validated and created on its own (same rules,
   * quotas and audit trail as the product editor); existing handles are skipped, never changed.
   */
  async import(
    store: StoreContext,
    text: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<ProductCsvImportResult> {
    let rows: string[][];
    try {
      rows = parseCsv(text);
    } catch {
      throw new BadRequestException('The file is not valid CSV (unterminated quote).');
    }
    const parsed = csvRowsToProducts(rows, store.currency);
    const result: ProductCsvImportResult = { created: [], skipped: [], errors: parsed.errors };
    const badRows = new Set(parsed.errors.map((e) => e.row));
    const existing = new Set(
      (
        await this.tenantDb.run(store.id, (tx) =>
          tx.product.findMany({
            where: { storeId: store.id, handle: { in: parsed.products.map((p) => p.handle) } },
            select: { handle: true },
          }),
        )
      ).map((p) => p.handle),
    );

    for (const product of parsed.products) {
      if (existing.has(product.handle)) {
        result.skipped.push({
          handle: product.handle,
          reason: 'A product with this handle exists.',
        });
        continue;
      }
      if (badRows.has(product.row)) continue;
      const input = productInputSchema.safeParse(product.input);
      if (!input.success) {
        for (const issue of input.error.issues.slice(0, 5)) {
          const at = issue.path.length ? ` (${issue.path.join('.')})` : '';
          result.errors.push({
            row: product.row,
            message: `${product.handle}: ${issue.message}${at}`,
          });
        }
        continue;
      }
      try {
        const created = await this.products.create(store, input.data, actor, meta);
        result.created.push({ handle: created.handle, title: created.title });
      } catch (error) {
        if (error instanceof PlanLimitError) {
          result.errors.push({ row: product.row, message: `${error.message} Import stopped.` });
          break;
        }
        if (error instanceof HttpException) {
          result.errors.push({ row: product.row, message: `${product.handle}: ${error.message}` });
          continue;
        }
        throw error;
      }
    }
    return result;
  }
}

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/product-csv')
export class ProductCsvController {
  constructor(private readonly csv: ProductCsvService) {}

  @Get('export')
  @RequirePermission('products:read')
  export(@CurrentStore() store: StoreContext): Promise<{ filename: string; csv: string }> {
    return this.csv.export(store);
  }

  @Post('import')
  @HttpCode(200)
  @RequirePermission('products:write')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_CSV_BYTES, files: 1, fields: 2 } }),
  )
  import(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @ReqMeta() meta: RequestMeta,
  ): Promise<ProductCsvImportResult> {
    if (!file) throw new BadRequestException('Attach a CSV file in the "file" field.');
    return this.csv.import(store, file.buffer.toString('utf8'), user, meta);
  }
}
