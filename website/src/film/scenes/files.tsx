import { interpolate, useCurrentFrame } from 'remotion'

import type { FilmData } from '../film-data'
import { TerminalFrame } from '../terminal-frame'

const LINE_PX = 30
const VISIBLE_LINES = 13

/** A path as a tree line: indented by depth, folders dimmed. */
function TreeLine({ path }: { readonly path: string }) {
  const parts = path.split('/')
  const name = parts.at(-1) ?? path
  return (
    <p style={{ paddingLeft: (parts.length - 1) * 28 }}>
      <span className="text-muted-foreground">{parts.length > 1 ? '└─ ' : '· '}</span>
      {name}
      {parts.length > 1 && (
        <span className="text-muted-foreground"> {parts.slice(0, -1).join('/')}/</span>
      )}
    </p>
  )
}

/** Scene 2: the review screen, then the planned files scroll by as they are written. */
export function FilesScene({ data }: { readonly data: FilmData }) {
  const frame = useCurrentFrame()
  const scroll = interpolate(frame, [15, 125], [0, (data.files.length - VISIBLE_LINES) * LINE_PX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const written = Math.round(
    interpolate(frame, [15, 125], [0, data.files.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    })
  )

  return (
    <TerminalFrame title={`~/projects/${data.projectName}`}>
      <p>
        <span className="text-primary">✔ </span>Review · Generate
        <span className="text-muted-foreground">
          {' '}
          · writing {written}/{data.files.length} files
        </span>
      </p>
      <div className="mt-3 h-[400px] overflow-hidden">
        <div style={{ transform: `translateY(${-scroll}px)` }}>
          {data.files.map((file) => (
            <TreeLine key={file} path={file} />
          ))}
        </div>
      </div>
    </TerminalFrame>
  )
}
