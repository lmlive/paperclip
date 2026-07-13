import { translateUiPhrase } from "./ui-phrases";

const ATTRIBUTE_NAMES = ["aria-label", "title", "placeholder"] as const;
const SKIP_TAGS = new Set(["CODE", "INPUT", "OPTION", "PRE", "SCRIPT", "STYLE", "TEXTAREA"]);

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

let observer: MutationObserver | null = null;
let scheduled = false;
let currentLocaleGetter: (() => string) | null = null;

function withOriginalWhitespace(original: string, translated: string): string {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  return Boolean(parent.closest("[data-no-i18n], code, pre, textarea"));
}

function localizeTextNode(node: Text, locale: string) {
  if (shouldSkipTextNode(node)) return;

  const currentValue = node.nodeValue ?? "";
  const storedOriginal = originalText.get(node);
  const storedTranslation =
    storedOriginal && locale !== "en"
      ? translateUiPhrase(storedOriginal.trim(), locale)
      : null;
  const storedLocalized =
    storedOriginal && storedTranslation
      ? withOriginalWhitespace(storedOriginal, storedTranslation)
      : null;
  const original =
    storedOriginal && (currentValue === storedOriginal || currentValue === storedLocalized)
      ? storedOriginal
      : currentValue;
  if (storedOriginal !== original) originalText.set(node, original);

  if (locale === "en") {
    if (node.nodeValue !== original) node.nodeValue = original;
    return;
  }

  const trimmed = original.trim();
  if (!trimmed) return;
  const translated = translateUiPhrase(trimmed, locale);
  if (translated) {
    const localized = withOriginalWhitespace(original, translated);
    if (node.nodeValue !== localized) node.nodeValue = localized;
  }
}

function localizeElementAttributes(element: Element, locale: string) {
  for (const attributeName of ATTRIBUTE_NAMES) {
    const currentValue = element.getAttribute(attributeName);
    if (!currentValue) continue;

    let attributes = originalAttributes.get(element);
    if (!attributes) {
      attributes = new Map();
      originalAttributes.set(element, attributes);
    }

    const storedOriginal = attributes.get(attributeName);
    const storedTranslation =
      storedOriginal && locale !== "en"
        ? translateUiPhrase(storedOriginal.trim(), locale)
        : null;
    const original =
      storedOriginal && (currentValue === storedOriginal || currentValue === storedTranslation)
        ? storedOriginal
        : currentValue;
    if (storedOriginal !== original) attributes.set(attributeName, original);

    if (locale === "en") {
      if (currentValue !== original) element.setAttribute(attributeName, original);
      continue;
    }

    const translated = translateUiPhrase(original.trim(), locale);
    if (translated && currentValue !== translated) {
      element.setAttribute(attributeName, translated);
    }
  }
}

function localizeNode(root: Node, locale: string) {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root as Text, locale);
    return;
  }

  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
  if (root instanceof Element) localizeElementAttributes(root, locale);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      localizeTextNode(current as Text, locale);
    } else if (current instanceof Element) {
      localizeElementAttributes(current, locale);
    }
    current = walker.nextNode();
  }
}

function applyCurrentLocalization() {
  scheduled = false;
  const locale = currentLocaleGetter?.() ?? "en";
  localizeNode(document.body, locale);
}

function scheduleLocalization() {
  if (scheduled) return;
  scheduled = true;
  window.queueMicrotask(applyCurrentLocalization);
}

export function applyDomLocalization(locale: string) {
  if (typeof document === "undefined" || !document.body) return;
  localizeNode(document.body, locale);
}

export function startDomLocalization(getLocale: () => string) {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  currentLocaleGetter = getLocale;
  observer?.disconnect();
  observer = new MutationObserver(scheduleLocalization);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [...ATTRIBUTE_NAMES],
    childList: true,
    characterData: true,
    subtree: true,
  });
  scheduleLocalization();
}
