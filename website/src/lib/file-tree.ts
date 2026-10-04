import type { ReactNode } from 'react'

import type { TreeNode } from '@/components/ui/file-tree'

interface Folder {
  readonly folders: Map<string, Folder>
  readonly files: string[]
}

const emptyFolder = (): Folder => ({ folders: new Map(), files: [] })

function folderOf(paths: readonly string[]): Folder {
  const root = emptyFolder()
  for (const path of paths) {
    const parts = path.split('/')
    const file = parts.pop() ?? path
    let folder = root
    for (const part of parts) {
      const child = folder.folders.get(part) ?? emptyFolder()
      folder.folders.set(part, child)
      folder = child
    }
    folder.files.push(file)
  }
  return root
}

function nodesOf(folder: Folder, prefix: string, icon?: (path: string) => ReactNode): TreeNode[] {
  const folders = [...folder.folders]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, child]): TreeNode => {
      // A folder holding only one folder reads as one row, like an editor shows it.
      let label = name
      let inner = child
      while (inner.files.length === 0 && inner.folders.size === 1) {
        const [[next, deeper]] = [...inner.folders]
        label = `${label}/${next}`
        inner = deeper
      }
      const path = `${prefix}${label}/`
      return { id: path, label, children: nodesOf(inner, path, icon) }
    })
  const files = [...folder.files]
    .sort((a, b) => a.localeCompare(b))
    .map((name): TreeNode => {
      const path = `${prefix}${name}`
      return icon === undefined
        ? { id: path, label: name }
        : { id: path, label: name, icon: icon(path) }
    })
  return [...folders, ...files]
}

/** Project-relative paths as a folder tree, folders first; `icon` marks a file by its path. */
export const treeOf = (paths: readonly string[], icon?: (path: string) => ReactNode): TreeNode[] =>
  nodesOf(folderOf(paths), '', icon)

/** The ids of every folder in `nodes`, to open a tree fully. */
export const folderIds = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((node) =>
    node.children === undefined ? [] : [node.id, ...folderIds(node.children)]
  )
