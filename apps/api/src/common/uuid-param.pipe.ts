import { NotFoundException, type PipeTransform } from '@nestjs/common';
import { isUuid } from '@repo/db';

/** Path ids that are not UUIDs cannot exist; answer 404 instead of a database error. */
export class UuidParam implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isUuid(value)) throw new NotFoundException();
    return value;
  }
}
