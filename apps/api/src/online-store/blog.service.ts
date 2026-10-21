import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BlogPost as BlogPostDto,
  blogPostInputSchema,
  Paginated,
  StorefrontBlogPost,
} from '@repo/contracts';
import type { BlogPost, Prisma, TenantTx } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { uniqueHandle } from '../catalog/handles.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';

type PostInput = z.output<typeof blogPostInputSchema>;

const PAGE_SIZE = 12;

function toDto(p: BlogPost): BlogPostDto {
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    excerpt: p.excerpt,
    body: p.body,
    author: p.author,
    tags: p.tags,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    status: !p.publishedAt ? 'draft' : p.publishedAt > new Date() ? 'scheduled' : 'published',
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toStorefront(p: BlogPost & { publishedAt: Date }): StorefrontBlogPost {
  return {
    title: p.title,
    handle: p.handle,
    excerpt: p.excerpt,
    body: p.body,
    author: p.author,
    tags: p.tags,
    publishedAt: p.publishedAt.toISOString(),
  };
}

/** Published means a publish time that has arrived (scheduled posts appear on their own). */
const published = (storeId: string): Prisma.BlogPostWhereInput => ({
  storeId,
  publishedAt: { not: null, lte: new Date() },
});

@Injectable()
export class BlogService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  list(storeId: string): Promise<BlogPostDto[]> {
    return this.tenantDb.run(storeId, async (tx) =>
      (
        await tx.blogPost.findMany({
          where: { storeId },
          orderBy: [{ publishedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
        })
      ).map(toDto),
    );
  }

  get(storeId: string, id: string): Promise<BlogPostDto> {
    return this.tenantDb.run(storeId, async (tx) => toDto(await this.find(tx, storeId, id)));
  }

  create(storeId: string, input: PostInput, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const handle = await uniqueHandle(input.handle, input.title, async (h) =>
        Boolean(await tx.blogPost.findFirst({ where: { storeId, handle: h } })),
      );
      const created = await tx.blogPost.create({
        data: { storeId, ...this.fields(input), handle },
      });
      await this.record(tx, storeId, actor, 'blog_post.created', created, meta);
      return toDto(created);
    });
  }

  update(storeId: string, id: string, input: PostInput, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const existing = await this.find(tx, storeId, id);
      const handle =
        input.handle && input.handle !== existing.handle
          ? await uniqueHandle(input.handle, input.title, async (h) =>
              Boolean(await tx.blogPost.findFirst({ where: { storeId, handle: h } })),
            )
          : existing.handle;
      const updated = await tx.blogPost.update({
        where: { id },
        data: { ...this.fields(input), handle },
      });
      await this.record(tx, storeId, actor, 'blog_post.updated', updated, meta);
      return toDto(updated);
    });
  }

  remove(storeId: string, id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    return this.tenantDb.run(storeId, async (tx) => {
      const post = await this.find(tx, storeId, id);
      await tx.blogPost.delete({ where: { id } });
      await this.record(tx, storeId, actor, 'blog_post.deleted', post, meta);
    });
  }

  storefrontList(
    storeId: string,
    query: { tag?: string; page: number },
  ): Promise<Paginated<StorefrontBlogPost>> {
    return this.tenantDb.run(storeId, async (tx) => {
      const where: Prisma.BlogPostWhereInput = {
        ...published(storeId),
        ...(query.tag ? { tags: { has: query.tag } } : {}),
      };
      const [rows, total] = await Promise.all([
        tx.blogPost.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          skip: (query.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        tx.blogPost.count({ where }),
      ]);
      return {
        items: rows.map((r) => toStorefront(r as BlogPost & { publishedAt: Date })),
        page: query.page,
        pageSize: PAGE_SIZE,
        total,
      };
    });
  }

  storefrontPost(storeId: string, handle: string): Promise<StorefrontBlogPost> {
    return this.tenantDb.run(storeId, async (tx) => {
      const post = await tx.blogPost.findFirst({ where: { ...published(storeId), handle } });
      if (!post) throw new NotFoundException('Post not found.');
      return toStorefront(post as BlogPost & { publishedAt: Date });
    });
  }

  private fields(input: PostInput) {
    return {
      title: input.title,
      excerpt: input.excerpt,
      body: input.body,
      author: input.author,
      tags: input.tags,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
    };
  }

  private async find(tx: TenantTx, storeId: string, id: string): Promise<BlogPost> {
    const post = await tx.blogPost.findFirst({ where: { id, storeId } });
    if (!post) throw new NotFoundException('Post not found.');
    return post;
  }

  private record(
    tx: TenantTx,
    storeId: string,
    actor: AuthUser,
    action: string,
    post: BlogPost,
    meta: RequestMeta,
  ) {
    return this.audit.record(tx, {
      storeId,
      actorUserId: actor.id,
      action,
      entityType: 'blog_post',
      entityId: post.id,
      data: { title: post.title },
      meta,
    });
  }
}
