import { applyDecorators, BadRequestException, type PipeTransform } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';

export class ValidationFailedException extends BadRequestException {
  constructor(error: z.ZodError) {
    super({
      title: 'Validation failed',
      errors: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}

/** Validates and transforms a request part (body/query/param) with a Zod schema. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new ValidationFailedException(result.error);
    return result.data;
  }
}

type OpenApiSchema = NonNullable<
  Extract<Parameters<typeof ApiBody>[0], { schema?: unknown }>['schema']
>;

/** Documents a Zod-validated JSON body in the OpenAPI spec. */
export function ApiZodBody(schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  return applyDecorators(ApiBody({ schema: jsonSchema as OpenApiSchema }));
}
