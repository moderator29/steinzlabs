const ALLOWED_TAGS = new Set([
  'a', 'b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'hr', 'div', 'span',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'class']),
  '*': new Set(['class']),
};

// Schemes an <a href> is allowed to carry. Relative URLs have no scheme and
// are always allowed.
const SAFE_URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function sanitizeNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }

    const allowed = new Set([...(ALLOWED_ATTRS['*'] || []), ...(ALLOWED_ATTRS[tag] || [])]);
    for (const attr of Array.from(el.attributes)) {
      if (!allowed.has(attr.name)) {
        el.removeAttribute(attr.name);
      }
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      // Browsers ignore embedded whitespace/control chars and are
      // case-insensitive on the scheme, so the old startsWith('javascript:')
      // check was trivially bypassed by "JavaScript:", " javascript:" or
      // "java\tscript:". Strip control chars + whitespace, lowercase, then
      // allowlist safe schemes.
      const normalized = href.replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
      const scheme = normalized.match(/^([a-z][a-z0-9+.-]*):/)?.[1];
      if (scheme && !SAFE_URL_SCHEMES.has(scheme)) {
        el.removeAttribute('href');
      }
      el.setAttribute('rel', 'noopener noreferrer');
    }

    Array.from(el.childNodes).forEach(sanitizeNode);
  }

  Array.from(doc.body.childNodes).forEach(sanitizeNode);
  return doc.body.innerHTML;
}
