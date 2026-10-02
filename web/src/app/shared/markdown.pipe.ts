import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { sanitizeMarkdown } from './markdown-sanitizer';

/**
 * Renders markdown for [innerHTML] binding.
 *
 * Parsing and XSS sanitization are fully delegated to the pure
 * sanitizeMarkdown() chokepoint (marked + DOMPurify). Only that
 * already-sanitized HTML is marked trusted — bypassing Angular's second
 * sanitization pass here keeps DOMPurify-approved attributes (link
 * target/rel, table alignment) that Angular's built-in sanitizer would
 * strip. Never pass unsanitized HTML to bypassSecurityTrustHtml.
 */
@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(sanitizeMarkdown(value ?? ''));
  }
}
