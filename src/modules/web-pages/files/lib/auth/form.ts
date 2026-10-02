/** A text field of a submitted form; FormData can also hold files, which count as empty. */
export function formText(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
