function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null
}

export function isTextEntryTarget(target: EventTarget | null): boolean {
  const el = asElement(target)
  if (!el) return false
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) return el.type !== 'checkbox' && el.type !== 'radio'
  return el instanceof HTMLElement && el.isContentEditable
}

// Enter on these elements must keep its native meaning (activate the focused control).
export function isActivatableTarget(target: EventTarget | null): boolean {
  return asElement(target)?.closest('button, a[href], summary, [role="button"], [role="link"]') != null
}

export function isInsideDialog(target: EventTarget | null): boolean {
  return asElement(target)?.closest('dialog') != null
}
