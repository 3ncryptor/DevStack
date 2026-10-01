/**
 * Folder-tree previews shown before the architecture questions (task 3.8). Each tree lists the
 * folders the module creates; a unit test checks them against the module's templates, so a
 * preview cannot promise a folder that is not generated.
 */
export const FOLDER_PREVIEWS: Readonly<Record<string, readonly string[]>> = {
  'arch-feature': ['src/features/<name>/', 'src/shared/types/', 'src/shared/utils/'],
  'arch-clean': ['src/domain/', 'src/application/', 'src/infrastructure/', 'src/interfaces/'],
  'arch-mvc': [
    'src/config/',
    'src/controllers/',
    'src/middlewares/',
    'src/models/',
    'src/routes/',
    'src/services/',
    'src/utils/',
    'src/validators/'
  ],
  'arch-flat': ['src/  (no extra folders; features go in src/modules/<name>/)'],
  'arch-web-feature': ['features/<name>/', 'components/', 'hooks/', 'types/'],
  'arch-web-layer': ['components/', 'constants/', 'hooks/', 'types/', 'utils/'],
  'arch-web-atomic': [
    'components/atoms/',
    'components/molecules/',
    'components/organisms/',
    'components/templates/',
    'hooks/'
  ]
}

/** The note shown before a question: one indented tree per choice, under its label. */
export function previewNote(choices: ReadonlyArray<{ value: string; label: string }>): string {
  return choices
    .filter((choice) => FOLDER_PREVIEWS[choice.value] !== undefined)
    .map((choice) =>
      [choice.label, ...(FOLDER_PREVIEWS[choice.value] ?? []).map((folder) => `  ${folder}`)].join(
        '\n'
      )
    )
    .join('\n\n')
}
