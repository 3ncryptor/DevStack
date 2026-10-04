import { useCurrentFrame } from 'remotion'

import { ramp } from '../anim'
import { Camera } from '../camera'
import type { SceneProps } from '../film-data'
import { TerminalFrame } from '../terminal-frame'

const LINE_PX = 50
const VISIBLE_LINES = 11
const WRITE_START = 10
const DEPTH_INDENT_PX = 40

/** A path as a tree line: indented by depth, its folder dimmed after the name. */
function TreeLine({ path }: { readonly path: string }) {
  const parts = path.split('/')
  return (
    <p style={{ height: LINE_PX, paddingLeft: (parts.length - 1) * DEPTH_INDENT_PX }}>
      <span className="text-muted-foreground">{parts.length > 1 ? '└─ ' : '· '}</span>
      {parts.at(-1)}
      {parts.length > 1 && (
        <span className="text-muted-foreground"> {parts.slice(0, -1).join('/')}/</span>
      )}
    </p>
  )
}

/** Scene 4: the planned files stream out under a running count, the camera swinging round. */
export function GenerateScene({ data, duration }: SceneProps) {
  const frame = useCurrentFrame()
  const writeEnd = duration - 20
  const written = Math.round(ramp(frame, WRITE_START, writeEnd, 0, data.files.length))
  const scroll = ramp(
    frame,
    WRITE_START,
    writeEnd,
    0,
    (data.files.length - VISIBLE_LINES) * LINE_PX
  )

  return (
    <Camera from={{ rotateY: -14, scale: 0.94 }} to={{ rotateY: 6, scale: 1 }} frames={duration}>
      <TerminalFrame title={`~/projects/${data.projectName}`}>
        <p className="mb-4 flex justify-between">
          <span>
            <span className="text-primary">✔ </span>Generate
          </span>
          <span className="text-primary tabular-nums">
            {written}
            <span className="text-muted-foreground"> / {data.files.length} files</span>
          </span>
        </p>
        <div className="overflow-hidden" style={{ height: VISIBLE_LINES * LINE_PX }}>
          <div style={{ transform: `translateY(${-scroll}px)` }}>
            {data.files.map((file) => (
              <TreeLine key={file} path={file} />
            ))}
          </div>
        </div>
      </TerminalFrame>
    </Camera>
  )
}
